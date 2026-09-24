import { type Page } from '@playwright/test';
import { membershipPlanLocators } from '../locators';

export class MembershipPage {
  constructor(private readonly page: Page) {}

  async isPlanModalVisible(): Promise<boolean> {
    return await this.page.getByRole('heading', { name: membershipPlanLocators.heading }).isVisible();
  }

  async selectPlan(type: 'monthly' | 'annual'): Promise<void> {
    if (type === 'annual') {
      await this.page.locator(membershipPlanLocators.annualPlanRadio).click();
    } else {
      await this.page.locator(membershipPlanLocators.monthlyPlanRadio).click();
    }
  }

  async fillPaymentAndSubmit(cardDetails: {
    nameOnCard: string;
    cardNumber: string;
    expDate: string;
    cvc: string;
  }): Promise<void> {
    const nameInput = this.page.getByRole('textbox', { name: 'Name on Card' });
    if (await nameInput.isVisible()) {
      await nameInput.fill(cardDetails.nameOnCard);
    }

    const cardFrame = this.page.frameLocator(membershipPlanLocators.cardNumberFrame);
    await cardFrame.locator(membershipPlanLocators.cardNumberInput).fill(cardDetails.cardNumber);

    const expFrame = this.page.frameLocator(membershipPlanLocators.expirationDateFrame);
    await expFrame.locator(membershipPlanLocators.expirationDateInput).fill(cardDetails.expDate);

    const cvcFrame = this.page.frameLocator(membershipPlanLocators.securityCodeFrame);
    await cvcFrame.locator(membershipPlanLocators.securityCodeInput).fill(cardDetails.cvc);

    // Click label at (5,5) to reliably toggle accept policy checkbox
    await this.page.locator(membershipPlanLocators.acceptPolicyLabel).click({ position: { x: 5, y: 5 } });

    await this.page.locator(membershipPlanLocators.startMembershipButton).click();
    await this.page.waitForTimeout(6000);
  }
}
