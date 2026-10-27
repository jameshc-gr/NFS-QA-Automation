import { SelectorList } from '../selector-engine';

function byText(text: string): string {
  return `//android.widget.TextView[@text=${JSON.stringify(text)}]`;
}

function byInputLabel(label: string): string {
  return `//android.widget.EditText[.//android.widget.TextView[@text=${JSON.stringify(label)}]]`;
}

export const authSelectors = {
  loginTab: [byText('Log in'), byText('Iniciar sesión')] as SelectorList,
  createAccountTab: [byText('Create account'), byText('Crear cuenta')] as SelectorList,

  emailInput: [
    'android=new UiSelector().className("android.widget.EditText").instance(0)',
    '//android.widget.EditText[1]',
    byInputLabel('Email'),
    '//android.widget.EditText[.//android.widget.TextView[@text="Email"]]',
    '//android.widget.EditText[@text="Email"]',
    byInputLabel('Correo electrónico'),
  ] as SelectorList,

  passwordInput: [
    'android=new UiSelector().className("android.widget.EditText").instance(1)',
    '//android.widget.EditText[@password="true"]',
    byInputLabel('Password'),
    '//android.widget.EditText[.//android.widget.TextView[@text="Password"]]',
    '//android.widget.EditText[@text="Password"]',
    byInputLabel('Contraseña'),
  ] as SelectorList,

  loginButton: [
    `//android.widget.ScrollView//android.view.View[(.//android.widget.TextView[@text="Log in"] or .//android.widget.TextView[@text="Go!"]) and .//android.widget.Button and @clickable="true"]`,
    `//android.widget.ScrollView//android.widget.Button[.//android.widget.TextView[@text="Log in"] or .//android.widget.TextView[@text="Go!"]]`,
    `//android.widget.TextView[@text="Go!"]/..`,
    `//android.widget.TextView[@text="Log in"]/..`,
    `//android.widget.Button[.//*[@text="Log in"] or .//*[@text="Go!"]]`,
    `//*[contains(@text, "Go!") and @clickable="true"]`,
    `//*[contains(@text, "Log in") and @clickable="true"]`,
    `//*[contains(@text, "Log in")]`,
    `//android.widget.ScrollView//android.view.View[.//android.widget.TextView[@text="Iniciar sesión"] and .//android.widget.Button and @clickable="true"]`,
    `//android.widget.ScrollView//android.widget.Button[.//android.widget.TextView[@text="Iniciar sesión"]]`,
    `//android.widget.TextView[@text="Iniciar sesión"]/..`,
    `//*[contains(@text, "Iniciar sesión") and @clickable="true"]`,
  ] as SelectorList,

  forgotPasswordLink: [
    `//*[contains(@text, "Forgot password?") and @clickable="true"]`,
    `//*[contains(@text, "Forgot password") and @clickable="true"]`,
    `//android.widget.TextView[contains(@text, "Forgot password")]/..`,
    `//android.widget.TextView[contains(@text, "Forgot password")]`,
    `//*[contains(@content-desc, "forgot_password")]`,
  ] as SelectorList,

  emailCodeInput: [
    byInputLabel('6-digit code'),
    byInputLabel('Código de 6 dígitos'),
    byInputLabel('Código de verificación'),
    `//android.widget.EditText[contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code') or contains(translate(@hint, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code') or contains(translate(@content-desc, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code')]`,
    `//android.widget.EditText`,
  ] as SelectorList,

  phoneCodeInput: [
    byInputLabel('6-digit code'),
    byInputLabel('Código de 6 dígitos'),
    byInputLabel('Código de verificación'),
    `//android.widget.EditText[contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code') or contains(translate(@hint, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code') or contains(translate(@content-desc, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'code')]`,
    `//android.widget.EditText`,
  ] as SelectorList,

  emailVerifyButton: [
    byText('Verify'),
    byText('Verificar'),
  ] as SelectorList,

  phoneCodeVerifyButton: [
    byText('Verify'),
    byText('Continue'),
    byText('Verificar'),
    byText('Continuar'),
  ] as SelectorList,

  emailVerificationPrompt: [byText('Email verification'), byText('Verificación de correo electrónico'), byText('Verificación de email'), byText('Verifica tu identidad')] as SelectorList,

  resetEmailCodeTitlePrompt: byText('Verification code via Email'),

  resetSmsCodeTitlePrompt: byText('Verification code via SMS'),

  emailCodeSentPrompt: [
    `//android.widget.TextView[contains(@text, "code we sent to your email")]`,
    `//android.widget.TextView[contains(@text, "código que enviamos a tu correo")]`,
    `//android.widget.TextView[contains(@text, "código que enviamos a tu email") or contains(@text, "enviamos un código a tu correo")]`,
  ] as SelectorList,

  genericEnterCodePrompt: [
    `//android.widget.TextView[@text="6-digit code" or contains(@text, "digit code")]`,
    `//android.widget.TextView[@text="Código de 6 dígitos" or contains(@text, "código de 6 dígitos")]`,
  ] as SelectorList,

  smsVerificationPrompt: [byText('Phone verification'), byText('Verificación del teléfono'), byText('Verificación por teléfono'), byText('Verificación telefónica')] as SelectorList,

  smsCodeSentPrompt: [
    `//android.widget.TextView[contains(@text, "we texted") or contains(@text, "sent to your phone")]`,
    `//android.widget.TextView[contains(@text, "enviamos un mensaje de texto") or contains(@text, "enviamos a tu teléfono")]`,
  ] as SelectorList,

  smsEnterCodePrompt: byText('Enter the 6-digit code we texted to your phone number at'),

  phoneInput: [
    `//android.widget.EditText[contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'phone') or contains(translate(@hint, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'phone') or contains(translate(@content-desc, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'phone')]`,
    `//android.widget.EditText`,
  ] as SelectorList,

  continueButton: [
    `//*[contains(@text, "Continue") and @clickable="true"]`,
    `//*[contains(@text, "Verify") and @clickable="true"]`,
  ] as SelectorList,

  newPasswordInput: [
    byInputLabel('New password'),
    byInputLabel('Password'),
    `//android.widget.EditText[contains(translate(@hint, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'new') or contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'new')]`,
    `(//android.widget.EditText)[1]`,
  ] as SelectorList,

  confirmPasswordInput: [
    byInputLabel('Confirm password'),
    `//android.widget.EditText[contains(translate(@hint, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'confirm') or contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'confirm')]`,
    `(//android.widget.EditText)[2]`,
  ] as SelectorList,

  saveNewPasswordButton: [
    byText('Update password'),
    `//android.widget.TextView[@text="Update password"]/..`,
    byText('Update'),
    byText('Save'),
    byText('Set password'),
    byText('Reset password'),
    byText('Continue'),
  ] as SelectorList,

  resetSubmitButton: [
    byText('Reset via Email'),
    byText('Reset via email'),
    `//android.widget.TextView[contains(@text, "Reset via Email") or contains(@text, "Reset via email")]/..`,
    `//android.widget.TextView[contains(@text, "Reset via Email") or contains(@text, "Reset via email")]`,
    `//*[(contains(@text, "Reset via Email") or contains(@text, "Reset via email") or contains(@text, "Send reset link") or contains(@text, "Reset")) and @clickable="true"]`,
    `//android.widget.Button[contains(@text, "Reset via Email") or contains(@text, "Reset via email") or contains(@text, "Reset")]`,
  ] as SelectorList,

  resetViaSmsButton: [
    byText('Reset via SMS'),
    byText('Reset via sms'),
    `//android.widget.TextView[contains(@text, "Reset via SMS") or contains(@text, "Reset via sms")]/..`,
    `//android.widget.TextView[contains(@text, "Reset via SMS") or contains(@text, "Reset via sms")]`,
    `//*[(contains(@text, "Reset via SMS") or contains(@text, "Reset via sms")) and @clickable="true"]`,
    `//android.widget.Button[contains(@text, "Reset via SMS") or contains(@text, "Reset via sms")]`,
  ] as SelectorList,

  resetEmailInput: [
    byInputLabel('Email'),
    `//android.widget.EditText[contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'email') or contains(translate(@hint, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'email')]`,
    `//android.widget.EditText`,
  ] as SelectorList,

  faceIdContinueButton: [
    byText('Continue'),
  ] as SelectorList,

  profileIcon: [
    `//android.widget.TextView[starts-with(@text, "Hi ")]/following-sibling::android.view.View[1]`,
    `//android.widget.TextView[starts-with(@text, "Hi ")]/following-sibling::*`,
    `//android.widget.TextView[starts-with(@text, "Hi ")]/..//android.view.View[last()]`,
    `//*[contains(@content-desc, "profile") or contains(@content-desc, "avatar") or contains(@content-desc, "contact") or contains(@content-desc, "more")]`,
    `//android.widget.ImageView[contains(@content-desc, "profile") or contains(@content-desc, "person")]`,
  ] as SelectorList,

  settingsMenuItem: [
    `//android.widget.TextView[@text="Settings"]/..`,
    `//*[contains(@text, "Settings") and @clickable="true"]`,
  ] as SelectorList,

  logoutLink: [
    `//android.widget.TextView[@text="Log out"]`,
    `//*[contains(@text, "Log out") and @clickable="true"]`,
  ] as SelectorList,
};
