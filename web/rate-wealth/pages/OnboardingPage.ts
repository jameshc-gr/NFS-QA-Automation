import { type Page } from '@playwright/test';
import { onboardingLocators } from '../locators';

export class OnboardingPage {
  constructor(private readonly page: Page) {}

  async resumeIfNeeded(): Promise<void> {
    const continueBtn = this.page.getByRole('button', { name: onboardingLocators.continueButton });
    if (await continueBtn.isVisible()) {
      await continueBtn.click();
      await this.page.waitForTimeout(3000);
    }
  }

  async completeStep1Basics(dob = '05/20/1990', zip = '90210'): Promise<void> {
    if (await this.page.locator(onboardingLocators.zipInput).isVisible()) {
      await this.page.locator(onboardingLocators.dobInput).first().fill(dob);
      await this.page.locator(onboardingLocators.zipInput).fill(zip);
      await this.page.locator(onboardingLocators.genderMaleLabel).click();
      await this.page.locator(onboardingLocators.marriedNoLabel).click();
      await this.page.locator(onboardingLocators.childrenNoLabel).click();
      await this.page.getByRole('button', { name: onboardingLocators.nextButton }).click();
      await this.page.waitForTimeout(3000);
    }
  }

  async completeStep1Education(hasDegree = false): Promise<void> {
    if (await this.page.locator(onboardingLocators.degreeNoLabel).isVisible()) {
      if (hasDegree) {
        await this.page.locator(onboardingLocators.degreeYesLabel).click();
      } else {
        await this.page.locator(onboardingLocators.degreeNoLabel).click();
      }
      await this.page.getByRole('button', { name: onboardingLocators.nextButton }).click();
      await this.page.waitForTimeout(3000);
    }
  }

  async completeStep2Financial(annualIncome = '65000', monthlyRent = '1500'): Promise<void> {
    // Financial intro screen
    if (await this.page.getByRole('heading', { name: onboardingLocators.financialIntroHeading }).isVisible()) {
      await this.page.getByRole('button', { name: onboardingLocators.nextButton }).click();
      await this.page.waitForTimeout(3000);
    }

    // Income
    if (await this.page.locator(onboardingLocators.annualSalaryInput).isVisible()) {
      await this.page.locator(onboardingLocators.annualSalaryInput).fill(annualIncome);
      await this.page.getByRole('button', { name: onboardingLocators.nextButton }).click();
      await this.page.waitForTimeout(3000);
    }

    // Expenses
    if (await this.page.locator(onboardingLocators.monthlyRentInput).isVisible()) {
      await this.page.locator(onboardingLocators.monthlyRentInput).fill(monthlyRent);
      await this.page.getByRole('button', { name: onboardingLocators.nextButton }).click();
      await this.page.waitForTimeout(3000);
    }

    // Debts
    if (await this.page.getByRole('heading', { name: onboardingLocators.debtsHeading }).isVisible()) {
      await this.page.getByRole('button', { name: onboardingLocators.nextButton }).click();
      await this.page.waitForTimeout(3000);
    }

    // Assets
    if (await this.page.getByRole('heading', { name: onboardingLocators.assetsHeading }).isVisible()) {
      await this.page.getByRole('button', { name: onboardingLocators.nextButton }).click();
      await this.page.waitForTimeout(3000);
    }
  }

  async completeStep3Work(professionKeyword = 'Eng'): Promise<void> {
    // Work intro
    if (await this.page.getByRole('heading', { name: onboardingLocators.workIntroHeading }).isVisible()) {
      await this.page.getByRole('button', { name: onboardingLocators.nextButton }).click();
      await this.page.waitForTimeout(3000);
    }

    // Work form
    if (await this.page.getByRole('heading', { name: onboardingLocators.workFormHeading }).isVisible()) {
      const combo = this.page.locator(onboardingLocators.professionComboBox);
      await combo.click();
      await this.page.waitForTimeout(500);

      const input = combo.locator('input');
      await input.pressSequentially(professionKeyword, { delay: 100 });
      await this.page.waitForTimeout(1000);

      const opt = this.page.locator('.euiSelectableListItem, [role="option"]').first();
      if (await opt.isVisible()) {
        await opt.click();
      }

      await this.page.locator(onboardingLocators.networkingNoLabel).click();
      await this.page.locator(onboardingLocators.ncaaSportsNoLabel).click();
      await this.page.locator(onboardingLocators.marathonsNoLabel).click();
      await this.page.locator(onboardingLocators.militaryNoLabel).click();

      await this.page.getByRole('button', { name: onboardingLocators.finishButton }).click();
      await this.page.waitForTimeout(6000);
    }
  }
}
