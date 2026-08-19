/**
 * Shared helpers for inquiry e2e tests.
 *
 * Centralising these prevents selector/test-id drift across the 14 spec files
 * and makes form-fill changes a single-file edit.
 */

import { type Locator, type Page, expect } from "@playwright/test";

// ─── Utility functions ────────────────────────────────────────────────────────

export function toCalendarInputDateDigits(value: string): string {
  const [year, month, day] = value.split("-");
  return `${month}${day}${year}`;
}

export async function typeMaskedInput(
  locator: Locator,
  value: string,
): Promise<void> {
  await locator.click();
  await locator.press("ControlOrMeta+A");
  await locator.press("Backspace");
  await locator.pressSequentially(value, { delay: 35 });
  await locator.press("Tab");
}

export function formatPhoneNumber(digits: string): string {
  // Normalize: keep only digits
  const cleaned = (digits || "").replace(/\D/g, "");
  if (cleaned.length !== 10) return digits;
  const area = cleaned.slice(0, 3);
  const prefix = cleaned.slice(3, 6);
  const line = cleaned.slice(6);
  return `(${area}) ${prefix}-${line}`;
}

/**
 * Generates a collision-safe yopmail address:
 * inq{MM}-{DD}-{HH}-{mm}-{ss}-{random4}@yopmail.com
 */
export function generateUniqueEmail(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 6);
  return `inq${month}-${date}-${hours}-${minutes}-${seconds}-${random}@yopmail.com`;
}

export function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InquiryAddress {
  readonly street: readonly string[];
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
  readonly country: string;
}

export interface InquiryFormInput {
  readonly propertyInputHeloc: {
    readonly address: InquiryAddress;
    readonly type: string;
    readonly requestedLoanAmount: number;
    readonly loanOfficerId: number;
  };
  readonly basicInfoInput: {
    readonly emailId: string;
    readonly name: {
      readonly first: string;
      readonly middle: string;
      readonly last: string;
      readonly suffix: string;
    };
    readonly residenceAddress: InquiryAddress;
    readonly residenceStartDate: string;
    readonly phoneNumber: string;
    readonly isAgreed: boolean;
  };
  readonly basicInfoUpdateInput: {
    readonly dateOfBirth: string;
    readonly lastFourSSN: string;
  };
  readonly incomeInput: ReadonlyArray<{
    readonly annualIncome: number;
    readonly incomeSource: string;
    readonly incomeType?: string | null;
  }>;
  readonly existingMortgageAmount: number;
}

// ─── Form fill + submit ───────────────────────────────────────────────────────

const occupancyDisplayMap: Record<string, string> = {
  PRIMARY: "Primary residence",
  SECONDARY: "Secondary residence",
  INVESTMENT: "Investment",
};

/**
 * Navigates to the inquiry intake page, fills the entire form, submits it, and
 * waits for the offers page with exactly 3 offer cards.
 *
 * @returns The inquiry ID extracted from the URL query param `id`.
 */
