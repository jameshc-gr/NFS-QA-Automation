import { BasePage } from './base.page';
import { promptForVerificationCode } from '../utils/mobile-auth';

export class AuthPage extends BasePage {
  private readonly loginTab = this.byText('Log in');
  private readonly createAccountTab = this.byText('Create account');
  private readonly emailCandidates = this.platform === 'ios'
    ? ['~log_in.field.email']
    : [this.byInputLabel('Email')];
  private readonly passwordCandidates = this.platform === 'ios'
    ? ['~log_in.field.password']
    : [this.byInputLabel('Password')];
  private readonly loginButtonCandidates = this.platform === 'ios'
    ? ['~log_in.button.log_in']
    : [
        `//android.widget.ScrollView//android.view.View[.//android.widget.TextView[@text="Log in"] and .//android.widget.Button and @clickable="true"]`,
        `//android.widget.ScrollView//android.widget.Button[.//android.widget.TextView[@text="Log in"]]`,
        `//android.widget.TextView[@text="Log in"]/..`,
        `//android.widget.Button[.//*[@text="Log in"]]`,
        `//*[contains(@text, "Log in") and @clickable="true"]`,
        `//*[contains(@text, "Log in")]`
      ];
  private readonly logoutButton = this.byText('Log out');
  // The email and phone verification screens reuse the same layout but expose
  // different identifier prefixes, so both are listed.
  private readonly verificationCodeInputCandidates = this.platform === 'ios'
    ? [
        '~confirm_email.field.code',
        '~confirm_phone.field.code',
        '//XCUIElementTypeTextField[contains(@name, ".field.code")]'
      ]
    : [
        this.byInputLabel('6-digit code'),
        `//android.widget.EditText[contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code') or contains(translate(@hint, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code') or contains(translate(@content-desc, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code')]`,
        `//android.widget.EditText`
      ];
  private readonly verifyButton = this.platform === 'ios'
    ? '//XCUIElementTypeButton[contains(@name, ".button.verify")]'
    : this.byText('Verify');
  private readonly emailVerificationPrompt = this.platform === 'ios'
    ? '//XCUIElementTypeStaticText[@name="Email verification"]'
    : this.byText('Email verification');
  private readonly emailCodeSentPrompt = this.platform === 'ios'
    ? '//XCUIElementTypeStaticText[contains(@name, "code we sent to your email")]'
    : `//android.widget.TextView[contains(@text, "code we sent to your email")]`;
  private readonly smsVerificationPrompt = this.platform === 'ios'
    ? '//XCUIElementTypeStaticText[@name="Phone verification"]'
    : this.byText('Phone verification');
  private readonly smsCodeSentPrompt = this.platform === 'ios'
    ? '//XCUIElementTypeStaticText[contains(@name, "we texted") or contains(@name, "sent to your phone")]'
    : `//android.widget.TextView[contains(@text, "we texted") or contains(@text, "sent to your phone")]`;
  private readonly smsEnterCodePrompt = this.byText('Enter the 6-digit code we texted to your phone number at');
  private readonly genericEnterCodePrompt = this.platform === 'ios'
    ? '//XCUIElementTypeStaticText[contains(@name, "digit code")]'
    : `//android.widget.TextView[@text="6-digit code" or contains(@text, "digit code")]`;
  private readonly phoneInputCandidates = this.platform === 'ios'
    ? [
        '~confirm_phone.field.phone_number',
        '//XCUIElementTypeTextField[contains(@name, "phone")]'
      ]
    : [
        `//android.widget.EditText[contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'phone') or contains(translate(@hint, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'phone') or contains(translate(@content-desc, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'phone')]`,
        `//android.widget.EditText`
      ];
  private readonly continueButtonCandidates = this.platform === 'ios'
    ? [
        '//XCUIElementTypeButton[contains(@name, ".button.continue")]',
        '//XCUIElementTypeButton[@label="Continue" or @label="Next" or @label="Verify"]'
      ]
    : [
        `//*[contains(@text, "Continue") and @clickable="true"]`,
        `//android.widget.TextView[@text="Continue"]/..`,
        `//*[contains(@text, "Next") and @clickable="true"]`,
        `//android.widget.TextView[@text="Next"]/..`,
        `//android.widget.TextView[@text="Verify"]/..`
      ];
  private readonly phonePrompt = this.platform === 'ios'
    ? '//XCUIElementTypeStaticText[contains(@name, "Phone number")]'
    : this.byText('Phone number');

