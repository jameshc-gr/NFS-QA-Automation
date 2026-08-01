# Rate Wealth (FitBUX) - Comprehensive Research & QA Planning Document

**Date**: July 30, 2026  
**Application URL**: https://wealth.dev.fitbux.com/  
**Public Website**: https://www.fitbux.com/

---

## 1. APPLICATION PURPOSE & OVERVIEW

### What FitBUX Does
FitBUX is a comprehensive financial planning and management platform designed specifically for young professionals. It combines AI-driven financial technology with expert human guidance to help users achieve financial freedom.

**Mission**: Help young professionals simplify their finances, build achievable financial plans, and make informed decisions about their money.

**Target Users**:
- Young professionals (typically ages 20-45)
- Student loan borrowers
- Early-career individuals
- Those seeking financial guidance
- Users managing $2.7B+ in assets and debts (current user base)

### Core Value Proposition
FitBUX offers:
- **Personalized Financial Roadmap**: AI-driven algorithms combining behavioral analytics, real-time data, and expert insights
- **Expert Access**: Real financial experts available on-demand to answer questions
- **Unified Financial Management**: Single platform for tracking debt, savings, investments, and goals
- **Scenario Simulation**: Tools to test different financial strategies
- **Adaptive Planning**: Automatic plan adjustments as life circumstances change

---

## 2. KEY FINANCIAL PLANNING FEATURES

### 2.1 Core Financial Planning Tools

#### Profile Builder & FitBUX Score
- **Multi-step onboarding** (3 main sections):
  1. **Personal Info**: Basic demographics and life circumstances
  2. **Financial Info**: Income, expenses, assets, and debts
  3. **Human Capital**: Career path, earning potential, and future prospects
  
- **FitBUX Score**: Proprietary metric (0-100 scale observed) that incorporates:
  - Budget and cash flow analysis
  - Financial assets and investments
  - Existing debt levels
  - Human capital valuation
  - Financial behavior patterns

#### Financial Management Dashboard
- Centralized view of complete financial picture
- Asset and debt tracking
- Real-time financial health monitoring
- Plan progress tracking

### 2.2 Specialized Planning Tools

#### Student Loan Management
- Loan payoff calculators
- Repayment strategy comparison
- Loan consolidation and refinancing options
- Public Service Loan Forgiveness (PSLF) planning
- Income-Driven Repayment (IDR) plan analysis

#### Debt Repayment Planning
- Multiple debt payoff strategies (avalanche, snowball, etc.)
- Cash flow analysis
- Debt consolidation options
- Timeline projections

#### Investment & Retirement Planning
- Retirement savings strategy
- Investment allocation guidance
- 401(k) and IRA planning
- Tax optimization

#### Goal-Based Planning
- Purchase planning (home, car, etc.)
- Emergency fund sizing
- Savings goal tracking
- Major life event planning

### 2.3 Expert Services
- **Expert Consultants**: Real financial experts available via:
  - Scheduled phone/video consultations
  - On-demand expert answers
  - Plan implementation guidance
- **Educational Resources**: 
  - Podcast series
  - Educational articles
  - Video tutorials

### 2.4 Integration & Partnerships
FitBUX partners with major financial platforms:
- **Betterment** (Investment management)
- **SoFi** (Student loan refinancing, personal loans)
- **Splash Financial** (Student loan refinancing)
- **Earnest** (Personal loans, student loans)
- **Gentreo** (Document management)

---

## 3. USER WORKFLOWS

### 3.1 New User Registration & Onboarding

```
START → Landing Page → Registration/Sign-Up → Payment Info → Profile Building → Dashboard Access
```

#### Step-by-Step Registration Flow:

1. **Landing Page / Login**
   - URL: `/auth/login` or `/register`
   - Options: Email registration or Google/Social login
   - Password requirements (appears to need strong password: Test123! format)
   - New user option: "Join now" / "Don't have an account?"

2. **Subscription Selection**
   - Plan options:
     - **Monthly**: $18.99/month (cancel anytime)
     - **Annual**: $189/year (Save 17% - RECOMMENDED)
   - **14-day free trial** (no charge until trial ends)
   - Optional promo code entry
   - Association discounts available

3. **Payment Information**
   - Card holder name
   - Card number (Stripe-powered, with autofill via Link)
   - Expiration date (MM/YY format)
   - Security code (CVC/CVV)
   - Billing address (implicit)
   - Legal agreement acceptance:
     - Privacy Policy
     - Terms of Use
     - Refund Policy
     - Electronic Disclosures consent

4. **Profile Builder - Personal Info (Step 1)**
   - User name/contact details
   - Age and life stage
   - Employment status
   - Family/dependent information
   - Location/residency

5. **Profile Builder - Financial Info (Step 2)**
   - Annual income
   - Monthly expenses
   - Current assets:
     - Savings accounts
     - Investment accounts
     - Retirement accounts
   - Current debts:
     - Student loans (type, amount, interest rate)
     - Credit card debt
     - Mortgage/rent
     - Other loans

6. **Profile Builder - Human Capital (Step 3)**
   - Career field/profession
   - Years of experience
   - Career growth potential
   - Expected income growth
   - Job satisfaction/stability
   - Educational background

7. **FitBUX Score Calculation**
   - System processes entered data
   - Generates FitBUX Score
   - Displays initial financial assessment
   - Provides plan recommendations

