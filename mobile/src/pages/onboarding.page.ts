import { BasePage } from './base.page';

export class OnboardingPage extends BasePage {
  private readonly createAccountTab = `//android.widget.TextView[@text="Create account"]/..`;

  async start(): Promise<void> {
    await this.tap(this.createAccountTab);
  }
}