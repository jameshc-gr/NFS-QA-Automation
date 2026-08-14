import { resolveMobilePlatform } from '../config/mobile.config';

export abstract class BasePage {
  protected readonly platform = resolveMobilePlatform();

  protected byText(text: string): any {
    if (this.platform === 'ios') {
      return $(`~${text}`);
    }

    return $(`//android.widget.TextView[@text=${JSON.stringify(text)}]/..`);
  }

  protected byInputLabel(label: string): any {
    if (this.platform === 'ios') {
      return $(
        `//XCUIElementTypeTextField[@name=${JSON.stringify(label)} or @label=${JSON.stringify(label)} or @value=${JSON.stringify(label)}] | //XCUIElementTypeSecureTextField[@name=${JSON.stringify(label)} or @label=${JSON.stringify(label)} or @value=${JSON.stringify(label)}]`
      );
    }

    return $(`//android.widget.EditText[.//android.widget.TextView[@text=${JSON.stringify(label)}]]`);
  }

  protected async waitForVisible(selector: string | any, timeout = 15000) {
    const element: any = typeof selector === 'string' ? $(selector) : selector;

    try {
      await element.waitForDisplayed({ timeout: 5000 });
      return element;
    } catch {
      // Fields lower on a form are clipped out of the hierarchy while the soft
      // keyboard is open, so drop the keyboard and scroll before giving up.
      await this.hideKeyboard();
      await element.waitForDisplayed({ timeout: 3000 }).catch(async () => {
        await this.scrollIntoView(element);
      });
    }

    await element.waitForDisplayed({ timeout });
    return element;
  }

  /**
   * XCUITest can scroll a known-but-offscreen element into view directly, which
   * is far more reliable than guessing a swipe distance.
   */
  private async scrollIntoView(element: any): Promise<void> {
    if (this.platform === 'ios') {
      const elementId = await element.elementId;
      if (elementId) {
        await browser
          .execute('mobile: scroll', { elementId, toVisible: true })
          .catch(() => {});
        await browser.pause(500);
        return;
      }
    }

    await this.scrollDown();
  }

  /** Scrolls the current screen down by roughly half a viewport. */
  protected async scrollDown(): Promise<void> {
    if (this.platform === 'ios') {
      await browser.execute('mobile: scroll', { direction: 'down' });
      return;
    }

    const { width, height } = await browser.getWindowSize();
    await browser.execute('mobile: scrollGesture', {
      left: Math.round(width * 0.1),
      top: Math.round(height * 0.2),
      width: Math.round(width * 0.8),
      height: Math.round(height * 0.6),
      direction: 'down',
      percent: 0.6
    });
    await browser.pause(500);
  }

  protected async tap(selector: string | any): Promise<void> {
    const element = await this.waitForVisible(selector);

    if (this.platform === 'ios') {
      await element.click();
      return;
    }

    const location = await element.getLocation();
    const size = await element.getSize();

    try {
      await browser.execute('mobile: clickGesture', {
        x: Math.round(location.x + size.width / 2),
        y: Math.round(location.y + size.height / 2)
      });
      return;
    } catch {
      await element.click();
    }
  }

  /**
   * Enters text once. On iOS this verifies the result instead of trusting a
   * single `clearValue()`/`addValue()` pass, because iOS AutoFill/Keychain
   * suggestions can race with the clear and leave stale text (e.g. a
   * previous run's email domain) concatenated with the new value; a mismatch
   * retries with a fresh tap + clear + type. On Android, key events are sent
   * one at a time because Compose fields treat `setValue` as a full replace
   * and skip validation.
   */
  protected async type(selector: string | any, value: string): Promise<void> {
    const element = await this.waitForVisible(selector);

    if (this.platform === 'ios') {
      await this.typeIOSWithVerification(element, value);
      return;
    }

    await this.typeAndroidWithVerification(element, value);
  }

