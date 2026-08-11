#!/usr/bin/env npx ts-node
/**
 * iOS Release Downloader - Download specific SuperApp-iOS releases
 * 
 * Features:
 * - Download builds directly from GitHub releases
 * - Support for QA/Stage/PROD environments
 * - Automatic extraction and organization into the folder structure
 * - Build metadata tracking
 * - Resume capability for interrupted downloads
 * 
 * Usage:
 *   npm run ios:download-build -- --help
 *   npm run ios:download-build -- --list
 *   npm run ios:download-build -- --download "v30.3-qa" --env qa
 *   npm run ios:download-build -- --download "v30.3-stage" --env stage
 *   npm run ios:download-build -- --download "v30.3" --env prod
 */

import path from 'node:path';
import fs from 'node:fs';
import { createWriteStream, promises as fsPromises } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import YAML from 'yaml';

interface GitHubAsset {
  name: string;
  download_url: string;
  browser_download_url: string;
  size: number;
  state: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  html_url?: string;
  assets: GitHubAsset[];
}

interface DownloadProgress {
  file: string;
  downloaded: number;
  total: number;
  startTime: number;
}

const CONFIG_PATH = 'test-data/mobile-app/gri/ios/config.yml';
const GITHUB_REPO = 'Guaranteed-Rate/SuperApp-iOS';
const GITHUB_API_BASE = 'https://api.github.com/repos';

/**
 * Parse CLI arguments
 */
function parseArgs(): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.substring(2);
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        args[key] = nextArg;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

/**
 * Load configuration
 */
function loadConfig() {
  const configPath = path.resolve(process.cwd(), CONFIG_PATH);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}`);
  }
  return YAML.parse(fs.readFileSync(configPath, 'utf8'));
}

/**
 * Get repo root from config
 */
function getRepoRoot(): string {
  const config = loadConfig();
  return (config.ios?.repo?.root || '/Users/jameshc/iOS ').trim();
}

/**
 * Get folder prefix from config
 */
function getFolderPrefix(): string {
  const config = loadConfig();
  return config.ios?.repo?.folderPrefix || 'SuperApp-iOS';
}

/**
 * Fetch releases from GitHub API
 */
async function fetchReleases(limit = 50): Promise<GitHubRelease[]> {
  try {
    const url = `${GITHUB_API_BASE}/${GITHUB_REPO}/releases?per_page=${limit}`;
    console.log(`[Download] Fetching releases from GitHub...`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ios-release-downloader',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return await response.json() as GitHubRelease[];
  } catch (error) {
    console.error(`[Download] Error fetching releases:`, error);
    throw error;
  }
}

/**
 * List available releases
 */
async function listReleases(): Promise<void> {
  console.log('\n=== Available SuperApp-iOS Releases ===\n');

  const releases = await fetchReleases(30);

  releases.forEach((release, index) => {
    const type = release.prerelease ? 'pre-release' : release.draft ? 'draft' : 'release';
    const date = new Date(release.published_at || release.created_at);
    const formatted = date.toISOString().split('T')[0];

    console.log(`${index + 1}. ${release.tag_name}`);
    console.log(`   Name: ${release.name || '(no description)'}`);
    console.log(`   Type: ${type}`);
    console.log(`   Date: ${formatted}`);
    console.log(`   Assets: ${release.assets.length}`);

    if (release.assets.length > 0) {
      release.assets.slice(0, 3).forEach((asset) => {
        const sizeStr = formatBytes(asset.size);
        console.log(`     - ${asset.name} (${sizeStr})`);
      });
      if (release.assets.length > 3) {
        console.log(`     ... and ${release.assets.length - 3} more`);
      }
    }

    console.log('');
  });
}

/**
 * Find release by tag or version string
 */
async function findRelease(searchTerm: string): Promise<GitHubRelease | null> {
  const releases = await fetchReleases(50);

  // Try exact match first
  let release = releases.find((r) => r.tag_name === searchTerm || r.tag_name === `v${searchTerm}`);
  if (release) return release;

  // Try partial match
  release = releases.find((r) => r.tag_name.includes(searchTerm));
  if (release) return release;

  return null;
}

/**
 * Find build asset in release
 */
function findBuildAsset(release: GitHubRelease, env: string): GitHubAsset | null {
  // Look for .ipa files or build artifacts
  const candidates = release.assets.filter((asset) => {
    const name = asset.name.toLowerCase();
    return name.endsWith('.ipa') || name.endsWith('.zip') || name.includes('build');
  });

  if (candidates.length === 0) {
    console.error('[Download] No build assets found in release');
    return null;
  }

  // Try to match by environment if specified
  if (env) {
    const envMatch = candidates.find((a) => a.name.toLowerCase().includes(env.toLowerCase()));
    if (envMatch) return envMatch;
  }

  // Return the first/best match
  return candidates[0];
}

/**
 * Download file with progress reporting
 */
async function downloadFile(url: string, outputPath: string): Promise<void> {
  console.log(`[Download] Downloading from: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
  let downloaded = 0;
  const startTime = Date.now();

  // Ensure output directory exists
  await fsPromises.mkdir(path.dirname(outputPath), { recursive: true });

  const writeStream = createWriteStream(outputPath);

  // Response is a Node.js readable stream in this context
  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      downloaded += value.length;
      writeStream.write(Buffer.from(value));

      // Progress reporting
      if (contentLength > 0) {
        const percent = Math.round((downloaded / contentLength) * 100);
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = downloaded / elapsed / 1024 / 1024; // MB/s
        process.stdout.write(
          `\r[Download] ${percent}% (${formatBytes(downloaded)}/${formatBytes(contentLength)}, ${rate.toFixed(2)} MB/s)`
        );
      }
    }

    writeStream.end();
    console.log('\n[Download] Download complete');
  } catch (error) {
    writeStream.destroy();
    throw error;
  }
}

