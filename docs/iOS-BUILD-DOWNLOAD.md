# iOS Build Download & Management

This document describes the iOS build download and management mechanism for the SuperApp-iOS project. It provides a centralized approach to managing multiple iOS builds for QA, Stage, and Production environments.

## Overview

The iOS build management system provides:

- **Centralized Storage**: All iOS builds are stored in `/Users/jameshc/iOS` (this is the only location for iOS clones/builds)
- **Consistent Naming**: Builds follow the format `SuperApp-iOS-30.X-buildXXX`
- **Multi-Environment Support**: Manage builds for QA, Stage, and PROD environments
- **GitHub Integration**: Download releases directly from the SuperApp-iOS GitHub repository
- **Build Metadata**: Each build includes metadata tracking version, environment, and download information
- **Easy Cleanup**: Built-in tools to manage disk space by removing old builds

## Architecture

```
/Users/jameshc/iOS                    # Repository root (configured in config.yml)
├── SuperApp-iOS-30.0-build1          # QA build for version 30.0
│   ├── SuperApp.xcodeproj
│   ├── .git                          # Git history
│   ├── build-info.json               # Build metadata
│   └── ...
├── SuperApp-iOS-30.3-build1          # Stage build for version 30.3
│   └── ...
├── SuperApp-iOS-30.3-build2          # Prod build for version 30.3
│   └── ...
└── .current-build                    # Marker file for current active build
```

## Build Folder Naming

Builds follow this naming convention: **`SuperApp-iOS-VERSION-buildBUILDNUMBER`**

Examples:
- `SuperApp-iOS-30.0-build1` - First build of version 30.0
- `SuperApp-iOS-30.3-build1` - First build of version 30.3
- `SuperApp-iOS-30.3-build2` - Second build of version 30.3
- `SuperApp-iOS-31.0-build1` - First build of version 31.0

## Quick Start

### List Available Releases

See all available releases from GitHub:

```bash
npm run ios:list-releases
```

### Clone Repository

Clone the SuperApp-iOS repository (gets latest main branch):

```bash
npm run ios:clone
```

Clone a specific release/tag:

```bash
npm run ios:clone -- --clone release-30.3
npm run ios:clone -- --clone v30.3-qa
```

### Download Build from Release

Download a specific release build:

```bash
# QA environment
npm run ios:download-build:qa -- --download v30.3-qa

# Stage environment
npm run ios:download-build:stage -- --download v30.3-stage

# Production environment
npm run ios:download-build:prod -- --download v30.3
```

### List Local Builds

See all builds currently stored locally:

```bash
npm run ios:list-builds
```

Output example:

```
=== Local iOS Builds ===

Total: 3 builds

1. SuperApp-iOS-30.0-build1
   Version: 30.0
   Build #: 1
   Modified: 2026-08-10
   Size: 2.45 GB
   Git Branch: main
   Git Commit: a1b2c3d

2. SuperApp-iOS-30.3-build1
   Version: 30.3
   Build #: 1
   Modified: 2026-08-09
   Size: 2.51 GB
   Git Branch: release-30.3
   Git Commit: e4f5g6h
```

### Clean Up Old Builds

Remove old builds, keeping only the N most recent:

```bash
# Keep only 3 most recent builds (deletes older ones)
npm run ios:build-manager -- --cleanup 3

# Keep 5 most recent builds
npm run ios:build-manager -- --cleanup 5
```

## Detailed Usage

### iOS Build Manager

The main build manager script handles repository cloning, version management, and local build organization.

```bash
# Show help
npm run ios:build-manager -- --help

# List available GitHub releases
npm run ios:build-manager -- --list-releases

# List local builds
npm run ios:build-manager -- --list-local

# Clone/update repository
npm run ios:build-manager -- --clone
npm run ios:build-manager -- --clone release-30.3

# Select a local build for use
npm run ios:build-manager -- --checkout 30.3-build1

# Clean up old builds
npm run ios:build-manager -- --cleanup 3

# Show configuration
npm run ios:build-manager -- --info
```

### iOS Release Downloader