8. **Dashboard Access**
   - Initial financial planning dashboard
   - Scheduled call booking with expert
   - Plan exploration and refinement

### 3.2 Existing User Login

```
START → Login Page → Email/Password → Dashboard → Financial Planning Tools
```

1. **Authentication**
   - URL: `https://wealth.dev.fitbux.com/auth/login`
   - Fields: Email address and password
   - "Forgot password?" recovery link
   - Remember me / Stay logged in option

2. **Dashboard Access**
   - Redirects to personalized dashboard
   - Displays current FitBUX Score
   - Shows financial snapshot
   - Lists available planning tools

### 3.3 Key User Journeys

#### Journey 1: Financial Plan Creation
1. Log in → Dashboard
2. Navigate to "Create Plan" or "Financial Planning"
3. Enter/update financial information
4. Review scenario analysis
5. Receive expert guidance
6. Implement recommended strategy
7. Track progress

#### Journey 2: Student Loan Management
1. Log in → Dashboard
2. Navigate to "Student Loan Tools"
3. Input loan details (amount, interest rate, term)
4. Compare repayment strategies
5. Get refinancing options from partners
6. View payoff scenarios
7. Generate implementation plan

#### Journey 3: Schedule Expert Consultation
1. Log in → Dashboard
2. Navigate to "Schedule Call" / "Expert Guidance"
3. Select availability
4. Choose consultation topic
5. Complete call with financial expert
6. Receive written guidance/plan update

#### Journey 4: Monitor & Adjust Plan
1. Log in → Dashboard
2. Review current plan progress
3. Input new financial information (if life changed)
4. View updated recommendations
5. Adjust strategy as needed
6. Track metrics and goals

---

## 4. SITE MAP & NAVIGATION STRUCTURE

### 4.1 Primary Navigation (Observed/Inferred)

```
FitBUX Wealth Platform
│
├── Authentication
│   ├── /auth/login - Login page
│   ├── /register - New user registration
│   ├── /auth/logout - Logout (server-side)
│   └── /forgot-password - Password recovery
│
├── Onboarding
│   ├── /profile-builder - Multi-step profile creation
│   ├── /select-plan - Subscription plan selection
│   └── /subscription - Billing/payment processing
│
├── Main Application
│   ├── /dashboard - Main dashboard/home
│   ├── /home - Alternative home view
│   ├── /plans - Financial plans list/management
│   └── /profile - User profile and settings
│
├── Financial Planning Tools
│   ├── /student-loans - Student loan planning
│   ├── /debt-payoff - Debt repayment calculator
│   ├── /investments - Investment planning
│   ├── /retirement - Retirement planning
│   ├── /goals - Financial goals tracking
│   ├── /portfolio - Portfolio management
│   └── /calculator - Various financial calculators
│
├── Expert Services
│   ├── /expert-call - Schedule consultation
│   ├── /ask-expert - Submit expert questions
│   └── /expert-guidance - View expert recommendations
│
├── Account Management
│   ├── /settings - Application settings
│   ├── /account - Account information
│   ├── /billing - Subscription and billing
│   ├── /profile-settings - Profile preferences
│   └── /notifications - Notification preferences
│
└── Resources
    ├── /resources - Educational content hub
    ├── /articles - Blog/article library
    ├── /videos - Video tutorials
    ├── /podcast - Podcast library
    └── /help - Help and FAQ
```

### 4.2 Key UI Components

#### Top Navigation Bar
- FitBUX Logo (links to `/dashboard` or `/home`)
- FitBUX Score display (large, prominent)
- User menu/account access
- Notification icon
- Search functionality (likely)

#### Sidebar Navigation (Inferred)
- Dashboard link
- Planning Tools (collapsible menu)
  - Student Loans
  - Debt Repayment
  - Investments
  - Retirement
  - Goals
- Expert Services
  - Schedule Call
  - Ask Expert
- Account Settings
- Help & Support

#### Dashboard Elements
- Financial Snapshot/Summary
- FitBUX Score widget
- Recent activity
- Action items
- Quick links to common tasks

---

## 5. DATA ENTRY POINTS & FORMS

### 5.1 Registration & Authentication Forms

#### Login Form
- **Email Address** (required, email validation)
- **Password** (required, masked input)
- **"Remember Me"** checkbox (optional)
- **"Forgot Password?"** link

#### Registration Form
- **Email Address** (required, unique, email validation)
- **Password** (required, strength validation - appears to require uppercase, number, special char)
- **Confirm Password** (required, must match)
- **Terms acceptance** (required checkbox)
- **Privacy policy** (required checkbox)

### 5.2 Subscription & Billing Forms

#### Plan Selection Form
- **Subscription Type** (radio buttons):
  - Monthly: $18.99
  - Annual: $189 (RECOMMENDED)
- **Promo Code** (optional text field)
- **Association Selection** (dropdown, optional - for discounts)
- **Terms acceptance** (required checkbox with multiple linked policies)

#### Payment Information Form (Stripe)
- **Cardholder Name** (required text field)
- **Card Number** (required, Stripe iframe, with Autofill via Link option)
- **Expiration Date** (required, MM/YY format, Stripe iframe)
- **Security Code/CVV** (required, Stripe iframe)
- **Billing Address** (implicit in Stripe)
- **Billing email** (implicit)

