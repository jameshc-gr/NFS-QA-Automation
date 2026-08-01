import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

import { BasePage } from './base.page';
import { getVerificationCode } from '../utils/verification-service';
import { getVerificationConfig, getMobileEnvironment, promptForVerificationCode, resolveGoogleVoiceProfile } from '../utils/mobile-auth';

export class AuthPage extends BasePage {
  private readonly verificationConfig = getVerificationConfig();
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
  private readonly emailCodeInputCandidates = this.platform === 'ios'
    ? [
        '~confirm_email.field.code',
        '//XCUIElementTypeTextField[contains(@name, "confirm_email") and contains(@name, ".field.code")]'
      ]
    : [
        this.byInputLabel('6-digit code'),
        `//android.widget.EditText[contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code') or contains(translate(@hint, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code') or contains(translate(@content-desc, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code')]`,
        `//android.widget.EditText`
      ];
  private readonly phoneCodeInputCandidates = this.platform === 'ios'
    ? [
        '~verify_sms_number.field.code',
        '~confirm_phone.field.code',
        '//XCUIElementTypeTextField[contains(@name, "verify_sms_number") and contains(@name, ".field.code")]',
        '//XCUIElementTypeTextField[contains(@name, "confirm_phone") and contains(@name, ".field.code")]'
      ]
    : [
        this.byInputLabel('6-digit code'),
        `//android.widget.EditText[contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code') or contains(translate(@hint, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code') or contains(translate(@content-desc, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code')]`,
        `//android.widget.EditText`
      ];
  private readonly emailVerifyButtonCandidates = this.platform === 'ios'
    ? [
        '~confirm_email.button.verify',
        '//XCUIElementTypeButton[contains(@name, "verify") or @label="Verify"]'
      ]
    : [this.byText('Verify')];
  private readonly phoneCodeVerifyButtonCandidates = this.platform === 'ios'
    ? [
        '~verify_sms_number.button.verify',
        '~confirm_phone.button.verify',
        '~confirm_phone.button.continue',
        '//XCUIElementTypeButton[contains(@name, "verify") or contains(@name, "continue") or @label="Verify" or @label="Continue"]'
      ]
    : [this.byText('Verify'), this.byText('Continue')];
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
        '~confirm_phone.field.phone',
        '//XCUIElementTypeTextField[contains(@name, "phone")]'
      ]
    : [
        `//android.widget.EditText[contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'phone') or contains(translate(@hint, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'phone') or contains(translate(@content-desc, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'phone')]`,
        `//android.widget.EditText`
      ];
  private readonly continueButtonCandidates = this.platform === 'ios'
    ? [
        '~confirm_phone.button.continue',
        '~confirm_phone.button.verify',
        '//XCUIElementTypeButton[contains(@name, "continue") or contains(@name, "verify") or @label="Continue" or @label="Verify"]',
        '~confirm_email.button.verify'
      ]
    : [
        `//*[contains(@text, "Continue") and @clickable="true"]`,
        `//android.widget.TextView[@text="Continue"]/..`,
        `//*[contains(@text, "Next") and @clickable="true"]`,
        `//android.widget.TextView[@text="Next"]/..`,
        `//android.widget.TextView[@text="Verify"]/..`
      ];
  private readonly resendButtonCandidates = this.platform === 'ios'
    ? [
        '~Resend code',
        '~verify_sms_number.button.resend',
        '~confirm_email.button.resend',
        '~confirm_phone.button.resend',
        '//XCUIElementTypeButton[contains(@name, "Resend") or contains(@label, "Resend")]',
        '//XCUIElementTypeStaticText[contains(@name, "Resend")]/..'
      ]
    : [
        `//*[contains(@text, "Resend code") and @clickable="true"]`,
        `//*[contains(@text, "Resend") and @clickable="true"]`,
        `//android.widget.TextView[contains(@text, "Resend")]/..`,
        `//android.widget.Button[contains(@text, "Resend")]`
      ];
  private readonly phonePrompt = this.platform === 'ios'
    ? '//XCUIElementTypeStaticText[contains(@name, "Phone number")]'
    : this.byText('Phone number');
  private readonly codeIncorrectPrompt = this.platform === 'ios'
    ? '//XCUIElementTypeStaticText[contains(@name, "Code incorrect") or contains(@name, "incorrect")]'
    : `//android.widget.TextView[contains(@text, "Code incorrect") or contains(@text, "incorrect")]`;
  // iOS renders "Are you already working with someone from Rate?", Android drops the "already".
  private readonly loanOfficerPrompt = this.platform === 'ios'
    ? '//XCUIElementTypeStaticText[contains(@name, "working with someone") or contains(@name, "Loan officer") or contains(@label, "Loan officer")]'
    : `//android.widget.TextView[contains(@text, "working with someone") or contains(@text, "Loan officer")]`;
  private readonly loanOfficerCloseButtonCandidates = this.platform === 'ios'
    ? [
        '~loan_officer_selector_view.button.no',
        '~navigation_top.button.close',
        '~close',
        '~Close',
        '~modal.button.close',
        '//XCUIElementTypeButton[contains(@name, "close") or contains(@label, "close") or @name="X" or @label="X"]'
      ]
    : [
        `//*[contains(@content-desc, "loan_officer_selector_view.button.no")]`,
        `//android.widget.TextView[@text="No"]`,
        `//*[contains(@content-desc, "close") or @text="X" or @text="✕" or @text="×"]`,
        `//android.widget.TextView[@text="X"]/..`
      ];
  private readonly homeIndicatorCandidates = this.platform === 'ios'
    ? ['~bottom_navigation.button.home']
    : ['//*[contains(@content-desc, "bottom_navigation.button.home")]', this.byText('Home')];
  private readonly faceIdContinueButtonCandidates = this.platform === 'ios'
    ? [
        '~Continue',
        '//XCUIElementTypeButton[@name="Continue" or @label="Continue"]'
      ]
    : [this.byText('Continue')];

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

    const code = await this.retrieveCodeWithResend(promptKind);
    const candidates = promptKind === 'phone' ? this.phoneCodeInputCandidates : this.emailCodeInputCandidates;
    await this.typeAny(candidates, code);
    await this.tapVerifyOrContinue();
    return true;
  }

  async completeAllVerifications(options?: { googleVoiceProfile?: string; phoneNumber?: string }): Promise<void> {
    this.assertEnvironmentMatchesBuild();
    const excludeCodesByChannel: Record<'email' | 'phone', string[]> = { email: [], phone: [] };

    // STEP 1: Email verification - code typed in - verify button
    await this.executeEmailVerificationStep(excludeCodesByChannel.email, options);

    // STEP 2: Phone verification page - enter phone number from config file 6163200701 - verify button
    const gvProfile = resolveGoogleVoiceProfile(options?.googleVoiceProfile);
    const phoneNumber = options?.phoneNumber || gvProfile.phoneNumber || this.verificationConfig.verification.phoneNumber || '6163200701';
    await this.executePhoneNumberStep(phoneNumber);

    // STEP 3: Phone verification code - grab latest code from Google Voice - verify button - resend if needed
    await this.executePhoneCodeVerificationStep(excludeCodesByChannel.phone, options);
    await this.dismissLoanOfficerModalIfPresent();
    await this.completeFaceIdOnboarding();
    await this.dismissLoanOfficerModalIfPresent();
    await this.waitForHomeScreen();
  }

  // A QA build emails the Outlook mailbox while a prod build emails Guerrilla Mail,
  // so a mismatch here silently polls an inbox that will never receive the code.
  private assertEnvironmentMatchesBuild(): void {
    const environment = getMobileEnvironment();
    const capabilities = (browser.capabilities || {}) as Record<string, string>;
    const appId =
      capabilities['appium:appPackage'] ||
      capabilities['appium:bundleId'] ||
      capabilities.appPackage ||
      capabilities.bundleId ||
      process.env.MOBILE_IOS_BUNDLE_ID ||
      process.env.MOBILE_ANDROID_APP_PACKAGE ||
      '';

    if (!appId) {
      console.log(`[Verification] env=${environment} (app id unavailable, skipping build check)`);
      return;
    }

    const isQaBuild = appId.endsWith('.qa');
    const expectsQaBuild = environment !== 'prod';

    console.log(
      `[Verification] env=${environment} app=${appId} emailSource=${this.verificationConfig.verification.email}`
    );

    if (isQaBuild !== expectsQaBuild) {
      throw new Error(
        `Environment/build mismatch: MOBILE_ENV=${environment} expects a ${expectsQaBuild ? 'QA' : 'production'} build, ` +
        `but the app under test is "${appId}". Verification codes would be sent to a different inbox. ` +
        `Run with MOBILE_ENV=${isQaBuild ? 'qa' : 'prod'} or install the matching build.`
      );
    }
  }

  async dismissLoanOfficerModalIfPresent(): Promise<void> {
    if (!(await this.isDisplayed(this.loanOfficerPrompt))) {
      return;
    }

    console.log('[Modal] "Are you already working with someone from Rate?" shown — dismissing.');
    await this.tapAny(this.loanOfficerCloseButtonCandidates);
    await browser.pause(1500);

    if (await this.isDisplayed(this.loanOfficerPrompt)) {
      await this.tapAny(this.loanOfficerCloseButtonCandidates);
      await browser.pause(1500);
    }
  }

  async waitForHomeScreen(timeoutMs = 20000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.isDisplayed(...this.homeIndicatorCandidates)) {
        return true;
      }
      await browser.pause(500);
    }

    await this.dumpScreenIfCandidatesMissing(this.homeIndicatorCandidates, 'home-screen');
    return false;
  }

  private async completeFaceIdOnboarding(): Promise<void> {
    for (let step = 0; step < 5; step += 1) {
      if (!(await this.isDisplayed(...this.faceIdContinueButtonCandidates))) {
        return;
      }

      await this.tapAny(this.faceIdContinueButtonCandidates);
      await browser.pause(1000);
    }
  }

  private async executeEmailVerificationStep(
    excludeCodes: string[],
    options?: { googleVoiceProfile?: string }
  ): Promise<void> {
    await this.findFirstDisplayedSelector(this.emailCodeInputCandidates, 20000);

    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const code = await this.retrieveCodeWithResend('email', options, excludeCodes);
      await this.clearAny(this.emailCodeInputCandidates);
      await this.typeAny(this.emailCodeInputCandidates, code);
      await this.tapAny(this.emailVerifyButtonCandidates);

      const outcome = await this.waitForCodeOutcome(15000, 'email');
      if (outcome === 'accepted') {
        await browser.pause(2000);
        return;
      }

      excludeCodes.push(code);
      if (attempt < maxRetries) {
        await this.tapResendIfVisible();
        await browser.pause(30000);
      } else {
        throw new Error(`Email verification code rejected repeatedly (tried: ${excludeCodes.join(', ')}).`);
      }
    }
  }

  private async executePhoneNumberStep(phoneNumber: string): Promise<void> {
    await this.findFirstDisplayedSelector(this.phoneInputCandidates, 20000);

    const cleanPhone = phoneNumber.replace(/\D/g, '') || '6163200701';
    await this.clearAny(this.phoneInputCandidates);
    await this.typeAny(this.phoneInputCandidates, cleanPhone);
    await this.tapAny(this.continueButtonCandidates);

    await browser.pause(3000);
  }

  private async executePhoneCodeVerificationStep(
    excludeCodes: string[],
    options?: { googleVoiceProfile?: string }
  ): Promise<void> {
    await this.findFirstDisplayedSelector(this.phoneCodeInputCandidates, 20000);
    await this.dumpScreenIfCandidatesMissing(this.phoneCodeInputCandidates, 'phone-code');

    // Keep retries intentionally low to avoid getting stuck in long resend
    // loops when SMS delivery is down.
    const maxRetries = 1;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const waitForNewCode = attempt > 0;
      let code: string;
      try {
        code = await this.retrieveCodeWithResend(
          'phone',
          options,
          excludeCodes,
          { waitForNewCode }
        );
      } catch (error) {
        if (attempt === 0) {
          throw new Error(
            'Google Voice did not return an eligible latest SMS code on the first check. ' +
            'Stopping without auto-resend to avoid an endless loop.'
          );
        }

        if (attempt < maxRetries) {
          throw new Error(
            'No new Google Voice SMS code arrived after resend wait. Stopping to avoid repeated resend loops.'
          );
        }
        throw error;
      }

      // Google Voice retrieval can take minutes, so re-confirm the field is on screen
      // instead of letting typeAny fall back to a stale selector.
      await this.findFirstDisplayedSelector(this.phoneCodeInputCandidates, 30000);
      await this.clearAny(this.phoneCodeInputCandidates);
      await this.typeAny(this.phoneCodeInputCandidates, code);
      await this.tapAny(this.phoneCodeVerifyButtonCandidates);
      const outcome = await this.waitForCodeOutcome(15000, 'phone');
      if (outcome === 'accepted') {
        await browser.pause(2000);
        return;
      }

      excludeCodes.push(code);
      if (attempt < maxRetries) {
        console.log(`[Phone Verification] Code ${code} failed or rejected. Triggering resend and waiting 30s...`);
        await this.tapResendIfVisible();
        await browser.pause(30000);
      } else {
        throw new Error(`Phone verification code rejected repeatedly (tried: ${excludeCodes.join(', ')}).`);
      }
    }
  }

  /**
   * Fetches a code, submits it, and — if the app reports it as incorrect —
   * resends and retries with a code that isn't one of the ones already
   * rejected, instead of blindly resubmitting the same stale/wrong code.
   * excludeCodes is shared with the caller so a rejection is remembered even
   * if this method is invoked again later for the same channel.
   */
  private async submitCodeWithValidation(
    channel: 'email' | 'phone',
    excludeCodes: string[],
    options?: { googleVoiceProfile?: string }
  ): Promise<void> {
    const maxRejectionRetries = 3;

    for (let rejectionAttempt = 0; rejectionAttempt <= maxRejectionRetries; rejectionAttempt += 1) {
      const code = await this.retrieveCodeWithResend(channel, options, excludeCodes);
      await this.submitVerificationCode(code, channel);

      // The backend validates the code over the network, so the rejection
      // banner can take longer to render than the field submit itself; race
      // it against the input disappearing (meaning the app moved on).
      const outcome = await this.waitForCodeOutcome(20000, channel);
      if (outcome === 'accepted') {
        return;
      }

      excludeCodes.push(code);

      if (rejectionAttempt >= maxRejectionRetries) {
        throw new Error(`${channel} verification code was rejected repeatedly (tried: ${excludeCodes.join(', ')}).`);
      }

      await this.tapResendIfVisible();
      await browser.pause(30000);
    }
  }

  /**
   * Polls until either the "Code incorrect" banner appears (rejected) or the
   * code input is no longer on screen, meaning the app navigated forward
   * (accepted). Treats an ambiguous timeout as a rejection so the caller
   * always resends and retries rather than silently treating it as success.
   */
  private async waitForCodeOutcome(timeoutMs: number, channel: 'email' | 'phone' = 'email'): Promise<'accepted' | 'rejected'> {
    const deadline = Date.now() + timeoutMs;
    const candidates = channel === 'phone' ? this.phoneCodeInputCandidates : this.emailCodeInputCandidates;

    while (Date.now() < deadline) {
      // If email verification has already advanced to the phone step, treat
      // this as accepted immediately instead of continuing to poll email code
      // selectors and triggering false retries.
      if (
        channel === 'email' &&
        await this.isDisplayed(
          this.smsVerificationPrompt,
          this.smsCodeSentPrompt,
          this.phonePrompt,
          ...this.phoneInputCandidates,
          ...this.phoneCodeInputCandidates
        )
      ) {
        return 'accepted';
      }

      if (await this.isDisplayed(this.codeIncorrectPrompt)) {
        return 'rejected';
      }

      if (!(await this.isDisplayed(...candidates))) {
        return 'accepted';
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return 'rejected';
  }

  /** Enters an already-retrieved verification code, replacing any leftover value, and submits it. */
  async submitVerificationCode(code: string, channel: 'email' | 'phone' = 'email'): Promise<void> {
    const candidates = channel === 'phone' ? this.phoneCodeInputCandidates : this.emailCodeInputCandidates;
    await this.clearAny(candidates);
    await this.typeAny(candidates, code);
    await this.tapVerifyOrContinue();
  }

  /** Enters the phone number used for SMS verification and continues. */
  async submitPhoneNumber(phoneNumber: string): Promise<void> {
    await this.typeAny(this.phoneInputCandidates, phoneNumber);
    await this.tapAny(this.continueButtonCandidates);
    await this.waitForCodePrompt(10000).catch(() => {});
  }

  private async tapVerifyOrContinue(): Promise<void> {
    try {
      await this.tapAny(this.emailVerifyButtonCandidates);
    } catch {
      await this.tapAny(this.continueButtonCandidates);
    }
  }

  private async detectVerificationStep(): Promise<'email-code' | 'phone-input' | 'phone-code' | 'none'> {
    const codePrompt = await this.waitForVerificationPrompt(3000);
    if (codePrompt === 'email') {
      return 'email-code';
    }

    if (codePrompt === 'phone') {
      return 'phone-code';
    }

    if (await this.isDisplayed(this.phonePrompt, ...this.phoneInputCandidates)) {
      return 'phone-input';
    }

    return 'none';
  }

  private async retrieveCodeWithResend(
    channel: 'email' | 'phone',
    options?: { googleVoiceProfile?: string },
    excludeCodes: string[] = [],
    behavior?: { waitForNewCode?: boolean }
  ): Promise<string> {
    const gvProfile = channel === 'phone'
      ? resolveGoogleVoiceProfile(options?.googleVoiceProfile)
      : undefined;
    const waitForNewCode = behavior?.waitForNewCode ?? false;
    // For phone verification, resend is controlled by the caller after a code
    // rejection so we do not auto-resend from inside code retrieval.
    const resendAttempts = channel === 'phone' ? 0 : 1;
    // Keep email verification bounded so the flow reaches phone/SMS quickly,
    // while phone verification keeps the full 3-minute retrieval window.
    const timeoutMs = channel === 'phone'
      ? 180000
      : 60000;

    for (let attempt = 0; attempt <= resendAttempts; attempt += 1) {
      try {
        const provider = channel === 'phone'
          ? this.verificationConfig.verification.phone
          : this.verificationConfig.verification.email;
        if (provider === 'manual') {
          return await promptForVerificationCode(channel);
        }

        if (provider === 'yopmail' || provider === 'guerrillamail') {
          const mailbox = this.extractMailboxFromAccountEmail();
          return await getVerificationCode(channel, {
            provider,
            mailbox,
            timeoutMs,
            excludeCodes,
            googleVoiceProfile: options?.googleVoiceProfile,
          });
        }

        return await getVerificationCode(channel, {
          provider,
          timeoutMs,
          excludeCodes,
          googleVoiceProfile: options?.googleVoiceProfile,
          // For phone codes, poll up to timeout instead of single-checking once
          // so we can wait up to 3 minutes before failing.
          singleCheck: channel === 'phone' ? false : undefined,
        });
      } catch (error) {
        console.error(`[${channel.toUpperCase()}] Code retrieval failed on attempt ${attempt + 1}:`, error);
        if (attempt >= resendAttempts) {
          // Always prompt for manual entry as fallback, whether TTY or not
          console.log(`[${channel.toUpperCase()}] Falling back to manual code entry after automated retrieval failed`);
          return await promptForVerificationCode(channel);
        }

        await this.tapResendIfVisible();
        await browser.pause(15000);
      }
    }

    throw new Error(`Unable to retrieve ${channel} verification code.`);
  }

  private extractMailboxFromAccountEmail(): string {
    const email = process.env.MOBILE_TEST_EMAIL || process.env.MOBILE_LOGIN_EMAIL || '';
    const localPart = email.split('@')[0]?.trim();
    if (!localPart) {
      throw new Error('Email verification requires MOBILE_TEST_EMAIL or MOBILE_LOGIN_EMAIL to infer mailbox.');
    }

    return localPart;
  }

  private async tapResendIfVisible(): Promise<void> {
    for (const selector of this.resendButtonCandidates) {
      const element = typeof selector === 'string' ? $(selector) : selector;
      if (await element.isDisplayed().catch(() => false)) {
        await this.tap(selector);
        return;
      }
    }
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

  private async withFastImplicitTimeout<T>(fn: () => Promise<T>, fastMs = 300): Promise<T> {
    try {
      await browser.setTimeout({ implicit: fastMs }).catch(() => {});
      return await fn();
    } finally {
      await browser.setTimeout({ implicit: 3000 }).catch(() => {});
    }
  }

  private async isDisplayed(...selectors: Array<string | any>): Promise<boolean> {
    return await this.withFastImplicitTimeout(async () => {
      for (const selector of selectors) {
        const element: any = typeof selector === 'string' ? $(selector) : selector;
        if (await element.isDisplayed().catch(() => false)) {
          return true;
        }
      }
      return false;
    });
  }

  /** Clears any leftover value (e.g. a previously rejected code) from the first matching input. */
  private async clearAny(selectors: string[]): Promise<void> {
    await this.withFastImplicitTimeout(async () => {
      for (const selector of selectors) {
        const element: any = typeof selector === 'string' ? $(selector) : selector;
        if (await element.isDisplayed().catch(() => false)) {
          await element.clearValue().catch(() => {});
          return;
        }
      }
    });
  }

  // Diagnostic aid: persists the accessibility tree when an expected screen's
  // selectors resolve to nothing, so locator drift can be identified from logs.
  private async dumpScreenIfCandidatesMissing(selectors: string[], label: string): Promise<void> {
    const anyDisplayed = await this.withFastImplicitTimeout(async () => {
      for (const selector of selectors) {
        if (await $(selector).isDisplayed().catch(() => false)) {
          return true;
        }
      }
      return false;
    });

    if (anyDisplayed) {
      return;
    }

    const source = await browser.getPageSource().catch(() => '');
    const outPath = path.resolve(process.cwd(), `mobile/.builds/${label}-screen.xml`);
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, source);
    console.log(`[Diagnostics] No "${label}" selector matched. Page source written to ${outPath}`);
  }

  private async findFirstDisplayedSelector(selectors: string[], timeoutMs = 3000): Promise<string> {    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const match = await this.withFastImplicitTimeout(async () => {
        for (const selector of selectors) {
          const el = typeof selector === 'string' ? $(selector) : selector;
          if (await el.isDisplayed().catch(() => false)) {
            return selector;
          }
        }
        return null;
      });

      if (match) {
        return match;
      }

      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    return selectors[0];
  }

  private async tapAny(selectors: string[]): Promise<void> {
    const targetSelector = await this.findFirstDisplayedSelector(selectors);
    await this.tap(targetSelector);
  }

  private async typeAny(selectors: string[], value: string): Promise<void> {
    const targetSelector = await this.findFirstDisplayedSelector(selectors);
    await this.type(targetSelector, value);
  }

  private async waitForLoginSubmission(timeoutMs = 10000): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (
        await this.isDisplayed(
          ...this.emailVerifyButtonCandidates,
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
