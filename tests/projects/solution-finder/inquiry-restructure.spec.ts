import { test, expect } from "@playwright/test";
import {
  fillAndSubmitInquiryForm,
  formatCurrency,
  generateUniqueEmail,
  typeMaskedInput,
} from "./helpers/inquiry-form";

const inquiryConfig = {
  propertyInputHeloc: {
    address: {
      street: ["1100 Biscayne Blvd"],
      city: "Miami",
      region: "FL",
      postalCode: "33132",
      country: "US",
    },
    type: "SECONDARY",
    requestedLoanAmount: 200000,
    loanOfficerId: 6068,
  },
  basicInfoInput: {
    emailId: "",
    name: {
      first: "Erica",
      middle: "",
      last: "Lambert",
      suffix: "",
    },
    residenceAddress: {
      street: ["409 Glenwood Ave"],
      city: "Menlo Park",
      region: "CA",
      postalCode: "94025",
      country: "US",
    },
    residenceStartDate: "2009-01-01",
    phoneNumber: "3302741661",
    isAgreed: true,
  },
  basicInfoUpdateInput: {
    dateOfBirth: "2000-01-01",
    lastFourSSN: "2955",
  },
  incomeInput: [
    {
      annualIncome: 1000000,
      incomeSource: "SELF_EMPLOYED",
      incomeType: null,
    },
  ],
  existingMortgageAmount: 70000,
} as const;

