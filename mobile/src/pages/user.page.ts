import { BasePage } from './base.page';

export class UserPage extends BasePage {
  private readonly firstName = this.byInputLabel('First name');
  private readonly lastName = this.byInputLabel('Last name');
  private readonly email = this.byInputLabel('Email');
  private readonly password = this.byInputLabel('Password');
  private readonly confirmPassword = this.byInputLabel('Confirm password');
  private readonly termsCheckbox = `//android.widget.TextView[@text="I agree to the terms of use and the privacy policy"]/preceding-sibling::android.widget.CheckBox[1]`;
  private readonly submitButton = this.byText('Create account');

  async createUser(input: { firstName: string; lastName: string; email: string; password: string }): Promise<void> {
    await this.type(this.firstName, input.firstName);
    await this.type(this.lastName, input.lastName);
    await this.type(this.email, input.email);
    await this.type(this.password, input.password);
    await this.type(this.confirmPassword, input.password);
    await this.tap(this.termsCheckbox);
    await this.tap(this.submitButton);
  }
}