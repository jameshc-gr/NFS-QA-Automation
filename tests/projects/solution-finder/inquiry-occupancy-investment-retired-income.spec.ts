import { test, expect } from "@playwright/test";
import {
  formatCurrency,
  generateUniqueEmail,
  selectInquiryIncomeSource,
  toCalendarInputDateDigits,
  typeMaskedInput,
} from "./helpers/inquiry-form";

const inquiryConfig = {
  type: "SALES_INQUIRY",
  applicationInquiryInput: {
    applicationInput: {
      applicationType: "HELOC",
    },
    propertyInputHeloc: {
      address: {
        street: ["49 Longview Ln"],
        city: "Newtown Square",
        region: "PA",
        postalCode: "19073",
        country: "US",
      },
      type: "INVESTMENT",
      requestedLoanAmount: 200000,
      loanOfficerId: 6068,
    },
    basicInfoInput: {
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
      dateOfBirth: "1950-01-01",
      lastFourSSN: "2955",
    },
    incomeInput: [
      {
        annualIncome: 1000000,
        incomeSource: "RETIRED_SSI",
        incomeType: "SOCIAL_SECURITY",
      },
    ],
    loId: 6068,
    loCostCenter: "9127",
    isConsent: true,
    channel: "CONSUMERDIRECT",
    existingMortgageAmount: 70000,
  },
} as const;

test("Navigator retirement-source visibility follows the 62nd birthday", async ({ page }) => {
  for (const [today, dob, available] of [
    ["2026-06-30", "1964-07-01", false],
    ["2026-07-01", "1964-07-01", true],
    ["2026-07-02", "1964-07-01", true],
    ["2026-02-28", "1964-02-29", false],
    ["2026-03-01", "1964-02-29", true],
  ] as const) {
    await page.clock.setFixedTime(new Date(`${today}T12:00:00`));
    await page.goto("/inquiry/intake/?playwright=true");
    await expect(page.getByTestId("new-inquiry-page")).toBeVisible();
    const birthDate = page.locator("input#date");
    await typeMaskedInput(birthDate, toCalendarInputDateDigits(dob));
    const [year, month, day] = dob.split("-");
    await expect(birthDate).toHaveValue(`${month}/${day}/${year}`);
    const source = page.getByRole("combobox", { name: "Primary income source*", exact: true });
    await source.click();
    await expect(source).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("option", { name: "Retired SSI", exact: true }))
      .toHaveCount(available ? 1 : 0);
    await page.keyboard.press("Escape");
  }
});

test("Occupancy type is investment and income source is Retired SSI", async ({
  page,
}, testInfo) => {
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
  await phoneInput.pressSequentially(
    config.applicationInquiryInput.basicInfoInput.phoneNumber,
    { delay: 35 },
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

  // Never substitute employment if the age-gated retirement option is missing.
  const incomeSourceField = page.getByTestId("inquiry-primary-income-source");
  await expect(incomeSourceField).toBeVisible({ timeout: 10000 });
  const targetIncomeSource =
    config.applicationInquiryInput.incomeInput[0].incomeSource;

  await selectInquiryIncomeSource(page, incomeSourceField, targetIncomeSource);

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
  const [inquiryResponse] = await Promise.all([
    page.waitForResponse(response =>
      new URL(response.url()).pathname === "/api/application/inquiry" &&
      response.request().method() === "POST",
      { timeout: 3 * 60 * 1000 },
    ),
    submitButton.click(),
  ]);
  expect(inquiryResponse.status()).toBe(200);
  const actualRequest = inquiryResponse.request().postDataJSON();
  await testInfo.attach("actual-inquiry-request", {
    body: Buffer.from(JSON.stringify(actualRequest, null, 2)),
    contentType: "application/json",
  });
  await testInfo.attach("actual-inquiry-response", {
    body: await inquiryResponse.body(),
    contentType: "application/json",
  });
  expect(actualRequest.applicationInquiryInput.basicInfoUpdateInput.dateOfBirth)
    .toBe(config.applicationInquiryInput.basicInfoUpdateInput.dateOfBirth);
  expect(actualRequest.applicationInquiryInput.incomeInput)
    .toEqual(config.applicationInquiryInput.incomeInput);

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

  // Verify static LO mismatch warning banner is shown (GRI only)
  if (!process.env.COMPANY || process.env.COMPANY === "gri") {
    await expect(page.getByTestId("static-lo-mismatch-warning")).toBeVisible({
      timeout: 3 * 60 * 1000,
    });
  }

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

  const expectedOfferTitles = [
    "Fixed Rate HELOC",
    "Variable Rate HELOC",
    "HELOAN",
  ];
  const capturedOffers: string[] = [];
  const offerCards = page.locator('[data-testid^="inquiry-offer-card-"]');
  for (const title of expectedOfferTitles) {
    const card = offerCards.filter({ has: page.getByText(title, { exact: true }) });
    await expect(card).toHaveCount(1);
    await expect(card).toBeVisible();
    capturedOffers.push(((await card.innerText()) ?? "").trim());
  }

  for (const title of ["Fixed Rate HELOC", "Variable Rate HELOC"]) {
    const card = offerCards.filter({ has: page.getByText(title, { exact: true }) });
    await expect(card.getByText(/^\d+\.\d{2,3}%$/).first()).toBeVisible();
    await expect(card).toContainText("Loan Amount");
    await expect(card).toContainText(/\$[\d,]+/);
    await expect(card).toContainText("Term");
    await expect(card).toContainText(/\d+\s+years/);
    await expect(card).toContainText("Offer Details");
    await expect(card).toContainText("Max CLTV:");
    await expect(card).toContainText("Credit Score Required:");
    await expect(card).toContainText("Rate Type:");
  }

  console.log("Captured offers:\n" + capturedOffers.join("\n---\n"));
  await page.screenshot({ path: testInfo.outputPath("offers.png"), fullPage: true });

  console.log(
    `✅ Test completed successfully with email: ${uniqueEmail}, inquiry ID: ${inquiryId}`,
  );
});
