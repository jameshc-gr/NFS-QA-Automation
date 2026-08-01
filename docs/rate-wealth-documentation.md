# Rate Wealth QA Testing Documentation

**Last Updated:** July 30, 2026  
**Environment:** https://wealth.dev.fitbux.com/  
**Status:** QA Planning & Research Complete

---

## Executive Summary

Rate Wealth (FitBUX) is a comprehensive financial planning and wealth management platform designed for young professionals and individuals managing student loan debt. The application combines AI-driven financial technology with expert human guidance to help users build personalized financial plans, manage debt, plan for retirement, and achieve financial goals.

**Key Metrics:**
- **Free Trial:** 14 days
- **Monthly Subscription:** $18.99
- **Annual Subscription:** $189 (Save 17%)
- **User Onboarding Steps:** 3 (Personal Info, Financial Info, Human Capital)
- **FitBUX Score:** Proprietary financial health metric

---

## Project Overview: Rate Wealth Financial Planning Platform

### What is Rate Wealth?

Rate Wealth is a financial planning application built by FitBUX that enables users to:

✅ **Understand Financial Health** - Calculate and track their FitBUX Score (proprietary metric combining income, debt, assets, and human capital)  
✅ **Manage Student Loans** - Compare repayment strategies, explore forgiveness options (PSLF), and optimize payoff schedules  
✅ **Plan Debt Consolidation** - Analyze multiple loans (student, auto, credit card) and find optimal payoff strategies  
✅ **Retirement Planning** - Project retirement income, model withdrawal strategies, integrate Social Security  
✅ **Build Emergency Funds** - Set savings goals based on financial situation  
✅ **Track Financial Goals** - Set and monitor progress toward personal financial objectives  
✅ **Access Expert Guidance** - Schedule consultations with financial experts  
✅ **Optimize Wealth** - For high earners, provide investment and tax optimization strategies  

### Target User Profiles

- **Primary:** Young professionals (ages 22-45) with student loan debt
- **Secondary:** Mid-career professionals planning for retirement
- **Specialized:** PSLF-eligible public servants, high-income earners, self-employed/freelancers
- **Lifecycle:** Career changers, new parents, recently divorced, pre-retirees

### Business Model

- **Revenue:** Subscription (monthly/annual)
- **Pricing:** $18.99/month or $189/year (17% discount)
- **Trial:** 14-day free trial on registration
- **Monetization:** Expert consultation call scheduling (premium feature)

---

## Application Architecture & Site Map

### Core Application Routes

```
/                          → Marketing/Landing Page
/login                     → Login Page
/register                  → Registration/Sign-Up
/forgot-password          → Password Reset Flow

/profile-builder          → New User Onboarding (3-step form)
/home                     → Dashboard (Authenticated)
/dashboard                → Main App Dashboard

/student-loans            → Student Loan Management Tool
/debt-payoff              → Debt Payoff Calculator
/retirement               → Retirement Planning Tool
/goals                    → Financial Goal Tracker
/investments              → Investment Management
/tax-planning             → Tax Optimization Tool
/emergency-fund           → Emergency Fund Planning

/account                  → Account Settings
/profile                  → User Profile Edit
/settings                 → Settings/Preferences
/billing                  → Subscription & Billing
/help                     → Help & Support
/schedule-call            → Expert Consultation Booking
```

### Key Sections

| Section | Purpose | Key Features |
|---------|---------|--------------|
| **Authentication** | Login/Register/Password Reset | Email/password, Stripe payment, plan selection |
| **Profile Builder** | New User Onboarding | 3-step form (Personal, Financial, Human Capital) |
| **Dashboard** | User Hub | FitBUX Score display, quick access to tools |
| **Student Loans** | Loan Management | Loan tracking, repayment plan comparison, PSLF eligibility |
| **Debt Payoff** | Debt Optimization | Multi-loan payoff calculations, strategy comparison |
| **Retirement** | Retirement Planning | Income projection, withdrawal strategy, Social Security |
| **Goals** | Goal Tracking | SMART goal setting, progress tracking |
| **Investments** | Wealth Building | Portfolio tracking, asset allocation, recommendations |
| **Account** | User Management | Profile edit, settings, subscription, expert calls |

---

## User Workflows

### New User Workflow