test("@smoke - Restructure flow with updated data", async ({ page }) => {
  const uniqueEmail = generateUniqueEmail();
  const formInput = {
    ...inquiryConfig,
    basicInfoInput: {
      ...inquiryConfig.basicInfoInput,
      emailId: uniqueEmail,
    },
  };

  console.log(`Using email: ${uniqueEmail}`);

  // ──────────────────────────────────────────────────────────────────
  // Step 1: Submit the original inquiry
  // ──────────────────────────────────────────────────────────────────

  const inquiryId = await fillAndSubmitInquiryForm(page, formInput);
  console.log(`Original Inquiry ID: ${inquiryId}`);

  // Verify LO mismatch warning (GRI only)
  if (!process.env.COMPANY || process.env.COMPANY === "gri") {
    await expect(page.getByTestId("static-lo-mismatch-warning")).toBeVisible({
      timeout: 3 * 60 * 1000,
    });
  }

  // Verify HELOAN card is ineligible before restructure (no unit = AVM failure)
  const heloanCard = page.getByTestId("inquiry-offer-card-2");
  await expect(heloanCard).toBeVisible();
  await expect(heloanCard).toContainText("HELOAN");
  await expect(heloanCard).toContainText(
    "No offers were found for this product for the following reasons:",
  );

  // ──────────────────────────────────────────────────────────────────
  // Step 2: Test Restructure modal — Cancel
  // ──────────────────────────────────────────────────────────────────

  // Scroll down to find the Restructure Inquiry button
  const restructureButton = page.getByRole("button", {
    name: "Restructure Inquiry",
  });
  await restructureButton.scrollIntoViewIfNeeded();
  await expect(restructureButton).toBeVisible({ timeout: 5000 });
  await expect(restructureButton).toBeEnabled();

  // Click Restructure Inquiry — modal should appear
  await restructureButton.click();
  const modal = page.locator(".info-modal > .modal-content");
  await expect(modal).toBeVisible({ timeout: 5000 });

  // Click Cancel — modal should close
  const cancelButton = modal.getByRole("button", { name: "Cancel" });
  await expect(cancelButton).toBeVisible();
  await cancelButton.click();
  await expect(modal).not.toBeVisible({ timeout: 3000 });

  // ──────────────────────────────────────────────────────────────────
  // Step 3: Test Restructure modal — Close (X button)
  // ──────────────────────────────────────────────────────────────────

  // Re-open the modal
  await restructureButton.click();
  await expect(modal).toBeVisible({ timeout: 5000 });

  // Click the close (X) button on the modal
  const closeButton = modal
    .locator('button[aria-label="Close"], .modal-close, button:has(svg)')
    .first();
  await expect(closeButton).toBeVisible();
  await closeButton.click();
  await expect(modal).not.toBeVisible({ timeout: 3000 });

  // ──────────────────────────────────────────────────────────────────
  // Step 4: Test Restructure modal — Continue (triggers restructure)
  // ──────────────────────────────────────────────────────────────────

  // Re-open the modal
  await restructureButton.click();
  await expect(modal).toBeVisible({ timeout: 5000 });

  // Click Continue — should navigate to the prefilled intake form
  const continueButton = modal.getByRole("button", { name: "Continue" });
  await expect(continueButton).toBeVisible();
  await continueButton.click();

  // Wait for the intake form to load with prefilled data
  await expect(page.getByTestId("new-inquiry-page")).toBeVisible({
    timeout: 30000,
  });

  // ──────────────────────────────────────────────────────────────────
  // Step 5: Update the form — add unit number + increase loan amount
  // ──────────────────────────────────────────────────────────────────

  // Add unit number (was missing in original — causes AVM failure for HELOAN)
  const unitInput = page.locator('input[name="unit"]').first();
  await expect(unitInput).toBeVisible({ timeout: 5000 });
  await unitInput.fill("5404");

  // Update requested loan amount to $300,000
  const loanAmountInput = page.locator('input[name="loanAmount"]').first();
  await expect(loanAmountInput).toBeVisible({ timeout: 5000 });
  await typeMaskedInput(loanAmountInput, "300000");

  // Ensure consent checkbox is checked
  const inquiryConsentCheckbox = page.locator("#inquiry-consent-checkbox");
  await expect(inquiryConsentCheckbox).toBeVisible({ timeout: 5000 });
  if (!(await inquiryConsentCheckbox.isChecked())) {
    await inquiryConsentCheckbox.click();
  }

  // Submit the restructured inquiry
  const submitButton = page
    .getByTestId("inquiry-submit-button-container")
    .locator("button")
    .first();
  await submitButton.scrollIntoViewIfNeeded();
  await expect(submitButton).toBeVisible({ timeout: 10000 });
  await expect(submitButton).toBeEnabled({ timeout: 10000 });
  await submitButton.click();

  // Wait for offers page after restructure
  await page.waitForURL(/\/inquiry\/prequalify/, { timeout: 3 * 60 * 1000 });

  // ──────────────────────────────────────────────────────────────────
  // Step 6: Verify restructured offers
  // ──────────────────────────────────────────────────────────────────

  const restructuredInquiryId = new URL(page.url()).searchParams.get("id");
  expect(restructuredInquiryId).toBeTruthy();
  console.log(`Restructured Inquiry ID: ${restructuredInquiryId}`);

  await expect(page.getByTestId("inquiry-offers-page")).toBeVisible({
    timeout: 3 * 60 * 1000,
  });
  await expect(
    page.locator('[data-testid^="inquiry-offer-card-"]'),
  ).toHaveCount(3, { timeout: 3 * 60 * 1000 });

  // Verify the requested amount now reflects $300,000
  const offersPage = page.getByTestId("inquiry-offers-page");
  await expect(offersPage).toContainText(formatCurrency(300000));

  // HELOAN card should now show an actual offer (unit number resolved AVM)
  const restructuredHeloanCard = page.getByTestId("inquiry-offer-card-2");
  await expect(restructuredHeloanCard).toBeVisible();
  await expect(restructuredHeloanCard).toContainText("HELOAN");

  // Verify HELOAN now has a rate, loan amount, term, and offer details
  await expect(
    restructuredHeloanCard.getByText(/^\d+\.\d{2,3}%$/).first(),
  ).toBeVisible();
  await expect(restructuredHeloanCard).toContainText("Loan Amount");
  await expect(restructuredHeloanCard).toContainText(/\$[\d,]+/);
  await expect(restructuredHeloanCard).toContainText("Term");
  await expect(restructuredHeloanCard).toContainText(/\d+\s+years/);
  await expect(restructuredHeloanCard).toContainText("Offer Details");

  console.log(
    `✅ Restructure test completed — original: ${inquiryId}, restructured: ${restructuredInquiryId}`,
  );
});