Download specific builds from GitHub releases with automatic extraction and metadata tracking.

```bash
# Show help
npm run ios:download-build -- --help

# List available releases
npm run ios:download-build -- --list

# Download specific release (QA)
npm run ios:download-build -- --download v30.3-qa --env qa

# Download specific release (Stage)
npm run ios:download-build -- --download v30.3-stage --env stage

# Download specific release (Prod)
npm run ios:download-build -- --download v30.3 --env prod

# Download with automatic format detection
npm run ios:download-build:qa -- --download v30.3-qa
npm run ios:download-build:stage -- --download v30.3-stage
npm run ios:download-build:prod -- --download v30.3
```

## Environment Configuration

The iOS build system is configured in `test-data/mobile-app/gri/ios/config.yml`:

```yaml
ios:
  repo:
    root: /Users/jameshc/iOS           # Clone location (ONLY location)
    folderPrefix: SuperApp-iOS          # Folder name prefix
    projectName: SuperApp.xcodeproj     # Xcode project name
    gitUrl: https://github.com/Guaranteed-Rate/SuperApp-iOS.git
```

**Important**: Do not change the `root` path. All iOS clones must go to `/Users/jameshc/iOS`.

## Build Selection and Usage

### Current Build Marker

When you checkout a build using `--checkout`, a `.current-build` file is created in the repo root:

```
/Users/jameshc/iOS/.current-build
```

Contents: `SuperApp-iOS-30.3-build1`

This marker can be used by other scripts and automation to know which build is currently selected.

### Configuration Reference

After cloning/downloading, builds can be referenced in test configurations:

```bash
# Use specific cloned version for Xcode builds
MOBILE_IOS_REPO_VERSION=30.3 npm run test:mobile:ios:create-account:qa-xcode

# Use specific build for testing
MOBILE_IOS_BUILD=qa-simulator npm run test:mobile:ios:login-logout
```

## Common Workflows

### Workflow 1: Clone Latest and Test

```bash
# Clone latest from main branch
npm run ios:clone

# List what was cloned
npm run ios:list-builds

# Run tests (uses latest cloned version)
npm run test:mobile:ios:create-account:qa-xcode
```

### Workflow 2: Download Specific QA Release

```bash
# List available releases to find the right one
npm run ios:download-build -- --list

# Download a specific QA release
npm run ios:download-build:qa -- --download v30.3-qa

# List local builds to see the new one
npm run ios:list-builds

# Use it for testing
MOBILE_IOS_BUILD=qa-simulator npm run test:mobile:ios:login-logout
```

### Workflow 3: Manage Multiple Versions

```bash
# Clone QA version 30.0
npm run ios:clone -- --clone release-30.0

# Clone Stage version 30.3
npm run ios:clone -- --clone release-30.3-stage

# Clone Prod version 30.3
npm run ios:clone -- --clone release-30.3

# List all
npm run ios:list-builds

# Clean up, keeping only 3 most recent
npm run ios:build-manager -- --cleanup 3
```

### Workflow 4: Download from GitHub Releases

```bash
# See what's available on GitHub
npm run ios:download-build -- --list

# Download QA build with assets
npm run ios:download-build:qa -- --download v30.3-qa

# Download Stage build with assets  
npm run ios:download-build:stage -- --download v30.3-stage

# Download Prod build with assets
npm run ios:download-build:prod -- --download v30.3

# All builds are now available locally
npm run ios:list-builds

# Select one for use
npm run ios:build-manager -- --checkout 30.3-build1
```

## Build Metadata

Each downloaded build includes a `build-metadata.json` file with:

```json
{
  "buildName": "v30.3-qa",
  "version": "30.3",
  "environment": "qa",
  "releaseUrl": "https://github.com/Guaranteed-Rate/SuperApp-iOS/releases/tag/v30.3-qa",
  "assetName": "GRI-QA-30.3.ipa",
  "assetSize": 187392000,
  "downloadedAt": "2026-08-10T14:23:45.123Z",
  "downloadedBy": "jameshc",
  "description": "QA build for version 30.3"
}
```

