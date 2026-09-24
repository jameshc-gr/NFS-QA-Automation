import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../../../web/rate-wealth/pages/LoginPage';
import { MembershipPage } from '../../../web/rate-wealth/pages/MembershipPage';
import { OnboardingPage } from '../../../web/rate-wealth/pages/OnboardingPage';
import { DashboardPage } from '../../../web/rate-wealth/pages/DashboardPage';
import { loadRateWealthConfig, type RateWealthConfig } from '../../../web/rate-wealth/utils/config';

type RateWealthFixtures = {
  loginPage: LoginPage;
  membershipPage: MembershipPage;
  onboardingPage: OnboardingPage;
  dashboardPage: DashboardPage;
  rwConfig: RateWealthConfig;
};

export const test = base.extend<RateWealthFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  membershipPage: async ({ page }, use) => {
    await use(new MembershipPage(page));
  },
  onboardingPage: async ({ page }, use) => {
    await use(new OnboardingPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  rwConfig: async ({}, use) => {
    await use(loadRateWealthConfig());
  }
});

export { expect };
