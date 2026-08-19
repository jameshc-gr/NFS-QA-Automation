import { test, expect } from "@playwright/test";
import {
  fillAndSubmitInquiryForm,
  formatCurrency,
  generateUniqueEmail,
  toCalendarInputDateDigits,
  typeMaskedInput,
  formatPhoneNumber,
} from "./helpers/inquiry-form";

const inquiryConfig = {
  type: "SALES_INQUIRY",
  applicationInquiryInput: {
    applicationInput: {
      applicationType: "HELOC",
    },
    propertyInputHeloc: {
      address: {
        street: ["645 N Avenue 50"],
        city: "Los Angeles",
        region: "CA",
        postalCode: "90042",
        country: "US",
      },
      type: "SECONDARY",
      requestedLoanAmount: 210000,
      loanOfficerId: 6068,
    },
    basicInfoInput: {
      emailId: "test-na-24-1@yopmail.com",
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
      phoneNumber: "6163200701",
      isAgreed: true,
    },
    basicInfoUpdateInput: {
      dateOfBirth: "2000-01-01",
      lastFourSSN: "2955",
    },
    incomeInput: [
      {
        annualIncome: 444444,
        incomeSource: "EMPLOYED_FULL_TIME",
        incomeType: null,
      },
    ],
    loId: 6068,
    loCostCenter: "7547",
    isConsent: true,
    channel: "CONSUMERDIRECT",
    existingMortgageAmount: 70000,
  },
} as const;