### 5.3 Profile Building Forms

#### Step 1: Personal Information
- **First Name** (required)
- **Last Name** (required)
- **Date of Birth** (required, date picker)
- **Employment Status** (required, dropdown):
  - Employed (full-time)
  - Employed (part-time)
  - Self-employed
  - Unemployed
  - Student
  - Retired
  - Other
- **Marital Status** (required, dropdown):
  - Single
  - Married
  - Divorced
  - Widowed
  - Domestic Partnership
- **Number of Dependents** (required, numeric)
- **Location/State** (required, state selector)

#### Step 2: Financial Information
**Income Section**:
- **Primary Income** (required, currency field)
- **Secondary Income** (optional, currency field)
- **Bonus/Variable Income** (optional, currency field)
- **Annual Income Total** (auto-calculated display)

**Expenses Section**:
- **Monthly Housing Cost** (required, currency field)
- **Monthly Living Expenses** (required, currency field)
- **Monthly Transportation** (optional, currency field)
- **Monthly Insurance** (optional, currency field)
- **Monthly Utilities** (optional, currency field)
- **Other Monthly Expenses** (optional, currency field)
- **Total Monthly Expenses** (auto-calculated display)

**Assets Section** (checkboxes to include):
- [ ] Savings Accounts
  - **Savings Account Balance** (currency field)
- [ ] Checking Accounts
  - **Checking Account Balance** (currency field)
- [ ] Investment/Brokerage Accounts
  - **Investment Account Balance** (currency field)
- [ ] 401(k) / Retirement Plans
  - **Retirement Account Balance** (currency field)
- [ ] Real Estate (non-primary)
  - **Real Estate Value** (currency field)
- [ ] Other Assets
  - **Other Assets Value** (currency field)

**Debt Section** (checkboxes to include):
- [ ] Student Loans
  - **Total Student Loan Debt** (currency field)
  - **Interest Rate** (percentage field)
  - **Loan Type** (dropdown): Federal / Private / Mixed
  - **Current Payment** (currency field)
  - **Monthly Payment** (currency field)
- [ ] Credit Card Debt
  - **Total Credit Card Debt** (currency field)
  - **Interest Rate** (percentage field)
  - **Minimum Payment** (currency field)
- [ ] Mortgage / Rent
  - **Monthly Payment** (currency field)
  - **Remaining Balance** (currency field, mortgage only)
- [ ] Car Loan
  - **Total Loan Amount** (currency field)
  - **Monthly Payment** (currency field)
- [ ] Other Debt
  - **Other Debt Amount** (currency field)
  - **Monthly Payment** (currency field)

#### Step 3: Human Capital
- **Current Job Title** (required, text field)
- **Industry/Field** (required, dropdown)
- **Years in Current Role** (required, numeric)
- **Total Years of Experience** (required, numeric)
- **Education Level** (required, dropdown):
  - High School
  - Associate's Degree
  - Bachelor's Degree
  - Master's Degree
  - PhD
  - Professional Certification
- **Career Stage** (required, dropdown):
  - Entry Level
  - Mid-Career
  - Senior
  - Executive
  - Other
- **Job Stability** (required, rating scale):
  - Very Unstable (1) → Very Stable (5)
- **Expected Income Growth** (required, percentage or dropdown):
  - No Growth
  - Low Growth (0-2%)
  - Moderate Growth (2-5%)
  - High Growth (5%+)
- **Career Satisfaction** (optional, rating scale)
- **Likelihood to Stay in Field** (optional, percentage)
- **Expected Career Changes** (optional, text field)
- **Licensing/Certifications** (optional, checkboxes):
  - [ ] CPA
  - [ ] MBA
  - [ ] Law License
  - [ ] Medical License
  - [ ] Other: ________

### 5.4 Planning & Tool Forms

#### Student Loan Details Form
- **Loan Name/ID** (text field)
- **Loan Balance** (currency field)
- **Interest Rate** (percentage field)
- **Loan Term** (numeric months or years)
- **Loan Type** (dropdown): Federal / Private / Perkins / Other
- **Federal Plan** (if federal):
  - Standard Repayment
  - PAYE
  - REPAYE
  - IBR
  - ICR
- **Monthly Payment** (currency field, auto-calculated)
- **Start Date** (date field)
- **Expected Payoff Date** (display, auto-calculated)
- **Is in Forbearance/Deferment?** (yes/no)
- **PSLF Eligible?** (yes/no)

#### Debt Payoff Calculator Form
- **Debt Selection** (checkboxes to select which debts to include)
- **Payoff Strategy** (radio buttons):
  - [ ] Snowball (lowest balance first)
  - [ ] Avalanche (highest interest first)
  - [ ] Proportional (evenly distributed)
- **Target Payoff Date** (optional date field)
- **Additional Monthly Payment** (optional currency field)
- **Results Display**: 
  - Timeline to payoff
  - Total interest paid
  - Comparison to minimum payments

#### Investment Planning Form
- **Current 401(k) Balance** (currency field)
- **Current 401(k) Contribution** (currency or percentage field)
- **401(k) Match %** (percentage field)
- **IRA Balance** (currency field)
- **IRA Type** (dropdown): Traditional / Roth / SEP-IRA / Other
- **Desired Retirement Age** (numeric field)
- **Expected Retirement Spending** (currency field, annual)
- **Risk Tolerance** (radio buttons or slider):
  - Conservative
  - Moderate
  - Aggressive
