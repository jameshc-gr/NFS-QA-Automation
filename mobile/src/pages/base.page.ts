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
   * Enters text with real key events. Appium's setValue/addValue map to
   * setText on Android, which replaces the whole field on every call, so the
   * app's Compose validation never sees per-keystroke changes. Keys are sent
   * one at a time because sending them in a single batch drops characters.
   */
  protected async type(selector: string | any, value: string): Promise<void> {
    const element = await this.waitForVisible(selector);

    // iOS offers an "Automatic Strong Password" cover view on secure fields,
    // which setValue leaves in place. Real key events replace it.
    if (this.platform === 'ios') {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await this.tap(element);
        await element.clearValue().catch(() => {});
        await browser.pause(200);
        await element.addValue(value);
        await browser.pause(400);

        if (await this.hasValue(element, value)) {
          return;
        }
      }

      await element.setValue(value);
      await browser.pause(200);
      return;
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await this.tap(element);
      await element.clearValue();
      await browser.pause(200);

      for (const character of value) {
        await browser.keys([character]);
        await browser.pause(80);
      }

      await browser.pause(300);

      if (await this.hasValue(element, value)) {
        return;
      }
    }

    // Last resort so a flaky keystroke does not fail the whole run.
    await element.clearValue();
    await element.setValue(value);
    await browser.pause(200);
  }

  /** Masked fields only expose bullets, so fall back to comparing length. */
  private async hasValue(element: any, expected: string): Promise<boolean> {
    const current = String(await element.getText().catch(() => ''));

    if (current.length > 0 && /^[\u2022*]+$/.test(current)) {
      return current.length === expected.length;
    }

    return current === expected;
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