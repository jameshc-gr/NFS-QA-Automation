#!/usr/bin/env npx ts-node
/**
 * iOS Build Manager - Clone, manage, and download SuperApp-iOS builds
 * 
 * Features:
 * - Clone/update the SuperApp-iOS repository
 * - Manage multiple versions with naming format: SuperApp-iOS-30.X-buildXXX
 * - Support QA/Stage/PROD environments
 * - List available tags/releases
 * - Checkout specific builds
 * - Clean up old builds
 * 
 * Usage:
 *   npm run ios:build-manager -- --help
 *   npm run ios:build-manager -- --list-releases
 *   npm run ios:build-manager -- --clone-version 30.3
 *   npm run ios:build-manager -- --checkout-build qa-30.3-build1204
 *   npm run ios:build-manager -- --list-local
 *   npm run ios:build-manager -- --cleanup --keep 3
 */

import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import YAML from 'yaml';

interface GitHubRelease {
  tag_name: string;
  name: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  assets: Array<{
    name: string;
    url: string;
    download_count: number;
  }>;
}

interface BuildInfo {
  version: string;
  environment: 'qa' | 'stage' | 'prod';
  buildNumber: number;
  branch: string;
  clonedAt: string;
}

interface IOSConfig {
  ios?: {
    repo?: {
      root: string;
      folderPrefix: string;
      projectName: string;
      gitUrl?: string;
    };
  };
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
function loadConfig(): IOSConfig {
  const configPath = path.resolve(process.cwd(), CONFIG_PATH);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}`);
  }
  return YAML.parse(fs.readFileSync(configPath, 'utf8')) as IOSConfig;
}

/**
 * Get repo root from config or environment
 */
function getRepoRoot(): string {
  const config = loadConfig();
  const repoRoot = config.ios?.repo?.root || '/Users/jameshc/iOS '; // Note: trailing space in original config
  return repoRoot.trim(); // Remove trailing space for actual filesystem operations
}

/**
 * Get folder prefix from config
 */
function getFolderPrefix(): string {
  const config = loadConfig();
  return config.ios?.repo?.folderPrefix || 'SuperApp-iOS';
}

/**
 * Get GitHub repo URL from config or default
 */
function getGitHubRepoUrl(): string {
  const config = loadConfig();
  return config.ios?.repo?.gitUrl || `https://github.com/${GITHUB_REPO}.git`;
}

/**
 * Ensure repo root directory exists
 */
function ensureRepoRootExists(): string {
  const repoRoot = getRepoRoot();
  if (!fs.existsSync(repoRoot)) {
    console.log(`[iOS] Creating repo root directory: ${repoRoot}`);
    fs.mkdirSync(repoRoot, { recursive: true });
  }
  return repoRoot;
}

/**
 * Parse build folder name to extract version and build info
 * Format: SuperApp-iOS-30.X-buildXXX
 */
function parseBuildFolder(folderName: string): {
  version: string;
  buildNumber: number;
} | null {
  const prefix = getFolderPrefix();
  if (!folderName.startsWith(prefix)) return null;

  const match = folderName.match(new RegExp(`${prefix}-(.+?)-build(\\d+)`));
  if (match) {
    return {
      version: match[1],
      buildNumber: parseInt(match[2], 10),
    };
  }
  return null;
}

/**
 * Generate folder name from version and build info
 * Format: SuperApp-iOS-30.X-buildXXX
 */
function generateFolderName(version: string, buildNumber: number): string {
  return `${getFolderPrefix()}-${version}-build${buildNumber}`;
}

/**
 * Fetch releases from GitHub API
 */
