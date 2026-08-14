# Recording Mobile Test Steps (Appium + WebdriverIO)

This document explains how to record interactions on Android and iOS emulators/simulators using Appium + WebdriverIO and turn them into reproducible tests.

Prerequisites
- macOS for iOS simulator + Xcode (iOS only).
- Android Studio + Android SDK + at least one AVD configured.
- Node.js (matches repo), `npm` available.
- Appium and WebdriverIO dependencies installed (see `package.json`).
- `adb` on PATH for Android; `xcrun simctl` for iOS.

Quick commands
- Start Appium server:

```bash
npm run appium:start
```

- Launch an Android emulator (example):

```bash
# from Android Studio AVD manager or CLI
emulator -avd Pixel_5_API_33
```

- Launch iOS Simulator (example):

```bash
xcrun simctl boot "iPhone 14"
open -a Simulator
```

- Use WDIO codegen to capture flows (opens interactive recorder):

```bash
npx wdio codegen mobile/wdio.conf.ts
```

Recording workflow (native apps)
1. Start the emulator/simulator and ensure the app is installed on the device or provide your app path via desired capabilities (see `mobile/wdio.conf.ts`).
2. Start Appium server: `npm run appium:start`.
3. Run WDIO codegen: `npx wdio codegen mobile/wdio.conf.ts`.
   - The codegen tool will open an interactive REPL that records actions and prints WebDriver commands.
   - Interact with the app on the device. The recorder will emit corresponding commands which you can copy.
4. Save the recorded commands into a new spec under `tests/android/` or `tests/ios/`.
5. Replace brittle selectors with `accessibility id` or stable resource-ids.
6. Run the test via the repo scripts, e.g.:

```bash
npm run test:mobile:android -- --spec tests/android/my-recorded.spec.ts
```

Recording workflow (if you prefer Appium Desktop Inspector)
1. Install Appium Desktop (GUI Inspector) and open it.
2. Start Appium server from the GUI or via `npm run appium:start`.
3. Configure desired capabilities and connect to the running emulator/simulator.
4. Use the Inspector to interact with the app and capture element selectors.
5. Manually convert interactions into WDIO test steps using `browser` and `element` APIs.

Tips for stable recordings
- Prefer `accessibility id` / resource-id over XPath.
- Add explicit waits: `await $(selector).waitForExist({timeout: 10000})`.
- Use Page Objects (`mobile/src/pages`) to organize selectors and actions.
- After recording, refactor duplicated steps into helper methods.

Example snippet (WDIO + Mocha style)
```ts
import { expect } from 'chai';
import LoginPage from '../../mobile/src/pages/auth.page';

describe('Recorded login flow', () => {
  it('should log in using recorded steps', async () => {
    await LoginPage.open();
    await LoginPage.username.setValue('testuser');
    await LoginPage.password.setValue('Password123');
    await LoginPage.loginButton.click();
    await expect(LoginPage.homeScreen).toBeExisting();
  });
});
```

Where to store recordings
- Put new specs under `tests/android/` or `tests/ios/` and add corresponding `MOBILE_SPECS` environment usage if needed.

Next steps
- Record a short (1–2 minute) scenario and paste the generated commands here or open a PR and I can help convert it into a repo-compatible spec and Page Object.

