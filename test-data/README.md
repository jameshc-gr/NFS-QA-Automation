# Test Data Directory

This directory contains test configuration files, test data matrices, and build metadata. **Large binary files (APK, APP, IPA) are NOT stored in this repository.**

## Why Binary Builds Are Excluded

Mobile app builds (Android `.apk`, iOS `.app`, `.ipa` files) are excluded from version control because:
- They are large (50MB - 500MB+), slowing down clones and causing storage bloat
- They are ephemeral artifacts generated from source code
- Each developer/CI run may need different builds for different environments
- Builds should be downloaded on-demand when needed for testing

## Downloading Builds

### Android Builds

Android APK files are obtained from Firebase App Distribution. Use the build script to automatically download builds:

```bash
# Download the default Android build (usually QA)
npm run build:mobile:android

# Download a specific environment
npm run build:mobile:android -- --build qa
npm run build:mobile:android -- --build prod

# List available builds
npm run build:mobile:android -- --list
```

**Required Setup:**
- Firebase CLI configured locally or CI environment variables set
- Google account with access to Firebase App Distribution projects
- `GOOGLE_APPLICATION_CREDENTIALS` environment variable pointing to service account JSON (for CI)

**Location after download:** `test-data/mobile-app/gri/android/<version>/<environment>/app.apk`

**Manual download (if script fails):**
1. Navigate to [Firebase Console](https://console.firebase.google.com)
2. Select the appropriate Firebase project for your environment
3. Go to **App Distribution** → **Release notes**
4. Download the APK for the desired environment
5. Place it in the appropriate `test-data/mobile-app/gri/android/<version>/<environment>/` folder
6. Run the script with `--verify` to generate build metadata

### iOS Builds

iOS builds are downloaded from GitHub releases. Use the release downloader script:

```bash
# Download the latest QA build
npm run ios:download-build -- --download v30.3-qa --env qa

# Download stage build
npm run ios:download-build -- --download v30.3-stage --env stage

# Download prod build
npm run ios:download-build -- --download v30.3 --env prod

# List available releases
npm run ios:download-build -- --list
```

**Required Setup:**
- GitHub CLI configured or `GITHUB_TOKEN` environment variable set
- Access to the private or public SuperApp-iOS repository

**Location after download:** `test-data/mobile-app/gri/ios/<version>/<environment>/GRI*.app` or `.ipa`

**Manual download (if script fails):**
1. Navigate to [SuperApp-iOS Releases](https://github.com/Guaranteed-Rate/SuperApp-iOS/releases)
2. Find the release matching your version (e.g., `v30.3-qa`)
3. Download the `.app` or `.ipa` artifact from the release assets
4. Create the folder structure: `test-data/mobile-app/gri/ios/<version>/<environment>/`
5. Extract the downloaded archive into that folder
6. The build metadata (build-info.json) will be auto-generated on test run

### Local/Pre-built Builds

If you have builds available locally (e.g., from Xcode or previous downloads):

**Android:**
```bash
npm run build:mobile:android -- --build qa-local
```
This uses the pre-existing APK at `test-data/mobile-app/gri/android/app.apk`

**iOS:**
- Configure the path in `test-data/mobile-app/gri/ios/config.yml` under `ios.builds.<name>.ipaPath`
- Use: `npm run build:mobile:ios -- <build-name>`

## Build Metadata

When builds are downloaded or published, metadata files are created for reproducibility:

```
test-data/mobile-app/gri/android/<version>/<environment>/build-info.json
test-data/mobile-app/gri/ios/<version>/<environment>/build-info.json
```

These JSON files record:
- Version name / marketing version
- Version code / build number
- Package/bundle ID
- Build timestamp
- Source (Firebase, GitHub, Xcode, etc.)
- Git commit (if applicable)

**These metadata files ARE committed to the repo.** They provide a record of exactly which build was tested.

## Directory Structure

```
test-data/
├── README.md                                    # This file
├── mobile-app/
│   └── gri/
│       ├── android/
│       │   ├── README.md                        # Android-specific notes
│       │   ├── config.yml                       # Build configuration
│       │   ├── login.yml                        # Login credentials/profiles
│       │   ├── 1.43/
│       │   │   └── qa/
│       │   │       ├── app.apk                  # ⚠️ NOT in repo (gitignore)
│       │   │       └── build-info.json          # ✓ In repo
│       │   └── 1.48/
│       │       ├── prod/
│       │       └── qa/
│       └── ios/
│           ├── README.md                        # iOS-specific notes
│           ├── config.yml                       # Build configuration
│           ├── 30.3/
│           │   ├── qa/
│           │   │   ├── GRI QA.app/              # ⚠️ NOT in repo (gitignore)
│           │   │   └── build-info.json          # ✓ In repo
│           │   ├── stage/
│           │   └── prod/
│           └── 30.0/
│               └── stage/
├── rate-wealth/
│   ├── rate-wealth-test-cases.csv
│   ├── rate-wealth-test-cases.xlsx
│   └── rate-wealth.yml
├── student-loan-refi/
│   └── student-loan-refi.yml
└── student-IDR/
    ├── student-IDR.yml
    └── student-IDR-counters/
```

## CI/CD Environment

In CI environments:

1. **Android:** Configure Firebase service account in GitHub Secrets
2. **iOS:** Configure GitHub token with access to SuperApp-iOS releases
3. Builds are downloaded automatically before tests run
4. Build artifacts are cleaned up after test completion to save storage

Example GitHub Actions setup:
```yaml
env:
  GOOGLE_APPLICATION_CREDENTIALS: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

- name: Download builds
  run: |
    npm run build:mobile:android
    npm run build:mobile:ios -- --download v30.3-qa --env qa
```

## Troubleshooting

### "Build not found" error

**Android:** Verify Firebase project has App Distribution enabled and builds are published
**iOS:** Check GitHub releases exist for the requested version

### Large disk usage after downloads

Downloaded builds are temporarily extracted during test setup. They are typically cleaned up after test completion. To manually clean:

```bash
# Clean all build artifacts (keeps metadata)
npm run clean:builds

# Clean specific environment
rm -rf test-data/mobile-app/gri/android/1.48/prod/*.apk
rm -rf test-data/mobile-app/gri/ios/30.3/qa/*.app
```

### Authentication errors

**Android + Firebase:**
```bash
firebase login
# or set GOOGLE_APPLICATION_CREDENTIALS
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

**iOS + GitHub:**
```bash
gh auth login
# or set GitHub token
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
```

## More Information

- See [mobile-app/gri/android/README.md](mobile-app/gri/android/README.md) for Android-specific build details
- See [mobile-app/gri/ios/README.md](mobile-app/gri/ios/README.md) for iOS-specific build details
- See [root readme.md](../readme.md#setup) for general test setup instructions
