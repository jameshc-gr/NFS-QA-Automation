import { BasePage } from './base.page';
import { promptForVerificationCode } from '../utils/mobile-auth';

export class AuthPage extends BasePage {
  private readonly loginTab = this.byText('Log in');
  private readonly createAccountTab = this.byText('Create account');
  private readonly emailCandidates = this.platform === 'ios'
    ? [
        '~Email',
        `//XCUIElementTypeTextField[@name="Email" or @label="Email" or @value="Email"]`,
        `//XCUIElementTypeTextField[contains(translate(@name, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'email') or contains(translate(@label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'email') or contains(translate(@value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'email')]`
      ]
    : [this.byInputLabel('Email')];
  private readonly passwordCandidates = this.platform === 'ios'
    ? [
        '~Password',
        `//XCUIElementTypeSecureTextField[@name="Password" or @label="Password" or @value="Password"]`,
        `//XCUIElementTypeSecureTextField[contains(translate(@name, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'password') or contains(translate(@label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'password') or contains(translate(@value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'password')]`
      ]
    : [this.byInputLabel('Password')];
  private readonly loginButtonCandidates = this.platform === 'ios'
    ? [this.byText('Log in'), '~Log in', '~Continue', '~Sign in']
    : [
        `//android.widget.ScrollView//android.view.View[.//android.widget.TextView[@text="Log in"] and .//android.widget.Button and @clickable="true"]`,
        `//android.widget.ScrollView//android.widget.Button[.//android.widget.TextView[@text="Log in"]]`,
        `//android.widget.TextView[@text="Log in"]/..`,
        `//android.widget.Button[.//*[@text="Log in"]]`,
        `//*[contains(@text, "Log in") and @clickable="true"]`,
        `//*[contains(@text, "Log in")]`
      ];
  private readonly logoutButton = this.byText('Log out');
  private readonly verificationCodeInputCandidates = this.platform === 'ios'
    ? [
        '~Enter code',
        '~Verification code',
        `//XCUIElementTypeTextField[contains(translate(@name, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code') or contains(translate(@label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code') or contains(translate(@value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code')]`,
        `//XCUIElementTypeSecureTextField[contains(translate(@name, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code') or contains(translate(@label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code') or contains(translate(@value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code')]`
      ]
    : [`//android.widget.EditText[contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code') or contains(translate(@hint, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code') or contains(translate(@content-desc, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code')]`];
  private readonly verifyButton = this.byText('Verify');
  private readonly emailVerificationPrompt = this.byText('Verification code via Email');
  private readonly emailCodeSentPrompt = this.byText('Email verification code sent.');
  private readonly smsVerificationPrompt = this.byText('Verification code via SMS');
  private readonly smsCodeSentPrompt = this.byText('SMS verification code sent.');
  private readonly smsEnterCodePrompt = this.byText('Enter the 6-digit code we texted to your phone number at');
  private readonly genericEnterCodePrompt = this.byText('Enter code');

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

  private async waitForVerificationPrompt(timeoutMs = 15000): Promise<'email' | 'phone' | null> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (await this.isDisplayed(this.emailVerificationPrompt, this.emailCodeSentPrompt, this.genericEnterCodePrompt)) {
        return 'email';
      }

      if (await this.isDisplayed(this.smsVerificationPrompt, this.smsCodeSentPrompt, this.smsEnterCodePrompt, this.genericEnterCodePrompt)) {
        return 'phone';
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