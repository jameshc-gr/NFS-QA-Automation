#!/usr/bin/env npx ts-node
/**
 * Download/Export iOS Stage .ipa from Xcode
 * 
 * Usage:
 *   npm run download:ios:stage-ipa
 *   MOBILE_IOS_REPO_VERSION=30.3 npm run download:ios:stage-ipa
 */

import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import YAML from 'yaml';

const CONFIG_PATH = 'test-data/mobile-app/gri/ios/config.yml';
const REPO_ROOT = path.resolve(process.cwd(), 'test-data/mobile-app/gri/ios');

interface IOSConfig {
  ios?: {
    artifactRoot?: string;
    repo?: { root: string; folderPrefix: string; projectName: string };
    builds?: Record<string, any>;
  };
}

function findLatestRepoVersion(repoRoot: string, folderPrefix: string): string {
  try {
    const folders = fs.readdirSync(repoRoot).filter(f => {
      const stat = fs.statSync(path.join(repoRoot, f));
      return stat.isDirectory() && f.startsWith(folderPrefix);
    });

    if (folders.length === 0) {
      throw new Error(`No repo folders found matching "${folderPrefix}" in ${repoRoot}`);
    }

    // Sort by version number descending (e.g. SuperApp-iOS-30.3 > SuperApp-iOS-30.2)
    folders.sort((a, b) => {
      const verA = parseFloat(a.replace(folderPrefix + '-', ''));
      const verB = parseFloat(b.replace(folderPrefix + '-', ''));
      return verB - verA;
    });

    const latest = folders[0];
    const version = latest.replace(folderPrefix + '-', '');
    console.log(`[iOS] Found latest repo version: ${version} (${latest})`);
    return version;
  } catch (error) {
    console.error(`Error finding repo version:`, error);
    throw error;
  }
}

function loadConfig(): IOSConfig {
  const configPath = path.resolve(process.cwd(), CONFIG_PATH);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}`);
  }
  return YAML.parse(fs.readFileSync(configPath, 'utf8')) as IOSConfig;
}

async function buildAndExportIPA(): Promise<void> {
  const config = loadConfig();
  const iosConfig = config.ios;

  if (!iosConfig) {
    throw new Error('No ios configuration found in config.yml');
  }

  const repoVersion =
    process.env.MOBILE_IOS_REPO_VERSION ||
    findLatestRepoVersion(
      iosConfig.repo!.root,
      iosConfig.repo!.folderPrefix
    );

  const repoName = `${iosConfig.repo!.folderPrefix}-${repoVersion}`;
  const repoPath = path.join(iosConfig.repo!.root, repoName);

  if (!fs.existsSync(repoPath)) {
    throw new Error(`Repo not found at ${repoPath}`);
  }

  console.log(`\n[iOS] Using repo: ${repoPath}`);
  console.log(`[iOS] Building Stage scheme...`);

  const projectPath = path.join(repoPath, iosConfig.repo!.projectName);
  const archivePath = path.join(
    process.cwd(),
    'mobile/.builds',
    `Rate-Stage-${Date.now()}.xcarchive`
  );

  // Create .builds directory if needed
  fs.mkdirSync(path.dirname(archivePath), { recursive: true });

  // Build archive
  const archiveCmd = [
    'xcodebuild',
    '-scheme "GRI - Stage"',
    '-configuration Release',
    `-archivePath "${archivePath}"`,
    'archive',
  ].join(' ');

  console.log(`[iOS] Executing: ${archiveCmd}`);
  try {
    execSync(archiveCmd, { cwd: repoPath, stdio: 'inherit' });
  } catch (error) {
    throw new Error(`Archive build failed: ${error}`);
  }

  // Export .ipa
  const ipaPath = path.join(
    process.cwd(),
    'mobile/.builds',
    `Rate-Stage-${repoVersion}.ipa`
  );
  const exportPlist = path.join(process.cwd(), 'mobile/.builds', 'ExportOptions.plist');

  // Create minimal export options if not present
  if (!fs.existsSync(exportPlist)) {
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>teamID</key>
  <string>${process.env.MOBILE_IOS_TEAM_ID || '2T4269CK6U'}</string>
  <key>method</key>
  <string>ad-hoc</string>
</dict>
</plist>`;
    fs.writeFileSync(exportPlist, plistContent);
    console.log(`[iOS] Created export options: ${exportPlist}`);
  }

  const exportCmd = [
    'xcodebuild',
    `-exportArchive`,
    `-archivePath "${archivePath}"`,
    `-exportOptionsPlist "${exportPlist}"`,
    `-exportPath "${path.dirname(ipaPath)}"`,
  ].join(' ');

  console.log(`[iOS] Exporting .ipa...`);
  console.log(`[iOS] Executing: ${exportCmd}`);
  try {
    execSync(exportCmd, { stdio: 'inherit' });
  } catch (error) {
    throw new Error(`Export failed: ${error}`);
  }

  // Find the exported .ipa (xcodebuild exports to Payload.ipa by default)
  const defaultIpaPath = path.join(path.dirname(ipaPath), 'Payload.ipa');
  if (fs.existsSync(defaultIpaPath)) {
    fs.renameSync(defaultIpaPath, ipaPath);
    console.log(`\n✅ Stage .ipa ready: ${ipaPath}`);
  } else {
    console.log(`⚠️  Check exports folder: ${path.dirname(ipaPath)}`);
  }
}

buildAndExportIPA().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
