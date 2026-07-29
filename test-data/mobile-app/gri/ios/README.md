# iOS Build Artifacts

Builds are published here under `<version>/<environment>/`, where the version is
read from the built app's `CFBundleShortVersionString` (falling back to the clone
folder name):

```
30.3/qa/GRI QA.app          + build-info.json
30.3/stage/GRI Stage.app    + build-info.json
30.3/prod/Rate.app          + build-info.json
```

`build-info.json` records the marketing version, build number, bundle id, scheme,
configuration, source repo, git branch and commit, and the build timestamp, so
the exact build under test is always identifiable. The `.app` and `.ipa` payloads
are gitignored; the metadata is not.

| Environment | Scheme | Configuration | Bundle id | Product |
| --- | --- | --- | --- | --- |
| QA | `GRI - QA` | `QA` | `com.guaranteedrate.superapp.qa` | `GRI QA.app` |
| Stage | `GRI - Stage` | `Stage` | `com.guaranteedrate.superapp.stage` | `GRI Stage.app` |
| Prod | `GRI - Release` | `Release` | `com.guaranteedrate.superapp` | `Rate.app` |

Build them with:

```bash
npm run build:mobile:ios                      # qa, stage and prod
npm run build:mobile:ios -- qa stage
npm run build:mobile:ios -- qa-xcode-device   # signed .ipa for a real device
```

Builds are named in [config.yml](config.yml) under `ios.builds` and selected with
`MOBILE_IOS_BUILD` (or `ios.defaultBuild`):

| Build | `source` | Target |
| --- | --- | --- |
| `qa-xcode` / `stage-xcode` / `prod-xcode` | `xcode` | iOS Simulator, compiled from the app repo |
| `qa-xcode-device` / `stage-xcode-device` / `prod-xcode-device` | `xcode` | Real device, archives and exports a signed `.ipa` |
| `qa-simulator` | `simulator` | iOS Simulator, installs a pre-existing local `.app` |
| `qa-ipa` / `stage-ipa` | `ipa` | Real device, installs `ipaPath` or downloads `ipaUrl` into `mobile/.builds` |
| `qa-testflight` / `stage-testflight` | `testflight` | Real device, launches a build you installed from TestFlight |

## Building from the Xcode project

App clones live under `ios.repo.root` and are named after the release, for
example `/Users/jameshc/iOS /SuperApp-iOS-30.3`. The folder name selects the
version: the newest clone wins unless `ios.repo.version` or
`MOBILE_IOS_REPO_VERSION` pins one. Schemes are `GRI - Dev`, `GRI - QA`,
`GRI - Stage`, `GRI - Release` (and the `GRA - *` equivalents).

The automation never commits, pushes, or otherwise writes to that repo — it only
reads it and runs `xcodebuild`.

- Simulator targets run `xcodebuild build -destination 'generic/platform=iOS Simulator'` and use the resulting `.app`.
- Device targets run `xcodebuild archive` plus `-exportArchive`, producing a signed `.ipa` using `exportMethod` and `teamId`.
- Intermediate products and xcodebuild logs live in `mobile/.builds`, keyed by version, and are reused until `xcode.build` is `always` or `MOBILE_IOS_XCODE_BUILD=always` is set.
- Keep code signing enabled. Building with `CODE_SIGNING_ALLOWED=NO` succeeds but the app then fails during account registration, so `xcode.codeSigning: false` is opt-in only.

## Checking which version you have

```bash
# Everything currently published
cat 30.3/*/build-info.json

# Straight from an artifact's metadata
plutil -extract CFBundleShortVersionString raw -o - "30.3/qa/GRI QA.app/Info.plist"
plutil -extract CFBundleVersion raw -o - "30.3/qa/GRI QA.app/Info.plist"

# What the repo would produce, before building
cd "/Users/jameshc/iOS /SuperApp-iOS-30.3"
xcodebuild -project SuperApp.xcodeproj -scheme "GRI - QA" -showBuildSettings \
  | grep -E 'MARKETING_VERSION|CURRENT_PROJECT_VERSION|PRODUCT_BUNDLE_IDENTIFIER'
git rev-parse --abbrev-ref HEAD && git rev-parse --short HEAD
```

TestFlight cannot run on the iOS Simulator — Apple does not ship the TestFlight
app for simulators, and TestFlight builds are signed for devices only. There is
also no public API that downloads a TestFlight `.ipa`, so a TestFlight run means
installing the build on the device first and letting the session launch it by
bundle id. Prefer an `xcode` build when you want the latest source, or an `ipa`
build when you have a downloadable artifact URL.

Required simulator settings:

- `MOBILE_PLATFORM=ios`
- `MOBILE_IOS_BUILD=qa-simulator` (or any build whose `source` is `simulator`)
- the build's `appPath` pointing at your local `.app` bundle
- the build's `bundleId`, for example `com.guaranteedrate.superapp.qa`

Required real-device settings:

- `MOBILE_IOS_BUILD=<an ipa or testflight build>`
- the build's `deviceUdid` (or `MOBILE_IOS_DEVICE_UDID`)
- for `ipa` builds, `ipaPath` or `ipaUrl` (plus an encrypted `ipaAuthHeader` when the URL needs a token)

Use `npm run test:mobile:ios:simulator` to launch the simulator lane once the
bundle is in place, or `npm run test:mobile:ios:create-account:qa-testflight`
for a device build.

## Related Guides

- [Root framework guide](../../../../readme.md)
- [Android build artifact guide](../android/README.md)
- [API how-to guide](../../../../api/README.md)
- [Mobile test case workspace](../../../../ai/tests/mobile/README.md)
