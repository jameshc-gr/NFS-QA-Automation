import { type Page } from '@playwright/test';
import { dashboardLocators, navDrawerLocators } from '../locators';

export class DashboardPage {
  constructor(private readonly page: Page) {}

  async navigateTo(section: 'home' | 'financialPlans' | 'financialSnapshot' | 'dayToDayMoney' | 'transactions' | 'accounts'): Promise<void> {
    const locatorKey = navDrawerLocators[section];
    if (locatorKey) {
      await this.page.locator(locatorKey).first().click();
      await this.page.waitForTimeout(2000);
    }
  }

  async getWealthScore(): Promise<string | null> {
    const scoreElement = this.page.locator(dashboardLocators.wealthScoreText);
    if (await scoreElement.isVisible()) {
      return await scoreElement.innerText();
    }
    return null;
  }

  async clickBuildPlan(): Promise<void> {
    await this.page.locator(dashboardLocators.buildPlanButton).first().click();
    await this.page.waitForTimeout(2000);
  }
}
