import { expect, type Page } from '@playwright/test';

export class IdentityConsentPage {
  constructor(private readonly page: Page) {}

  async complete(values: { dob: string; ssn: string }): Promise<void> {
    await this.page.locator('#dob').fill(values.dob);
    await this.page.getByRole('textbox', { name: 'Social security number*' }).fill(values.ssn);
    await this.page.getByRole('button').filter({ hasText: /^$/ }).click();

    await expect(this.page.getByRole('checkbox').first()).toBeVisible({ timeout: 15000 });

    const checkboxes = this.page.getByRole('checkbox');
    const count = await checkboxes.count();
    for (let index = 0; index < count; index++) {
      await checkboxes.nth(index).check();
    }

    await this.page.getByRole('button', { name: 'Agree and Check my Rates' }).click();
  }
}
