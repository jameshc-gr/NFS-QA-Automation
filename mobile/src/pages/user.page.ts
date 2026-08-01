import { BasePage } from './base.page';

export class UserPage extends BasePage {
  private readonly ios = this.platform === 'ios';
  // iOS ships stable accessibility identifiers, so use them instead of labels.
  private readonly firstName = this.ios
    ? '//XCUIElementTypeTextField[@name="create_account.field.first_name"]'
    : this.byInputLabel('First name');
  private readonly lastName = this.ios
    ? '//XCUIElementTypeTextField[@name="create_account.field.last_name"]'
    : this.byInputLabel('Last name');
  private readonly email = this.ios
    ? '//XCUIElementTypeTextField[@name="create_account.field.email"]'
    : this.byInputLabel('Email');
  // Revealing the field turns the SecureTextField into a plain TextField, so
  // both types have to match.
  private readonly password = this.ios
    ? '//XCUIElementTypeSecureTextField[@name="create_account.field.password"]|//XCUIElementTypeTextField[@name="create_account.field.password"]'
    : this.byInputLabel('Password');
  private readonly confirmPassword = this.ios
    ? '//XCUIElementTypeSecureTextField[@name="create_account.field.confirm_password"]|//XCUIElementTypeTextField[@name="create_account.field.confirm_password"]'
    : this.byInputLabel('Confirm password');
  private readonly revealPassword = '~create_account.button.hide_show';
  private readonly revealConfirmPassword = '~create_account.button.hide_show_confirm';
  // The iOS terms checkbox has no identifier; both checkboxes are the only
  // 24x24 buttons on the form, so match them by size.
  private readonly checkboxSelector = this.ios
    ? '//XCUIElementTypeButton[@width="24" and @height="24"]'
    : '//android.widget.CheckBox';
  // The "Create account" tab and the submit button share the same label, but
  // only the submit button sits inside a clickable container.
  private readonly submitButtonCandidates = this.ios
    ? ['~create_account.button.create_account']
    : [
        '//android.widget.TextView[@text="Create account"]/parent::android.view.View[@clickable="true"]',
        '(//android.widget.TextView[@text="Create account"])[last()]/..'
      ];

  async createUser(input: { firstName: string; lastName: string; email: string; password: string }): Promise<void> {
    await this.fillForm(input);
    await this.checkAllCheckboxes();
    await this.submit();
  }

  /** Fills every field and dismisses the keyboard so the lower form is reachable. */
  async fillForm(input: { firstName: string; lastName: string; email: string; password: string }): Promise<void> {
    await this.type(this.firstName, input.firstName);
    await this.type(this.lastName, input.lastName);
    await this.type(this.email, input.email);

    // iOS covers secure fields with an "Automatic Strong Password" suggestion
    // that swallows typed input. Revealing the field first drops the cover view.
    await this.revealIfSecure(this.revealPassword);
    await this.type(this.password, input.password);
    await this.revealIfSecure(this.revealConfirmPassword);
    await this.type(this.confirmPassword, input.password);

    // Dismiss the keyboard: while it is open the checkboxes and the submit
    // button are clipped out of the view hierarchy entirely.
    await this.hideKeyboard();
  }

  /** Taps the eye toggle so the password renders as plain text (iOS only). */
  private async revealIfSecure(selector: string): Promise<void> {
    if (!this.ios) {
      return;
    }

    await this.tap(selector).catch(() => {});
    await browser.pause(300);
  }

  /** Ticks every checkbox on the form (agreeing to the terms enables submit). */
  async checkAllCheckboxes(): Promise<void> {
    const total = await this.countCheckboxes();

    if (total === 0) {
      throw new Error('No checkboxes found on the create account form.');
    }

    for (let index = 0; index < total; index += 1) {
      await this.ensureChecked(index);
    }
  }

  private async countCheckboxes(): Promise<number> {
    const boxes: any = await $$(this.checkboxSelector);
    return Number(await boxes.length);
  }

  /**
   * Taps a checkbox and confirms it actually toggled. Elements are re-resolved on
   * every attempt so the tap coordinates stay valid if the layout shifts.
   */
  private async ensureChecked(index: number, attempts = 4): Promise<void> {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const boxes: any = await $$(this.checkboxSelector);
      const box: any = boxes[index];

      if (!box) {
        throw new Error(`Checkbox at index ${index} is no longer present on the form.`);
      }

      const state = await this.readCheckedState(box);
      if (state === true) {
        return;
      }

      await this.tap(box);
      await browser.pause(600);

      // iOS renders these as plain buttons with no checked state to read, so a
      // single tap has to be trusted; submit() catches it if the terms box was
      // missed.
      if (state === null) {
        return;
      }
    }

    throw new Error(`Checkbox at index ${index} did not become checked after ${attempts} attempts.`);
  }

  /** Returns null when the platform exposes no readable checked state. */
  private async readCheckedState(element: any): Promise<boolean | null> {
    // iOS exposes these as plain buttons and does not support a `checked`
    // attribute, so skip attribute probing entirely.
    if (this.ios) {
      return null;
    }

    const checked = await element.getAttribute('checked').catch(() => null);
    if (checked !== null && checked !== undefined) {
      return String(checked) === 'true';
    }

    const value = await element.getAttribute('value').catch(() => null);
    if (value === null || value === undefined || value === '') {
      return null;
    }

    return String(value) === '1' || String(value) === 'true';
  }

  /** Waits for the submit button to become actionable and taps it. */
  async submit(timeoutMs = 15000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;

    while (Date.now() < deadline) {
      for (const selector of this.submitButtonCandidates) {
        const element: any = await $(selector);
        if (!(await element.isDisplayed().catch(() => false))) {
          continue;
        }

        try {
          await this.tap(element);
          await this.waitUntilSubmitted();
          return;
        } catch (error) {
          lastError = error;
        }
      }

      await browser.pause(500);
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Create account button never became actionable. Verify every required field and checkbox is set.');
  }

  /**
   * A disabled "Create account" button still reports clickable, so the only
   * reliable signal that the form was accepted is the form going away.
   */
  private async waitUntilSubmitted(timeoutMs = 20000): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const button: any = await $(this.submitButtonCandidates[0]);
      if (!(await button.isDisplayed().catch(() => false))) {
        return;
      }
      await browser.pause(500);
    }

    throw new Error(
      'Tapped "Create account" but the form stayed open, which means the button is still disabled. '
        + 'Check that every field is valid: the password must be 8+ characters with an upper case letter, '
        + 'a lower case letter, a number and a symbol, and must not contain part of the email, first name '
        + 'or last name.'
    );
  }
}