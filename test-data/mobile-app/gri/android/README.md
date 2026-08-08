# Android Build Artifacts

Builds are published here under `<version>/<environment>/app.apk`, where the
version is read from the apk's `versionName` using `aapt2 dump badging`:

```
1.43/qa/app.apk     + build-info.json
1.43/stage/app.apk  + build-info.json
1.48/prod/app.apk   + build-info.json
```

`build-info.json` records the versionName, versionCode, package, Firebase
release, source and download time, so the exact build under test is always
identifiable. The `.apk` payloads are gitignored; the metadata is not.

| Environment | Package |
| --- | --- |
| QA | `com.guaranteedrate.superapp.qa` |
| Stage | `com.guaranteedrate.superapp.stage` |
| Prod | `com.guaranteedrate.superapp` |

## Build sources

Builds are named in [config.yml](config.yml) under `android.builds` and selected
with `MOBILE_ANDROID_BUILD` (or `android.defaultBuild`):

| Build | `source` | Target |
| --- | --- | --- |
| `prod` / `qa` | `firebase-web` | Firebase App Distribution, downloaded via Playwright using the saved Google profile |
| `prod-local` / `qa-local` | `local` | Pre-existing apk on disk, such as `test-data/mobile-app/gri/android/app.apk` |

Build them with:

```bash
npm run build:mobile:android              # qa, stage and prod from Firebase
npm run build:mobile:android -- qa        # only that environment
npm run build:mobile:android -- qa-local  # publish the checked-in apk
```

Prod App Distribution releases are distributed as `.aab` bundles. The build
script converts them to a universal `.apk` with bundletool and signs them with
the local debug keystore, so they cannot upgrade a Play-signed install.

## Checking which version you have

```bash
# Everything currently published
cat 1.48/*/build-info.json

# Straight from an apk
"$ANDROID_SDK_ROOT"/build-tools/*/aapt2 dump badging 1.48/qa/app.apk | head -1

# Version of what is installed on the device
adb shell dumpsys package com.guaranteedrate.superapp.qa | grep -E 'versionName|versionCode'
```

## Related Guides

- [Root framework guide](../../../readme.md)
- [iOS build artifact guide](../ios/README.md)
