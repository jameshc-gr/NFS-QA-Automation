import { expect, type Page } from '@playwright/test';
import { completeAddressStep, selectOptionResilient } from '../utils/resilience';

export class AddressPage {
  constructor(private readonly page: Page) {}

  async complete(values: {
    address: string;
    addressAlt?: string;
    school: string;
    degreeLevel: string;
    graduationDate: string;
  }): Promise<void> {
    await completeAddressStep(this.page, values.address, values.addressAlt);

    await this.page.getByRole('combobox', { name: 'School/university*' }).click();
    await selectOptionResilient(this.page, values.school);

    await this.page
      .getByRole('combobox', { name: 'Degree level*' })
      .getByTestId('dropdown-label')
      .click();
    await selectOptionResilient(this.page, values.degreeLevel);

    const graduationDate = this.page.getByRole('textbox', { name: 'Graduation date*' });
    await graduationDate.waitFor({ state: 'visible', timeout: 15000 });
    await graduationDate.click();
    await graduationDate.fill(values.graduationDate);
    await expect(graduationDate).toHaveValue(values.graduationDate, { timeout: 5000 });
  }
}
