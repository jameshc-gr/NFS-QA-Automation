# iOS Build Artifacts

Place the locally built iOS Simulator `.app` bundle here and point the build's
`appPath` (or `MOBILE_IOS_APP_PATH`) at it.

Example local bundle names used in this repo include `GRI QA.app`.

Builds are named in [config.yml](config.yml) under `ios.builds` and selected with
`MOBILE_IOS_BUILD` (or `ios.defaultBuild`):

| Build | `source` | Target |
| --- | --- | --- |
| `qa-simulator` | `simulator` | iOS Simulator, installs the local `.app` |
| `qa-ipa` / `stage-ipa` | `ipa` | Real device, installs `ipaPath` or downloads `ipaUrl` into `mobile/.builds` |
| `qa-testflight` / `stage-testflight` | `testflight` | Real device, launches a build you installed from TestFlight |

TestFlight cannot run on the iOS Simulator — Apple does not ship the TestFlight
app for simulators, and TestFlight builds are signed for devices only. There is
also no public API that downloads a TestFlight `.ipa`, so a TestFlight run means
installing the build on the device first and letting the session launch it by
bundle id. Use an `ipa` build when you have a downloadable artifact URL.

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
- [API how-to guide](../../../../api/README.md)
- [Mobile test case workspace](../../../../ai/tests/mobile/README.md)