```
1. REGISTRATION PHASE
   ├─ Navigate to /register
   ├─ Enter: First Name, Last Name, Email, Password
   ├─ Validation: Password (8+ chars, letters/numbers/symbols)
   ├─ Select Subscription Plan (Monthly $18.99 or Annual $189)
   ├─ Payment via Stripe
   └─ Account Created (14-day trial begins)

2. PROFILE BUILDING PHASE (3 Steps)
   ├─ STEP 1: Personal Information
   │  ├─ Age, Employment Status, Job Title, Employer
   │  ├─ Employment Start Date, Marital Status, Dependents
   │  └─ Education Level, School, Graduation Date
   │
   ├─ STEP 2: Financial Information
   │  ├─ Annual Income, Income Type (Salary/Variable/Other)
   │  ├─ Loans: Type (Student/Auto/Mortgage), Amount, Monthly Payment
   │  ├─ Assets: Savings, Retirement Account, Investments
   │  ├─ Credit Score
   │  └─ Housing (Rent/Own), Monthly Housing Cost
   │
   └─ STEP 3: Human Capital
      ├─ Career trajectory & job stability
      ├─ Income growth potential
      ├─ Education & skill development
      └─ Life event risk factors

3. FITBUX SCORE CALCULATION
   ├─ System calculates score based on:
   │  ├─ Budget & savings rate
   │  ├─ Asset accumulation
   │  ├─ Debt levels & management
   │  └─ Human capital value
   └─ Score displayed on dashboard

4. DASHBOARD ACCESS
   ├─ FitBUX Score prominently displayed
   ├─ Quick action buttons for main tools
   ├─ Upcoming items or alerts
   └─ Call-to-action for scheduling expert consultation
```

### Existing User Workflow

```
1. AUTHENTICATION
   ├─ Navigate to /login
   ├─ Enter Email & Password
   ├─ MFA (if enabled) → verify
   └─ Dashboard access granted

2. DASHBOARD VIEW
   ├─ FitBUX Score (updated)
   ├─ Key Metrics Summary
   ├─ Recent Tool Access
   ├─ Alerts (loan due dates, goal milestones, etc.)
   └─ Navigation to specific financial tools

3. TOOL ACCESS
   ├─ Student Loans: View/update loans, compare repayment plans
   ├─ Debt Payoff: Analyze payoff strategy across all debts
   ├─ Retirement: Run projections with updated data
   ├─ Goals: Track progress, set new goals
   ├─ Investments: Review portfolio, get recommendations
   └─ Account: Update profile, manage subscription

4. DATA PERSISTENCE
   ├─ Changes saved to user profile
   ├─ Historical data retained for trend analysis
   └─ Can access previous calculations/scenarios
```

---

## Test Profiles & Scenarios

### Profile Distribution (31 Profiles)

The test data includes 31 comprehensive user profiles covering:

**By Demographics:**
- Single, Married, Divorced, Partnered
- Ages: 22-58 years old
- No dependents to 3+ dependents
- Various education levels (HS, Some College, Bachelor's, Master's, Doctoral)

**By Income Profile:**
- Entry-level ($45k-$65k) - 5 profiles
- Mid-career ($75k-$125k) - 8 profiles
- High income ($135k-$250k) - 10 profiles
- Variable/Self-employed ($55k-$165k) - 8 profiles

**By Debt Situation:**
- Debt-free ($0 debt) - 2 profiles
- Moderate debt ($28k-$85k) - 12 profiles
- High debt ($100k-$200k) - 10 profiles
- Extreme debt ($300k+) - 1 profile (medical resident)
- Credit card crisis ($18k+ CC debt) - 4 profiles

**By Life Circumstances:**
- Recent graduates (0-2 years post-graduation) - 3 profiles
- Career changers - 3 profiles
- Parents with children - 8 profiles
- Single parents - 2 profiles
- Specialized: Military, International, Disability, Gig Economy, PSLF-eligible, Entrepreneur

### Sample Profile Scenarios

**Profile 001: Emily Johnson - Entry-Level Graduate**
- Age: 24, Employed 1 year
- Income: $65,000 (Software Engineer Junior)
- Student Loans: $45,000 federal
- Credit Score: 680, Savings: $8,000
- Goal: Aggressive student loan payoff
- Scenario: Recent grad managing first significant debt

**Profile 005: James Williams - PSLF-Eligible**
- Age: 28, Employed 5 years at public school
- Income: $54,000 (High School Teacher)
- Student Loans: $68,000 federal
- PSLF Status: 5 years complete, 5 years remaining to forgiveness
- Goal: Track PSLF progress toward 10-year forgiveness
- Scenario: Public service professional tracking forgiveness

