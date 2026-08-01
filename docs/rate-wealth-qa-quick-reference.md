# Rate Wealth (FitBUX) - QA Planning Quick Reference

**Date**: July 30, 2026  
**Status**: Research Complete - Ready for QA Test Planning

---

## Executive Summary

FitBUX (Rate Wealth) is a comprehensive financial planning and management platform for young professionals. The application helps users create personalized financial plans, manage debt (especially student loans), track investments, and work with financial experts.

**Key Strengths for Testing**:
- Clear 5-step user journey
- Multiple financial planning tools
- Expert consultation services
- Third-party integrations
- Subscription-based revenue model

---

## Quick Facts

| Aspect | Details |
|--------|---------|
| **Application Type** | Web-based SPA (React) |
| **Primary Audience** | Young professionals, ages 20-50 |
| **Geographic Focus** | US-based (initially) |
| **Pricing Model** | Subscription (Monthly $18.99 / Annual $189) |
| **Free Trial** | 14 days |
| **Primary Features** | Financial planning, debt management, expert guidance |
| **Key Integrations** | Stripe, SoFi, Betterment, Splash Financial, Earnest |
| **Authentication** | Email/password |
| **Data Security** | Stripe for payments, HTTPS |

---

## Core User Workflows (3 Main Paths)

### Path 1: New User Registration (~10-15 minutes)
```
Landing Page → Signup → Subscription Selection → Payment Info → 
Profile Building (3 Steps) → FitBUX Score → Dashboard
```

**Critical Test Points**:
- Email validation
- Password strength
- Payment processing (Stripe)
- Form data persistence across 3-step profile
- FitBUX Score calculation accuracy

### Path 2: Existing User Login
```
Login Page → Email/Password → Dashboard → Financial Tools
```

**Critical Test Points**:
- Session management
- "Remember me" functionality
- Password reset flow
- Dashboard data accuracy

### Path 3: Financial Planning Workflow
```
Dashboard → Select Tool (Student Loans/Debt/Investment) → 
Input Data → View Recommendations → Schedule Expert Call
```

**Critical Test Points**:
- Data input validation
- Calculation accuracy
- Plan persistence
- Expert scheduling

---

## Key Features to Test (Prioritized)

### Must-Have Tests (Priority 1)
1. **Registration & Payment**
   - Email signup validation
   - Password complexity requirements
   - Stripe payment integration
   - 14-day trial enforcement

2. **Profile Building**
   - 3-step form flow and data persistence
   - Required field validation
   - Data type validation (currency, percentages, dates)
   - Auto-calculations (totals, averages)

3. **FitBUX Score**
   - Score calculation accuracy
   - Score range validation (0-100)
   - Score updates on profile changes
   - Score display prominence

4. **Dashboard**
   - Post-login landing
   - Financial snapshot accuracy
   - Quick action navigation
   - Score display

### Important Tests (Priority 2)
1. **Student Loan Management**
   - Multiple loan tracking
   - Payoff timeline calculations
   - Repayment plan comparisons
   - PSLF eligibility determination

2. **Debt Payoff Planning**
   - Snowball vs. avalanche calculations
   - Extra payment impact
   - Multiple debt combinations
   - Payoff timeline accuracy

3. **Account Management**
   - Profile update
   - Password changes
   - Subscription upgrade/downgrade
   - Payment method updates

### Nice-to-Have Tests (Priority 3)
1. Investment & retirement planning
2. Third-party integrations (SoFi, Betterment)
3. Expert consultation booking
4. Plan export/reporting
5. Mobile responsiveness

---

## Test Data Requirements

### 32 User Profile Categories (See Full Doc)

**Key Profile Types**:
- Entry-level professional ($45K income, $30K student loans)
- Mid-career ($75K-$100K, mixed debt)
- High debt burden (150K+ debt)
- Debt-free saver
- Student loan heavy (PSLF eligible)
- Self-employed/freelancer
- Recent graduate
- Career changer
- Parent with children
- Approaching retirement
- Multiple edge cases

---

## Form Fields by Step

### Registration/Login
- Email, Password, Confirm Password, Terms acceptance

### Subscription
- Plan selection, Promo code, Payment card, Billing address

### Profile Step 1: Personal
- Name, DOB, Employment status, Marital status, Dependents, State

### Profile Step 2: Financial
- Annual income, Monthly expenses, Assets (savings, investments, retirement), Debts (student loans, credit cards, mortgage, car loan)

### Profile Step 3: Human Capital
- Job title, Industry, Years experience, Education, Career stage, Job stability, Income growth, Certifications

---

## Critical Test Scenarios (8 Provided)

1. **New Graduate** - High student debt, low income, minimal savings
2. **Career Change** - Income reduction impact on financial plan
3. **Multiple Debts** - Consolidation and prioritization
4. **Subscription Management** - Payment, upgrade, downgrade, cancellation
5. **PSLF Planning** - Non-profit worker, 10-year forgiveness projection
6. **Retirement Planning** - 401(k) and IRA projections
7. **Emergency Fund** - Goal calculation and tracking
8. **Expert Consultation** - Call scheduling and confirmation

