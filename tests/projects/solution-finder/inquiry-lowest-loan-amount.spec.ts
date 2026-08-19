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
        street: ["49 Longview Ln"],
        city: "Newtown Square",
        region: "PA",
        postalCode: "19073",
        country: "US",
      },
      type: "SECONDARY",
      requestedLoanAmount: 19000,
      loanOfficerId: 6068,
    },
    basicInfoInput: {
      emailId: "test-na-24-3@yopmail.com",
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

test(
  "@smoke NewInquiryPage - lowest requested loan amount - HELOAN ineligible HELOC eligible",
  async ({ page }) => {
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

    // Verify intake page loaded
    await expect(page.getByTestId("new-inquiry-page")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("new-inquiry-header")).toBeVisible({
      timeout: 10000,
    });

    // ──────────────────────────────────────────────────────────────────
    // Property Information Section
    // ──────────────────────────────────────────────────────────────────

    const propertyManualAddressButton = page
      .getByTestId("property-manual-address-toggle")
      .getByRole("button");
    await expect(propertyManualAddressButton).toBeVisible({ timeout: 5000 });
    await propertyManualAddressButton.click();

    await page.locator('input[name="address"]').first().fill(propertyStreet);
    await page
      .locator('input[name="city"]')
      .first()
      .fill(propertyAddress.city);
    await page
      .locator('input[name="state"]')
      .first()
      .fill(propertyAddress.region);
    await page
      .locator('input[name="zip"]')
      .first()
      .fill(propertyAddress.postalCode);

    // Select occupancy type
    const targetOccupancy =
      config.applicationInquiryInput.propertyInputHeloc.type || "PRIMARY";
    const occupancyField = page.getByTestId("occupancy-type-field");
    await expect(occupancyField).toBeVisible({ timeout: 5000 });

    const nativeOccupancySelect = occupancyField.locator("select").first();
    if (
      await nativeOccupancySelect
        .isVisible({ timeout: 2000 })
        .catch(() => false)
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

    // Toggle same-as-address off (required for secondary occupancy)
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

    await page
      .getByTestId("borrower-information-section")
      .scrollIntoViewIfNeeded();

    await page
      .locator('input[placeholder*="first" i], input[name*="firstName"]')
      .fill(borrowerName.first);
    await page
      .locator('input[placeholder*="last" i], input[name*="lastName"]')
      .fill(borrowerName.last);

    const emailInput = page
      .locator('input[type="email"], input[name*="email"]')
      .first();
    await emailInput.fill(
      config.applicationInquiryInput.basicInfoInput.emailId,
    );

    const phoneInput = page.locator('input[name="phoneNumber"]').first();
    await phoneInput.click();
    await phoneInput.clear();
    await typeMaskedInput(
      phoneInput,
      formatPhoneNumber(config.applicationInquiryInput.basicInfoInput.phoneNumber),
    );

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

    const ssnInput = page.locator('input[name="lastFourSSN"]').first();
    await typeMaskedInput(
      ssnInput,
      config.applicationInquiryInput.basicInfoUpdateInput.lastFourSSN,
    );

    // ──────────────────────────────────────────────────────────────────
    // Residence Address Section
    // ──────────────────────────────────────────────────────────────────

    await page.waitForTimeout(300);

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

    await page
      .getByTestId("loan-information-section")
      .scrollIntoViewIfNeeded();

    // Low requested loan amount ($19,000) — below HELOAN minimum threshold
    const loanAmountInput = page
      .locator('input[placeholder*="loan" i], input[name*="loanAmount"]')
      .first();
    await typeMaskedInput(
      loanAmountInput,
      String(
        config.applicationInquiryInput.propertyInputHeloc.requestedLoanAmount,
      ),
    );

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

    await page
      .getByTestId("income-information-section")
      .scrollIntoViewIfNeeded();

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
        await targetIncomeOption
          .isVisible({ timeout: 2000 })
          .catch(() => false)
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
    // Consent Checkbox
    // ──────────────────────────────────────────────────────────────────

    const inquiryConsentCheckbox = page.locator("#inquiry-consent-checkbox");
    await expect(inquiryConsentCheckbox).toBeVisible({ timeout: 5000 });
    if (!(await inquiryConsentCheckbox.isChecked())) {
      await inquiryConsentCheckbox.click();
    }

    // ──────────────────────────────────────────────────────────────────
    // Submit Form
    // ──────────────────────────────────────────────────────────────────

    const submitButton = page
      .getByTestId("inquiry-submit-button-container")
      .locator("button")
      .first();
    await submitButton.scrollIntoViewIfNeeded();
    await expect(submitButton).toBeVisible({ timeout: 10000 });
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
    await submitButton.click();

    await page.waitForURL(/\/inquiry\/prequalify/, { timeout: 3 * 60 * 1000 });

    // ──────────────────────────────────────────────────────────────────
    // Verify Offers Page
    // ──────────────────────────────────────────────────────────────────

    await expect(page).toHaveURL(/\/inquiry\/prequalify/);

    const inquiryId = new URL(page.url()).searchParams.get("id");
    expect(inquiryId).toBeTruthy();
    console.log(`Inquiry ID: ${inquiryId}`);

    await expect(page.getByTestId("inquiry-offers-page")).toBeVisible({
      timeout: 3 * 60 * 1000,
    });
    await expect(
      page.locator('[data-testid^="inquiry-offer-card-"]'),
    ).toHaveCount(3, { timeout: 3 * 60 * 1000 });

    // ──────────────────────────────────────────────────────────────────
    // Validate Offers UI (lowest loan amount — HELOC eligible, HELOAN ineligible)
    // ──────────────────────────────────────────────────────────────────

    const offersPage = page.getByTestId("inquiry-offers-page");

    await expect(offersPage).toContainText(borrowerName.first);
    await expect(offersPage).toContainText(borrowerName.last);
    await expect(offersPage).toContainText(propertyStreet);
    await expect(offersPage).toContainText(propertyAddress.city);
    await expect(offersPage).toContainText(propertyAddress.region);
    await expect(offersPage).toContainText(propertyAddress.postalCode);
    await expect(offersPage).toContainText(
      formatCurrency(
        config.applicationInquiryInput.propertyInputHeloc.requestedLoanAmount,
      ),
    );

    // HELOC offers are eligible so CLTV, Rate Range, DTI are present in summary
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
      capturedSummary[label] = (
        (await valueLocator.textContent()) ?? ""
      ).trim();
    }
    console.log("Inquiry summary:", JSON.stringify(capturedSummary, null, 2));

    // Offer cards render in fixed order: Fixed HELOC (0), Variable HELOC (1), HELOAN (2)
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

    // Fixed Rate HELOC (card 0) is eligible — shows rate, loan amount, term and details
    const fixedHelocCard = page.getByTestId("inquiry-offer-card-0");
    await expect(
      fixedHelocCard.getByText(/^\d+\.\d{2}%$/).first(),
    ).toBeVisible({ timeout: 5000 });
    await expect(fixedHelocCard).toContainText("Loan Amount");
    await expect(fixedHelocCard).toContainText(/\$[\d,]+/);
    await expect(fixedHelocCard).toContainText("Term");
    await expect(fixedHelocCard).toContainText(/\d+\s+years/);
    await expect(fixedHelocCard).toContainText("Offer Details");
    await expect(fixedHelocCard).toContainText("Max CLTV:");
    await expect(fixedHelocCard).toContainText("Credit Score Required:");
    await expect(fixedHelocCard).toContainText("Rate Type:");

    // Variable Rate HELOC (card 1) is eligible — shows rate, loan amount, term and details
    const variableHelocCard = page.getByTestId("inquiry-offer-card-1");
    await expect(
      variableHelocCard.getByText(/^\d+\.\d{2}%$/).first(),
    ).toBeVisible({ timeout: 5000 });
    await expect(variableHelocCard).toContainText("Loan Amount");
    await expect(variableHelocCard).toContainText(/\$[\d,]+/);
    await expect(variableHelocCard).toContainText("Term");
    await expect(variableHelocCard).toContainText(/\d+\s+years/);
    await expect(variableHelocCard).toContainText("Offer Details");
    await expect(variableHelocCard).toContainText("Max CLTV:");
    await expect(variableHelocCard).toContainText("Credit Score Required:");
    await expect(variableHelocCard).toContainText("Rate Type:");

    // HELOAN (card 2) is ineligible — loan amount below minimum thresholds (exact reason varies in QA)
    const heloanCard = page.getByTestId("inquiry-offer-card-2");
    await expect(heloanCard).toContainText(ineligibleHeading);

    console.log("Captured offers:\n" + capturedOffers.join("\n---\n"));

    console.log(
      `✅ Test completed successfully with email: ${uniqueEmail}, inquiry ID: ${inquiryId}`,
    );
  },
);