**Profile 020: Sophia Moore - Medical Professional**
- Age: 32, Dentist with recent graduation
- Income: $175,000 ($155k salary + $20k bonus)
- Student Loans: $203,000 ($165k dental + $38k undergrad)
- Repayment: Income-driven (~$2,030/month), 20-25 year forgiveness
- Goal: Medical debt management and long-term planning
- Scenario: Professional degree holder with extreme debt load

**Profile 031: Victoria Patterson - Medical Resident**
- Age: 36, Year 3 Resident
- Income: $68,000 (resident salary)
- Student Loans: $322,000 ($280k med school + $42k undergrad)
- Repayment: Income-driven (~$3,220/month, 10% of income)
- Goal: Manage current residency debt, plan for attending physician income
- Scenario: Extreme debt-to-income ratio in residency, future high income potential

---

## Test Scenarios & Cases

### Tier 1: Critical New User Flows (High Priority)

**Scenario 1: Registration & Trial Activation**
- Test Case: User Registration with Email Validation
- Steps: Registration → Plan Selection → Payment → Trial Start
- Data: Profile P001 (Emily Johnson)
- Expected: User gains 14-day trial access, redirected to profile builder
- Automation Priority: HIGH - Core feature

**Scenario 2: Profile Building Complete Flow**
- Test Case: Complete Multi-Step Profile with Data Persistence
- Steps: Personal Info → Financial Info → Human Capital → FitBUX Score
- Data: Profile P002 (Michael Chen - married with child)
- Expected: All data saved, FitBUX Score calculated, dashboard accessible
- Automation Priority: HIGH - Core feature

**Scenario 3: Student Loan Payoff Calculator**
- Test Case: Loan Payoff Strategy Comparison
- Steps: Enter loan details → Compare Standard vs Income-Driven vs Aggressive
- Data: Profile P001 ($45k loans) vs P020 ($203k loans)
- Expected: Accurate calculations, interest saved shown, strategies comparable
- Automation Priority: HIGH - Financial accuracy critical

### Tier 2: Specialized Workflows (Medium Priority)

**Scenario 4: PSLF Tracking & Forgiveness**
- Test Case: PSLF Eligibility Verification and Timeline
- Steps: Enter public service employment → Verify PSLF → Calculate forgiveness timeline
- Data: Profile P005 (James Williams - 5 years complete)
- Expected: Eligibility confirmed, 5-year remaining timeline shown, payment tracking
- Automation Priority: MEDIUM - Specialized feature

**Scenario 5: Complex Dual-Income Household**
- Test Case: Multi-Person Financial Profile & Joint Planning
- Steps: Enter primary + spouse info → Create household financial plan
- Data: Profile P002 (Michael Chen - household $220k)
- Expected: Combined financial view, household debt payoff strategy
- Automation Priority: MEDIUM - Household management

**Scenario 6: Self-Employed/Variable Income**
- Test Case: Variable Income Financial Planning
- Steps: Enter variable income → Model low/average/high months → Create budget
- Data: Profile P012 (Rachel Taylor - Freelancer)
- Expected: Income averaging, sustainable payment calculation, emergency fund recommendation
- Automation Priority: MEDIUM - Growing user segment

### Tier 3: Edge Cases & Complex Scenarios (Lower Priority)

**Scenario 7: Medical Resident Extreme Debt**
- Test Case: Extreme Debt-to-Income Ratio Management
- Steps: Enter resident income + $300k+ loans → Model income-driven repayment
- Data: Profile P031 (Victoria Patterson - $322k loans, $68k income)
- Expected: Income-driven repayment shown as only viable option, forgiveness timeline
- Automation Priority: LOW - Niche but important

**Scenario 8: Post-Divorce Financial Restructuring**
- Test Case: Life Event Impact on Financial Plan
- Steps: Update relationship status to Divorced → Recalculate finances with child support
- Data: Profile P013 (Margaret Wilson - Post-divorce)
- Expected: New budget with child support obligation, asset division impact shown
- Automation Priority: LOW - Important for life event scenarios

**Scenario 9: Gig Economy Variable Income**
- Test Case: Highly Variable Monthly Income (Ride-share/Delivery)
- Steps: Enter gig income with 12-month history → Calculate sustainable payments
- Data: Profile P019 (Ethan White - $3k-$5k/month variation)
- Expected: Income volatility handled, flexible repayment options recommended
- Automation Priority: LOW - Growing demographic

**Scenario 10: Retirement Income Planning**
- Test Case: Pre-Retirement to Post-Retirement Income Modeling
- Steps: Enter 7-year timeline to retirement → Model retirement income sources
- Data: Profile P009 (Richard Patterson - VP Finance, age 58)
- Expected: Retirement feasibility shown, withdrawal strategy calculated, Social Security impact
- Automation Priority: MEDIUM - Key use case