This metadata helps track:
- Which GitHub release each build came from
- When it was downloaded
- What environment it's for
- The original asset name and size

## Troubleshooting

### Issue: GitHub API Rate Limiting

If you hit GitHub API rate limits (typically 60 requests/hour for unauthenticated access):

```bash
# Set GitHub token to increase limit (5000 requests/hour)
export GITHUB_TOKEN=your_github_token
npm run ios:download-build -- --list
```

To generate a token:
1. Go to https://github.com/settings/tokens
2. Create a new token with `public_repo` scope
3. Use it: `export GITHUB_TOKEN=token_value`

### Issue: No Suitable Build Asset Found

If the downloader can't find a compatible build in a release:

1. Check the release on GitHub: https://github.com/Guaranteed-Rate/SuperApp-iOS/releases
2. Verify assets are included (.ipa, .zip, or .tar.gz files)
3. Specify environment explicitly: `--env qa` or `--env prod`

### Issue: Disk Space

Check local build sizes:

```bash
npm run ios:list-builds

# Clean up old builds to free space
npm run ios:build-manager -- --cleanup 2  # Keep only 2 most recent
```

### Issue: Clone/Fetch Fails

If git operations fail:

```bash
# Check if repo root exists
ls -la /Users/jameshc/iOS

# Manually create if needed
mkdir -p "/Users/jameshc/iOS"

# Try clone again
npm run ios:clone
```

## Environment Variables

Configure behavior with environment variables:

| Variable | Purpose | Example |
|----------|---------|---------|
| `MOBILE_IOS_REPO_VERSION` | Pin specific cloned version | `30.3` |
| `MOBILE_IOS_BUILD` | Select build for tests | `qa-simulator` |
| `GITHUB_TOKEN` | Increase API rate limits | `ghp_...` |
| `MOBILE_IOS_TEAM_ID` | Xcode team ID for signing | `2T4269CK6U` |

Example usage:

```bash
MOBILE_IOS_REPO_VERSION=30.3 npm run test:mobile:ios:create-account:qa-xcode
MOBILE_IOS_BUILD=stage-simulator npm run test:mobile:ios:login-logout
GITHUB_TOKEN=ghp_xxx npm run ios:list-releases
```

## Integration with CI/CD

For GitHub Actions workflows, integrate build download:

```yaml
- name: Clone iOS Repository
  run: npm run ios:clone -- --clone release-30.3

- name: List Available Builds
  run: npm run ios:list-builds

- name: Run iOS Tests
  run: MOBILE_IOS_REPO_VERSION=30.3 npm run test:mobile:ios:create-account:qa-xcode

- name: Cleanup Old Builds
  run: npm run ios:build-manager -- --cleanup 3
```

## Recommended Practices

1. **Always specify version**: `npm run ios:clone -- --clone release-30.3` instead of just `npm run ios:clone`

2. **Keep builds organized**: Use meaningful version numbers that match release tags

3. **Regular cleanup**: Run `npm run ios:build-manager -- --cleanup 3` weekly to manage disk space

4. **Document custom builds**: If you modify a cloned build for testing, note it in `build-metadata.json`

5. **Use checkouts**: Select a specific build with `--checkout` before long test runs

6. **Track downloads**: Check `build-metadata.json` to know which releases are available locally

## Folder Structure Location

**Important**: The folder structure MUST be:

```
/Users/jameshc/iOS/
├── SuperApp-iOS-30.X-buildXXX/
├── SuperApp-iOS-30.Y-buildXXX/
└── ...
```

This location is configured in `test-data/mobile-app/gri/ios/config.yml` as:

```yaml
ios:
  repo:
    root: /Users/jameshc/iOS
```

Do not change this path. It is the single source of truth for iOS build storage.

## Related Documentation

- [README](../../../readme.md) - Main project documentation
- [config.yml](./config.yml) - iOS configuration file
- [MOBILE-UI-VERIFICATION.md](../../../api/MOBILE-UI-VERIFICATION.md) - Mobile testing procedures
- [SuperApp-iOS GitHub](https://github.com/Guaranteed-Rate/SuperApp-iOS) - Source repository
