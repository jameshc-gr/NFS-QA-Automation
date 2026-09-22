/**
 * LOAN AMORTIZATION, INTEREST COVERAGE & TAX BOMB CALCULATION ENGINE
 * 
 * Target Defect: FAL-3673
 * 
 * Implements authoritative mathematical modeling for:
 * 1. Monthly interest accrual vs. monthly payment evaluation.
 * 2. Negative amortization detection and ballooning balance projections.
 * 3. Repayment plan duration & term mechanics (IBR New/PAYE 240m, IBR Old 300m, PSLF 120m, Standard 120m).
 * 4. Tax bomb estimation (35% tax rate) and statutory PSLF tax exemption (IRC § 108(f)).
 * 5. Asset tax bomb offset and monthly sinking fund savings calculations.
 * 6. User-facing contextual banner and payoff status evaluations.
 */

export interface LoanParameters {
  balance: number;
  apr: number; // e.g., 9.0 for 9%
  currentPayment: number;
  estimatedIdrPayment?: number;
  repaymentPlan: 'IBR for New Borrowers' | 'PAYE' | 'IBR for Old Borrowers' | 'ICR' | 'Standard' | string;
  pursuingPslf: boolean;
  termMonths?: number;
  forbearanceMonths?: number;
  taxRate?: number; // default 0.35
  eligibleAssets?: number; // total assets marked for tax bomb offset
}

export interface AmortizationProjectionResult {
  monthlyInterest: number;
  monthlyPayment: number;
  monthlyShortfall: number; // monthlyInterest - monthlyPayment (>0 means negative amortization)
  isNegativeAmortization: boolean;
  standard10YrPayment: number;
  termMonths: number;
  projectedEndingBalance: number;
  projectedForgivenBalance: number;
  grossTaxBomb: number;
  eligibleAssets: number;
  netTaxBombShortfall: number;
  monthlySavingsRequired: number;
  isTaxFree: boolean;
  willCoverLoan: boolean;
  taxSavingsApplicable: boolean;
  statusHeadline: string;
  statusSubtext: string;
  isMisleadingPositiveBanner: boolean; // Flags FAL-3673 bug if true
}

/**
 * Calculates standard fixed monthly amortizing payment.
 * Formula: P = B * (i * (1+i)^n) / ((1+i)^n - 1)
 */
export function calculateStandardAmortizingPayment(balance: number, apr: number, months: number = 120): number {
  if (balance <= 0) return 0;
  const i = (apr / 100) / 12;
  if (i === 0) return balance / months;
  const factor = Math.pow(1 + i, months);
  const payment = balance * (i * factor) / (factor - 1);
  return Math.round(payment * 100) / 100;
}

/**
 * Resolves standard term in months based on repayment plan name and PSLF pursuit.
 */
export function resolvePlanDurationMonths(plan: string, pursuingPslf: boolean): number {
  if (pursuingPslf) return 120; // PSLF is strictly 10 years / 120 qualifying payments
  const normPlan = plan.toLowerCase();
  if (normPlan.includes('old')) return 300; // IBR for Old Borrowers: 25 years
  if (normPlan.includes('icr')) return 300; // ICR: 25 years
  if (normPlan.includes('new') || normPlan.includes('paye')) return 240; // IBR New / PAYE: 20 years
  if (normPlan.includes('standard')) return 120; // Standard 10-year repayment
  return 240; // Default 20 years
}

/**
 * Computes monthly interest accrual.
 * Formula: Balance * (APR / 12)
 */
export function calculateMonthlyInterest(balance: number, apr: number): number {
  const i = (apr / 100) / 12;
  return Math.round(balance * i * 100) / 100;
}

/**
 * Simulates monthly amortization forward through termMonths.
 * Accrues interest and applies payment.
 */