export async function fillAndSubmitInquiryForm(
  page: Page,
  input: InquiryFormInput,
): Promise<string> {
  const { propertyInputHeloc, basicInfoInput, basicInfoUpdateInput, incomeInput, existingMortgageAmount } =
    input;
  const propertyAddress = propertyInputHeloc.address;
  const residenceAddress = basicInfoInput.residenceAddress;
  const borrowerName = basicInfoInput.name;
  const propertyStreet = propertyAddress.street[0] ?? "";
  const residenceStreet = residenceAddress.street[0] ?? "";

  // ── Navigate ──────────────────────────────────────────────────────────────

  await page.goto("/inquiry/intake?playwright=true", { waitUntil: "load" });

  await expect(page.getByTestId("new-inquiry-page")).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByTestId("new-inquiry-header")).toBeVisible({
    timeout: 10000,
  });

  // ── Property Information ──────────────────────────────────────────────────

  const propertyManualAddressButton = page
    .getByTestId("property-manual-address-toggle")
    .getByRole("button");
  await expect(propertyManualAddressButton).toBeVisible({ timeout: 5000 });
  await propertyManualAddressButton.click();

  await page.locator('input[name="address"]').first().fill(propertyStreet);
  await page.locator('input[name="city"]').first().fill(propertyAddress.city);
  await page.locator('input[name="state"]').first().fill(propertyAddress.region);
  await page.locator('input[name="zip"]').first().fill(propertyAddress.postalCode);

  const targetOccupancy = propertyInputHeloc.type || "PRIMARY";
  const occupancyField = page.getByTestId("occupancy-type-field");
  await expect(occupancyField).toBeVisible({ timeout: 5000 });

  const nativeOccupancySelect = occupancyField.locator("select").first();
  if (await nativeOccupancySelect.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nativeOccupancySelect.selectOption({ value: targetOccupancy });
  } else {
    const occupancyDropdown = occupancyField
      .locator(
        '#occupancyType, [name="occupancyType"], button, [role="combobox"], [aria-haspopup="listbox"]',
      )
      .first();
    await expect(occupancyDropdown).toBeVisible({ timeout: 5000 });
    await occupancyDropdown.click();
    await page
      .locator(
        `text="${occupancyDisplayMap[targetOccupancy] ?? occupancyDisplayMap["PRIMARY"]}"`,
      )
      .first()
      .click();
  }

  const sameAddressCheckbox = page.locator('#sameAsAddress, input[name="sameAsAddress"], [data-testid="same-as-address-toggle"] input[type="checkbox"]').first();
  if (await sameAddressCheckbox.isVisible({ timeout: 1500 }).catch(() => false)) {
  await expect(sameAddressCheckbox).not.toBeDisabled({ timeout: 5000 });
  if (await sameAddressCheckbox.isChecked()) {
    const sameAddressToggle = page.getByTestId("same-as-address-toggle");
    if (await sameAddressToggle.isVisible({ timeout: 1000 }).catch(() => false)) {
      await sameAddressToggle.click();
    } else {
      await sameAddressCheckbox.click();
    }
    await expect(sameAddressCheckbox).not.toBeChecked({ timeout: 3000 });
  }
}

  // ── Personal Information ──────────────────────────────────────────────────

  await page.getByTestId("borrower-information-section").scrollIntoViewIfNeeded();

  await page
    .locator('input[placeholder*="first" i], input[name*="firstName"]')
    .fill(borrowerName.first);
  await page
    .locator('input[placeholder*="last" i], input[name*="lastName"]')
    .fill(borrowerName.last);

  const emailInput = page
    .locator('input[type="email"], input[name*="email"]')
    .first();
  await emailInput.fill(basicInfoInput.emailId);

  const phoneInput = page.locator('input[name="phoneNumber"]').first();
  await phoneInput.click();
  await phoneInput.clear();
  // Format phone to (XXX) XXX-XXXX before typing so masked inputs receive expected characters
  await typeMaskedInput(phoneInput, formatPhoneNumber(basicInfoInput.phoneNumber));

  const dobInput = page
    .locator('input#date, input[name="birthday"], input[name="date"]')
    .first();
  await expect(dobInput).toBeVisible({ timeout: 10000 });
  await typeMaskedInput(
    dobInput,
    toCalendarInputDateDigits(basicInfoUpdateInput.dateOfBirth),
  );

  const ssnInput = page.locator('input[name="lastFourSSN"]').first();
  await typeMaskedInput(ssnInput, basicInfoUpdateInput.lastFourSSN);

  // ── Residence Address ─────────────────────────────────────────────────────

  // Short wait for form state to settle after SSN/DOB entry
  await page.waitForTimeout(300);

  const residenceManualAddressButton = page
    .getByTestId("residence-manual-address-toggle")
    .getByRole("button");
  await expect(residenceManualAddressButton).toBeVisible({ timeout: 5000 });
  await residenceManualAddressButton.click();

  await page.locator('input[name="residenceAddress"]').first().fill(residenceStreet);
  await page.locator('input[name="residenceCity"]').first().fill(residenceAddress.city);
  await page.locator('input[name="residenceState"]').first().fill(residenceAddress.region);
  await page.locator('input[name="residenceZip"]').first().fill(residenceAddress.postalCode);

  const residenceDateInput = page
    .locator('input#residence-start-date, input[name="start"]')
    .first();
  await expect(residenceDateInput).toBeVisible({ timeout: 10000 });
  await typeMaskedInput(
    residenceDateInput,
    toCalendarInputDateDigits(basicInfoInput.residenceStartDate),
  );

  // ── Property Details ──────────────────────────────────────────────────────

  await page.getByTestId("loan-information-section").scrollIntoViewIfNeeded();

  const loanAmountInput = page
    .locator('input[placeholder*="loan" i], input[name*="loanAmount"]')
    .first();
  await typeMaskedInput(
    loanAmountInput,
    String(propertyInputHeloc.requestedLoanAmount),
  );

  const mortgageInput = page.locator('input[name="existingMortgageAmount"]').first();
  await expect(mortgageInput).toBeVisible({ timeout: 10000 });
  await typeMaskedInput(mortgageInput, String(existingMortgageAmount));

  // ── Income ────────────────────────────────────────────────────────────────

  await page.getByTestId("income-information-section").scrollIntoViewIfNeeded();

  // Primary income source
  const incomeSourceField = page.getByTestId("inquiry-primary-income-source");
  await expect(incomeSourceField).toBeVisible({ timeout: 10000 });
  const targetIncomeSource = incomeInput[0].incomeSource;

  const nativeIncomeSelect = incomeSourceField.locator("select").first();
  if (await nativeIncomeSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
    const selected = await nativeIncomeSelect.selectOption({ value: targetIncomeSource });
    if (!selected.length) {
      const nonEmptyValue = await nativeIncomeSelect
        .locator("option")
        .evaluateAll((options) => {
          const first = options.find(
            (opt) => ((opt as HTMLOptionElement).value ?? "").trim().length > 0,
          ) as HTMLOptionElement | undefined;
          return first?.value ?? "";
        });
      if (nonEmptyValue) {
        await nativeIncomeSelect.selectOption({ value: nonEmptyValue });
      }
    }
  } else {
    const incomeDropdownTrigger = incomeSourceField
      .locator('button, [role="combobox"], [aria-haspopup="listbox"]')
      .first();
    await expect(incomeDropdownTrigger).toBeVisible({ timeout: 5000 });
    await incomeDropdownTrigger.click();

    const targetOption = page
      .locator('[role="listbox"] [role="option"], [role="option"]')
      .filter({ hasText: /Employed full-time|EMPLOYED_FULL_TIME/i })
      .first();
    if (await targetOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await targetOption.click();
    } else {
      const firstOption = page
        .locator('[role="listbox"] [role="option"], [role="option"]')
        .first();
      await expect(firstOption).toBeVisible({ timeout: 5000 });
      await firstOption.click();
    }
  }

  // Primary annual income
  const annualIncomeInput = page
    .getByTestId("inquiry-annual-income-input")
    .locator('input[name="income"]')
    .first();
  await expect(annualIncomeInput).toBeVisible({ timeout: 10000 });
  await expect(annualIncomeInput).toBeEditable({ timeout: 10000 });
  await typeMaskedInput(annualIncomeInput, String(incomeInput[0].annualIncome));

  // Additional income sources (for multi-income scenarios)
  const additionalIncomes = incomeInput.slice(1);
  for (let addlIndex = 0; addlIndex < additionalIncomes.length; addlIndex++) {
    const additionalIncome = additionalIncomes[addlIndex];

    const addIncomeButton = page.locator(".addMortgageButton").first();
    await expect(addIncomeButton).toBeVisible({ timeout: 5000 });
    await addIncomeButton.scrollIntoViewIfNeeded();
    await addIncomeButton.click();

    const additionalIncomeInput = page
      .locator(`input[name="income-${addlIndex}"]`)
      .first();
    await expect(additionalIncomeInput).toBeVisible({ timeout: 5000 });

    const additionalRow = page
      .locator("div.grid")
      .filter({ has: page.locator(`input[name="income-${addlIndex}"]`) })
      .first();
    const additionalSourceSelect = additionalRow.locator("select").first();

    if (
      await additionalSourceSelect.isVisible({ timeout: 2000 }).catch(() => false)
    ) {
      const selected = await additionalSourceSelect.selectOption({
        value: additionalIncome.incomeSource,
      });
      if (!selected.length) {
        const nonEmptyValue = await additionalSourceSelect
          .locator("option")
          .evaluateAll((options) => {
            const first = options.find(
              (opt) => ((opt as HTMLOptionElement).value ?? "").trim().length > 0,
            ) as HTMLOptionElement | undefined;
            return first?.value ?? "";
          });
        if (nonEmptyValue) {
          await additionalSourceSelect.selectOption({ value: nonEmptyValue });
        }
      }
    } else {
      // Fallback: custom dropdown
      const additionalDropdownTrigger = additionalRow
        .locator('button, [role="combobox"], [aria-haspopup="listbox"]')
        .first();
      if (
        await additionalDropdownTrigger
          .isVisible({ timeout: 2000 })
          .catch(() => false)
      ) {
        await additionalDropdownTrigger.click();
        const targetOption = page
          .locator('[role="listbox"] [role="option"], [role="option"]')
          .filter({ hasText: new RegExp(additionalIncome.incomeSource, "i") })
          .first();
        if (
          await targetOption.isVisible({ timeout: 2000 }).catch(() => false)
        ) {
          await targetOption.click();
        } else {
          const firstOption = page
            .locator('[role="listbox"] [role="option"], [role="option"]')
            .first();
          await expect(firstOption).toBeVisible({ timeout: 5000 });
          await firstOption.click();
        }
      }
    }

    await typeMaskedInput(
      additionalIncomeInput,
      String(additionalIncome.annualIncome),
    );
  }

  // ── Consent ───────────────────────────────────────────────────────────────

  const inquiryConsentCheckbox = page.locator("#inquiry-consent-checkbox");
  await expect(inquiryConsentCheckbox).toBeVisible({ timeout: 5000 });
  if (!(await inquiryConsentCheckbox.isChecked())) {
    await inquiryConsentCheckbox.click();
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  const submitButton = page
    .getByTestId("inquiry-submit-button-container")
    .locator("button")
    .first();
  await submitButton.scrollIntoViewIfNeeded();
  await expect(submitButton).toBeVisible({ timeout: 10000 });
  await expect(submitButton).toBeEnabled({ timeout: 10000 });
  await submitButton.click();

  await page.waitForURL(/\/inquiry\/prequalify/, { timeout: 3 * 60 * 1000 });
  await expect(page).toHaveURL(/\/inquiry\/prequalify/);

  const inquiryId = new URL(page.url()).searchParams.get("id");
  expect(inquiryId).toBeTruthy();
  console.log(`Inquiry ID: ${inquiryId}`);

  // ── Verify offers page ────────────────────────────────────────────────────

  await expect(page.getByTestId("inquiry-offers-page")).toBeVisible({
    timeout: 3 * 60 * 1000,
  });
  await expect(
    page.locator('[data-testid^="inquiry-offer-card-"]'),
  ).toHaveCount(3, { timeout: 3 * 60 * 1000 });

  return inquiryId!;
}
