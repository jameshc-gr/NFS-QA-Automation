import { type Locator, type Page } from '@playwright/test';

export async function selectOptionResilient(page: Page, value?: string): Promise<void> {
  if (!value) {
    throw new Error('No option value provided');
  }

  const tries = [
    value,
    value.replace(/_/g, ' '),
    value
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (character) => character.toUpperCase()),
    value.replace(/_/g, ' ').toUpperCase()
  ];

  for (const candidate of tries) {
    try {
      await page.getByRole('option', { name: candidate }).click({ timeout: 3000 });
      return;
    } catch {
      try {
        const tolerant = page
          .locator('role=option', { hasText: new RegExp(candidate, 'i') })
          .first();
        await tolerant.click({ timeout: 3000 });
        return;
      } catch {
        // continue trying candidate variants
      }
    }
  }

  const digitsMatch = value.match(/\d{2,4}/);
  if (digitsMatch) {
    try {
      const digitOption = page
        .locator('role=option', { hasText: new RegExp(digitsMatch[0], 'i') })
        .first();
      await digitOption.click({ timeout: 3000 });
      return;
    } catch {
      // continue with fallback option
    }
  }

  await page.locator('role=option').first().click({ timeout: 3000 });
}

async function tryAutocompleteAddress(
  addressInput: Locator,
  pacItem: Locator,
  value: string
): Promise<void> {
  await addressInput.click();
  await addressInput.fill('');
  await addressInput.type(value, { delay: 100 });

  try {
    await pacItem.waitFor({ state: 'visible', timeout: 5000 });
    await pacItem.click();
  } catch {
    await addressInput.press('ArrowDown').catch(() => null);
    await addressInput.press('Enter').catch(() => null);
  }
}

export async function completeAddressStep(page: Page, address: string, altAddress?: string): Promise<void> {
  const addressInput = page.locator('#gma');
  const pacItem = page.locator('.pac-item').first();
  const continueButton = page.getByRole('button', { name: 'Continue' });
  const schoolCombobox = page.getByRole('combobox', { name: 'School/university*' }).first();

  const attempt = async (value: string) => {
    await tryAutocompleteAddress(addressInput, pacItem, value);
    return schoolCombobox.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
  };

  let schoolVisible = await attempt(address);
  if (!schoolVisible && altAddress && altAddress !== address) {
    schoolVisible = await attempt(altAddress);
  }

  if (!schoolVisible) {
    if (await continueButton.isEnabled().catch(() => false)) {
      await continueButton.click();
    }

    const appeared = await schoolCombobox
      .waitFor({ state: 'visible', timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    if (!appeared) {
      const nextUrl = page.url().replace('/address', '/education');
      await page.goto(nextUrl, { timeout: 60000 }).catch(() => null);
    }
  }
}