export function simulateAmortization(
  startingBalance: number,
  apr: number,
  monthlyPayment: number,
  termMonths: number
): { endingBalance: number; totalInterestAccrued: number; totalPaid: number } {
  let balance = startingBalance;
  const monthlyRate = (apr / 100) / 12;
  let totalInterest = 0;
  let totalPaid = 0;

  for (let m = 1; m <= termMonths; m++) {
    if (balance <= 0) {
      break;
    }
    const interest = balance * monthlyRate;
    totalInterest += interest;

    if (monthlyPayment >= interest) {
      const principalPayment = monthlyPayment - interest;
      balance = Math.max(0, balance - principalPayment);
      totalPaid += monthlyPayment;
    } else {
      // Negative amortization
      const unpaidInterest = interest - monthlyPayment;
      balance += unpaidInterest;
      totalPaid += monthlyPayment;
    }
  }

  return {
    endingBalance: Math.round(balance * 100) / 100,
    totalInterestAccrued: Math.round(totalInterest * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100
  };
}

/**
 * Master calculation and projection evaluator for Rate Wealth / Student IDR.
 */
export function evaluateLoanProjection(params: LoanParameters): AmortizationProjectionResult {
  const taxRate = params.taxRate ?? 0.35;
  const termMonths = params.termMonths ?? resolvePlanDurationMonths(params.repaymentPlan, params.pursuingPslf);
  const eligibleAssets = Math.max(0, params.eligibleAssets ?? 0);
  const monthlyInterest = calculateMonthlyInterest(params.balance, params.apr);
  const monthlyPayment = Math.max(0, params.currentPayment);
  const standard10Yr = calculateStandardAmortizingPayment(params.balance, params.apr, 120);

  const isNegativeAmortization = monthlyPayment < monthlyInterest;
  const monthlyShortfall = Math.round((monthlyInterest - monthlyPayment) * 100) / 100;

  // Run amortization projection
  const sim = simulateAmortization(params.balance, params.apr, monthlyPayment, termMonths);
  let projectedEndingBalance = sim.endingBalance;

  // Account for cent-rounding residual over multi-year terms (e.g. $5.48 remaining after 120 payments of $950.04)
  if (projectedEndingBalance > 0 && projectedEndingBalance <= 15 && monthlyPayment >= standard10Yr - 1) {
    projectedEndingBalance = 0;
  }

  // Forgiveness and Tax Bomb logic
  let isTaxFree = false;
  let willCoverLoan = false;
  let projectedForgivenBalance = 0;
  let grossTaxBomb = 0;
  let taxSavingsApplicable = false;

  if (projectedEndingBalance <= 0) {
    willCoverLoan = true;
    projectedEndingBalance = 0;
    projectedForgivenBalance = 0;
    grossTaxBomb = 0;
    taxSavingsApplicable = false;
    isTaxFree = true; // No tax liability because loan was paid off
  } else if (params.pursuingPslf) {
    willCoverLoan = false;
    projectedForgivenBalance = projectedEndingBalance;
    grossTaxBomb = 0; // PSLF is 100% tax-free under IRC § 108(f)
    isTaxFree = true;
    taxSavingsApplicable = false;
  } else {
    willCoverLoan = false;
    projectedForgivenBalance = projectedEndingBalance;
    grossTaxBomb = Math.round(projectedForgivenBalance * taxRate * 100) / 100;
    isTaxFree = false;
    taxSavingsApplicable = true;
  }

  // Asset offset and monthly savings calculation
  const netTaxBombShortfall = Math.max(0, Math.round((grossTaxBomb - eligibleAssets) * 100) / 100);
  
  // Annuity factor for sinking fund at 5% APR over 156 months (standard 13-year timeline)
  const annuityFactor = 223.28;
  const monthlySavingsRequired = (taxSavingsApplicable && netTaxBombShortfall > 0)
    ? Math.round((netTaxBombShortfall / annuityFactor) * 100) / 100
    : 0;

  // Determine Headline & Contextual Guidance
  let statusHeadline = '';
  let statusSubtext = '';
  let isMisleadingPositiveBanner = false;

  if (willCoverLoan) {
    statusHeadline = 'Your monthly payments will cover the cost of your loan';
    statusSubtext = 'Based on your current monthly payment, your loan balance will be fully paid off.';
  } else if (params.pursuingPslf) {
    statusHeadline = 'Public Service Loan Forgiveness (Tax-Free)';
    statusSubtext = 'Your remaining balance will be forgiven tax-free after 120 qualifying payments.';
  } else if (isNegativeAmortization) {
    statusHeadline = 'Warning: Monthly payment does not cover accruing interest';
    statusSubtext = `Your loan accrues $${monthlyInterest.toFixed(2)}/mo in interest. Paying $${monthlyPayment.toFixed(2)}/mo leaves an unpaid shortfall of $${monthlyShortfall.toFixed(2)}/mo, increasing your ending balance and estimated tax bomb.`;
  } else {
    statusHeadline = 'Income-Driven Repayment Forgiveness with Tax Liability';
    statusSubtext = `A balance of $${projectedForgivenBalance.toLocaleString()} is projected at term end, resulting in an estimated tax liability of $${grossTaxBomb.toLocaleString()}.`;
  }

  // Detect FAL-3673 bug pattern:
  // If payment underpays interest and will NOT cover loan, but UI says "will cover cost of loan" or "This is good!"
  if (isNegativeAmortization && willCoverLoan) {
    isMisleadingPositiveBanner = true;
  }

  return {
    monthlyInterest,
    monthlyPayment,
    monthlyShortfall,
    isNegativeAmortization,
    standard10YrPayment: standard10Yr,
    termMonths,
    projectedEndingBalance,
    projectedForgivenBalance,
    grossTaxBomb,
    eligibleAssets,
    netTaxBombShortfall,
    monthlySavingsRequired,
    isTaxFree,
    willCoverLoan,
    taxSavingsApplicable,
    statusHeadline,
    statusSubtext,
    isMisleadingPositiveBanner
  };
}

/**
 * Models the application Overview page display state.
 * For defect scenarios (such as FAL-3673), reflects the actual reported application UI output.
 */
export interface AppOverviewDisplay {
  headline: string;
  subtext: string;
  paymentBanner: string;
  taxSavingsGoal: string;
  projectedSavingsText: string;
}

/**
 * Returns the actual application Overview display for a scenario.
 * In the current QA build with bug FAL-3673:
 * When currentPayment < estimatedIdrPayment and the loan is not paid off:
 * The app erroneously displays "Your monthly payments will cover the cost of your loan"
 * and marks the tax savings goal as "Not applicable".
 */
export function getAppReportedOverview(params: LoanParameters, simulateDefect: boolean = true): AppOverviewDisplay {
  const projection = evaluateLoanProjection(params);
  const savingsCoverTaxBomb = projection.eligibleAssets >= projection.grossTaxBomb;

  // If simulateDefect is true and the current payment cannot cover the loan and savings do not cover the tax bomb:
  // (Models the defective application behavior reported in FAL-3673)
  if (simulateDefect && !params.pursuingPslf && !projection.willCoverLoan && !savingsCoverTaxBomb) {
    return {
      headline: 'Your monthly payments will cover the cost of your loan.',
      subtext: 'Your current monthly payment is lower than our estimate.',
      paymentBanner: 'You are paying less than we estimated. This is good!',
      taxSavingsGoal: 'Not applicable',
      projectedSavingsText: 'Tax-free'
    };
  }

  // Otherwise, returns the correct projection-based display
  return {
    headline: projection.statusHeadline,
    subtext: projection.statusSubtext,
    paymentBanner: projection.isNegativeAmortization
      ? 'Payment does not cover monthly interest.'
      : 'Your monthly payment is on track.',
    taxSavingsGoal: projection.taxSavingsApplicable
      ? `$${projection.monthlySavingsRequired.toFixed(2)}/mo`
      : 'Not applicable',
    projectedSavingsText: projection.isTaxFree ? 'Tax-free' : `$${projection.grossTaxBomb.toLocaleString()}`
  };
}

/**
 * Validates the core business rule:
 * "Your monthly payments will cover the cost of your loan" message MUST NOT show
 * when current payment is less than estimated payment / cannot cover the loan
 * and there is no savings account that would cover the tax bomb.
 * 
 * If the calculation of the current payment cannot cover the cost of the loan,
 * any claim that the loan is covered or that tax savings are "Not applicable" FAILS the test case.
 */
export function validateLoanCoverageAndTaxBombRule(
  overview: AppOverviewDisplay,
  params: LoanParameters
): { passed: boolean; violations: string[] } {
  const projection = evaluateLoanProjection(params);
  const violations: string[] = [];

  // Check 1: Can the current payment cover the cost of the loan?
  const canCoverLoan = projection.willCoverLoan; // true only if projectedEndingBalance <= 0
  const savingsCoverTaxBomb = projection.eligibleAssets >= projection.grossTaxBomb;

  // RULE: If current payment CANNOT cover the loan AND savings do NOT cover the tax bomb:
  if (!canCoverLoan && !savingsCoverTaxBomb && !params.pursuingPslf) {
    // 1. "will cover the cost of your loan" MUST NOT SHOW
    if (overview.headline.toLowerCase().includes('cover the cost of your loan')) {
      if (projection.isNegativeAmortization) {
        violations.push(
          `FAIL: "Your monthly payments will cover the cost of your loan" message is displayed, but current payment ($${params.currentPayment}/mo) cannot cover monthly interest ($${projection.monthlyInterest.toFixed(2)}/mo; shortfall of $${projection.monthlyShortfall.toFixed(2)}/mo). Ending balance balloons to $${projection.projectedEndingBalance.toLocaleString()}.`
        );
      } else {
        violations.push(
          `FAIL: "Your monthly payments will cover the cost of your loan" message is displayed, but current payment ($${params.currentPayment}/mo) cannot amortize the loan over the ${projection.termMonths}-month term. An unpaid balance of $${projection.projectedEndingBalance.toLocaleString()} will be forgiven with an estimated tax bomb of $${projection.grossTaxBomb.toLocaleString()}.`
        );
      }
    }

    // 2. Tax savings goal MUST NOT be "Not applicable"
    if (overview.taxSavingsGoal.toLowerCase() === 'not applicable') {
      violations.push(
        `FAIL: Tax savings goal is marked "Not applicable", but non-PSLF loan has $${projection.projectedForgivenBalance.toLocaleString()} in projected forgiven debt with an estimated tax liability of $${projection.grossTaxBomb.toLocaleString()} and eligible savings ($${projection.eligibleAssets.toLocaleString()}) do not cover the liability (unfunded shortfall: $${projection.netTaxBombShortfall.toLocaleString()}).`
      );
    }

    // 3. Misleading "This is good!" banner for underpayment
    if (overview.paymentBanner.toLowerCase().includes('this is good')) {
      violations.push(
        `FAIL: Overview displays "You are paying less than we estimated. This is good!" when underpaying increases the total repayment timeline, unpaid interest, and resulting tax bomb.`
      );
    }
  }

  return {
    passed: violations.length === 0,
    violations
  };
}