---

## Test Data Summary

### Data Entry Points by User Workflow

**Registration Form:**
- First Name (required, text, max 50 chars)
- Last Name (required, text, max 50 chars)
- Email (required, email format, unique)
- Password (required, min 8 chars, letters+numbers+symbols)
- Plan Selection (required, radio: Monthly/$18.99 or Annual/$189)
- Payment (Stripe integration, card validation)

**Profile: Personal Information**
- Age (required, number, 18-100)
- Employment Status (dropdown: Employed, Self-Employed, Student, Military, Disability, Unemployed)
- Employer (text, conditional required if employed)
- Job Title (text, conditional required if employed)
- Employment Start Date (date picker, conditional required)
- Marital Status (dropdown: Single, Married, Divorced, Separated, Partnered)
- Dependents (number, 0-10)
- Dependent Ages (conditional, array if dependents > 0)
- Education Level (dropdown: High School, Some College, Associate, Bachelor, Master, Doctoral)
- School Name (text, conditional required if education > High School)
- Graduation Date (date picker, conditional required)

**Profile: Financial Information**
- Annual Income (number, $0-$999,999, or calculated for self-employed)
- Income Type (dropdown: Salary, Variable, Bonus, Investment, Business, Other)
- Primary Loan Type (dropdown: None, Federal, Private, Mix)
- Total Student Loan Amount (number, $0-$500,000)
- Monthly Student Loan Payment (number, auto-calculated or manual override)
- Other Debts (checkbox group: Auto Loan, Mortgage, Credit Card, Medical, Other)
- [For each debt type]
  - Amount (number)
  - Monthly Payment (number)
  - Interest Rate (number, % format)
- Savings Account (number, $0-$5,000,000)
- Retirement Account (checkbox: 401k, Roth IRA, SEP IRA, Traditional IRA, Other)
- Retirement Balance (number per account type)
- Investments (checkbox: Brokerage, HSA, 529 College Savings, Other)
- Investment Balance (number)
- Credit Score (dropdown or number: 300-850)
- Housing Situation (dropdown: Renting, Own with Mortgage, Own with No Mortgage, Other)
- Housing Cost (number, $0-$10,000/month)
- Housing Value (number if own, conditional)

**Profile: Human Capital**
- Years in Current Role (number)
- Career Progression (text, narrative)
- Expected Income Growth (5 years: %, dropdown: Low/Medium/High)
- Job Stability (dropdown: Very Stable, Stable, Moderate, Uncertain, Risky)
- Industry/Field (text/dropdown)
- Special Certifications/Credentials (text)
- Risk Factors (checkbox: Recent job change, frequent career changes, seasonal work, other)

### User Profile Fields in YAML

The `rate-wealth.yml` file contains 31 profiles with 50+ data fields per profile:

```yaml
PROFILE TEMPLATE:
  FIRST_NAME, LAST_NAME, EMAIL
  AGE, EMPLOYMENT_STATUS, EMPLOYER, JOB_TITLE
  ANNUAL_INCOME, INCOME_TYPE, EMPLOYMENT_START_DATE
  MARITAL_STATUS, DEPENDENTS, SPOUSE_INFO (if married)
  EDUCATION_LEVEL, SCHOOL, GRADUATION_DATE
  STUDENT_LOAN_AMOUNT, STUDENT_LOAN_TYPE, MONTHLY_PAYMENT
  OTHER_DEBTS (auto, credit card, mortgage with amounts & payments)
  SAVINGS, EMERGENCY_FUND, RETIREMENT_ACCOUNT, INVESTMENTS
  ASSETS (home value, vehicles, other)
  CREDIT_SCORE
  FINANCIAL_GOAL
  PROFILE_SCENARIO (description)
  NOTES (testing guidance)
  PRIORITY (HIGH/MEDIUM/LOW)
```

### Test Cases Summary

**Total Test Cases:** 31 (one per profile)  
**Coverage Areas:**
- User Registration (5 cases)
- Profile Building (7 cases)
- Financial Calculations (8 cases)
- Specialized Features (7 cases)
- Life Events (4 cases)

**High Priority Cases:** 18 (core features + critical workflows)  
**Medium Priority Cases:** 9 (specialized but important)  
**Low Priority Cases:** 4 (edge cases, niche scenarios)

---

## Key Features for Testing

### Core Financial Calculation Tools

