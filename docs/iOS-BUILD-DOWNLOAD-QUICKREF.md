# iOS Build Download - Quick Reference

## Installation & Setup

Everything is pre-configured in the codebase. No additional setup required.

**Repo Location**: `/Users/jameshc/iOS` (configured in `test-data/mobile-app/gri/ios/config.yml`)

**Folder Format**: `SuperApp-iOS-30.X-buildXXX`

## Essential Commands

```bash
# See what's on GitHub
npm run ios:list-releases

# See what's local
npm run ios:list-builds

# Clone/fetch repository
npm run ios:clone

# Clone specific tag
npm run ios:clone -- --clone release-30.3

# Download QA build from GitHub
npm run ios:download-build:qa -- --download v30.3-qa

# Download Stage build from GitHub
npm run ios:download-build:stage -- --download v30.3-stage

# Download Prod build from GitHub
npm run ios:download-build:prod -- --download v30.3

# Select a build for use
npm run ios:build-manager -- --checkout 30.3-build1

# Clean up old builds (keep 3 newest)
npm run ios:build-manager -- --cleanup 3
```

## Environment Matrix

| Environment | Clone Command | Download Command | Bundle ID | Build Type |
|-------------|---------------|------------------|-----------|-----------|
| QA | `--clone release-30.3-qa` | `--download v30.3-qa --env qa` | `com.guaranteedrate.superapp.qa` | .ipa |
| Stage | `--clone release-30.3-stage` | `--download v30.3-stage --env stage` | `com.guaranteedrate.superapp.stage` | .ipa |
| Prod | `--clone release-30.3` | `--download v30.3 --env prod` | `com.guaranteedrate.superapp` | .ipa |

## Folder Structure After Download

```
/Users/jameshc/iOS/
├── SuperApp-iOS-30.3-build1/      # First QA build
│   ├── SuperApp.xcodeproj
│   ├── .git
│   ├── build-metadata.json
│   └── Pods
├── SuperApp-iOS-30.3-build2/      # Second Stage build
│   └── ...
└── .current-build                 # Current selection marker
```

## Using Downloaded Builds in Tests

Once downloaded, reference in tests:

```bash
# Use specific version for Xcode builds
MOBILE_IOS_REPO_VERSION=30.3 npm run test:mobile:ios:create-account:qa-xcode

# Or use build name directly
MOBILE_IOS_BUILD=qa-simulator npm run test:mobile:ios:login-logout
```

## Helpful Info

- **GitHub Repo**: https://github.com/Guaranteed-Rate/SuperApp-iOS
- **Config File**: `test-data/mobile-app/gri/ios/config.yml`
- **Documentation**: `docs/iOS-BUILD-DOWNLOAD.md`
- **Scripts Location**: `scripts/ios-build-manager.ts` and `scripts/ios-release-downloader.ts`

## Typical Workflow

1. Check what's available: `npm run ios:list-releases`
2. Download desired version: `npm run ios:download-build:qa -- --download v30.3-qa`
3. Verify local: `npm run ios:list-builds`
4. Run tests: `MOBILE_IOS_REPO_VERSION=30.3 npm run test:mobile:ios:create-account:qa-xcode`
5. Cleanup: `npm run ios:build-manager -- --cleanup 3`

See `docs/iOS-BUILD-DOWNLOAD.md` for full documentation.