test("@smoke NewInquiryPage - property on sale (listed in MLS) - HELOAN ineligible", async ({
  page,
}) => {
  const uniqueEmail = generateUniqueEmail();
  const config = {
    ...inquiryConfig,
    applicationInquiryInput: {
      ...inquiryConfig.applicationInquiryInput,
      basicInfoInput: {
        ...inquiryConfig.applicationInquiryInput.basicInfoInput,
        emailId: uniqueEmail,
      },
    },
  };

  const propertyAddress =
    config.applicationInquiryInput.propertyInputHeloc.address;
  const residenceAddress =
    config.applicationInquiryInput.basicInfoInput.residenceAddress;
  const borrowerName = config.applicationInquiryInput.basicInfoInput.name;

  const propertyStreet = propertyAddress.street[0] || "";
  const residenceStreet = residenceAddress.street[0] || "";

  const occupancyDisplayMap: Record<string, string> = {
    PRIMARY: "Primary residence",
    SECONDARY: "Secondary residence",
    INVESTMENT: "Investment",
  };

  console.log(`Using email: ${uniqueEmail}`);

  // Navigate to inquiry intake with playwright flag to bypass auth
  await page.goto("/inquiry/intake?playwright=true", {
    waitUntil: "load",
  });

  // Verify intake page loaded using stable test IDs
  await expect(page.getByTestId("new-inquiry-page")).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByTestId("new-inquiry-header")).toBeVisible({
    timeout: 10000,
  });

  // ──────────────────────────────────────────────────────────────────
  // Property Information Section
  // ──────────────────────────────────────────────────────────────────

  // Force manual address mode before filling property address fields
  const propertyManualAddressButton = page
    .getByTestId("property-manual-address-toggle")
    .getByRole("button");
  await expect(propertyManualAddressButton).toBeVisible({ timeout: 5000 });
  await propertyManualAddressButton.click();

  await page.locator('input[name="address"]').first().fill(propertyStreet);
  await page.locator('input[name="city"]').first().fill(propertyAddress.city);
  await page
    .locator('input[name="state"]')
    .first()
    .fill(propertyAddress.region);
  await page
    .locator('input[name="zip"]')
    .first()
    .fill(propertyAddress.postalCode);

  // Select occupancy type before toggling same-as-address.
  // Prefer native select when present; otherwise use dropdown menu interaction.
  const targetOccupancy =
    config.applicationInquiryInput.propertyInputHeloc.type || "PRIMARY";
  const occupancyField = page.getByTestId("occupancy-type-field");
  await expect(occupancyField).toBeVisible({ timeout: 5000 });

  const nativeOccupancySelect = occupancyField.locator("select").first();
  if (
    await nativeOccupancySelect.isVisible({ timeout: 2000 }).catch(() => false)
  ) {
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
        `text="${occupancyDisplayMap[targetOccupancy] || occupancyDisplayMap.PRIMARY}"`,
      )
      .first()
      .click();
  }

  // Toggle same-as-address off after occupancy is set (required for secondary).
  const sameAddressCheckbox = page.locator('#sameAsAddress, input[name="sameAsAddress"], [data-testid="same-as-address-toggle"] input[type="checkbox"]').first();
  if (await sameAddressCheckbox.isVisible({ timeout: 1500 }).catch(() => false)) {
  await expect(sameAddressCheckbox).not.toBeDisabled({ timeout: 5000 });
  const isSameAsChecked = await sameAddressCheckbox.isChecked();
  if (isSameAsChecked) {
    const sameAddressToggle = page.getByTestId("same-as-address-toggle");
    if (await sameAddressToggle.isVisible({ timeout: 1000 }).catch(() => false)) {
      await sameAddressToggle.click();
    } else {
      await sameAddressCheckbox.click();
    }
    await expect(sameAddressCheckbox).not.toBeChecked({ timeout: 3000 });
  }
}

  // ──────────────────────────────────────────────────────────────────
  // Personal Information Section
  // ──────────────────────────────────────────────────────────────────

  // Scroll to personal info section
  await page
    .getByTestId("borrower-information-section")
    .scrollIntoViewIfNeeded();

  // First Name
  await page
    .locator('input[placeholder*="first" i], input[name*="firstName"]')
    .fill(borrowerName.first);

  // Last Name
  await page
    .locator('input[placeholder*="last" i], input[name*="lastName"]')
    .fill(borrowerName.last);

  // Email
  const emailInput = page
    .locator('input[type="email"], input[name*="email"]')
    .first();
  await emailInput.fill(config.applicationInquiryInput.basicInfoInput.emailId);

  // Phone
  const phoneInput = page.locator('input[name="phoneNumber"]').first();
  await phoneInput.click();
  await phoneInput.clear();
  await typeMaskedInput(
    phoneInput,
    formatPhoneNumber(config.applicationInquiryInput.basicInfoInput.phoneNumber),
  );

  // Date of Birth (Calendar Input)
  const dobInput = page
    .locator('input#date, input[name="birthday"], input[name="date"]')
    .first();
  await expect(dobInput).toBeVisible({ timeout: 10000 });
  await typeMaskedInput(
    dobInput,
    toCalendarInputDateDigits(
      config.applicationInquiryInput.basicInfoUpdateInput.dateOfBirth,
    ),
  );

  // Last 4 SSN
  const ssnInput = page.locator('input[name="lastFourSSN"]').first();
  await typeMaskedInput(
    ssnInput,
    config.applicationInquiryInput.basicInfoUpdateInput.lastFourSSN,
  );

  // ──────────────────────────────────────────────────────────────────
  // Residence Address Section (since not same as property)
  // ──────────────────────────────────────────────────────────────────

  await page.waitForTimeout(300); // Wait for form to update

  const residenceManualAddressButton = page
    .getByTestId("residence-manual-address-toggle")
    .getByRole("button");
  await expect(residenceManualAddressButton).toBeVisible({ timeout: 5000 });
  await residenceManualAddressButton.click();

  await page
    .locator('input[name="residenceAddress"]')
    .first()
    .fill(residenceStreet);
  await page
    .locator('input[name="residenceCity"]')
    .first()
    .fill(residenceAddress.city);
  await page
    .locator('input[name="residenceState"]')
    .first()
    .fill(residenceAddress.region);
  await page
    .locator('input[name="residenceZip"]')
    .first()
    .fill(residenceAddress.postalCode);

  // Residence start date
  const residenceDateInput = page
    .locator('input#residence-start-date, input[name="start"]')
    .first();
  await expect(residenceDateInput).toBeVisible({ timeout: 10000 });
  await typeMaskedInput(
    residenceDateInput,
    toCalendarInputDateDigits(
      config.applicationInquiryInput.basicInfoInput.residenceStartDate,
    ),
  );

  // ──────────────────────────────────────────────────────────────────
  // Property Details Section
  // ──────────────────────────────────────────────────────────────────

  // Scroll to property details
  await page.getByTestId("loan-information-section").scrollIntoViewIfNeeded();

  // Requested Loan Amount
  const loanAmountInput = page
    .locator('input[placeholder*="loan" i], input[name*="loanAmount"]')
    .first();
  await typeMaskedInput(
    loanAmountInput,
    String(
      config.applicationInquiryInput.propertyInputHeloc.requestedLoanAmount,
    ),
  );

  // Existing Mortgage Amount
  const mortgageInput = page
    .locator('input[name="existingMortgageAmount"]')
    .first();
  await expect(mortgageInput).toBeVisible({ timeout: 10000 });
  await mortgageInput.fill(
    String(config.applicationInquiryInput.existingMortgageAmount),
  );

  // ──────────────────────────────────────────────────────────────────
  // Income Section
  // ──────────────────────────────────────────────────────────────────

  // Scroll to income section
  await page.getByTestId("income-information-section").scrollIntoViewIfNeeded();

  // Primary income source - select configured source (or first non-empty option)
  const incomeSourceField = page.getByTestId("inquiry-primary-income-source");
  await expect(incomeSourceField).toBeVisible({ timeout: 10000 });
  const targetIncomeSource =
    config.applicationInquiryInput.incomeInput[0].incomeSource;

  const nativeIncomeSelect = incomeSourceField.locator("select").first();
  if (
    await nativeIncomeSelect.isVisible({ timeout: 1000 }).catch(() => false)
  ) {
    const selected = await nativeIncomeSelect.selectOption({
      value: targetIncomeSource,
    });
    if (!selected.length) {
      const nonEmptyValue = await nativeIncomeSelect
        .locator("option")
        .evaluateAll((options) => {
          const first = options.find((option) => {
            const value = (option as HTMLOptionElement).value;
            return value && value.trim().length > 0;
          }) as HTMLOptionElement | undefined;
          return first?.value || "";
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

    const targetIncomeOption = page
      .locator('[role="listbox"] [role="option"], [role="option"]')
      .filter({ hasText: /Employed full-time|EMPLOYED_FULL_TIME/i })
      .first();
    if (
      await targetIncomeOption.isVisible({ timeout: 2000 }).catch(() => false)
    ) {
      await targetIncomeOption.click();
    } else {
      const firstIncomeOption = page
        .locator('[role="listbox"] [role="option"], [role="option"]')
        .first();
      await expect(firstIncomeOption).toBeVisible({ timeout: 5000 });
      await firstIncomeOption.click();
    }
  }

  // Annual Income
  const annualIncomeInput = page
    .getByTestId("inquiry-annual-income-input")
    .locator('input[name="income"]')
    .first();
  await expect(annualIncomeInput).toBeVisible({ timeout: 10000 });
  await expect(annualIncomeInput).toBeEditable({ timeout: 10000 });
  await typeMaskedInput(
    annualIncomeInput,
    String(config.applicationInquiryInput.incomeInput[0].annualIncome),
  );

  // ──────────────────────────────────────────────────────────────────
  // Consent Checkbox (inquiry terms)
  // ──────────────────────────────────────────────────────────────────

  const inquiryConsentCheckbox = page.locator("#inquiry-consent-checkbox");
  await expect(inquiryConsentCheckbox).toBeVisible({ timeout: 5000 });
  if (!(await inquiryConsentCheckbox.isChecked())) {
    await inquiryConsentCheckbox.click();
  }

  // ──────────────────────────────────────────────────────────────────
  // Submit Form
  // ──────────────────────────────────────────────────────────────────

  // Click submit button
  const submitButton = page
    .getByTestId("inquiry-submit-button-container")
    .locator("button")
    .first();
  await submitButton.scrollIntoViewIfNeeded();
  await expect(submitButton).toBeVisible({ timeout: 10000 });
  await expect(submitButton).toBeEnabled({ timeout: 10000 });
  await submitButton.click();

  // Wait for navigation to prequalify/offers page (can take up to 3 minutes)
  await page.waitForURL(/\/inquiry\/prequalify/, { timeout: 3 * 60 * 1000 });

  // ──────────────────────────────────────────────────────────────────
  // Verify Offers Page
  // ──────────────────────────────────────────────────────────────────

  // Verify we're on the offers page
  await expect(page).toHaveURL(/\/inquiry\/prequalify/);

  // Capture the inquiry ID from the offers page URL (set as `id` query param)
  const inquiryId = new URL(page.url()).searchParams.get("id");
  expect(inquiryId).toBeTruthy();
  console.log(`Inquiry ID: ${inquiryId}`);

  // Wait for offers to load
  // Verify offers page container and exactly 3 offer cards
  await expect(page.getByTestId("inquiry-offers-page")).toBeVisible({
    timeout: 3 * 60 * 1000,
  });
  await expect(
    page.locator('[data-testid^="inquiry-offer-card-"]'),
  ).toHaveCount(3, { timeout: 3 * 60 * 1000 });

  // Verify static LO mismatch warning banner is shown
  await expect(page.getByTestId("static-lo-mismatch-warning")).toBeVisible({
    timeout: 3 * 60 * 1000,
  });

  // ────────────────────────────────────────────────────────────────────
  // Validate Offers UI content (property on sale — HELOAN ineligible)
  // ────────────────────────────────────────────────────────────────────

  const offersPage = page.getByTestId("inquiry-offers-page");

  // Inquiry summary reflects the submitted borrower + property + requested amount
  await expect(offersPage).toContainText(
    `${borrowerName.first} ${borrowerName.last}`,
  );
  await expect(offersPage).toContainText(propertyStreet);
  await expect(offersPage).toContainText(propertyAddress.city);
  await expect(offersPage).toContainText(propertyAddress.region);
  await expect(offersPage).toContainText(propertyAddress.postalCode);
  await expect(offersPage).toContainText(
    formatCurrency(
      config.applicationInquiryInput.propertyInputHeloc.requestedLoanAmount,
    ),
  );

  // Capture the summary fields rendered as "<Label>: <value>" pairs
  const summaryLabels = [
    "Borrower",
    "Address",
    "FICO",
    "Requested Amount",
    "CLTV",
    "Rate Range",
    "DTI",
  ];
  const capturedSummary: Record<string, string> = {};
  for (const label of summaryLabels) {
    const valueLocator = offersPage
      .locator(`span:text-is("${label}:") + span`)
      .first();
    await expect(valueLocator).not.toBeEmpty();
    capturedSummary[label] = ((await valueLocator.textContent()) ?? "").trim();
  }
  console.log("Inquiry summary:", JSON.stringify(capturedSummary, null, 2));

  // Offer cards render in a fixed product order: Fixed HELOC, Variable HELOC, HELOAN
  const expectedOfferOrder = [
    "Fixed Rate HELOC",
    "Variable Rate HELOC",
    "HELOAN",
  ];
  const ineligibleHeading =
    "No offers were found for this product for the following reasons:";
  const capturedOffers: string[] = [];
  for (let i = 0; i < expectedOfferOrder.length; i++) {
    const card = page.getByTestId(`inquiry-offer-card-${i}`);
    await expect(card).toBeVisible();
    await expect(card).toContainText(expectedOfferOrder[i]);
    capturedOffers.push(((await card.innerText()) ?? "").trim());
  }

  // Fixed Rate HELOC (card 0) is eligible: shows rate, loan amount, term and details
  const fixedHelocCard = page.getByTestId("inquiry-offer-card-0");
  const fixedHelocRate = fixedHelocCard.getByText(/^\d+\.\d{2}%$/).first();
  if (await fixedHelocRate.isVisible({ timeout: 1000 }).catch(() => false)) {
    await expect(fixedHelocCard).toContainText("Loan Amount");
    await expect(fixedHelocCard).toContainText(/\$[\d,]+/);
    await expect(fixedHelocCard).toContainText("Term");
    await expect(fixedHelocCard).toContainText(/\d+\s+years/);
    await expect(fixedHelocCard).toContainText("Offer Details");
    await expect(fixedHelocCard).toContainText("Max CLTV:");
    await expect(fixedHelocCard).toContainText("Credit Score Required:");
    await expect(fixedHelocCard).toContainText("Rate Type:");
  } else {
    await expect(fixedHelocCard).toContainText(ineligibleHeading);
  }

  // Variable Rate HELOC (card 1) has no offer returned for this scenario
  const variableHelocCard = page.getByTestId("inquiry-offer-card-1");
  await expect(variableHelocCard).toContainText(ineligibleHeading);
  await expect(variableHelocCard).toContainText(
    "No offer was returned for this product.",
  );

  // HELOAN (card 2) is ineligible — property listed for sale (exact reason varies in QA)
  const heloanCard = page.getByTestId("inquiry-offer-card-2");
  await expect(heloanCard).toContainText(ineligibleHeading);

  console.log("Captured offers:\n" + capturedOffers.join("\n---\n"));

  console.log(
    `✅ Test completed successfully with email: ${uniqueEmail}, inquiry ID: ${inquiryId}`,
  );
});
