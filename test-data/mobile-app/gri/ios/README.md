# iOS Simulator Artifact

Place the locally built iOS Simulator `.app` bundle here and point `MOBILE_IOS_APP_PATH` at it.

Example local bundle names used in this repo include `GRI QA.app`.

This directory is not a TestFlight target. TestFlight runs remain real-device only.

Required simulator settings:

- `MOBILE_PLATFORM=ios`
- `MOBILE_IOS_MODE=simulator`
- `MOBILE_IOS_APP_PATH=<path to your local .app bundle>`
- `MOBILE_IOS_BUNDLE_ID=com.guaranteedrate.superapp.qa`

Use `npm run test:mobile:ios:simulator` to launch the lane once the bundle is in place.

## Related Guides

- [Root framework guide](../../../../readme.md)
- [API how-to guide](../../../../api/README.md)
- [Mobile test case workspace](../../../../ai/tests/mobile/README.md)