---

## Data Entry Validation Requirements

### Financial Fields
- Currency (decimal, positive values)
- Percentages (0-100 range)
- Numeric dates (MM/DD/YYYY, age calculation)
- Phone numbers (formatting)
- Email addresses (valid format)
- Large numbers (millions for assets)
- Extremely small incomes (gig workers, students)

### Edge Cases to Test
- Zero income scenarios
- Negative values (where applicable)
- Very high income ($500K+)
- Very high debt ($500K+)
- International characters in names
- Special characters in addresses

---

## Technical Details for Test Environment

### Stack Components
- **Frontend**: React SPA
- **Payment**: Stripe (with iframe embeds)
- **Analytics**: Google Analytics
- **Security**: hCaptcha
- **HTTPS**: Required
- **Cookies**: Consent banner present

### Key URLs
```
Production:     https://wealth.dev.fitbux.com/
Public Website: https://www.fitbux.com/

Login:           /auth/login
Register:        /register
Profile Builder: /profile-builder
Dashboard:       /dashboard or /home
Forgot Password: /forgot-password
```

### Expected Error Responses
- 404: Resource not found (when backend issues)
- 500: Server error
- hCaptcha verification failures
- Stripe payment rejections

---

## Key Product Questions (60+ in Full Doc)

### Top 10 Priority Questions
1. Can users update their profile after onboarding? Any restrictions?
2. How do married couples share financial data - one account or two?
3. What expert consultant availability hours/languages?
4. Can users create unlimited "what-if" scenarios?
5. Is there a mobile native app or web-responsive only?
6. What student loan repayment plans are supported?
7. Does it handle PSLF and tax implications?
8. What data privacy certifications (SOC 2, GDPR, etc.)?
9. Are there usage limits (expert calls, report generation)?
10. What is the exact data retention policy after cancellation?

---

## Testing Recommendations

### Coverage Goals
- **Happy Path**: 100% automation
- **Core Calculations**: 100% automation
- **Error Scenarios**: 75% automation
- **UI/UX**: 25% automation
- **Performance**: Smoke tests

### Test Automation Priorities
1. Registration through dashboard access
2. All financial calculations (debt payoff, retirement, FitBUX score)
3. Profile updates and FitBUX score recalculation
4. Student loan payoff scenarios
5. Data validation for all forms

### Manual Testing Priorities
1. Expert consultation quality
2. Financial advice accuracy review
3. UX intuitiveness
4. Accessibility (WCAG 2.1)
5. Third-party integration flows

### Performance Baselines to Establish
- Page load time: < 2 seconds
- Form submission: < 1 second
- Calculation time: < 2 seconds
- Dashboard rendering: < 1.5 seconds

---

## Potential Risk Areas

### High Risk (Test Thoroughly)
1. **Payment Processing** - Stripe integration, failed payments, retry logic
2. **Calculations** - FitBUX score, debt payoff, retirement projections (financial accuracy critical)
3. **Data Persistence** - Profile data loss across onboarding steps
4. **User Authentication** - Session timeout, password reset, account access

### Medium Risk (Regular Testing)
1. Third-party integrations (SoFi, Betterment)
2. Expert consultation scheduling
3. Mobile responsiveness
4. Concurrent user scenarios

### Lower Risk (Spot Check)
1. Podcast and resource library links
2. Help and FAQ pages
3. Cookie preferences
4. Social media links

---

## Recommended Test Automation Framework

### Tools
- **Playwright** (as per workspace setup)
- **test-data**: YAML profiles for 32+ user types
- **test-specs**: CSV scenarios with test cases
- **Helpers**: Financial calculation validators

### Test Organization
```
tests/projects/rate-wealth/
├── auth/
│   ├── login.spec.ts
│   ├── registration.spec.ts
│   └── password-reset.spec.ts
├── profile/
│   ├── personal-info.spec.ts
│   ├── financial-info.spec.ts
│   ├── human-capital.spec.ts
│   └── fitbux-score.spec.ts
├── planning/
│   ├── student-loans.spec.ts
│   ├── debt-payoff.spec.ts
│   ├── retirement.spec.ts
│   └── goals.spec.ts
├── account/
│   ├── settings.spec.ts
│   ├── billing.spec.ts
│   └── expert-consultation.spec.ts
└── e2e/
    ├── new-user-journey.spec.ts
    ├── existing-user-planning.spec.ts
    └── financial-scenario.spec.ts
```

---

## Next Steps for QA Planning

1. **Create detailed test cases** (CSV format with 50+ scenarios)
2. **Define test data** (32 user profiles in YAML format)
3. **Set up test environment** (test accounts, test data)
4. **Build automation framework** (Playwright setup in workspace)
5. **Establish baselines** (performance, calculation accuracy)
6. **Schedule expert interviews** (product team for requirements clarification)
7. **Plan UAT** (with financial domain experts)

---

**For Complete Details**: See [rate-wealth-research.md](rate-wealth-research.md)

**Document Version**: 1.0  
**Created**: July 30, 2026  
**Status**: Ready for QA Planning
