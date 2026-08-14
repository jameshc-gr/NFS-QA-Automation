import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

import { BasePage } from './base.page';
import { getVerificationCode } from '../utils/verification-service';
import { peekLatestGoogleVoicePreview } from '../utils/verification/google-voice';
import {
  expectedEmailVerificationProvider,
  type EmailVerificationProvider,
  getVerificationConfig,
  getMobileEnvironment,
  promptForVerificationCode,
  resolveGoogleVoiceProfile
} from '../utils/mobile-auth';

export class AuthPage extends BasePage {
  private readonly verificationConfig = getVerificationConfig();
  private buildEmailProviderOverride: EmailVerificationProvider | null = null;
  private readonly loginTab = this.byText('Log in');
  private readonly createAccountTab = this.byText('Create account');
  private readonly emailCandidates = this.platform === 'ios'
    // "log_in.field.email" is shared by the label, the input, and the error
    // text, so a bare accessibility id can resolve to the wrong node.
    ? ['//XCUIElementTypeTextField[@name="log_in.field.email"]']
    : [this.byInputLabel('Email')];
  private readonly passwordCandidates = this.platform === 'ios'
    ? ['//XCUIElementTypeSecureTextField[@name="log_in.field.password"]|//XCUIElementTypeTextField[@name="log_in.field.password"]']
    : [this.byInputLabel('Password')];
  private readonly loginButtonCandidates = this.platform === 'ios'
    ? ['~log_in.button.log_in']
    // The submit button's label is not always "Log in" — it renders as "Go!"
    // in some builds/states, sharing the same clickable-row pattern as "Log in".
    : [
        `//android.widget.ScrollView//android.view.View[(.//android.widget.TextView[@text="Log in"] or .//android.widget.TextView[@text="Go!"]) and .//android.widget.Button and @clickable="true"]`,
        `//android.widget.ScrollView//android.widget.Button[.//android.widget.TextView[@text="Log in"] or .//android.widget.TextView[@text="Go!"]]`,
        `//android.widget.TextView[@text="Go!"]/..`,
        `//android.widget.TextView[@text="Log in"]/..`,
        `//android.widget.Button[.//*[@text="Log in"] or .//*[@text="Go!"]]`,
        `//*[contains(@text, "Go!") and @clickable="true"]`,
        `//*[contains(@text, "Log in") and @clickable="true"]`,
        `//*[contains(@text, "Log in")]`
      ];
  // Bare accessibility ids are ambiguous here: the label, the input, and the
  // error text all share the same "*.field.code" id, so filter by element type.
  private readonly emailCodeInputCandidates = this.platform === 'ios'
    ? [
        '//XCUIElementTypeTextField[contains(@name, "confirm_email") and contains(@name, ".field.code")]',
        '//XCUIElementTypeTextField[contains(@name, "log_in") and contains(@name, ".field.code")]',
        // Forgot-password flow uses its own accessibility id prefix (e.g.
        // "forgot_password"/"reset_password"), so fall back to any field
        // whose id still carries the shared ".field.code" suffix, then to
        // any text field at all — safe here since callers only reach this
        // selector after confirming we're on the code-entry screen by title.
        '//XCUIElementTypeTextField[contains(@name, ".field.code")]',
        '//XCUIElementTypeTextField'
      ]
    : [
        this.byInputLabel('6-digit code'),
        `//android.widget.EditText[contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code') or contains(translate(@hint, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code') or contains(translate(@content-desc, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code')]`,
        `//android.widget.EditText`
      ];
  private readonly phoneCodeInputCandidates = this.platform === 'ios'
    ? [
        '//XCUIElementTypeTextField[contains(@name, "verify_sms_number") and contains(@name, ".field.code")]',
        '//XCUIElementTypeTextField[contains(@name, "confirm_phone") and contains(@name, ".field.code")]',
        // Forgot-password SMS reset uses its own accessibility id prefix;
        // fall back the same way as emailCodeInputCandidates above.
        '//XCUIElementTypeTextField[contains(@name, ".field.code")]',
        '//XCUIElementTypeTextField'
      ]
    : [
        this.byInputLabel('6-digit code'),
        `//android.widget.EditText[contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code') or contains(translate(@hint, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code') or contains(translate(@content-desc, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code')]`,
        `//android.widget.EditText`
      ];
  private readonly emailVerifyButtonCandidates = this.platform === 'ios'
    ? [
        '~confirm_email.button.verify',
        '~log_in.button.verify',
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
    ? '//XCUIElementTypeStaticText[@name="Email verification" or @name="Verify it\u2019s you"]'
    : this.byText('Email verification');
  // Forgot-password flow renders a different title ("Verification code via
  // Email") than the create-user flow ("Email verification").
  private readonly resetEmailCodeTitlePrompt = this.platform === 'ios'
    ? '//XCUIElementTypeStaticText[@name="Verification code via Email"]'
    : this.byText('Verification code via Email');
  private readonly resetSmsCodeTitlePrompt = this.platform === 'ios'
    ? '//XCUIElementTypeStaticText[@name="Verification code via SMS"]'
    : this.byText('Verification code via SMS');
  private readonly emailCodeSentPrompt = this.platform === 'ios'
    ? '//XCUIElementTypeStaticText[contains(@name, "code we sent to your email") or contains(@name, "code we sent")]'
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
        '//XCUIElementTypeTextField[contains(@name, "confirm_phone") and (contains(@name, "phone_number") or contains(@name, "phone"))]',
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
  private readonly codeNotValidPrompt = this.platform === 'ios'
    ? '//XCUIElementTypeStaticText[contains(translate(@name, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "not valid") or contains(translate(@name, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "invalid") or contains(translate(@name, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "expired")]'
    : `//android.widget.TextView[contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'not valid') or contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'invalid') or contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'expired')]`;
  // Shown on the reset-password screen when the entered email has no account
  // (e.g. an unregistered/expired test account) — must fail fast, not retry.
  private readonly emailNotRecognizedPrompt = this.platform === 'ios'
    ? '//XCUIElementTypeStaticText[contains(translate(@name, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "don\'t recognize") or contains(translate(@name, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "do not recognize") or contains(translate(@name, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "no account")]'
    : `//android.widget.TextView[contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), "don't recognize") or contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'do not recognize') or contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'no account')]`;
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
  // Post-login app-store-style rating prompt ("Are you enjoying Rate app?"),
  // seen blocking the home-screen check on both platforms.
  private readonly ratingSurveyPrompt = this.platform === 'ios'
    ? '//XCUIElementTypeStaticText[contains(@name, "enjoying")]'
    : `//android.widget.TextView[contains(@text, "enjoying")]`;
  private readonly ratingSurveyDismissCandidates = this.platform === 'ios'
    ? ['~No', '//XCUIElementTypeButton[@name="No" or @label="No"]']
    : [`//android.widget.TextView[@text="No"]`, `//*[contains(@text, "No") and @clickable="true"]`];
  private readonly homeIndicatorCandidates = this.platform === 'ios'
    ? ['~bottom_navigation.button.home']
    : ['//*[contains(@content-desc, "bottom_navigation.button.home")]', this.byText('Home')];
  private readonly profileIconCandidates = this.platform === 'ios'
    ? [
        '~ic_contact_person',
        '~navigation_top.button.dots',
        '~ic_more',
        '//XCUIElementTypeButton[contains(@name, "contact") or contains(@name, "dots") or contains(@name, "more")]'
      ]
    // Compose renders the top-nav profile icon as an anonymous, unlabeled
    // View with no content-desc/resource-id, positioned right after the
    // "Hi <Name>" greeting text.
    : [
        `//android.widget.TextView[starts-with(@text, "Hi ")]/following-sibling::android.view.View[1]`,
        `//android.widget.TextView[starts-with(@text, "Hi ")]/following-sibling::*`,
        `//android.widget.TextView[starts-with(@text, "Hi ")]/..//android.view.View[last()]`,
        `//*[contains(@content-desc, "profile") or contains(@content-desc, "avatar") or contains(@content-desc, "contact") or contains(@content-desc, "more")]`,
        `//android.widget.ImageView[contains(@content-desc, "profile") or contains(@content-desc, "person")]`
      ];
  // Tapping the profile icon opens a menu list (not a "My profile" page);
  // "Settings" is a row in that list, and "Log out" then sits in the
  // Settings page's own top-right nav bar — no scrolling needed for it.
  private readonly settingsMenuItemCandidates = this.platform === 'ios'
    ? ['~Settings, Customize your experience']
    : [
        `//android.widget.TextView[@text="Settings"]/..`,
        `//*[contains(@text, "Settings") and @clickable="true"]`
      ];
  private readonly logoutLinkCandidates = this.platform === 'ios'
    ? [
        '~Log out',
        '//XCUIElementTypeStaticText[@name="Log out"]',
        '//XCUIElementTypeButton[@name="Log out" or @label="Log out"]'
      ]
    : [
        `//android.widget.TextView[@text="Log out"]`,
        `//*[contains(@text, "Log out") and @clickable="true"]`
      ];
  private readonly faceIdContinueButtonCandidates = this.platform === 'ios'
    ? [
        '~Continue',
        '//XCUIElementTypeButton[@name="Continue" or @label="Continue"]'
      ]
    : [this.byText('Continue')];
  private readonly forgotPasswordLinkCandidates = this.platform === 'ios'
    ? [
        '~log_in.button.forgot_password',
        '~Forgot password?',
        '~Forgot password',
        '//XCUIElementTypeButton[contains(@name, "Forgot") or contains(@label, "Forgot")]',
        '//XCUIElementTypeStaticText[contains(@name, "Forgot") or contains(@label, "Forgot")]'
      ]
    : [
        `//*[contains(@text, "Forgot password?") and @clickable="true"]`,
        `//*[contains(@text, "Forgot password") and @clickable="true"]`,
        `//android.widget.TextView[contains(@text, "Forgot password")]/..`,
        `//android.widget.TextView[contains(@text, "Forgot password")]`,
        `//*[contains(@content-desc, "forgot_password")]`
      ];
  private readonly resetEmailInputCandidates = this.platform === 'ios'
    ? [
        '//XCUIElementTypeTextField[contains(@name, "email") or contains(@name, "reset")]',
        '//XCUIElementTypeTextField'
      ]
    : [
        this.byInputLabel('Email'),
        `//android.widget.EditText[contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'email') or contains(translate(@hint, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'email')]`,
        `//android.widget.EditText`
      ];
  private readonly resetSubmitButtonCandidates = this.platform === 'ios'
    ? [
        '~Reset via email',
        '~Reset via Email',
        '~Send reset link',
        '~Reset',
        '//XCUIElementTypeButton[contains(@name, "Reset") or contains(@name, "Send") or @label="Reset via email" or @label="Send reset link" or @label="Reset" or @label="Continue"]'
      ]
    : [
        this.byText('Reset via Email'),
        this.byText('Reset via email'),
        `//android.widget.TextView[contains(@text, "Reset via Email") or contains(@text, "Reset via email")]/..`,
        `//android.widget.TextView[contains(@text, "Reset via Email") or contains(@text, "Reset via email")]`,
        `//*[(contains(@text, "Reset via Email") or contains(@text, "Reset via email") or contains(@text, "Send reset link") or contains(@text, "Reset")) and @clickable="true"]`,
        `//android.widget.Button[contains(@text, "Reset via Email") or contains(@text, "Reset via email") or contains(@text, "Reset")]`,
        `//*[contains(@text, "Reset via Email") and @clickable="true"]`,
        `//*[contains(@text, "Reset via email") and @clickable="true"]`
      ];
  private readonly resetViaSmsButtonCandidates = this.platform === 'ios'
    ? [
        '~Reset via SMS',
        '~Reset via sms',
        '//XCUIElementTypeButton[contains(@name, "SMS") or contains(@label, "SMS")]'
      ]
    : [
        this.byText('Reset via SMS'),
        this.byText('Reset via sms'),
        `//android.widget.TextView[contains(@text, "Reset via SMS") or contains(@text, "Reset via sms")]/..`,
        `//android.widget.TextView[contains(@text, "Reset via SMS") or contains(@text, "Reset via sms")]`,
        `//*[(contains(@text, "Reset via SMS") or contains(@text, "Reset via sms")) and @clickable="true"]`,
        `//android.widget.Button[contains(@text, "Reset via SMS") or contains(@text, "Reset via sms")]`
      ];
  private readonly newPasswordInputCandidates = this.platform === 'ios'
    ? [
        '//XCUIElementTypeSecureTextField[contains(@name, "new_password") or contains(@name, "password")]',
        '//XCUIElementTypeSecureTextField[@name="password"]',
        '//XCUIElementTypeSecureTextField[1]',
        '//XCUIElementTypeTextField[contains(@name, "new_password") or contains(@name, "password")]',
        '//XCUIElementTypeTextField[1]',
        '//XCUIElementTypeSecureTextField',
        'XCUIElementTypeSecureTextField'
      ]
    : [
        this.byInputLabel('New password'),
        this.byInputLabel('Password'),
        `//android.widget.EditText[contains(translate(@hint, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'new') or contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'new')]`,
        `(//android.widget.EditText)[1]`
      ];
  private readonly confirmPasswordInputCandidates = this.platform === 'ios'
    ? [
        '//XCUIElementTypeSecureTextField[contains(@name, "confirm_password") or contains(@name, "confirm")]',
        '//XCUIElementTypeSecureTextField[2]',
        '//XCUIElementTypeTextField[contains(@name, "confirm_password") or contains(@name, "confirm")]'
      ]
    : [
        this.byInputLabel('Confirm password'),
        `//android.widget.EditText[contains(translate(@hint, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'confirm') or contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'confirm')]`,
        `(//android.widget.EditText)[2]`
      ];
  private readonly saveNewPasswordButtonCandidates = this.platform === 'ios'
    ? [
        '~Update password',
        '~Update',
        '~Save',
        '~Set password',
        '~Reset password',
        '~Continue',
        '//XCUIElementTypeButton[contains(@name, "Update") or contains(@name, "Save") or contains(@name, "Set") or contains(@name, "Reset") or contains(@name, "Continue") or @label="Update password" or @label="Save" or @label="Continue"]'
      ]
    : [
        this.byText('Update password'),
        `//android.widget.TextView[@text="Update password"]/..`,
        `//android.widget.TextView[@text="Update password"]`,
        this.byText('Update'),
        this.byText('Save'),
        this.byText('Set password'),
        this.byText('Reset password'),
        this.byText('Continue'),
        `//android.widget.TextView[contains(@text, "Update password") or contains(@text, "Update") or contains(@text, "Save") or contains(@text, "Continue") or contains(@text, "Reset")]/..`,
        `//android.widget.TextView[contains(@text, "Update password") or contains(@text, "Update") or contains(@text, "Save") or contains(@text, "Continue") or contains(@text, "Reset")]`,
        `//*[(contains(@text, "Update password") or contains(@text, "Update") or contains(@text, "Save") or contains(@text, "Set password") or contains(@text, "Reset password") or contains(@text, "Continue") or contains(@text, "Submit")) and @clickable="true"]`,
        `//android.widget.Button[contains(@text, "Update") or contains(@text, "Save") or contains(@text, "Continue") or contains(@text, "Reset")]`
      ];

  private readonly backButtonCandidates = this.platform === 'ios'
    ? [
        '~navigation_top.button.back',
        '~Back',
        '//XCUIElementTypeButton[contains(@name, "Back") or contains(@label, "Back")]'
      ]
    : [
        `//android.widget.ImageButton[contains(@content-desc, "Back") or contains(@content-desc, "Navigate up")]`,
        `//*[contains(@content-desc, "Back") or contains(@content-desc, "back") or contains(@content-desc, "Navigate up")]`,
        `//android.widget.Button[@text="" and @bounds="[22,95][127,200]"]`,
        `//android.view.View[@bounds="[12,85][138,211]"]`
      ];

  /**
   * Cold app starts (especially right after a data clear or fresh install)
   * can sit on the splash screen far longer than a warm relaunch, so this
   * waits generously for either auth tab instead of assuming a fixed delay.
   */
  async waitForAuthScreenReady(timeoutMs = 60000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.isDisplayed(this.loginTab, this.createAccountTab)) {
        return;
      }
      if (await this.isDisplayed(...this.backButtonCandidates)) {
        await this.tapAny(this.backButtonCandidates).catch(() => {});
        await browser.pause(1000);
      }
      await browser.pause(500);
    }

