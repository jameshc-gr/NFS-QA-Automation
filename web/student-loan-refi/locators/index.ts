export const personalInfoLocators = {
  firstName: { role: 'textbox', name: 'First name*' },
  lastName: { role: 'textbox', name: 'Last name*' },
  email: { role: 'textbox', name: 'Email address*' },
  phone: { role: 'textbox', name: 'Phone number*' },
  continueButtonTestId: 'button'
} as const;

export const loanDetailsLocators = {
  loanAmount: { role: 'textbox', name: 'Loan amount to refinance*' },
  monthlyPayment: { role: 'textbox', name: 'Current monthly payment*' },
  interestRate: { role: 'textbox', name: 'Current interest rate*' },
  loanTypeDropdownTestId: 'dropdown-label',
  continueButtonName: 'Continue'
} as const;

export const addressLocators = {
  addressInputCss: '#gma',
  pacItemCss: '.pac-item',
  schoolCombobox: { role: 'combobox', name: 'School/university*' },
  degreeCombobox: { role: 'combobox', name: 'Degree level*' },
  graduationDate: { role: 'textbox', name: 'Graduation date*' }
} as const;

export const employmentLocators = {
  incomeTypeCombobox: { role: 'combobox', name: 'Income type*' },
  employer: { role: 'textbox', name: 'Employer name*' },
  occupation: { role: 'textbox', name: 'Occupation/job title*' },
  annualIncome: { role: 'textbox', name: 'Annual income*' },
  employmentStart: { role: 'textbox', name: 'Employment start date*' },
  continueButtonName: 'Continue'
} as const;

export const financialLocators = {
  citizenStatusCombobox: { role: 'combobox', name: 'Citizen status*' },
  creditScoreCombobox: { role: 'combobox', name: 'Credit score range*' },
  housingTypeCombobox: { role: 'combobox', name: 'Housing type*' },
  housingCost: { role: 'textbox', name: 'Monthly housing cost*' },
  totalAssets: { role: 'textbox', name: 'Enter total assets' },
  continueButtonName: 'Continue'
} as const;

export const identityLocators = {
  dobCss: '#dob',
  ssn: { role: 'textbox', name: 'Social security number*' },
  emptyButtonTextRegex: /^$/,
  agreeAndCheckRatesButton: 'Agree and Check my Rates'
} as const;

export const offersLocators = {
  noOfferHeading: /No refinance offer available/i,
  refinanceOffers: /Your refinance offers/i,
  applyNow: /Apply now/i,
  tryAgain: /Try Again/i,
  applyWithCosigner: /Apply with co-signer/i,
  noOfferBody: /We weren't able to find any refinance offers|We are unable to find refinance offers/i,
  noOfferReason: /Didn't meet lender/i
} as const;
