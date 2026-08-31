import { expect, test, type Page } from '@playwright/test';
import { loadProfile, runIdrFlow } from './test-setup';

test.setTimeout(240000);

const PROFILE = 'SCN-001';
loadProfile(PROFILE);

async function openDashboard(page: Page) {
  await runIdrFlow(page, PROFILE);
  await expect(page).toHaveURL(/dashboard/i);
}

test.describe('Student IDR dashboard coverage', () => {
  test('DASH-001: Overview renders and exposes dashboard sections', async ({ page }) => {
    await openDashboard(page);

    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).toContain('overview');
    expect(body).toContain('scenarios');
    expect(body).toContain('personal');
    expect(body).toContain('settings');
    expect(body).toContain('feedback');
  });

  test('DASH-002: Scenarios exposes a selectable and savable control', async ({ page }) => {
    await openDashboard(page);

    const scenarios = page.getByText(/scenarios/i).first();
    await expect(scenarios).toBeVisible();
    await scenarios.click().catch(() => null);

    const controls = page.locator('select, [role="combobox"], input, button').filter({
      hasText: /scenario|save/i,
    });
    await expect(controls.first()).toBeVisible();
  });

  test('DASH-003: Personal Data exposes editable fields and save action', async ({ page }) => {
    await openDashboard(page);

    const personalData = page.getByText(/personal data/i).first();
    await expect(personalData).toBeVisible();
    await personalData.click().catch(() => null);

    await expect(page.locator('input:not([disabled]), textarea, [contenteditable="true"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /save|update/i }).first()).toBeVisible();
  });

  test('DASH-004: Settings exposes editable controls and save action', async ({ page }) => {
    await openDashboard(page);

    const settings = page.getByText(/settings/i).first();
    await expect(settings).toBeVisible();
    await settings.click().catch(() => null);

    await expect(page.locator('select, [role="combobox"], input, [role="switch"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /save|update/i }).first()).toBeVisible();
  });

  test('DASH-005: Feedback exposes required input and submit action', async ({ page }) => {
    await openDashboard(page);

    const feedback = page.getByText(/feedback/i).first();
    await expect(feedback).toBeVisible();
    await feedback.click().catch(() => null);

    await expect(page.locator('textarea, input:not([type="hidden"])').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /submit|send|save/i }).first()).toBeVisible();
  });
});
