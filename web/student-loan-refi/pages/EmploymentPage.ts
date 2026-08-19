import { expect, type Page } from '@playwright/test';
import { selectOptionResilient } from '../utils/resilience';

export class EmploymentPage {
  constructor(private readonly page: Page) {}

  async complete(values: {
    incomeType: string;
    employer: string;
    occupation: string;
    annualIncome: string;
    employmentStart: string;
  }): Promise<void> {
    await this.page
      .getByRole('combobox', { name: 'Income type*' })
      .getByTestId('dropdown-label')
      .click();
    await selectOptionResilient(this.page, values.incomeType);

    const employer = this.page.getByRole('textbox', { name: 'Employer name*' });
    await employer.waitFor({ state: 'visible', timeout: 15000 });
    await employer.click();
    await employer.fill(values.employer);
    await expect(employer).toHaveValue(values.employer, { timeout: 5000 });

    const occupation = this.page.getByRole('textbox', { name: 'Occupation/job title*' });
    await occupation.click();
    await occupation.fill(values.occupation);
    await expect(occupation).toHaveValue(values.occupation, { timeout: 5000 });

    await this.page.getByRole('textbox', { name: 'Annual income*' }).fill(values.annualIncome);
    await this.page.getByRole('textbox', { name: 'Employment start date*' }).fill(values.employmentStart);
    await this.page.getByRole('button', { name: 'Continue' }).click();
  }
}
