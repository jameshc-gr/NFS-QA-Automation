import { type Page } from '@playwright/test';
import { loanDetailsLocators } from '../locators';

export class LoanDetailsPage {
  constructor(private readonly page: Page) {}

  async complete(values: {
    loanAmount: string;
    monthlyPayment: string;
    interestRate: string;
    loanType?: string;
  }): Promise<void> {
    await this.page.getByRole('textbox', { name: loanDetailsLocators.loanAmount.name }).fill(values.loanAmount);
    await this.page.getByRole('textbox', { name: loanDetailsLocators.monthlyPayment.name }).fill(values.monthlyPayment);
    await this.page.getByRole('textbox', { name: loanDetailsLocators.interestRate.name }).fill(values.interestRate);
    await this.page.getByTestId(loanDetailsLocators.loanTypeDropdownTestId).click();
    await this.page.getByRole('option', { name: values.loanType || 'Both' }).click();
    await this.page.getByRole('button', { name: loanDetailsLocators.continueButtonName }).click();
  }
}
