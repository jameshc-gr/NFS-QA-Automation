import { SelectorList } from '../selector-engine';

function byText(text: string): string {
  return `~${text}`;
}

export const authSelectors = {
  loginTab: '~Log in',
  createAccountTab: '~Create account',

  emailInput: [
    '//XCUIElementTypeTextField[@name="log_in.field.email"]',
  ] as SelectorList,

  passwordInput: [
    '//XCUIElementTypeSecureTextField[@name="log_in.field.password"]|//XCUIElementTypeTextField[@name="log_in.field.password"]',
  ] as SelectorList,

  loginButton: [
    '~log_in.button.log_in',
  ] as SelectorList,

  forgotPasswordLink: [
    '~log_in.button.forgot_password',
    '~Forgot password?',
    '~Forgot password',
    '//XCUIElementTypeButton[contains(@name, "Forgot") or contains(@label, "Forgot")]',
    '//XCUIElementTypeStaticText[contains(@name, "Forgot") or contains(@label, "Forgot")]',
  ] as SelectorList,

  emailCodeInput: [
    '//XCUIElementTypeTextField[contains(@name, "confirm_email") and contains(@name, ".field.code")]',
    '//XCUIElementTypeTextField[contains(@name, "log_in") and contains(@name, ".field.code")]',
    '//XCUIElementTypeTextField[contains(@name, ".field.code")]',
    '//XCUIElementTypeTextField',
  ] as SelectorList,

  phoneCodeInput: [
    '//XCUIElementTypeTextField[contains(@name, "verify_sms_number") and contains(@name, ".field.code")]',
    '//XCUIElementTypeTextField[contains(@name, "confirm_phone") and contains(@name, ".field.code")]',
    '//XCUIElementTypeTextField[contains(@name, ".field.code")]',
    '//XCUIElementTypeTextField',
  ] as SelectorList,

  emailVerifyButton: [
    '~confirm_email.button.verify',
    '~log_in.button.verify',
    '//XCUIElementTypeButton[contains(@name, "verify") or @label="Verify"]',
  ] as SelectorList,

  phoneCodeVerifyButton: [
    '~verify_sms_number.button.verify',
    '~confirm_phone.button.verify',
    '~confirm_phone.button.continue',
    '//XCUIElementTypeButton[contains(@name, "verify") or contains(@name, "continue") or @label="Verify" or @label="Continue"]',
  ] as SelectorList,

  emailVerificationPrompt: '//XCUIElementTypeStaticText[@name="Email verification" or @name="Verify it\u2019s you"]',

  resetEmailCodeTitlePrompt: '//XCUIElementTypeStaticText[@name="Verification code via Email"]',

  resetSmsCodeTitlePrompt: '//XCUIElementTypeStaticText[@name="Verification code via SMS"]',

  emailCodeSentPrompt: '//XCUIElementTypeStaticText[contains(@name, "code we sent to your email") or contains(@name, "code we sent")]',

  genericEnterCodePrompt: '//XCUIElementTypeStaticText[contains(@name, "digit code")]',

  smsVerificationPrompt: '//XCUIElementTypeStaticText[@name="Phone verification"]',

  smsCodeSentPrompt: '//XCUIElementTypeStaticText[contains(@name, "we texted") or contains(@name, "sent to your phone")]',

  smsEnterCodePrompt: byText('Enter the 6-digit code we texted to your phone number at'),

  phoneInput: [
    '//XCUIElementTypeTextField[contains(@name, "confirm_phone") and (contains(@name, "phone_number") or contains(@name, "phone"))]',
    '//XCUIElementTypeTextField[contains(@name, "phone")]',
  ] as SelectorList,

  continueButton: [
    '~confirm_phone.button.continue',
    '~confirm_phone.button.verify',
    '//XCUIElementTypeButton[contains(@name, "continue") or contains(@name, "verify") or @label="Continue" or @label="Verify"]',
    '~confirm_email.button.verify',
  ] as SelectorList,

  newPasswordInput: [
    '//XCUIElementTypeSecureTextField[contains(@name, "new_password") or contains(@name, "password")]',
    '//XCUIElementTypeSecureTextField[@name="password"]',
    '//XCUIElementTypeSecureTextField[1]',
    '//XCUIElementTypeTextField[contains(@name, "new_password") or contains(@name, "password")]',
    '//XCUIElementTypeTextField[1]',
    '//XCUIElementTypeSecureTextField',
  ] as SelectorList,

  confirmPasswordInput: [
    '//XCUIElementTypeSecureTextField[contains(@name, "confirm_password") or contains(@name, "confirm")]',
    '//XCUIElementTypeSecureTextField[2]',
    '//XCUIElementTypeTextField[contains(@name, "confirm_password") or contains(@name, "confirm")]',
  ] as SelectorList,

  saveNewPasswordButton: [
    '~Update password',
    '~Update',
    '~Save',
    '~Set password',
    '~Reset password',
    '~Continue',
    '//XCUIElementTypeButton[contains(@name, "Update") or contains(@name, "Save") or contains(@name, "Set") or contains(@name, "Reset") or contains(@name, "Continue") or @label="Update password" or @label="Save" or @label="Continue"]',
  ] as SelectorList,

  resetSubmitButton: [
    '~Reset via email',
    '~Reset via Email',
    '~Send reset link',
    '~Reset',
    '//XCUIElementTypeButton[contains(@name, "Reset") or contains(@name, "Send") or @label="Reset via email" or @label="Send reset link" or @label="Reset" or @label="Continue"]',
  ] as SelectorList,

  resetViaSmsButton: [
    '~Reset via SMS',
    '~Reset via sms',
    '//XCUIElementTypeButton[contains(@name, "SMS") or contains(@label, "SMS")]',
  ] as SelectorList,

  resetEmailInput: [
    '//XCUIElementTypeTextField[contains(@name, "email") or contains(@name, "reset")]',
    '//XCUIElementTypeTextField',
  ] as SelectorList,

  faceIdContinueButton: [
    '~Continue',
    '//XCUIElementTypeButton[@name="Continue" or @label="Continue"]',
  ] as SelectorList,

  profileIcon: [
    '~navigation_top.button.dots',
    '~ic_more',
    '//XCUIElementTypeButton[contains(@name, "contact") or contains(@name, "dots") or contains(@name, "more")]',
  ] as SelectorList,

  settingsMenuItem: [
    '~Settings, Customize your experience',
  ] as SelectorList,

  logoutLink: [
    '~Log out',
    '//XCUIElementTypeStaticText[@name="Log out"]',
    '//XCUIElementTypeButton[@name="Log out" or @label="Log out"]',
  ] as SelectorList,
};