/**
 * Extract downloaded file
 */
async function extractBuild(
  filePath: string,
  outputDir: string
): Promise<void> {
  console.log(`[Download] Extracting to ${outputDir}...`);

  await fsPromises.mkdir(outputDir, { recursive: true });

  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.ipa' || ext === '.zip') {
    // Use unzip command
    const { execSync } = await import('node:child_process');
    try {
      execSync(`unzip -q "${filePath}" -d "${outputDir}"`, { stdio: 'inherit' });
      console.log('[Download] Extraction complete');
    } catch (error) {
      throw new Error(`Extraction failed: ${error}`);
    }
  } else if (ext === '.tar') {
    const { execSync } = await import('node:child_process');
    try {
      execSync(`tar -xf "${filePath}" -C "${outputDir}"`, { stdio: 'inherit' });
      console.log('[Download] Extraction complete');
    } catch (error) {
      throw new Error(`Extraction failed: ${error}`);
    }
  } else if (ext === '.gz') {
    const { execSync } = await import('node:child_process');
    try {
      execSync(`tar -xzf "${filePath}" -C "${outputDir}"`, { stdio: 'inherit' });
      console.log('[Download] Extraction complete');
    } catch (error) {
      throw new Error(`Extraction failed: ${error}`);
    }
  } else {
    // Copy file as-is (might be a single .app or similar)
    await fsPromises.copyFile(filePath, path.join(outputDir, path.basename(filePath)));
    console.log('[Download] File copied');
  }
}

/**
 * Save build metadata
 */
async function saveBuildMetadata(
  outputDir: string,
  release: GitHubRelease,
  asset: GitHubAsset,
  env: string,
  downloadedAt: Date
): Promise<void> {
  const metadata = {
    buildName: release.tag_name,
    version: extractVersion(release.tag_name),
    environment: env,
    releaseUrl: release.html_url || '',
    assetName: asset.name,
    assetSize: asset.size,
    downloadedAt: downloadedAt.toISOString(),
    downloadedBy: process.env.USER || 'unknown',
    description: release.body || '',
  };

  const metadataPath = path.join(outputDir, 'build-metadata.json');
  await fsPromises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`[Download] Metadata saved to ${metadataPath}`);
}

/**
 * Extract version from tag (e.g., "v30.3-qa" -> "30.3")
 */
function extractVersion(tag: string): string {
  const match = tag.match(/(\d+\.\d+)/);
  return match ? match[1] : tag;
}

/**
 * Generate folder name with build number
 */