**1. Student Loan Payoff Calculator**
- Input: Loan amount, current payment, rate
- Calculations: 10-year standard, income-driven alternatives, aggressive payoff
- Output: Monthly payment, total interest, payoff timeline, savings comparisons
- Critical: Accuracy of interest calculations

**2. Debt Consolidation Analyzer**
- Input: Multiple loans (student, auto, credit card, mortgage)
- Calculates: Avalanche method, snowball method, interest comparison
- Output: Optimal payoff sequence, monthly cash flow requirements
- Critical: Multi-loan handling and strategy comparison

**3. Retirement Income Planner**
- Input: Current age, retirement age, savings, monthly contributions
- Calculates: Retirement balance at target age, withdrawal rate, longevity analysis
- Integration: Social Security timing, pension (if applicable)
- Output: Retirement feasibility, required savings adjustment
- Critical: Long-term projection accuracy

**4. Emergency Fund Calculator**
- Input: Monthly expenses, employment stability, dependents
- Calculates: Recommended emergency fund size (3-9 months)
- Output: Current gap, savings target, monthly savings needed
- Critical: Appropriate emergency fund sizing by profile

**5. Investment Allocation Analyzer**
- Input: Age, risk tolerance, time horizon, existing portfolio
- Recommends: Asset allocation (stocks/bonds/cash), rebalancing
- Output: Risk assessment, expected returns
- Critical: Age-appropriate and risk-adjusted recommendations

### Advanced Features

**PSLF Tracking Module**
- Employer verification for PSLF eligibility
- Payment tracking toward 120 required payments
- Alerts for missing payments or status changes
- Forgiveness timeline calculation
- Critical: Accurate 120-payment tracking and timeline

**Income-Driven Repayment Modeler**
- Supports: PAYE, SAVE, Income-Contingent, Income-Based
- Calculates: Monthly payment based on income
- Models: Tax liability on forgiveness, monthly cash flow
- Comparison: Student loan repayment plans
- Critical: Accurate income-driven payment calculations

**Tax Optimization Tool**
- Input: Income sources, deductions, investment gains/losses
- Analysis: Tax efficiency of investments, charitable giving impact
- Models: Tax brackets, withholding adequacy
- Output: Tax planning recommendations
- Critical: Tax calculation accuracy, legal compliance

**Spouse/Household Financial Planning**
- Dual income household management
- Combined financial goals
- Spousal loan management (separate vs. joint repayment)
- Critical: Multi-person financial integration

---

## Product Questions for Engineering & Finance Teams

### Financial Calculation Accuracy

1. **Interest Calculation Method:** Are loan interest calculations daily compounded, monthly, or simple? What's the exact formula used?
2. **FitBUX Score Algorithm:** What are the exact weights/formula for calculating FitBUX Score? How are they validated?
3. **Retirement Projection Model:** What's the assumed inflation rate, investment return rate, and life expectancy in projections?
4. **PSLF Calculation:** How is the 120 payment tracking validated against the Department of Education data?
5. **Income-Driven Repayment:** Are payments calculated using discretionary income or adjusted gross income? What's the household size calculation?

### Data Handling & Persistence

6. **Data Validation:** What are the validation rules for each financial field (income limits, debt limits, credit score range)?
7. **Currency Handling:** Are there any special considerations for handling currency (cents, rounding, display)?
8. **Historical Data:** Are historical financial snapshots stored? Can users see their FitBUX Score history?
9. **Data Export:** Can users export their financial data? In what formats?
10. **Audit Trail:** Is there logging of all financial calculations for audit purposes?

### Payment & Subscription

11. **Trial Period Logic:** How is the 14-day trial counted? From registration or first login?
12. **Auto-Renewal:** What's the auto-renewal process? How many days before does billing occur?
13. **Plan Upgrade/Downgrade:** Can users switch from monthly to annual mid-billing cycle? Proration logic?
14. **Payment Failures:** What's the retry strategy for failed Stripe transactions?
15. **Cancellation:** Can users cancel mid-trial? What's the data retention after cancellation?

### User Management & Authentication

16. **Password Requirements:** Exact regex for password validation (8+ chars, must have letters/numbers/symbols)?
17. **Email Verification:** Is email verification required before accessing app?
18. **Session Management:** Session timeout length? Concurrent session limits per account?
19. **Account Recovery:** Can users recover accounts? What's the process if email is inaccessible?
20. **Account Deletion:** Is there a self-serve account deletion? GDPR compliance?

### Profile Data