- **Investment Goals** (checkboxes):
  - [ ] Maximize retirement savings
  - [ ] Tax optimization
  - [ ] Wealth preservation
  - [ ] Growth

#### Goal-Based Planning Form
- **Goal Name** (text field)
- **Goal Category** (dropdown):
  - Home Purchase
  - Car Purchase
  - Education
  - Vacation
  - Emergency Fund
  - Wealth Building
  - Other
- **Target Amount** (currency field)
- **Target Date** (date field)
- **Current Savings** (currency field)
- **Regular Savings Amount** (currency field)
- **Savings Frequency** (dropdown): Daily / Weekly / Monthly / Quarterly / Annually

### 5.5 Account Settings Forms

#### Profile Settings Form
- **First Name** (text field)
- **Last Name** (text field)
- **Email Address** (email field)
- **Phone Number** (phone field)
- **Preferred Contact Method** (dropdown): Email / Phone / SMS
- **Notification Preferences** (checkboxes):
  - [ ] Plan milestone notifications
  - [ ] Expert availability alerts
  - [ ] New feature announcements
  - [ ] Promotional emails

#### Password Change Form
- **Current Password** (password field)
- **New Password** (password field, with strength indicator)
- **Confirm New Password** (password field)

#### Billing & Subscription Form
- **Current Plan** (display): Monthly / Annual
- **Billing Cycle** (display): Next billing date
- **Payment Method** (display/update):
  - Stored credit card (last 4 digits)
  - Update payment method button
- **Billing Address** (editable fields)
- **Upgrade/Downgrade Plan** (radio selection with confirmation)
- **Cancel Membership** (button with warning)

---

## 6. IDENTIFICATION OF KEY FEATURES TO TEST

### 6.1 Core Functionality Testing Areas

#### Authentication & Registration
- [ ] Email validation (valid, invalid, already registered)
- [ ] Password validation (strength requirements, confirmation match)
- [ ] Registration with/without promotions
- [ ] Login with correct credentials
- [ ] Login with incorrect credentials
- [ ] Password reset flow
- [ ] Session timeout and re-authentication
- [ ] Social login integration (if available)
- [ ] Remember me functionality

#### Subscription & Billing
- [ ] Plan selection (monthly vs. annual)
- [ ] Promo code application and validation
- [ ] Association discount application
- [ ] Payment processing with valid card
- [ ] Payment processing with invalid card
- [ ] Payment failures and retry
- [ ] Secure payment form (Stripe iframe)
- [ ] Billing address capture
- [ ] Terms and conditions acceptance
- [ ] Invoice generation and access
- [ ] Subscription upgrade/downgrade
- [ ] Cancellation process
- [ ] Refund policy enforcement (14-day trial)
- [ ] Recurring billing and auto-renewal

#### Profile Building & Setup
- [ ] Step 1 - Personal Information form submission
  - [ ] Required field validation
  - [ ] Data type validation (date, numeric, etc.)
  - [ ] Boundary testing (extreme ages, dependents)
  - [ ] Form progression to step 2
  - [ ] Back button functionality
  - [ ] Data persistence if returning to step

- [ ] Step 2 - Financial Information
  - [ ] Income field calculations
  - [ ] Expense field calculations
  - [ ] Asset selection and balance entry
  - [ ] Debt type selection and detail entry
  - [ ] Auto-calculations (totals)
  - [ ] Decimal handling for currency fields
  - [ ] Negative value handling
  - [ ] Very large number handling
  - [ ] Currency formatting
  - [ ] Data persistence

- [ ] Step 3 - Human Capital
  - [ ] Career field selection
  - [ ] Experience field validation
  - [ ] Education level selection
  - [ ] Income growth estimation
  - [ ] Job stability rating
  - [ ] Career satisfaction rating
  - [ ] Certification selection
  - [ ] Data persistence

- [ ] FitBUX Score Calculation
  - [ ] Score generated after profile completion
  - [ ] Score displayed prominently
  - [ ] Score updates when profile changes
  - [ ] Score ranges (0-100 validation)
  - [ ] Score consistency with inputs

#### Dashboard & Home Page
- [ ] Dashboard loads after login
- [ ] FitBUX Score displayed
- [ ] Financial snapshot accuracy
- [ ] Recent activity display
- [ ] Quick action links
- [ ] Responsive layout
- [ ] Navigation menu functionality
- [ ] User menu access
- [ ] Logout functionality

#### Student Loan Management
- [ ] Loan entry form validation
- [ ] Multiple loan tracking
- [ ] Loan balance updates
- [ ] Interest rate calculations
- [ ] Monthly payment calculations
- [ ] Payoff date projections
- [ ] Federal vs. private loan handling
- [ ] Repayment plan selection (if federal)
- [ ] PSLF eligibility determination
- [ ] Forbearance/deferment tracking

#### Debt Payoff Calculations
- [ ] Snowball calculation (lowest balance first)
- [ ] Avalanche calculation (highest interest first)
- [ ] Total payoff timeline accuracy
- [ ] Total interest calculation
- [ ] Extra payment impact on timeline
- [ ] Multiple debt combination scenarios
- [ ] Currency formatting in results
- [ ] Comparison reports

