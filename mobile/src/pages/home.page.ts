import { BasePage } from './base.page';

export class HomePage extends BasePage {
  private readonly homeIndicators = this.platform === 'ios'
    ? [
        // Bottom navigation, which only exists once the user is inside the app.
        '~bottom_navigation.button.home',
        '~bottom_navigation.button.accounts'
      ]
    : [
        // Bottom navigation plus the dashboard greeting, both unique to home.
        `//android.widget.TextView[@text="Accounts"]`,
        `//android.widget.TextView[@text="Financial wellness"]`,
        `//android.widget.TextView[starts-with(@text, "Hi ")]`,
        `//android.widget.TextView[@text="Home"]`
      ];

  private readonly workingWithRatePrompt = this.platform === 'ios'
    ? `//XCUIElementTypeStaticText[contains(@name, "working with someone from Rate")]`
    : `//android.widget.TextView[contains(@text, "working with someone from Rate")]`;

  private readonly closeButtonSelector = this.platform === 'ios'
    ? '~navigation_top.button.close'
    : `//android.view.View[@clickable="true"]`;

  // iOS offers Face ID enrolment straight after email verification; Android
  // never shows it, so the selector simply never matches there.
  private readonly skipBiometricsButton = this.platform === 'ios'
    ? '~biometrics_setup.button.skip'
    : `//android.widget.TextView[@text="Skip this for now"]/..`;

  /**
   * Declines the biometrics enrolment screen when the app offers it, so the run
   * can continue into onboarding. Returns false when the screen never appears.
   */
  async skipBiometricsSetupIfPresent(timeoutMs = 20000): Promise<boolean> {
    const button: any = $(this.skipBiometricsButton);
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (await button.isDisplayed().catch(() => false)) {
        await this.tap(this.skipBiometricsButton);
        await browser.pause(1500);
        return true;
      }
      await browser.pause(1000);
    }

    return false;
  }

  /**
   * The onboarding survey modal is dismissed with an unlabelled "X" in the top
   * right corner, so it can only be identified by where it sits on screen.
   */
  async dismissWorkingWithRateModal(timeoutMs = 60000): Promise<boolean> {
    const prompt: any = $(this.workingWithRatePrompt);
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (await prompt.isDisplayed().catch(() => false)) break;
      await browser.pause(1000);
    }

    if (!(await prompt.isDisplayed().catch(() => false))) {
      return false;
    }

    const closeButton = await this.findTopRightCloseButton();
    if (!closeButton) {
      throw new Error('Found the "working with someone from Rate" modal but no close button in its top right corner.');
    }

    await this.tap(closeButton);

    while (Date.now() < deadline) {
      if (!(await prompt.isDisplayed().catch(() => false))) return true;
      await browser.pause(1000);
    }

    return false;
  }

  private async findTopRightCloseButton(): Promise<any> {
    // iOS labels the dismiss control, so the Android bounds heuristic (and its
    // `bounds` attribute, which XCUITest does not expose) is not needed here.
    if (this.platform === 'ios') {
      const element: any = $(this.closeButtonSelector);
      return (await element.isDisplayed().catch(() => false)) ? element : undefined;
    }

    const { width, height } = await browser.getWindowSize();
    const candidates: any = await $$(this.closeButtonSelector);
    const total = Number(await candidates.length);

    for (let index = 0; index < total; index += 1) {
      const element: any = candidates[index];
      const bounds = String(await element.getAttribute('bounds').catch(() => ''));
      const match = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
      if (!match) continue;

      const [left, top, right, bottom] = match.slice(1).map(Number);
      const isSmall = right - left < width * 0.3 && bottom - top < height * 0.15;
      const isTopRight = left > width * 0.7 && top < height * 0.2;

      if (isSmall && isTopRight) return element;
    }

    return undefined;
  }

  async waitForLoaded(timeoutMs = 60000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      for (const selector of this.homeIndicators) {
        const element: any = $(selector);
        if (await element.isDisplayed().catch(() => false)) {
          return true;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return false;
  }
}
