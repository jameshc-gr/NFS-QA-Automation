import { type Page } from '@playwright/test';
import { personalInfoLocators } from '../locators';

export class PersonalInfoPage {
  constructor(private readonly page: Page) {}

  async complete(values: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  }): Promise<void> {
    await this.page.locator('body').click();
    await this.page.getByRole('textbox', { name: personalInfoLocators.firstName.name }).fill(values.firstName);
    await this.page.getByRole('textbox', { name: personalInfoLocators.lastName.name }).fill(values.lastName);
    await this.page.getByRole('textbox', { name: personalInfoLocators.email.name }).fill(values.email);
    await this.page.getByRole('textbox', { name: personalInfoLocators.phone.name }).fill(values.phone);
    await this.page.getByTestId(personalInfoLocators.continueButtonTestId).click();
  }
}