#### Financial Planning Tools
- [ ] Investment planning calculations
- [ ] Retirement savings projections
- [ ] Goal tracking and progress
- [ ] Scenario simulation accuracy
- [ ] Plan recommendations
- [ ] Plan export/download
- [ ] Plan sharing (if feature exists)
- [ ] Plan history/versioning

#### Expert Services
- [ ] Expert availability calendar display
- [ ] Consultation booking
- [ ] Timezone handling
- [ ] Meeting confirmation
- [ ] Meeting reminder notifications
- [ ] Expert response quality
- [ ] Question submission and answer retrieval
- [ ] Follow-up responses

#### Account Management
- [ ] Profile information update
- [ ] Password change with validation
- [ ] Payment method update
- [ ] Notification preference settings
- [ ] Privacy setting configuration
- [ ] Data download/export
- [ ] Account deletion request

### 6.2 Integration Testing

#### Third-Party Integrations
- [ ] Betterment integration (if available)
- [ ] SoFi refinancing integration
- [ ] Splash Financial integration
- [ ] Earnest integration
- [ ] Gentreo document integration

#### Payment Processing
- [ ] Stripe payment flow
- [ ] Stripe iframe functionality
- [ ] Autofill via Link
- [ ] Card validation
- [ ] Billing address validation

### 6.3 Data & Security Testing

#### Data Validation
- [ ] Input field validation (type, length, format)
- [ ] Boundary value testing
- [ ] Special character handling
- [ ] Unicode/international character support
- [ ] XSS vulnerability testing
- [ ] SQL injection testing (if backend testing)

#### Security
- [ ] Password encryption
- [ ] Session security
- [ ] HTTPS enforcement
- [ ] Secure cookie flags
- [ ] CSRF token validation
- [ ] Rate limiting on login
- [ ] Data privacy compliance

### 6.4 Performance & Usability Testing

#### Performance
- [ ] Page load times
- [ ] Form submission speed
- [ ] Report generation time
- [ ] Dashboard rendering time
- [ ] Search functionality speed (if present)
- [ ] Calculation performance
- [ ] Memory usage
- [ ] Large dataset handling

#### Usability
- [ ] Form field clarity and labeling
- [ ] Error message clarity
- [ ] Success message visibility
- [ ] Navigation intuitiveness
- [ ] Mobile responsiveness
- [ ] Accessibility (WCAG compliance)
- [ ] Color contrast
- [ ] Font readability

### 6.5 Edge Cases & Error Scenarios

#### Calculation Edge Cases
- [ ] Zero income scenarios
- [ ] Negative values (where applicable)
- [ ] Extremely high values
- [ ] Rounding/precision issues
- [ ] Floating-point arithmetic errors
- [ ] Time period edge cases (leap years, month boundaries)

#### User Scenarios
- [ ] New user completing profile
- [ ] User with no debt
- [ ] User with only student loans
- [ ] User with very high debt-to-income ratio
- [ ] User changing financial situation significantly
- [ ] User approaching retirement
- [ ] Married couple (if multi-user feature exists)

#### Error Handling
- [ ] Network disconnection during submission
- [ ] Server error responses
- [ ] Timeout handling
- [ ] Validation error recovery
- [ ] Payment failure recovery
- [ ] Session expiration handling
- [ ] Concurrent edit conflicts

### 6.6 Workflow Testing

#### Complete User Journeys
- [ ] New user registration → profile setup → dashboard access
- [ ] Login → update financial info → generate plan
- [ ] Student loan planning → refinancing referral
- [ ] Debt payoff plan creation → tracking progress
- [ ] Schedule call → receive guidance → implement plan
- [ ] Plan adjustment → track new results

---

## 7. USER PROFILES FOR QA TEST COVERAGE

### Profile Categories (30+ profiles recommended)

#### Demographics-Based Profiles
1. **Young Professional (Entry-Level)**
   - Age: 22-25
   - Income: $45K-$55K
   - Employment: Full-time
   - Debt: Student loans ($25K-$40K)

2. **Mid-Career Professional**
   - Age: 30-35
   - Income: $75K-$100K
   - Employment: Full-time
   - Debt: Student loans, car loan, credit card
   - Assets: 401(k), savings

3. **Senior Professional**
   - Age: 40-50
   - Income: $120K+
   - Employment: Full-time/Executive
   - Debt: Mortgage, minimal other debt
   - Assets: Significant 401(k), investments

4. **Self-Employed**
   - Age: 28-45
   - Income: Variable ($50K-$150K)
   - Employment: Self-employed
   - Debt: Business loans possible

5. **Recent Graduate**
   - Age: 22-24
   - Income: $40K-$60K
   - Employment: First job
   - Debt: High student loans ($30K-$50K)

#### Financial Situation Profiles
6. **High Debt Burden**
   - Total Debt: $150K+
   - Debt-to-Income: > 80%
   - Income: $55K-$75K
   - Multiple debt types

7. **Debt-Free**
   - Total Debt: $0
   - Assets: Savings, investments
   - Focus: Wealth building

8. **Student Loan Heavy**
   - Primary Debt: Student loans ($80K+)
   - Federal loans (testing PSLF)
   - Income: $60K-$90K