    await this.assertPageVerbiage('auth screen (Log in / Create account)', [
      this.loginTab,
      this.createAccountTab
    ], 5000);
  }

  async openLogin(): Promise<void> {
    await this.tap(this.loginTab);
  }

  async openCreateAccount(): Promise<void> {
    await this.tap(this.createAccountTab);
  }

  async openForgotPassword(): Promise<void> {
    await this.tapAny(this.forgotPasswordLinkCandidates);
  }

  async submitForgotPasswordEmail(email: string): Promise<void> {
    await this.assertPageVerbiage('reset password screen', [
      this.byText('Reset your password'),
      ...this.resetEmailInputCandidates
    ], 15000);

    await this.typeAny(this.resetEmailInputCandidates, email);
    if (this.platform === 'android') {
      await this.hideKeyboard();
    }
    await this.tapAny(this.resetSubmitButtonCandidates);

    // Race the "email not recognized" error against actually reaching the code
    // screen — the generic EditText fallback in emailCodeInputCandidates would
    // otherwise still match the reset screen's own email field and mask this.
    const outcome = await this.raceEmailNotRecognizedVsCodeScreen(20000);
    if (outcome === 'not-recognized') {
      throw new Error(
        `Reset via email failed: the app does not recognize "${email}" as an existing account. ` +
        `Use a previously created/verified account (see test-data/mobile-app/created-accounts.json) instead of a random email.`
      );
    }
    if (outcome === 'timeout') {
      await this.dumpScreenIfCandidatesMissing([this.emailVerificationPrompt], 'reset-email-verification-code-input');
      throw new Error('Expected to reach the reset email verification code screen but it never appeared.');
    }
  }

  async submitForgotPasswordSms(email: string): Promise<void> {
    await this.assertPageVerbiage('reset password screen', [
      this.byText('Reset your password'),
      ...this.resetEmailInputCandidates
    ], 15000);

    await this.typeAny(this.resetEmailInputCandidates, email);
    if (this.platform === 'android') {
      await this.hideKeyboard();
    }
    await this.tapAny(this.resetViaSmsButtonCandidates);

    const outcome = await this.raceEmailNotRecognizedVsCodeScreen(20000, 'sms');
    if (outcome === 'not-recognized') {
      throw new Error(
        `Reset via SMS failed: the app does not recognize "${email}" as an existing account. ` +
        `Use a previously created/verified account (see test-data/mobile-app/created-accounts.json) instead of a random email.`
      );
    }
    if (outcome === 'timeout') {
      await this.dumpScreenIfCandidatesMissing([this.smsVerificationPrompt], 'reset-sms-verification-code-input');
      throw new Error('Expected to reach the reset SMS verification code screen but it never appeared.');
    }
  }

  /** Polls for the "email not recognized" error vs. arrival at the code-entry screen, using non-generic selectors only. */
  private async raceEmailNotRecognizedVsCodeScreen(
    timeoutMs: number,
    channel: 'email' | 'sms' = 'email'
  ): Promise<'not-recognized' | 'code-screen' | 'timeout'> {
    const codeScreenSelectors = channel === 'sms'
      ? [this.smsVerificationPrompt, this.smsCodeSentPrompt, this.resetSmsCodeTitlePrompt]
      : [this.emailVerificationPrompt, this.emailCodeSentPrompt, this.resetEmailCodeTitlePrompt];

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.isDisplayed(this.emailNotRecognizedPrompt)) {
        return 'not-recognized';
      }
      if (await this.isDisplayed(...codeScreenSelectors)) {
        return 'code-screen';
      }
      await browser.pause(300);
    }
    return 'timeout';
  }

  async completeResetEmailVerification(email: string): Promise<void> {
    this.assertEnvironmentMatchesBuild();
    const excludeCodes: string[] = [];
    const emailTitleHint = email.trim().toLowerCase();

    console.log(`[Reset Email Verification] Waiting for verification code sent to ${email} (searching title for "reset password" and ${emailTitleHint})...`);
    await this.findFirstDisplayedSelector(this.emailCodeInputCandidates, 20000);

    // Keep retrying until a code is accepted. The test timeout (10 min) is the
    // ultimate guardrail, but we cap the loop slightly below it so we can fail
    // with a clear message instead of a generic timeout.
    const globalDeadline = Date.now() + 9 * 60 * 1000;

    while (Date.now() < globalDeadline) {
      // retrieveCodeWithResend will only return codes from emails whose title
      // matches the account email address AND contains "Reset password", and it will skip any codes already
      // tried and rejected by the app.
      const code = await this.retrieveCodeWithResend(
        'email',
        undefined,
        excludeCodes,
        { emailTitleHint, emailSubjectMustContain: 'reset password' }
      );

      console.log(`[Reset Email Verification] Entering code ${code}...`);
      await this.clearAny(this.emailCodeInputCandidates);
      await this.typeAny(this.emailCodeInputCandidates, code);
      await this.tapAny(this.emailVerifyButtonCandidates);

      const outcome = await this.waitForCodeOutcome(15000, 'email');
      if (outcome === 'accepted') {
        console.log('[Reset Email Verification] Code accepted successfully!');
        await browser.pause(2000);
        return;
      }

      const inlineMessage = await this.readInlineCodeValidationMessage();
      excludeCodes.push(code);

      console.warn(`[Reset Email Verification] Code ${code} rejected (message: "${inlineMessage}"). Clearing input and waiting for a fresh verification email...`);

      if (!inlineMessage.includes('expired') && !inlineMessage.includes('invalid') && !inlineMessage.includes('not valid')) {
        throw new Error(`Reset email verification blocked by unexpected inline message: "${inlineMessage}"`);
      }

      // Delete the rejected code from the input field as requested, then loop
      // to fetch a fresh code from a new verification email whose title
      // matches the account email address.
      await this.clearAny(this.emailCodeInputCandidates);
      await browser.pause(5000);
    }

    throw new Error(`Reset email verification failed: unable to obtain a valid code for ${email} before timeout.`);
  }

  async completeResetSmsVerification(options?: { googleVoiceProfile?: string }): Promise<void> {
    const excludeCodes: string[] = [];
    const gvProfile = resolveGoogleVoiceProfile(options?.googleVoiceProfile);
    const gvBaselinePreview = await peekLatestGoogleVoicePreview({
      sessionPath: gvProfile.sessionPath,
      headless: gvProfile.headless,
    }).catch(() => '');

    console.log('[Reset SMS Verification] Waiting for SMS code via Google Voice...');
    await this.executePhoneCodeVerificationStep(excludeCodes, options, gvBaselinePreview);
  }

  async setNewPassword(preferredPassword?: string): Promise<string> {
    const defaultCandidates = [
      preferredPassword,
      'TestNewP@ssw0rd!2026',
      'AltP@ssw0rd#2026',
      'SecureReset!9876',
      'GR@teSuperApp2026!'
    ].filter((p): p is string => Boolean(p && p.trim().length >= 8));

    const resetScreenPrompt = this.platform === 'ios'
      ? '//XCUIElementTypeStaticText[@name="Reset your password" or @label="Reset your password"]'
      : `//android.widget.TextView[@text="Reset your password"]`;

    for (const password of defaultCandidates) {
      console.log(`[Reset Password] Attempting password...`);
      
      try {
        if (this.platform === 'ios') {
          // iOS: Use type() method which has iOS-specific logic
          await this.type('//XCUIElementTypeSecureTextField[1]', password);
          console.log(`[Reset Password] New password field filled`);
          
          // Press Tab to move to confirm field
          await browser.keys(['Tab']);
          await browser.pause(500);
          
          // Fill confirm field
          try {
            await this.type('//XCUIElementTypeSecureTextField[2]', password);
            console.log(`[Reset Password] Confirm password field filled`);
          } catch (e) {
            console.log(`[Reset Password] Could not fill confirm field: ${e}, continuing...`);
            // Maybe form only needs one field, continue to button
          }
        } else {
          // Android: Use existing logic
          await this.clearAny(this.newPasswordInputCandidates);
          await this.typeAny(this.newPasswordInputCandidates, password);
          
          if (await this.isDisplayed(...this.confirmPasswordInputCandidates)) {
            await this.clearAny(this.confirmPasswordInputCandidates);
            await this.typeAny(this.confirmPasswordInputCandidates, password);
          }
        }
      } catch (e) {
        console.log(`[Reset Password] Failed to fill fields: ${e}`);
        continue;
      }

      if (this.platform === 'android') {
        await this.hideKeyboard();
      } else {
        // iOS: dismiss keyboard with Escape or Tab+Return
        await browser.keys(['Escape']).catch(() => {});
      }

      await browser.pause(500);
      console.log(`[Reset Password] Tapping Update button...`);
      try {
        await this.tapAny(this.saveNewPasswordButtonCandidates);
      } catch (e) {
        console.log(`[Reset Password] Button tap failed: ${e}`);
        continue;
      }

      // Wait up to 10 seconds for reset screen to dismiss
      const successDeadline = Date.now() + 10000;
      let transitioned = false;
      while (Date.now() < successDeadline) {
        const stillOnResetScreen = await this.isDisplayed(resetScreenPrompt);
        if (!stillOnResetScreen) {
          transitioned = true;
          break;
        }
        await browser.pause(500);
      }

      if (transitioned) {
        console.log(`[Reset Password] ✓ Password reset successful!`);
        await browser.pause(2000);
        return password;
      }

      const errorText = await this.readInlinePasswordValidationMessage();
      if (errorText) {
        console.warn(`[Reset Password] Error: "${errorText}" - retrying...`);
      } else {
        console.warn(`[Reset Password] Button click didn't advance screen - retrying...`);
      }
    }

    throw new Error('Failed to set a new password after trying all candidate passwords.');
  }

  private async readInlinePasswordValidationMessage(): Promise<string> {
    const errorSelectors = this.platform === 'ios'
      ? [
          '//XCUIElementTypeStaticText[contains(@name, "error") or contains(@name, "invalid") or contains(@name, "previously") or contains(@name, "match") or contains(@name, "cannot")]'
        ]
      : [
          `//android.widget.TextView[contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'error') or contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'previously') or contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'cannot') or contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'match')]`
        ];

    return await this.withFastImplicitTimeout(async () => {
      for (const selector of errorSelectors) {
        const el: any = $(selector);
        if (await el.isDisplayed().catch(() => false)) {
          return String(await el.getText().catch(() => '') || '').trim();
        }
      }
      return '';
    });
  }

  async login(email: string, password: string): Promise<void> {
    await this.typeAny(this.emailCandidates, email);
    await this.typeAny(this.passwordCandidates, password);
    // The soft keyboard's "Go!" IME action can cover/intercept the submit
    // button's on-screen area on Android, causing tapAny to hit the wrong
    // element (e.g. the "Log in" tab instead of the submit button).
    if (this.platform === 'android') {
      await this.hideKeyboard();
      // The submit button lives in a lazily-rendered ScrollView and can be
      // absent from the tree until scrolled into view; without this, the
      // short poll below falls back to the ambiguous "Log in" tab instead.
      const specificLoginButtonCandidates = this.loginButtonCandidates.slice(0, 2);
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline && !(await this.isDisplayed(...specificLoginButtonCandidates))) {
        await this.scrollDown();
      }
      if (!(await this.isDisplayed(...specificLoginButtonCandidates))) {
        await browser.saveScreenshot(path.resolve(process.cwd(), 'mobile/.builds/android-login-button-missing.png')).catch(() => {});
        const source = await browser.getPageSource().catch(() => '');
        writeFileSync(path.resolve(process.cwd(), 'mobile/.builds/android-login-button-missing.xml'), source);
        console.log('[Diagnostics] Specific login button candidates not found; dumped android-login-button-missing.{png,xml}');
      }
    }
    await this.tapAny(this.loginButtonCandidates);
    await this.waitForLoginSubmission();
  }

  /** Real navigation path: Home > profile icon (top right) > menu list > Settings > Log out (top-right of Settings). */
  async logout(): Promise<void> {
    console.log('[Logout] Navigating to logout...');
    await this.dismissLoanOfficerModalIfPresent();
    await this.dismissRatingSurveyIfPresent();

    await this.tapAny(this.profileIconCandidates);
    await browser.pause(1000);
    await this.tapAny(this.settingsMenuItemCandidates);
    await browser.pause(1000);
    await this.tapAny(this.logoutLinkCandidates);
    await browser.pause(2000);
    console.log('[Logout] Logged out successfully.');
  }

  /**
   * Login-time email verification must always use Guerrilla Mail regardless of
   * environment. Create-user flow still follows env-based routing.
   */
  async completeLoginVerification(loginEmail: string): Promise<boolean> {
    void loginEmail;
    const previousOverride = this.buildEmailProviderOverride;
    this.buildEmailProviderOverride = 'guerrillamail';

    try {
      return await this.completeVerificationIfPresent();
    } finally {
      this.buildEmailProviderOverride = previousOverride;
    }
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
    await this.assertPageVerbiage('email verification', [
      this.emailVerificationPrompt,
      this.emailCodeSentPrompt,
      this.genericEnterCodePrompt,
      ...this.emailCodeInputCandidates
    ]);
    await this.executeEmailVerificationStep(excludeCodesByChannel.email, options);

    // STEP 2/3: Phone verification. Some accounts/builds skip straight to the
    // post-signup modal/home after email, so detect which screen actually
    // rendered instead of assuming phone verification always runs.
    const postEmailStep = await this.detectPostEmailStep();
    if (postEmailStep === 'phone-entry') {
      await this.assertPageVerbiage('phone number entry', [this.phonePrompt, ...this.phoneInputCandidates], 5000);
      const gvProfile = resolveGoogleVoiceProfile(options?.googleVoiceProfile);
      const phoneNumber = options?.phoneNumber || gvProfile.phoneNumber || this.verificationConfig.verification.phoneNumber || '6163200701';

      // Snapshot the inbox before the app can possibly send a new SMS, so the
      // retriever can later prove a message is genuinely new instead of
      // trusting a fuzzy relative-time string (which misjudged a multi-hour-old
      // message as "fresh" in practice).
      const gvBaselinePreview = await peekLatestGoogleVoicePreview({
        sessionPath: gvProfile.sessionPath,
        headless: gvProfile.headless,
      }).catch(() => '');

      await this.executePhoneNumberStep(phoneNumber);

      await this.assertPageVerbiage('phone code verification', [
        this.smsVerificationPrompt,
        this.smsCodeSentPrompt,
        this.smsEnterCodePrompt,
        ...this.phoneCodeInputCandidates
      ], 5000);
      await this.executePhoneCodeVerificationStep(excludeCodesByChannel.phone, options, gvBaselinePreview);
    } else if (postEmailStep === 'post-signup') {
      console.log('[Verification] Phone verification not required for this account/build; proceeding to post-signup flow.');
    } else {
      throw new Error(
        'After email verification, neither the phone entry screen nor the post-signup screen was detected.'
      );
    }

    await this.dismissLoanOfficerModalIfPresent();
    await this.completeFaceIdOnboarding();
    await this.dismissLoanOfficerModalIfPresent();

    const reachedHome = await this.waitForHomeScreen();
    if (!reachedHome) {
      throw new Error('Account creation did not land on the home screen after all verification steps.');
    }
    await this.assertPageVerbiage('home screen', this.homeIndicatorCandidates, 5000);
  }

  /**
   * Confirms the app shows the expected step's verbiage/inputs before the
   * caller proceeds, so a stale or unexpected screen fails fast with a clear
   * error instead of silently typing into the wrong field.
   */
  private async assertPageVerbiage(
    stepName: string,
    candidates: Array<string | any>,
    timeoutMs = 20000
  ): Promise<void> {
    const found = await this.isDisplayedWithTimeout(candidates, timeoutMs);
    if (!found) {
      await this.dumpScreenIfCandidatesMissing(
        candidates.filter((c): c is string => typeof c === 'string'),
        `page-verbiage-${stepName.replace(/\s+/g, '-')}`
      );
      throw new Error(`Expected to be on the "${stepName}" page but its verbiage/inputs were not found.`);
    }

    console.log(`[Page Verbiage] Confirmed on "${stepName}" page.`);
  }

  private async isDisplayedWithTimeout(candidates: Array<string | any>, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.isDisplayed(...candidates)) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return false;
  }

  /**
   * After email verification, some accounts/builds require a phone step and
   * some skip straight to the post-signup modal/home. Poll for whichever
   * screen actually renders instead of assuming a fixed sequence.
   */
  private async detectPostEmailStep(timeoutMs = 15000): Promise<'phone-entry' | 'post-signup' | 'unknown'> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.isDisplayed(this.phonePrompt, ...this.phoneInputCandidates)) {
        return 'phone-entry';
      }
      if (
        await this.isDisplayed(
          this.loanOfficerPrompt,
          this.ratingSurveyPrompt,
          ...this.homeIndicatorCandidates
        )
      ) {
        return 'post-signup';
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return 'unknown';
  }

  // A QA build emails the Outlook mailbox while a prod build emails Guerrilla Mail,
  // so a mismatch here silently polls an inbox that will never receive the code.
  private assertEnvironmentMatchesBuild(): void {
    const environment = getMobileEnvironment();
    const expectedEmailProvider = expectedEmailVerificationProvider(environment);
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

    const appIdLower = appId.toLowerCase();
    const isNonProdBuild = appIdLower.endsWith('.qa') || appIdLower.endsWith('.stage') || appIdLower.endsWith('.dev');
    const buildEnvironment = isNonProdBuild ? 'qa' : 'prod';
    const buildExpectedEmailProvider = expectedEmailVerificationProvider(buildEnvironment);
    this.buildEmailProviderOverride = buildExpectedEmailProvider;

    console.log(
      `[Verification] env=${environment} app=${appId} emailSource=${this.verificationConfig.verification.email} expectedEmailSource=${expectedEmailProvider} buildExpectedEmailSource=${buildExpectedEmailProvider}`
    );

    if (buildExpectedEmailProvider !== expectedEmailProvider) {
      console.warn(
        `[Verification] MOBILE_ENV=${environment} does not match detected build (${buildEnvironment}). ` +
        `Email verification will use ${buildExpectedEmailProvider} for this run.`
      );
    }
  }

  private getEffectiveEmailProvider(): EmailVerificationProvider {
    return this.buildEmailProviderOverride || (this.verificationConfig.verification.email as EmailVerificationProvider);
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

  async dismissRatingSurveyIfPresent(): Promise<void> {
    if (!(await this.isDisplayed(this.ratingSurveyPrompt))) {
      return;
    }

    console.log('[Modal] "Are you enjoying Rate app?" survey shown — dismissing.');
    await this.tapAny(this.ratingSurveyDismissCandidates);
    await browser.pause(1000);
  }

  async waitForHomeScreen(timeoutMs = 20000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.isDisplayed(...this.homeIndicatorCandidates)) {
        return true;
      }

      await this.dismissLoanOfficerModalIfPresent();
      await this.dismissRatingSurveyIfPresent();
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
    const emailTitleHint = await this.resolveVerificationTitleEmailHint();
    console.log(`[Email Verification] Matching inbox emails with title hint: "${emailTitleHint || ''}"`);

    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const code = await this.retrieveCodeWithResend(
        'email',
        options,
        excludeCodes,
        { emailTitleHint }
      );
      await this.clearAny(this.emailCodeInputCandidates);
      await this.typeAny(this.emailCodeInputCandidates, code);
      await this.tapAny(this.emailVerifyButtonCandidates);

      const outcome = await this.waitForCodeOutcome(15000, 'email');
      if (outcome === 'accepted') {
        await browser.pause(2000);
        return;
      }

      const inlineMessage = await this.readInlineCodeValidationMessage();
      excludeCodes.push(code);

      if (inlineMessage.includes('not valid') || inlineMessage.includes('invalid')) {
        console.warn(
          `[Email Verification] Code ${code} marked invalid by inline validation. ` +
          `Re-checking inbox with title hint ${emailTitleHint || '(none)'} before resend.`
        );
        continue;
      }

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
    options?: { googleVoiceProfile?: string },
    gvBaselinePreview?: string
  ): Promise<void> {
    await this.findFirstDisplayedSelector(this.phoneCodeInputCandidates, 20000);
    await this.dumpScreenIfCandidatesMissing(this.phoneCodeInputCandidates, 'phone-code');

    // Google Voice freshness fallback can still hand back a code the app
    // rejects, so allow a few resend cycles rather than failing immediately.
    const maxRetries = 3;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const waitForNewCode = attempt > 0;
      let code: string;
      try {
        code = await this.retrieveCodeWithResend(
          'phone',
          options,
          excludeCodes,
          { waitForNewCode, gvBaselinePreview }
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
      const outcome = await this.waitForCodeOutcome(20000, 'phone');
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
    behavior?: { waitForNewCode?: boolean; emailTitleHint?: string; emailSubjectMustContain?: string; gvBaselinePreview?: string }
  ): Promise<string> {
    const gvProfile = channel === 'phone'
      ? resolveGoogleVoiceProfile(options?.googleVoiceProfile)
      : undefined;
    const waitForNewCode = behavior?.waitForNewCode ?? false;
    // For phone verification, resend is controlled by the caller after a code
    // rejection so we do not auto-resend from inside code retrieval.
    // Email verification keeps one built-in resend attempt so the inbox has a
    // fresh chance to deliver before falling back to manual entry.
    const resendAttempts = channel === 'phone' ? 0 : 1;
    // Keep email verification bounded so the flow reaches phone/SMS quickly,
    // while phone verification keeps the full 3-minute retrieval window.
    const timeoutMs = channel === 'phone'
      ? 180000
      : 180000;

    for (let attempt = 0; attempt <= resendAttempts; attempt += 1) {
      const provider = channel === 'phone'
        ? this.verificationConfig.verification.phone
        : this.getEffectiveEmailProvider();

      try {
        if (provider === 'manual') {
          return await promptForVerificationCode(channel);
        }

        if (provider === 'guerrillamail') {
          const mailbox = this.extractMailboxFromAccountEmail();
          const domain = this.extractDomainFromAccountEmail();
          return await getVerificationCode(channel, {
            provider,
            mailbox,
            domain,
            timeoutMs,
            excludeCodes,
            subjectMustContain: channel === 'email' ? behavior?.emailSubjectMustContain : undefined,
            googleVoiceProfile: options?.googleVoiceProfile,
          });
        }

        return await getVerificationCode(channel, {
          provider,
          timeoutMs,
          excludeCodes,
          titleMustContain: channel === 'email' ? behavior?.emailTitleHint : undefined,
          subjectMustContain: channel === 'email' ? behavior?.emailSubjectMustContain : undefined,
          baselinePreviewText: channel === 'phone' ? behavior?.gvBaselinePreview : undefined,
          googleVoiceProfile: options?.googleVoiceProfile,
          // For phone codes, poll up to timeout instead of single-checking once
          // so we can wait up to 3 minutes before failing.
          singleCheck: channel === 'phone' ? false : undefined,
        });
      } catch (error) {
        console.error(`[${channel.toUpperCase()}] Code retrieval failed on attempt ${attempt + 1}:`, error);
        if (attempt >= resendAttempts) {
          if (channel === 'email' && provider === 'outlook') {
            throw new Error(
              'Outlook automated email retrieval failed. Manual fallback is disabled for this flow.'
            );
          }

          // Always prompt for manual entry as fallback, whether TTY or not
          console.log(`[${channel.toUpperCase()}] Falling back to manual code entry after automated retrieval failed`);
          return await promptForVerificationCode(channel);
        }

        await this.tapResendIfVisible();
        // Wait up to 3 minutes for the resent verification email/SMS to arrive
        // before giving the next attempt a chance to retrieve a new code.
        await browser.pause(180000);
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

  private extractDomainFromAccountEmail(): string | undefined {
    const email = process.env.MOBILE_TEST_EMAIL || process.env.MOBILE_LOGIN_EMAIL || '';
    const domain = email.split('@')[1]?.trim();
    return domain;
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

  private async findFirstDisplayedSelector(selectors: Array<string | any>, timeoutMs = 3000): Promise<string | any> {
    const deadline = Date.now() + timeoutMs;

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

  private async tapAny(selectors: Array<string | any>): Promise<void> {
    const targetSelector = await this.findFirstDisplayedSelector(selectors);
    await this.tap(targetSelector);
  }

  private async typeAny(selectors: Array<string | any>, value: string): Promise<void> {
    const targetSelector = await this.findFirstDisplayedSelector(selectors);
    await this.type(targetSelector, value);
  }

  private async waitForLoginSubmission(timeoutMs = 10000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    const loginErrorPrompt = this.platform === 'ios'
      ? '//XCUIElementTypeStaticText[contains(@name, "incorrect") or contains(@name, "error") or contains(@name, "invalid")]'
      : `//android.widget.TextView[contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'incorrect') or contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'error') or contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'invalid')]`;

    while (Date.now() < deadline) {
      // Check for login success (progressed to next screen)
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

      // Check for login failure (error message displayed)
      if (await this.isDisplayed(loginErrorPrompt)) {
        const errorText = await $(loginErrorPrompt).getText().catch(() => 'Unknown error');
        throw new Error(`Login failed: ${errorText}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  private async readInlineCodeValidationMessage(): Promise<string> {
    const messages = [this.codeNotValidPrompt, this.codeIncorrectPrompt];
    const text = await this.withFastImplicitTimeout(async () => {
      for (const selector of messages) {
        const element: any = typeof selector === 'string' ? $(selector) : selector;
        if (await element.isDisplayed().catch(() => false)) {
          const value = String(await element.getText().catch(() => '') || '').trim();
          if (value) {
            return value;
          }
        }
      }
      return '';
    });

    return text.toLowerCase();
  }

  private async resolveVerificationTitleEmailHint(): Promise<string | undefined> {
    const configured = (process.env.MOBILE_TEST_EMAIL || process.env.MOBILE_LOGIN_EMAIL || '').trim().toLowerCase();
    if (configured) {
      return configured;
    }

    const source = await browser.getPageSource().catch(() => '');
    const matches = source.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
    const candidate = matches[0]?.toLowerCase();
    return candidate || undefined;
  }
}