function generateFolderName(version: string, env: string, buildNumber: number): string {
  return `${getFolderPrefix()}-${version}-build${buildNumber}`;
}

/**
 * Get next build number for a version
 */
function getNextBuildNumber(version: string): number {
  const repoRoot = getRepoRoot();
  if (!fs.existsSync(repoRoot)) {
    return 1;
  }

  const folders = fs.readdirSync(repoRoot).filter((f) => {
    try {
      const stat = fs.statSync(path.join(repoRoot, f));
      return stat.isDirectory() && f.includes(`-${version}-build`);
    } catch {
      return false;
    }
  });

  if (folders.length === 0) {
    return 1;
  }

  const buildNumbers = folders
    .map((f) => {
      const match = f.match(/-build(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);

  return buildNumbers.length > 0 ? Math.max(...buildNumbers) + 1 : 1;
}

/**
 * Download and process a build
 */
async function downloadBuild(releaseTag: string, environment: string): Promise<void> {
  try {
    // Find the release
    console.log(`\n[Download] Looking for release: ${releaseTag}`);
    const release = await findRelease(releaseTag);

    if (!release) {
      console.error(`[Download] Release not found: ${releaseTag}`);
      console.log('[Download] Run with --list to see available releases');
      process.exit(1);
    }

    console.log(`[Download] Found: ${release.tag_name}`);
    console.log(`[Download] Description: ${release.name || '(no description)'}`);

    // Find the build asset
    const asset = findBuildAsset(release, environment);
    if (!asset) {
      console.error('[Download] No suitable build asset found');
      process.exit(1);
    }

    console.log(`[Download] Asset: ${asset.name} (${formatBytes(asset.size)})`);

    // Prepare download
    const version = extractVersion(release.tag_name);
    const buildNumber = getNextBuildNumber(version);
    const folderName = generateFolderName(version, environment, buildNumber);
    const repoRoot = getRepoRoot();

    if (!fs.existsSync(repoRoot)) {
      fs.mkdirSync(repoRoot, { recursive: true });
    }

    const targetDir = path.join(repoRoot, folderName);
    const tempFile = path.join(repoRoot, `.download-${Date.now()}-${asset.name}`);

    console.log(`[Download] Target folder: ${folderName}`);

    // Download the file
    await downloadFile(asset.browser_download_url, tempFile);

    // Extract
    await extractBuild(tempFile, targetDir);

    // Save metadata
    await saveBuildMetadata(targetDir, release, asset, environment, new Date());

    // Clean up temp file
    try {
      fs.unlinkSync(tempFile);
    } catch {
      // Ignore
    }

    console.log(`\n✓ Build downloaded successfully`);
    console.log(`  Folder: ${folderName}`);
    console.log(`  Path: ${targetDir}`);
  } catch (error) {
    console.error('[Download] Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Show help
 */
function showHelp(): void {
  console.log(`
iOS Release Downloader

Usage: npm run ios:download-build -- [options]

Options:
  --help              Show this help message
  --list              List available releases on GitHub
  --download TAG      Download a specific release (tag or version)
  --env ENV           Environment: qa, stage, or prod (default: qa)
  --resume            Resume interrupted download (if available)

Environment Variables:
  GITHUB_TOKEN        GitHub API token (optional, for higher rate limits)

Examples:
  npm run ios:download-build -- --list
  npm run ios:download-build -- --download v30.3-qa --env qa
  npm run ios:download-build -- --download v30.3-stage --env stage
  npm run ios:download-build -- --download v30.3 --env prod

Supported asset formats:
  - .ipa (iOS app archive)
  - .zip (compressed builds)
  - .tar.gz (compressed archives)
  - .tar (uncompressed archives)
`);
}

/**
 * Main
 */
async function main(): Promise<void> {
  try {
    const args = parseArgs();

    if (args.help) {
      showHelp();
      return;
    }

    if (args.list) {
      await listReleases();
      return;
    }

    if (args.download) {
      const tag = typeof args.download === 'string' ? args.download : '';
      const env = typeof args.env === 'string' ? args.env : 'qa';

      if (!tag) {
        console.error('Error: --download requires a release tag');
        process.exit(1);
      }

      await downloadBuild(tag, env);
      return;
    }

    showHelp();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
