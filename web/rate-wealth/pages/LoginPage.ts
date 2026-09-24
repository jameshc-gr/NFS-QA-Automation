import { type Page } from '@playwright/test';
import { loginLocators } from '../locators';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async navigate(): Promise<void> {
    await this.page.goto('https://wealth.dev.fitbux.com/', { waitUntil: 'domcontentloaded' });
    await this.dismissCookieBanner();
  }

  async dismissCookieBanner(): Promise<void> {
    await this.page.evaluate(() => {
      const banner = document.getElementById('onetrust-consent-sdk');
      if (banner) banner.remove();
    });
  }

  async login(email: string, pass: string): Promise<void> {
    await this.page.waitForSelector(loginLocators.emailInput, { state: 'visible', timeout: 15000 });
    await this.page.fill(loginLocators.emailInput, email);
    await this.page.fill(loginLocators.passwordInput, pass);
    await this.page.click(loginLocators.signInButton);
    await this.page.waitForTimeout(4000);
    await this.dismissCookieBanner();
  }
}