9. **High Income Low Savings**
   - Income: $120K+
   - Savings: < $10K
   - Lifestyle spending

10. **Married Couple**
    - Joint Income: $100K+
    - Shared Debt & Assets
    - Multiple financial goals

#### Life Stage Profiles
11. **Recently Married**
    - Age: 25-30
    - Income: Dual income
    - Debt: Consolidated
    - Planning: Honeymoon, home

12. **Parent of Young Children**
    - Age: 28-40
    - Income: Variable
    - Debt: Mortgage, student loans
    - Goals: Child education fund

13. **Approaching Retirement**
    - Age: 55-65
    - Income: High
    - Assets: Significant 401(k), investments
    - Goals: Retirement planning

14. **Recent Job Loss**
    - Income: $0 or reduced
    - Assets: Unemployment benefits
    - Goals: Budget tight, find work

15. **Career Changer**
    - Income: Transitioning
    - Education: Retraining possible
    - Debt: May increase temporarily

#### Special Scenarios
16. **High Student Loan Forgiveness Candidate**
    - Education: Advanced degree (MD, JD, PhD)
    - Employment: Non-profit or government
    - Goals: PSLF tracking
    - Income: Professional-level

17. **Freelancer/Gig Worker**
    - Income: Highly variable ($25K-$100K)
    - Expenses: Self-employed tax planning
    - Retirement: Self-directed

18. **International/Immigrant**
    - Work visa considerations
    - Income: Potential currency issues
    - Language: May need translation support

19. **Student Still in School**
    - Age: 18-25
    - Income: Part-time or none
    - Debt: Expected student loans
    - Assets: Minimal

20. **High Spender/Lifestyle Inflation**
    - Income: $80K-$150K
    - Expenses: High ($70K-$100K+)
    - Debt: Credit cards, loans
    - Behavior: Needs coaching

21. **Conservative Saver**
    - Income: Moderate ($50K-$75K)
    - Expenses: Low ($30K-$40K)
    - Savings Rate: High (30%+)
    - Goals: Wealth building

22. **Single Parent**
    - Income: Varies
    - Dependents: 1-4
    - Expenses: Childcare heavy
    - Goals: Security

23. **Healthcare Professional**
    - Profession: Doctor, nurse, therapist
    - Income: $60K-$200K+
    - Debt: Student loans possible
    - Schedule: Irregular

24. **Tech Industry**
    - Income: $80K-$250K+
    - Benefits: Stock options, bonuses
    - Expense: Bay Area or high COL
    - Goals: Wealth optimization

25. **Teacher/Non-profit Worker**
    - Income: $40K-$65K
    - PSLF Eligible: Yes
    - Debt: Student loans
    - Job Security: Stable

#### Boundary/Edge Case Profiles
26. **Zero Income**
    - Recent job loss
    - Student with savings
    - Testing: How app handles zero/no income

27. **Extremely High Income**
    - Income: $500K+
    - Assets: Investment portfolio
    - Complexity: Tax optimization

28. **Minimal Assets**
    - Net worth: Near zero
    - Savings: < $1K
    - Living paycheck-to-paycheck

29. **Significant Asset Holder**
    - Investment portfolio: $500K+
    - Real estate: Multiple properties
    - Testing: Asset diversification

30. **Multiple Currency/International**
    - Income: Multiple countries
    - Currency: Testing multi-currency
    - Debt: International loans

31. **Bankruptcy History**
    - Credit score: Low
    - Testing: Debt planning post-bankruptcy
    - Goals: Rebuild credit

32. **Elderly/Retirement Focus**
    - Age: 65+
    - Income: Fixed (Social Security, pension)
    - Assets: Significant
    - Goals: Preserve wealth

---

## 8. TEST SCENARIOS & WORKFLOWS

### Scenario 1: New Graduate with High Student Debt
**User Profile**: Recent graduate, $28K student loans, $45K income, minimal savings
**Objectives**:
1. Complete profile setup
2. View FitBUX score
3. Explore student loan payoff options
4. Compare repayment plans
5. Get expert consultation recommendation

**Test Steps**:
1. Register new account
2. Select annual subscription
3. Complete profile (personal, financial, human capital)
4. Verify FitBUX score calculated
5. Navigate to Student Loans tool
6. Enter loan details
7. Compare repayment strategies
8. Verify payoff timeline
9. Schedule expert call (if feature available)
10. Verify plan saved to dashboard

### Scenario 2: Career-Change Financial Impact
**User Profile**: 35-year-old changing careers, income dropping from $95K to $55K
**Objectives**:
1. Verify profile update workflow
2. Test financial impact calculations
3. Evaluate new plan recommendations
4. Test debt prioritization changes

**Test Steps**:
1. Log in with existing account
2. Update profile financial info (reduce income)
3. Verify FitBUX score recalculation
4. Review debt payoff impact
5. Check expense optimization suggestions
6. Verify goal timeline updates
7. Test plan adjustment workflow

### Scenario 3: Multiple Debt Consolidation
**User Profile**: Professional with scattered debts (student loan, credit cards, car payment)
**Objectives**:
1. Input multiple debt types
2. Test consolidation calculations
3. Test payoff strategy comparison
4. Verify refinancing partner recommendations