21. **Spouse Linking:** Can spouse be a separate account or must they share one account?
22. **Dependent Information:** What's tracked for dependents beyond age?
23. **Employment History:** Is employment history tracked, or only current employment?
24. **Income Documentation:** Does the system verify income or accept user input?
25. **Loan Verification:** Does the system fetch real loan data (via Plaid, etc.) or accept user input?

### PSLF & Public Service

26. **Employer Verification:** How is PSLF employer eligibility verified? Real-time against Department of Education list?
27. **Employment Certification:** Does the system support PSLF Employment Certification Form (ECF)?
28. **Payment History:** Does the system track payments made while ineligible (before employment)?
29. **Loan Consolidation:** Does PSLF require Direct Loan consolidation? Does system recommend this?
30. **Forgiveness Processing:** Can system track forgiveness application status with DOE?

### Calculations & Scenarios

31. **Scenario Saving:** Can users save multiple scenarios and compare them?
32. **Calculator Precision:** What's the precision for calculations (cents, dollars)? Rounding methodology?
33. **Edge Cases:** How are edge cases handled (e.g., zero income, negative assets)?
34. **Partial Data:** Can users save profile with incomplete data? What fields are truly required?
35. **Data Consistency:** If user updates income, are all calculations recalculated automatically?

### Expert Consultation

36. **Expert Availability:** How is expert availability managed? What's the booking system?
37. **Consultation Types:** Are there different consultation types or specializations?
38. **Call Recording:** Are calls recorded? What's the user consent process?
39. **Follow-up:** What's included in follow-up communication after consultation?
40. **Scheduling:** Can users reschedule? Cancellation policy?

### Specialized Features

41. **Income Volatility:** How is variable/gig income handled? Does system average over time?
42. **Disability Benefits:** How are SSI/SSDI handled in income calculations? Work incentive programs?
43. **Military Benefits:** Are military-specific benefits (BAH, TSP, GI Bill) specially handled?
44. **International Users:** Can non-US citizens use the platform? ITIN vs. SSN handling?
45. **Self-Employed:** Does system support S-Corp taxation vs. Schedule C?

### Data Integration

46. **Plaid Integration:** If used, what loan/bank data can be pulled automatically?
47. **Office365/Google:** Are document imports supported for verification?
48. **API Availability:** Is there an API for third-party integration?
49. **Data Sharing:** Can users authorize data sharing with financial institutions?
50. **Export Formats:** What export formats are supported (PDF, Excel, CSV)?

---

## Product Recommendations & Observations

### Observations from UX/Research Perspective

1. **14-Day Trial Strategic:** The 14-day free trial is consumer-friendly but may not be enough for users to build full financial plans. Consider educational content during trial.

2. **FitBUX Score Gamification:** The FitBUX Score (prominently displayed at 126 during test) could drive engagement. Consider:
   - Historical score tracking
   - Score impact explanations
   - Improvement recommendations

3. **Expert Call Monetization:** Premium feature of scheduling expert calls could be significant revenue driver. Ensure:
   - Expert availability is transparent
   - Call value is clearly communicated
   - Follow-up resources are provided

4. **Mobile-First Consideration:** Financial app usage suggests need for mobile experience. Test responsiveness of:
   - Form inputs on mobile
   - Calculator outputs on small screens
   - Dashboard on mobile view

5. **Data Security:** Given sensitive financial data, ensure:
   - PII encryption at rest/in transit
   - Session security
   - Secure password handling

### Feature Recommendations for Product Team

1. **Loan Verification Integration:** Consider Plaid integration to auto-fetch real student loan data directly from servicers (Federal Student Aid, Nelnet, etc.).

2. **Employment Verification:** For PSLF users, automated employment verification against DOE's PSLF employer database would reduce manual verification.

3. **Real-Time Calculations:** Consider real-time FitBUX Score updates as users modify profile data, with visual feedback on impact.

4. **AI Chat Assistant:** Given expert consultation importance, consider AI chatbot for:
   - Common questions during off-hours
   - Educational content delivery
   - Recommendation explanations

5. **Savings Goal Automation:** Integrate with banking partners (Stripe Connect, Plaid) to automate savings transfers toward goals.

6. **Notification System:** Implement proactive notifications for:
   - Grace period ending (for new graduates)
   - Loan due dates
   - PSLF payment milestones
   - Goal progress updates

7. **Comparative Benchmarking:** Allow users to (anonymously) see how they compare to similar users:
   - "Average 28-year-old teacher in your state"
   - Anonymized percentile rankings

8. **Document Repository:** Provide secure document storage for:
   - Loan documents
   - Paycheck stubs (for income verification)
   - Tax returns
   - Benefit statements

---

## Playwright Automation Strategy