  private async typeAndroidWithVerification(element: any, value: string, maxAttempts = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await this.tap(element);
      await browser.pause(200);

      // Compose text fields on Android: clearValue() often fails or leaves text.
      // Clear with clearValue and also send backspaces / select all to ensure clean slate.
      await element.clearValue().catch(() => {});
      await browser.keys(['\uE009', 'a']); // Control + A
      await browser.keys(['\uE017']); // Delete
      await browser.pause(100);

      // Try setValue first
      await element.setValue(value).catch(() => {});
      await browser.pause(300);

      let actual = await this.readFieldValue(element);
      if (this.areEquivalentFieldValues(actual, value)) {
        return;
      }

      // If setValue didn't set the full string cleanly (or appended garbage),
      // clear completely and use adb shell input text
      await element.clearValue().catch(() => {});
      await browser.keys(['\uE009', 'a']);
      await browser.keys(['\uE017']);
      await browser.pause(200);

      // Type each character or use keys
      for (const char of value) {
        await browser.keys([char]);
        await browser.pause(50);
      }
      await browser.pause(300);

      actual = await this.readFieldValue(element);
      if (this.areEquivalentFieldValues(actual, value)) {
        return;
      }

      console.warn(
        `[BasePage.type] Android field value mismatch on attempt ${attempt}/${maxAttempts}: `
          + `expected "${value}", got "${actual}". Retrying with a fresh clear.`
      );
    }

    throw new Error(`Unable to type "${value}" into the Android field after ${maxAttempts} attempts.`);
  }

  private async typeIOSWithVerification(element: any, value: string, maxAttempts = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await this.tap(element);
      await browser.pause(200);
      await element.clearValue().catch(() => {});
      await browser.pause(200);
      await element.addValue(value);
      await browser.pause(400);

      const actual = String((await element.getValue().catch(() => '')) || '');
      if (this.areEquivalentFieldValues(actual, value)) {
        return;
      }

      console.warn(
        `[BasePage.type] iOS field value mismatch on attempt ${attempt}/${maxAttempts}: `
          + `expected "${value}", got "${actual}". Retrying with a fresh clear.`
      );
    }

    throw new Error(`Unable to type "${value}" into the iOS field after ${maxAttempts} attempts.`);
  }

  /** Masked fields only expose bullets, so fall back to comparing length. */
  private async hasValue(element: any, expected: string): Promise<boolean> {
    const current = String(await element.getText().catch(() => ''));

    if (current.length > 0 && /^[\u2022*]+$/.test(current)) {
      return current.length === expected.length;
    }

    return current === expected;
  }

  private async readFieldValue(element: any): Promise<string> {
    const text = String(await element.getText().catch(() => '') || '');
    if (text) {
      return text;
    }

    return String(await element.getAttribute('text').catch(() => '') || '');
  }

  /** Secure text fields only expose bullets, so compare length instead of content. */
  private isMaskedMatch(actual: string, expected: string): boolean {
    return actual.length > 0 && /^[\u2022*]+$/.test(actual) && actual.length === expected.length;
  }

  /** Phone inputs may auto-format; compare the digit-only form in that case. */
  private areEquivalentFieldValues(actual: string, expected: string): boolean {
    if (actual === expected || this.isMaskedMatch(actual, expected)) {
      return true;
    }

    if (/^\d+$/.test(expected)) {
      const actualDigits = actual.replace(/\D/g, '');
      return actualDigits === expected;
    }

    return false;
  }

  /**
   * Closes the soft keyboard and lets the layout settle. Required before tapping
   * elements low on a form, because dismissing the keyboard reflows the screen.
   */
  protected async hideKeyboard(): Promise<void> {
    if (this.platform === 'ios') {
      // The simulator keyboard has no dismiss gesture, so ask XCUITest to press
      // whichever return-style key the field exposes.
      await browser
        .execute('mobile: hideKeyboard', { keys: ['Done', 'Return', 'return', 'next', 'Next', 'go'] })
        .catch(() => {});
      await browser.pause(500);
      return;
    }

    try {
      if (await browser.isKeyboardShown()) {
        await browser.hideKeyboard();
      }
    } catch {
      // browser.back() is Android-only; on iOS the keyboard simply stays up.
      if (this.platform === 'android') {
        await browser.back().catch(() => {});
      }
    }

    await browser.pause(1000);
  }
}