**Test Steps**:
1. Create profile with multiple debts
2. Dashboard should show all debts
3. Access debt consolidation tool
4. Compare payoff strategies
5. Test refinancing recommendations
6. Verify timeline calculations
7. Test partner integrations (SoFi, Splash, etc.)

### Scenario 4: Subscription & Billing Workflow
**User Profile**: Any new user
**Objectives**:
1. Test subscription selection
2. Test payment processing
3. Test billing cycle management
4. Test upgrade/downgrade
5. Test cancellation

**Test Steps**:
1. Reach subscription selection page
2. Select monthly plan
3. Enter promo code (if available)
4. Complete payment
5. Verify subscription active
6. Test billing settings
7. Test plan upgrade to annual
8. Test downgrade back to monthly
9. Test cancellation process

### Scenario 5: PSLF Eligible Borrower
**User Profile**: Non-profit worker with federal student loans
**Objectives**:
1. Set up PSLF tracking
2. Verify eligibility determination
3. Test 10-year projection
4. Test forgiveness calculation

**Test Steps**:
1. Create profile as non-profit employee
2. Enter federal student loan details
3. System should flag PSLF eligibility
4. Navigate to PSLF planner
5. Verify 10-year timeline
6. Test forgiveness amount calculation
7. Test required payment amounts
8. Generate PSLF action plan

### Scenario 6: Investment & Retirement Planning
**User Profile**: Mid-career professional with 401(k) and IRA
**Objectives**:
1. Input current retirement savings
2. Test retirement projection
3. Test investment allocation
4. Test retirement age adjustments

**Test Steps**:
1. Complete profile with retirement account values
2. Navigate to Retirement Planning
3. Enter current 401(k) balance and contribution
4. Enter IRA details
5. Set retirement age
6. System calculates needed savings rate
7. Test adjusting retirement age
8. Verify projections update
9. Test investment allocation recommendations

### Scenario 7: Emergency Fund Planning
**User Profile**: Young professional, minimal savings
**Objectives**:
1. Calculate recommended emergency fund
2. Create savings plan
3. Track progress
4. Test goal adjustment

**Test Steps**:
1. Create profile with financial details
2. Dashboard calculates emergency fund need
3. Create emergency fund goal
4. Set target timeline
5. Calculate monthly savings needed
6. Track contributions
7. Adjust goal if needed

### Scenario 8: Expert Consultation Flow
**User Profile**: Any logged-in user
**Objectives**:
1. Schedule expert call
2. Test availability display
3. Test confirmation
4. Test reminders

**Test Steps**:
1. Log in to dashboard
2. Navigate to Expert Services
3. View available consultation slots
4. Select desired time
5. Confirm booking
6. Verify confirmation email sent
7. Test calendar integration (if available)
8. Verify reminder notification

---

## 9. KEY QUESTIONS FOR PRODUCT TEAM

### Functional Questions
1. **Profile Flexibility**: Can users update their profile at any time? Are there restrictions or confirmations needed?
2. **Multi-Account**: Can one email have multiple accounts or profiles?
3. **Shared Profiles**: For married couples, can one account represent joint finances, or does each spouse need individual accounts?
4. **Data Export**: Can users export their financial plan and data? In what formats?
5. **Plan History**: Does the system maintain historical versions of plans? Can users view how recommendations changed?
6. **Expert Services**: 
   - What time zones are experts available in?
   - What languages do experts support?
   - Are experts available 24/7 or business hours only?
   - What is average response time for written questions?
7. **Scenario Simulation**: Can users create unlimited "what-if" scenarios? Are there save limits?
8. **Mobile Application**: Is there a native mobile app, or is the web app responsive?
9. **Data Updates**: How frequently should users update their financial information for accurate recommendations?
10. **API/Integration**: Are there public APIs for the third-party integrations (SoFi, Betterment, etc.)?

### Financial Features Questions
1. **Student Loans**:
   - Which federal repayment plans are supported?
   - Does the system account for Public Service Loan Forgiveness tax implications?
   - Does it support income-driven repayment recalculation scenarios?
   - How are Parent PLUS loans handled?

2. **Investments**:
   - What investment calculators are available?
   - Does the platform provide robo-advisor services or just planning?
   - How are index funds, stocks, and mutual funds handled?
   - Tax-loss harvesting support?

3. **Retirement**:
   - Does it support all types of IRAs and 401(k) plans?
   - SEP-IRA, Solo 401(k) for self-employed?
   - Backdoor Roth contributions?
   - Required Minimum Distribution (RMD) planning?

4. **Taxes**:
   - Does the platform provide tax planning recommendations?
   - Tax-advantaged account prioritization?
   - Estimated tax calculations for self-employed?

5. **Insurance**:
   - Does the platform recommend insurance needs (life, disability)?
   - Gap analysis for coverage?

### Business & Subscription Questions
1. **Trial Period**: How are 14-day trial limitations enforced? Can users view all features?
2. **Pricing Tiers**: Are there different feature sets by subscription level?
3. **Cancellation**: Is there a cancellation fee? How is the refund period calculated?
4. **Auto-Renewal**: How are auto-renewal notifications handled?
5. **Usage Limits**: Are there limits on:
   - Number of plans created?
   - Number of expert consultations?
   - Report generation?

