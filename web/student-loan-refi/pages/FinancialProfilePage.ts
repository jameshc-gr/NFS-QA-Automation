import { type Page } from '@playwright/test';
import { selectOptionResilient } from '../utils/resilience';

export class FinancialProfilePage {
  constructor(private readonly page: Page) {}

  private async openDropdown(label: RegExp): Promise<void> {
    const combobox = this.page.getByRole('combobox', { name: label }).first();
    await combobox.waitFor({ state: 'visible', timeout: 60000 });

    // Some builds attach click handlers on combobox, others on nested dropdown-label.
    await combobox
      .getByTestId('dropdown-label')
      .click({ timeout: 5000 })
      .catch(async () => {
        await combobox.click({ timeout: 5000 });
      });
  }

  async complete(values: {
    citizenStatus: string;
    creditScore: string;
    housingType: string;
    housingCost: string;
    totalAssets: string;
  }): Promise<void> {
    await this.openDropdown(/Citizen status\*/i);
    await selectOptionResilient(this.page, values.citizenStatus);

    await this.openDropdown(/Credit score range\*/i);
    await selectOptionResilient(this.page, values.creditScore);

    await this.openDropdown(/Housing type\*/i);
    await selectOptionResilient(this.page, values.housingType);

    await this.page.getByRole('textbox', { name: 'Monthly housing cost*' }).fill(values.housingCost);
    await this.page.getByRole('textbox', { name: 'Enter total assets' }).fill(values.totalAssets);
    await this.page.getByRole('button', { name: 'Continue' }).click();
  }
}