async function fetchGitHubReleases(
  limit = 20
): Promise<GitHubRelease[]> {
  try {
    const url = `${GITHUB_API_BASE}/${GITHUB_REPO}/releases?per_page=${limit}`;
    console.log(`[iOS] Fetching releases from ${url}...`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ios-build-manager',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const releases = await response.json() as GitHubRelease[];
    console.log(`[iOS] Found ${releases.length} releases`);
    return releases;
  } catch (error) {
    console.error(`[iOS] Error fetching releases:`, error);
    return [];
  }
}

/**
 * Fetch GitHub tags (branches/release candidates)
 */
async function fetchGitHubTags(limit = 50): Promise<Array<{
  name: string;
  commit: { sha: string };
}>> {
  try {
    const url = `${GITHUB_API_BASE}/${GITHUB_REPO}/tags?per_page=${limit}`;
    console.log(`[iOS] Fetching tags from ${url}...`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ios-build-manager',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const tags = await response.json() as Array<{ name: string; commit: { sha: string } }>;
    console.log(`[iOS] Found ${tags.length} tags`);
    return tags;
  } catch (error) {
    console.error(`[iOS] Error fetching tags:`, error);
    return [];
  }
}

/**
 * List available releases from GitHub
 */
async function listReleases(): Promise<void> {
  console.log('\n=== GitHub SuperApp-iOS Releases ===\n');

  const releases = await fetchGitHubReleases(20);
  if (releases.length === 0) {
    console.log('No releases found or unable to access GitHub API');
    return;
  }

  releases.forEach((release, index) => {
    const type = release.prerelease ? 'pre-release' : release.draft ? 'draft' : 'release';
    const date = new Date(release.published_at || release.created_at);
    const formatted = date.toISOString().split('T')[0];

    console.log(`${index + 1}. ${release.tag_name}`);
    console.log(`   Name: ${release.name || '(no description)'}`);
    console.log(`   Type: ${type}`);
    console.log(`   Date: ${formatted}`);
    console.log(`   Assets: ${release.assets.length}`);
    console.log('');
  });

  // Also list tags
  const tags = await fetchGitHubTags(20);
  if (tags.length > 0) {
    console.log('=== Recent Tags ===\n');
    tags.slice(0, 10).forEach((tag) => {
      console.log(`- ${tag.name} (${tag.commit.sha.substring(0, 7)})`);
    });
    console.log('');
  }
}

/**
 * List local cloned builds
 */
function listLocalBuilds(): void {
  console.log('\n=== Local iOS Builds ===\n');

  const repoRoot = getRepoRoot();
  if (!fs.existsSync(repoRoot)) {
    console.log(`No builds found. Repo root does not exist: ${repoRoot}`);
    return;
  }

  const folders = fs.readdirSync(repoRoot).filter((f) => {
    const stat = fs.statSync(path.join(repoRoot, f));
    return stat.isDirectory() && f.startsWith(getFolderPrefix());
  });

  if (folders.length === 0) {
    console.log('No builds found');
    return;
  }

  // Sort by date modified, newest first
  const withStats = folders
    .map((f) => ({
      name: f,
      path: path.join(repoRoot, f),
      mtime: fs.statSync(path.join(repoRoot, f)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  console.log(`Total: ${folders.length} builds\n`);

  withStats.forEach((build, index) => {
    const parsed = parseBuildFolder(build.name);
    const date = build.mtime.toISOString().split('T')[0];
    const size = getDirectorySize(build.path);

    console.log(`${index + 1}. ${build.name}`);
    if (parsed) {
      console.log(`   Version: ${parsed.version}`);
      console.log(`   Build #: ${parsed.buildNumber}`);
    }
    console.log(`   Modified: ${date}`);
    console.log(`   Size: ${formatBytes(size)}`);

    // Check for build-info.json
    const buildInfoPath = path.join(build.path, 'build-info.json');
    if (fs.existsSync(buildInfoPath)) {
      try {
        const info = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
        console.log(`   Git Branch: ${info.gitBranch || 'unknown'}`);
        console.log(`   Git Commit: ${info.gitCommit ? info.gitCommit.substring(0, 7) : 'unknown'}`);
      } catch {
        // Ignore
      }
    }

    console.log('');
  });
}

/**
 * Clone or fetch the SuperApp-iOS repository
 */
function cloneOrUpdateRepo(tag?: string): string {
  const repoRoot = ensureRepoRootExists();
  const gitUrl = getGitHubRepoUrl();

  // If tag specified, use specific folder format with build number
  // Otherwise, determine build number based on existing local builds
  let targetFolder = `${getFolderPrefix()}-main`;
  let checkoutRef = 'main';

  if (tag) {
    // Extract version from tag (e.g., "release-30.3" -> "30.3")
    const versionMatch = tag.match(/(\d+\.\d+)/);
    if (versionMatch) {
      const version = versionMatch[1];
      const buildNumber = getNextBuildNumber(version);
      targetFolder = generateFolderName(version, buildNumber);
      checkoutRef = tag;
    } else {
      throw new Error(`Cannot extract version from tag: ${tag}`);
    }
  }

  const targetPath = path.join(repoRoot, targetFolder);

  if (fs.existsSync(targetPath)) {
    console.log(`[iOS] Repository already exists at ${targetPath}`);
    console.log(`[iOS] Updating to latest...`);
    try {
      execSync(`git fetch origin && git checkout ${checkoutRef}`, {
        cwd: targetPath,
        stdio: 'inherit',
      });
      console.log(`[iOS] Repository updated successfully`);
    } catch (error) {
      throw new Error(`Failed to update repository: ${error}`);
    }
  } else {
    console.log(`[iOS] Cloning repository to ${targetPath}...`);
    try {
      execSync(`git clone --depth 1 ${gitUrl} "${targetPath}"`, { stdio: 'inherit' });

      if (checkoutRef && checkoutRef !== 'main') {
        console.log(`[iOS] Checking out ${checkoutRef}...`);
        execSync(`git checkout ${checkoutRef}`, {
          cwd: targetPath,
          stdio: 'inherit',
        });
      }

      console.log(`[iOS] Repository cloned successfully`);
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error}`);
    }
  }

  return targetPath;
}

/**
 * Get the next build number for a version
 */
function getNextBuildNumber(version: string): number {
  const repoRoot = getRepoRoot();
  if (!fs.existsSync(repoRoot)) {
    return 1;
  }

  const folders = fs.readdirSync(repoRoot).filter((f) => {
    const stat = fs.statSync(path.join(repoRoot, f));
    return stat.isDirectory() && f.includes(`-${version}-build`);
  });

  if (folders.length === 0) {
    return 1;
  }

  // Extract build numbers and find the highest
  const buildNumbers = folders
    .map((f) => {
      const match = f.match(/-build(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);

  return buildNumbers.length > 0 ? Math.max(...buildNumbers) + 1 : 1;
}

/**
 * Checkout a specific build
 */
function checkoutBuild(buildSpec: string): void {
  const repoRoot = getRepoRoot();

  // Try to find matching build folder
  const folders = fs.readdirSync(repoRoot).filter((f) => {
    const stat = fs.statSync(path.join(repoRoot, f));
    return stat.isDirectory() && f.includes(buildSpec);
  });

  if (folders.length === 0) {
    console.error(`[iOS] No build found matching: ${buildSpec}`);
    console.log('[iOS] Available builds:');
    listLocalBuilds();
    process.exit(1);
  }

  if (folders.length > 1) {
    console.error(`[iOS] Multiple builds match: ${buildSpec}`);
    folders.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }

  const targetBuild = folders[0];
  const targetPath = path.join(repoRoot, targetBuild);

  console.log(`[iOS] Selected build: ${targetBuild}`);
  console.log(`[iOS] Path: ${targetPath}`);

  // Write build-selection file for other scripts to use
  const selectionFile = path.join(repoRoot, '.current-build');
  fs.writeFileSync(selectionFile, targetBuild);
  console.log(`[iOS] Saved to ${selectionFile}`);
}

/**
 * Clean up old builds
 */
function cleanupBuilds(keepCount: number): void {
  const repoRoot = getRepoRoot();
  if (!fs.existsSync(repoRoot)) {
    console.log('No builds to clean up');
    return;
  }

  const folders = fs.readdirSync(repoRoot)
    .filter((f) => {
      const stat = fs.statSync(path.join(repoRoot, f));
      return stat.isDirectory() && f.startsWith(getFolderPrefix());
    })
    .map((f) => ({
      name: f,
      path: path.join(repoRoot, f),
      mtime: fs.statSync(path.join(repoRoot, f)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  if (folders.length <= keepCount) {
    console.log(`[iOS] Only ${folders.length} build(s) exist. Nothing to clean up.`);
    return;
  }

  const toDelete = folders.slice(keepCount);
  console.log(`[iOS] Keeping ${keepCount} newest build(s), deleting ${toDelete.length}...`);

  toDelete.forEach((build) => {
    console.log(`[iOS] Deleting ${build.name} (${formatBytes(getDirectorySize(build.path))})`);
    try {
      execSync(`rm -rf "${build.path}"`, { stdio: 'inherit' });
    } catch (error) {
      console.error(`[iOS] Failed to delete ${build.path}:`, error);
    }
  });

  console.log('[iOS] Cleanup complete');
}

/**
 * Get directory size in bytes
 */
function getDirectorySize(dirPath: string): number {
  let size = 0;

  function walk(filePath: string) {
    try {
      const files = fs.readdirSync(filePath);
      files.forEach((file) => {
        const fullPath = path.join(filePath, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else {
          size += stat.size;
        }
      });
    } catch {
      // Skip errors
    }
  }

  walk(dirPath);
  return size;
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
 * Display help
 */
function showHelp(): void {
  console.log(`
iOS Build Manager

Usage: npm run ios:build-manager -- [options]

Options:
  --help              Show this help message
  --list-releases     List available releases from GitHub
  --list-local        List locally cloned builds
  --clone [tag]       Clone/fetch the repository (optionally checkout specific tag)
                      Examples: --clone, --clone release-30.3
  --checkout [spec]   Select a local build for use
                      Example: --checkout 30.3-build1
  --cleanup [keep]    Remove old builds, keeping N most recent (default: 3)
                      Example: --cleanup 5
  --info              Show build manager info

Environment Variables:
  MOBILE_IOS_REPO_VERSION   Force specific version (e.g., "30.3")
  MOBILE_IOS_BUILD          Build name to use
  
Examples:
  npm run ios:build-manager -- --list-releases
  npm run ios:build-manager -- --clone release-30.3
  npm run ios:build-manager -- --list-local
  npm run ios:build-manager -- --checkout 30.3-build1
  npm run ios:build-manager -- --cleanup 5
`);
}

/**
 * Show info about the build manager configuration
 */
function showInfo(): void {
  console.log('\n=== iOS Build Manager Configuration ===\n');
  const config = loadConfig();
  const repoRoot = getRepoRoot();
  const folderPrefix = getFolderPrefix();
  const gitUrl = getGitHubRepoUrl();

  console.log(`Repo Root: ${repoRoot}`);
  console.log(`Folder Prefix: ${folderPrefix}`);
  console.log(`GitHub URL: ${gitUrl}`);
  console.log(`Config Path: ${CONFIG_PATH}`);
  console.log(`\nExample folder names:`);
  console.log(`  - ${generateFolderName('30.3', 1)}`);
  console.log(`  - ${generateFolderName('30.3', 2)}`);
  console.log(`  - ${generateFolderName('31.0', 1)}`);
  console.log('');
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

    if (args.info) {
      showInfo();
      return;
    }

    if (args['list-releases']) {
      await listReleases();
      return;
    }

    if (args['list-local']) {
      listLocalBuilds();
      return;
    }

    if (args.clone !== undefined) {
      const tag = typeof args.clone === 'string' ? args.clone : undefined;
      const repoPath = cloneOrUpdateRepo(tag);
      console.log(`\n✓ Repository ready at: ${repoPath}`);
      return;
    }

    if (args.checkout !== undefined) {
      const spec = typeof args.checkout === 'string' ? args.checkout : '';
      if (!spec) {
        console.error('[iOS] Error: --checkout requires a build specification');
        process.exit(1);
      }
      checkoutBuild(spec);
      return;
    }

    if (args.cleanup !== undefined) {
      const keepStr = typeof args.cleanup === 'string' ? args.cleanup : '3';
      const keep = parseInt(keepStr, 10);
      if (isNaN(keep) || keep < 1) {
        console.error('[iOS] Error: --cleanup requires a valid number >= 1');
        process.exit(1);
      }
      cleanupBuilds(keep);
      return;
    }

    // Default: show help
    showHelp();
  } catch (error) {
    console.error(`\n[iOS] Error:`, error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