### Data & Privacy Questions
1. **Data Security**: 
   - What encryption is used for data in transit and at rest?
   - Is SOC 2 certified?
   - GDPR compliant?
   - CCPA compliant?

2. **Data Retention**: How long is data retained after account closure?
3. **Financial Data Source**: Are there integrations with banks/investment accounts (Plaid, etc.)?
4. **Data Sharing**: Are there options to share financial plans with:
   - Financial advisors?
   - Spouse/partner?
   - Family members?

### Performance & Reliability Questions
1. **System SLA**: What is the uptime guarantee?
2. **Calculation Accuracy**: How are financial calculations validated and tested?
3. **Rounding**: How are decimal/rounding decisions made for currency?
4. **Concurrent Users**: Maximum concurrent users supported?
5. **Data Backup**: Backup frequency and recovery procedures?

### Compliance Questions
1. **Financial Advice**: 
   - Is advice considered "financial advice" requiring registration?
   - FitBUX RIA scope vs. FitBUX Inc. scope?
   - Disclaimers and limitations?

2. **Regulations**:
   - State regulations for financial guidance?
   - Any restrictions on user types (age, location, citizenship)?

3. **Accessibility**: 
   - WCAG 2.1 AA compliance level?
   - Screen reader support?
   - Keyboard navigation support?

---

## 10. OBSERVED TECHNICAL DETAILS

### Technology Stack
- **Frontend**: React SPA (Single Page Application)
- **Payment Processing**: Stripe (with iframe integration, Link autofill)
- **Authentication**: Email/password based
- **Analytics**: Google Analytics
- **Security**: hCaptcha
- **Hosting**: Unknown (likely cloud-based)
- **HTTP**: HTTPS enforced
- **API**: Likely REST API (exact endpoints not fully exposed)

### Key Routes Identified
```
/auth/login              - Login page
/auth/logout             - Logout endpoint
/register                - Registration page
/profile-builder         - Multi-step profile setup
/dashboard               - Main application dashboard
/home                    - Alternative home/dashboard
/forgot-password         - Password recovery
```

### Inferred API Endpoints (Common Patterns)
```
POST /api/auth/login             - User login
POST /api/auth/register          - User registration
POST /api/auth/logout            - User logout
GET /api/user/profile            - Fetch user profile
PUT /api/user/profile            - Update user profile
GET /api/fitbux-score            - Get FitBUX score
GET /api/student-loans           - List student loans
POST /api/student-loans          - Create student loan
PUT /api/student-loans/{id}      - Update student loan
DELETE /api/student-loans/{id}   - Delete student loan
GET /api/plans                   - List financial plans
POST /api/plans                  - Create plan
PUT /api/plans/{id}              - Update plan
GET /api/payments                - Subscription info
POST /api/payments               - Process payment (via Stripe)
GET /api/expert-calls            - Available appointments
POST /api/expert-calls           - Schedule call
```

### Error Codes Observed
- **404**: Resource not found
- **500**: Server error
- **hCaptcha**: Challenge-response verification

### Frontend Features Observed
- Modal dialogs (FitBUX Score explanation)
- Multi-step form handling
- Stripe iframe embeds
- Loading progress indicators
- Responsive design (desktop-first observed)
- Cookie consent banner

---

## 11. TESTING RECOMMENDATIONS

### Priority 1 (Critical Path)
1. Registration and subscription flow
2. Profile building and data persistence
3. FitBUX Score calculation
4. Login and session management
5. Dashboard access and navigation
6. Financial data input and persistence

### Priority 2 (Core Features)
1. Student loan management workflows
2. Debt payoff calculations
3. Plan creation and updates
4. Expert consultation booking
5. Payment processing

### Priority 3 (Enhancement)
1. Advanced scenario simulation
2. Third-party integrations
3. Reporting and export
4. Mobile responsiveness
5. Accessibility compliance

### Recommended Test Automation Coverage
- **Happy Path**: 100% automation (new user → dashboard access)
- **Core Calculations**: 100% automation (debt payoff, retirement planning, FitBUX score)
- **Error Scenarios**: 75% automation (input validation, payment failures)
- **Edge Cases**: 50% automation (extreme values, boundary conditions)
- **UI/UX**: 25% automation (visual regression, responsive design)

### Manual Testing Focus Areas
- Expert interaction quality
- Financial advice accuracy
- User experience and intuitiveness
- Accessibility compliance
- Performance under load
- Third-party integration quality

---

## 12. CONCLUSION

FitBUX is a comprehensive financial planning platform targeting young professionals with complex financial situations. The platform combines AI-driven financial analysis with expert human guidance, offering tools for debt management, retirement planning, investment strategy, and goal-based financial planning.

### Key Testing Areas
1. **User Onboarding**: Complete registration → profile setup → dashboard
2. **Financial Calculations**: Accuracy of all financial algorithms
3. **Data Management**: Persistence, updates, and historical tracking
4. **Expert Services**: Consultation booking and quality
5. **Integration**: Third-party partner connections
6. **Security**: Payment processing, data privacy, access control
7. **Usability**: Intuitiveness and accessibility

The 30+ user profiles and test scenarios provided offer comprehensive coverage of different user demographics, financial situations, and life stages, enabling thorough QA validation across the platform's full feature set.

---

**Document Version**: 1.0  
**Last Updated**: July 30, 2026  
**Status**: Research & Planning Complete