  async openLogin(): Promise<void> {
    await this.tap(this.loginTab);
  }

  async openCreateAccount(): Promise<void> {
    await this.tap(this.createAccountTab);
  }

  async login(email: string, password: string): Promise<void> {
    await this.typeAny(this.emailCandidates, email);
    await this.typeAny(this.passwordCandidates, password);
    await this.tapAny(this.loginButtonCandidates);
    await this.waitForLoginSubmission();
  }

  async logout(): Promise<void> {
    await this.tap(this.logoutButton);
  }

  async completeVerificationIfPresent(): Promise<boolean> {
    const promptKind = await this.waitForVerificationPrompt();
    if (!promptKind) {
      return false;
    }

    const code = await promptForVerificationCode(promptKind);
    await this.typeAny(this.verificationCodeInputCandidates, code);
    await this.tap(this.verifyButton);
    return true;
  }

  /** Enters an already-retrieved verification code and submits it. */
  async submitVerificationCode(code: string): Promise<void> {
    await this.typeAny(this.verificationCodeInputCandidates, code);

    try {
      await this.tap(this.verifyButton);
    } catch {
      await this.tapAny(this.continueButtonCandidates);
    }
  }

  /** Enters the phone number used for SMS verification and continues. */
  async submitPhoneNumber(phoneNumber: string): Promise<void> {
    await this.typeAny(this.phoneInputCandidates, phoneNumber);
    await this.tapAny(this.continueButtonCandidates);
  }

  async waitForPhonePrompt(timeoutMs = 30000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (await this.isDisplayed(this.phonePrompt, ...this.phoneInputCandidates)) {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return false;
  }

  async waitForCodePrompt(timeoutMs = 30000): Promise<'email' | 'phone' | null> {
    return await this.waitForVerificationPrompt(timeoutMs);
  }

  private async waitForVerificationPrompt(timeoutMs = 15000): Promise<'email' | 'phone' | null> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      // Check the SMS screen first: both screens share the generic "6-digit
      // code" label, so the email branch would otherwise swallow it.
      if (await this.isDisplayed(this.smsVerificationPrompt, this.smsCodeSentPrompt, this.smsEnterCodePrompt)) {
        return 'phone';
      }

      if (await this.isDisplayed(this.emailVerificationPrompt, this.emailCodeSentPrompt, this.genericEnterCodePrompt)) {
        return 'email';
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return null;
  }

  private async isDisplayed(...selectors: Array<string | any>): Promise<boolean> {
    for (const selector of selectors) {
      const element: any = typeof selector === 'string' ? $(selector) : selector;
      if (await element.isDisplayed().catch(() => false)) {
        return true;
      }
    }

    return false;
  }

  private async tapAny(selectors: string[]): Promise<void> {
    let lastError: unknown;

    for (const selector of selectors) {
      try {
        await this.tap(selector);
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Unable to tap any login button candidate.');
  }

  private async typeAny(selectors: string[], value: string): Promise<void> {
    let lastError: unknown;

    for (const selector of selectors) {
      try {
        await this.type(selector, value);
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Unable to type into any verification input candidate.');
  }

  private async waitForLoginSubmission(timeoutMs = 10000): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (
        await this.isDisplayed(
          this.verifyButton,
          this.emailVerificationPrompt,
          this.emailCodeSentPrompt,
          this.smsVerificationPrompt,
          this.smsCodeSentPrompt,
          this.smsEnterCodePrompt,
          this.genericEnterCodePrompt
        )
      ) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}