### Architecture Recommendations

**Test Structure:**
```
tests/projects/rate-wealth/
├── seed.spec.ts                    # Test setup/teardown
├── test-setup.ts                   # Shared test utilities
├── 01-registration/
│  └── registration.spec.ts         # User registration scenarios
├── 02-profile-building/
│  ├── personal-info.spec.ts
│  ├── financial-info.spec.ts
│  └── human-capital.spec.ts
├── 03-core-features/
│  ├── student-loans.spec.ts
│  ├── debt-payoff.spec.ts
│  ├── retirement-planning.spec.ts
│  └── emergency-fund.spec.ts
├── 04-specialized-features/
│  ├── pslf-tracking.spec.ts
│  ├── household-planning.spec.ts
│  ├── tax-optimization.spec.ts
│  └── variable-income.spec.ts
└── 05-life-events/
   ├── career-change.spec.ts
   ├── life-milestone.spec.ts
   └── portfolio-update.spec.ts
```

### Page Object Model (POM) Structure

```typescript
// pages/LoginPage.ts
export class LoginPage {
  async login(email: string, password: string)
  async navigateTo()
  async getErrorMessage()
}

// pages/RegistrationPage.ts
export class RegistrationPage {
  async register(userData: UserData)
  async selectPlan(plan: 'monthly' | 'annual')
  async submitPayment(cardData: CardData)
}

// pages/ProfileBuilderPage.ts
export class ProfileBuilderPage {
  async fillPersonalInfo(personalInfo: PersonalInfo)
  async fillFinancialInfo(financialInfo: FinancialInfo)
  async fillHumanCapital(humanCapital: HumanCapital)
  async submitProfile()
  async getFitBUXScore()
}

// pages/StudentLoanToolPage.ts
export class StudentLoanToolPage {
  async enterLoanDetails(loan: StudentLoan)
  async compareRepaymentPlans()
  async calculatePayoff()
  async verifyAccuracy(expectedPayment: number)
}
```

### Test Data Management

Use the YAML file (`rate-wealth.yml`) as test data source:
```typescript
// fixtures/testProfiles.ts
import YAML from 'yaml'
export const profiles = YAML.parse(readFileSync('test-data/rate-wealth/rate-wealth.yml', 'utf8'))

test('P001 - Entry Level Graduate', async ({ page }) => {
  const profile = profiles.P001
  // Use profile data for test
})
```

### Key Test Scenarios

**Tier 1: Critical (Automation First)**
- User registration → Plan selection → Payment → Trial activation
- Multi-step profile building with data persistence
- Student loan payoff calculation accuracy (multiple profiles)
- Login/logout/session management
- Basic CRUD on user financial data

**Tier 2: Important (Phase 2)**
- PSLF eligibility and tracking
- Dual-income household planning
- Retirement income projections
- Debt consolidation strategy comparison
- Tax optimization recommendations

**Tier 3: Edge Cases (Phase 3)**
- Extreme debt scenarios (P031 - $322k loans)
- Variable/gig income handling
- Post-divorce financial restructuring
- Disability income integration
- International user scenarios

### Locator Strategy

**Priority:**
1. Accessibility labels (aria-label, role-based)
2. Test IDs (data-testid)
3. Semantic HTML (button, heading, form labels)
4. Stable attributes (name, id where stable)
5. Last resort: CSS/XPath (avoid fragile selectors)

### Performance Testing Considerations

- Profile load time (should be < 2s)
- Financial calculation response time (should be < 1s)
- Dashboard rendering (should be < 3s)
- Large portfolio handling (100+ loans/accounts)

---

## QA Test Execution Matrix

| Workflow | Profile | Test Type | Browser | Device | Priority |
|----------|---------|-----------|---------|--------|----------|
| Registration | P001 | Functional | Chrome, Firefox, Safari | Desktop, Mobile | HIGH |
| Registration Payment | All (sample P001, P002) | Payment Integration | Chrome | Desktop | HIGH |
| Profile Building | P001, P002, P010 | Data Persistence | Chrome, Firefox | Desktop, Tablet | HIGH |
| Student Loan Calc | P001, P020, P031 | Accuracy/Edge Cases | Chrome | Desktop | HIGH |
| PSLF Tracking | P005 | Feature | Chrome | Desktop | MEDIUM |
| Household Planning | P002, P012, P021 | Relationship Feature | Chrome | Desktop | MEDIUM |
| Career Change | P003, P024 | Life Event | Chrome | Desktop | MEDIUM |
| Retirement Planning | P009, P027 | Advanced Feature | Chrome | Desktop | MEDIUM |
| Extreme Debt | P031 | Edge Case | Chrome | Desktop | LOW |
| Gig Income | P019 | Niche Feature | Chrome | Desktop | LOW |

