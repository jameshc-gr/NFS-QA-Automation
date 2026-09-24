export const loginLocators = {
  emailInput: 'input[name="identifier"]',
  passwordInput: 'input[name="credentials.passcode"]',
  rememberMeCheckbox: 'input[name="rememberMe"]',
  signInButton: 'input[type="submit"]',
  forgotPasswordLink: 'a:has-text("Forgot password?")',
  unlockAccountLink: 'a:has-text("Unlock account?")',
  registerLink: 'a:has-text("Don\'t have an account? Register")',
  cookieAcceptButton: 'button:has-text("Accept Cookies")'
} as const;

export const registrationLocators = {
  emailInput: '#email',
  continueButton: 'button:has-text("Continue")',
  firstNameInput: '#firstname',
  lastNameInput: '#lastname'
} as const;

export const membershipPlanLocators = {
  heading: 'Select your plan',
  monthlyPlanRadio: 'label:has-text("Monthly")',
  annualPlanRadio: 'label:has-text("Annual")',
  nameOnCardInput: 'input[placeholder=""], input[name="name"]',
  cardNumberFrame: 'iframe[title*="card number" i]',
  cardNumberInput: 'input[name="cardnumber"]',
  expirationDateFrame: 'iframe[title*="expiration" i]',
  expirationDateInput: 'input[name="exp-date"]',
  securityCodeFrame: 'iframe[title*="CVC" i], iframe[title*="security" i]',
  securityCodeInput: 'input[name="cvc"]',
  acceptPolicyCheckbox: '#acceptPolicy',
  acceptPolicyLabel: 'label[for="acceptPolicy"]',
  startMembershipButton: 'button:has-text("Start membership")'
} as const;

export const onboardingLocators = {
  welcomeHeading: 'Welcome to Rate Wealth',
  welcomeBackHeading: 'Welcome Back',
  continueButton: 'button:has-text("Continue")',
  nextButton: 'button:has-text("Next")',
  saveAndExitButton: 'button:has-text("Save and Exit")',
  backButton: 'button:has-text("Back")',
  
  // Step 1: Basics
  dobInput: 'input[aria-label*="calendar" i], input[type="text"]',
  zipInput: 'input[name="zip"]',
  genderMaleLabel: 'label[for="m"]',
  genderFemaleLabel: 'label[for="f"]',
  marriedNoLabel: 'label[for="married_n"]',
  marriedYesLabel: 'label[for="married_y"]',
  childrenNoLabel: 'label[for="has_children_n"]',
  childrenYesLabel: 'label[for="has_children_y"]',

  // Step 1: Education
  degreeNoLabel: 'label[for="n"]',
  degreeYesLabel: 'label[for="y"]',

  // Step 2: Financial Intro & Income
  financialIntroHeading: 'See your financial life together',
  annualSalaryInput: 'input[name="annual"]',
  monthlySalaryInput: 'input[name="monthly"]',

  // Step 2: Expenses
  monthlyRentInput: 'input[name="monthly__rent"]',
  annualRentInput: 'input[name="annual__rent"]',
  monthlyGroceryInput: 'input[name="monthly__grocery"]',

  // Step 2: Debts & Assets
  debtsHeading: 'Your debts',
  assetsHeading: 'Your assets',
  addDebtAccountButton: 'button:has-text("Add debt account")',
  addAssetAccountButton: 'button:has-text("Add asset account")',

  // Step 3: Work & Background
  workIntroHeading: 'Work & Background',
  workFormHeading: 'Your work & background',
  professionComboBox: '.euiComboBox',
  professionInput: '.euiComboBox input',
  networkingNoLabel: 'label[for="qual_networking_n"]',
  ncaaSportsNoLabel: 'label[for="qual_ncaa_sports_n"]',
  marathonsNoLabel: 'label[for="qual_marathons_n"]',
  militaryNoLabel: 'label[for="qual_military_n"]',
  finishButton: 'button:has-text("Finish")'
} as const;

export const dashboardLocators = {
  wealthScoreText: 'Wealth Score',
  buildPlanButton: 'button:has-text("Build Plan"), a:has-text("Build Your Financial Plan")',
  linkAccountsButton: 'button:has-text("Link My Accounts")',
  scheduleCallButton: 'button:has-text("Schedule A Call")',
  goToAccountsLink: 'a:has-text("Go to Accounts")',
  accountMenuButton: 'button[aria-label="Account menu"]'
} as const;

export const navDrawerLocators = {
  home: '.euiListGroupItem:has-text("Home")',
  financialPlans: '.euiListGroupItem:has-text("Financial Plans")',
  financialSnapshot: '.euiListGroupItem:has-text("Financial Snapshot")',
  dayToDayMoney: '.euiListGroupItem:has-text("Day-to-Day Money")',
  transactions: '.euiListGroupItem:has-text("Transactions")',
  accounts: '.euiListGroupItem:has-text("Accounts")'
} as const;