---

## Success Criteria

### Functional Success
- All registration flows complete successfully
- Profile data persists across sessions
- Financial calculations accurate to $0.01
- PSLF timeline correctly calculated
- No data loss on page refresh

### Performance Success
- Page load time < 3 seconds
- Calculation response time < 1 second
- Dashboard render < 500ms
- No memory leaks in long sessions

### Financial Accuracy Success
- Student loan calculations match amortization schedules
- Interest calculations within 1% of external calculators
- FitBUX Score calculation verified against specification
- Retirement projections use consistent assumptions

### User Experience Success
- Mobile responsiveness across devices
- Accessibility (WCAG 2.1 AA minimum)
- Clear error messages for validation failures
- Responsive feedback for long-running operations

---

## Known Issues & Observations

### From Initial Exploration

1. **Backend Errors:** 500 errors observed during registration form validation. Investigate:
   - Server-side validation errors
   - Database connection issues
   - API rate limiting

2. **Analytics Blocking:** Google Analytics, ads, and tracking requests blocked in QA environment (expected). Ensure:
   - App functionality not dependent on analytics
   - Analytics errors don't break core features

3. **hCaptcha:** hCaptcha verification observed on pages. Test requirements:
   - Manual testing or mock bypass for automation
   - Accessibility of CAPTCHA alternative

### Recommendations

1. **Test Environment Setup:** Ensure test environment has:
   - Mock payment processor (Stripe Test mode)
   - Test user seeding scripts
   - Database reset between test runs
   - No rate limiting for automated tests

2. **Monitoring & Alerting:** Set up alerts for:
   - Financial calculation failures
   - Payment processing errors
   - User session timeouts
   - API response time degradation

3. **Data Privacy:** Ensure test environment:
   - Uses non-PII test data (test@example.com, not real emails)
   - Isolates test data from production
   - Implements GDPR compliance for any EU users

---

## Appendix: Test Data Files

### Files Created

1. **rate-wealth.yml** (13 KB)
   - 31 comprehensive user profiles
   - 50+ data fields per profile
   - Covers all demographic and financial scenarios
   - Location: `test-data/rate-wealth/rate-wealth.yml`

2. **rate-wealth-test-cases.csv** (85 KB)
   - 31 test cases (one per profile)
   - Detailed test steps and expected results
   - Workflow-based organization
   - Location: `test-data/rate-wealth/rate-wealth-test-cases.csv`

3. **rate-wealth-documentation.md** (This file)
   - Comprehensive project documentation
   - Suitable for Confluence/Wiki publication
   - Includes product questions, recommendations
   - Location: `docs/rate-wealth-documentation.md`

### Data Conventions

**Email Format:** `my-fitbux-jcXXXX@yopmail.com` (where XXXX is 0001-9999)  
**Password:** `Test123!` (meets all requirements: 8+ chars, letters, numbers, symbols)  
**Test Profiles:** 31 profiles covering all key scenarios  
**Test Cases:** 31 cases (high priority + medium/low priority)

---

## Next Steps for QA Team

### Immediate Actions (Week 1)

- [ ] Review all 31 test profiles for completeness
- [ ] Set up Rate Wealth QA environment access
- [ ] Create test user account repository
- [ ] Set up payment testing with Stripe Test mode
- [ ] Document any environment-specific configurations

### Short-term Actions (Weeks 2-4)

- [ ] Implement Playwright test suite for Tier 1 scenarios
- [ ] Validate financial calculation accuracy
- [ ] Test payment processing end-to-end
- [ ] Test PSLF tracking functionality
- [ ] Create baseline performance metrics

### Medium-term Actions (Months 2-3)

- [ ] Complete Tier 2 test automation (specialized features)
- [ ] Performance testing and optimization
- [ ] Mobile/responsive design testing
- [ ] Accessibility testing (WCAG compliance)
- [ ] Load testing with multiple concurrent users

### Long-term Roadmap (Month 4+)

- [ ] API testing (if available)
- [ ] Security testing and penetration testing
- [ ] Data migration and backup testing
- [ ] Integration testing with expert consultation system
- [ ] Continuous integration/deployment pipeline

---

**Document Owner:** QA Team  
**Last Review Date:** July 30, 2026  
**Next Review Date:** August 30, 2026  
**Status:** COMPLETE & READY FOR PLAYWRIGHT AUTOMATION
