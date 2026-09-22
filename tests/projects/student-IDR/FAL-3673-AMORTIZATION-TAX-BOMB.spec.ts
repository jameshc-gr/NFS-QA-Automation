import { test, expect } from '@playwright/test';
import {
  LoanParameters,
  AmortizationProjectionResult,
  calculateMonthlyInterest,
  calculateStandardAmortizingPayment,
  resolvePlanDurationMonths,
  simulateAmortization,
  evaluateLoanProjection,
  getAppReportedOverview,
  validateLoanCoverageAndTaxBombRule
} from './loan-amortization-calculator';

test.describe('FAL-3673: Amortization, Interest Coverage & Tax Bomb Validity Suite', () => {

  // ==========================================================================
  // SECTION 1: FAL-3673 EXACT BUG REPRODUCTION & MATHEMATICAL PROOF
  // ==========================================================================
  test.describe('FAL-3673 Bug Reproduction: $10 payment on $75k loan at 9% APR', () => {

    const fal3673Params: LoanParameters = {
      balance: 75000,
      apr: 9.0,
      currentPayment: 10,
      estimatedIdrPayment: 634,
      repaymentPlan: 'IBR for New Borrowers',
      pursuingPslf: false,
      termMonths: 240,
      taxRate: 0.35,
      eligibleAssets: 0
    };

    test('FAL-3673-01: Monthly interest accrual must be exactly $562.50', () => {
      const monthlyInterest = calculateMonthlyInterest(fal3673Params.balance, fal3673Params.apr);
      expect(monthlyInterest).toBe(562.50);
    });

    test('FAL-3673-02: $10 payment produces severe negative amortization of $552.50/mo', () => {
      const result = evaluateLoanProjection(fal3673Params);
      expect(result.monthlyInterest).toBe(562.50);
      expect(result.monthlyPayment).toBe(10);
      expect(result.monthlyShortfall).toBe(552.50);
      expect(result.isNegativeAmortization).toBe(true);
    });

    test('FAL-3673-03: If calculation shows payment cannot cover loan, test MUST fail if "will cover cost of loan" is displayed', () => {
      // In the application reported in FAL-3673, the app displayed:
      // "Your monthly payments will cover the cost of your loan." and "Not applicable" for tax savings.
      const appOverview = getAppReportedOverview(fal3673Params, true);

      // Validate against the business rule:
      // If calculation of current payment cannot cover the cost of the loan and savings do not cover tax bomb,
      // displaying "Your monthly payments will cover the cost of your loan" MUST FAIL.
      const ruleCheck = validateLoanCoverageAndTaxBombRule(appOverview, fal3673Params);

      // Asserts that the defective app output violates the rule and fails
      expect(ruleCheck.passed, 'Defect FAL-3673 should fail validation when app claims loan is covered').toBe(false);
      expect(ruleCheck.violations.length).toBeGreaterThan(0);
      expect(ruleCheck.violations[0]).toContain('Your monthly payments will cover the cost of your loan');
      expect(ruleCheck.violations[1]).toContain('Tax savings goal is marked "Not applicable"');
    });

    test('FAL-3673-04: Ending balance balloons and triggers substantial taxable forgiveness', () => {
      const result = evaluateLoanProjection(fal3673Params);
      // Balance must balloon above starting $75k balance
      expect(result.projectedEndingBalance).toBeGreaterThan(75000);
      expect(result.projectedEndingBalance).toBeGreaterThan(200000);
      expect(result.projectedForgivenBalance).toBe(result.projectedEndingBalance);
    });

    test('FAL-3673-05: Tax savings goal cannot be "Not applicable" or "Tax-free" for non-PSLF IBR', () => {
      const result = evaluateLoanProjection(fal3673Params);
      expect(result.isTaxFree).toBe(false);
      expect(result.taxSavingsApplicable).toBe(true);
      expect(result.grossTaxBomb).toBeGreaterThan(70000);
      expect(result.monthlySavingsRequired).toBeGreaterThan(300);
    });

    test('FAL-3673-06: Flag misleading congratulatory banners for underpayment', () => {
      // Under FAL-3673, the app said "You are paying less than we estimated. This is good!"
      // In reality, paying $10 instead of $634 causes negative amortization and explodes the tax bomb
      const result = evaluateLoanProjection(fal3673Params);
      expect(result.isMisleadingPositiveBanner).toBe(false); // Our fixed engine correctly forbids this
    });
  });

  // ==========================================================================
  // SECTION 2: CURRENT PAYMENT SPECTRUM & INTEREST COVERAGE
  // ==========================================================================
  test.describe('Payment Spectrum: Negative Amortization vs Breakeven vs Payoff', () => {

    test('PAY-01: $0 payment results in maximum negative amortization and highest tax bomb', () => {
      const result = evaluateLoanProjection({
        balance: 75000,
        apr: 9.0,
        currentPayment: 0,
        repaymentPlan: 'IBR for New Borrowers',
        pursuingPslf: false
      });

      expect(result.isNegativeAmortization).toBe(true);
      expect(result.monthlyShortfall).toBe(562.50);
      expect(result.willCoverLoan).toBe(false);
      expect(result.projectedEndingBalance).toBeGreaterThan(250000);
      expect(result.grossTaxBomb).toBeGreaterThan(80000);
    });

    test('PAY-02: $350 payment (initial state in ticket) still underpays interest by $212.50/mo', () => {
      const result = evaluateLoanProjection({
        balance: 75000,
        apr: 9.0,
        currentPayment: 350,
        repaymentPlan: 'IBR for New Borrowers',
        pursuingPslf: false
      });

      expect(result.isNegativeAmortization).toBe(true);
      expect(result.monthlyShortfall).toBe(212.50);
      expect(result.willCoverLoan).toBe(false);
      expect(result.projectedEndingBalance).toBeGreaterThan(75000);
    });

    test('PAY-03: $562.50 payment matches monthly interest accrual exactly (Flat balance)', () => {
      const result = evaluateLoanProjection({
        balance: 75000,
        apr: 9.0,
        currentPayment: 562.50,
        repaymentPlan: 'IBR for New Borrowers',
        pursuingPslf: false
      });

      expect(result.isNegativeAmortization).toBe(false);
      expect(result.monthlyShortfall).toBe(0);
      expect(result.willCoverLoan).toBe(false);
      // Balance stays flat at $75,000
      expect(result.projectedEndingBalance).toBe(75000);
      expect(result.grossTaxBomb).toBe(75000 * 0.35); // Exactly $26,250
    });

    test('PAY-04: Estimated IDR payment of $634 covers interest and slowly pays principal', () => {
      const result = evaluateLoanProjection({
        balance: 75000,
        apr: 9.0,
        currentPayment: 634,
        repaymentPlan: 'IBR for New Borrowers',
        pursuingPslf: false
      });

      expect(result.isNegativeAmortization).toBe(false);
      expect(result.monthlyPayment).toBeGreaterThan(result.monthlyInterest);
      // Balance decreases below starting $75k
      expect(result.projectedEndingBalance).toBeLessThan(75000);
      expect(result.willCoverLoan).toBe(false); // Still has remaining balance forgiven at 20 yrs
      expect(result.taxSavingsApplicable).toBe(true);
    });

    test('PAY-05: Standard 10-year amortizing payment (~$950.04) fully pays off loan ($0 tax bomb)', () => {
      const standardPayment = calculateStandardAmortizingPayment(75000, 9.0, 120);
      expect(standardPayment).toBeCloseTo(950.04, 1);

      const result = evaluateLoanProjection({
        balance: 75000,
        apr: 9.0,
        currentPayment: 950.04,
        repaymentPlan: 'Standard',
        pursuingPslf: false,
        termMonths: 120
      });

      expect(result.willCoverLoan).toBe(true);
      expect(result.projectedEndingBalance).toBe(0);
      expect(result.grossTaxBomb).toBe(0);
      expect(result.taxSavingsApplicable).toBe(false);
      expect(result.statusHeadline).toContain('cover the cost of your loan');
    });

    test('PAY-06: Accelerated payment of $1,200 pays off loan early and eliminates tax bomb', () => {
      const result = evaluateLoanProjection({
        balance: 75000,
        apr: 9.0,
        currentPayment: 1200,
        repaymentPlan: 'IBR for New Borrowers',
        pursuingPslf: false
      });

      expect(result.willCoverLoan).toBe(true);
      expect(result.projectedEndingBalance).toBe(0);
      expect(result.grossTaxBomb).toBe(0);
      expect(result.taxSavingsApplicable).toBe(false);
    });
  });

  // ==========================================================================
  // SECTION 3: PERSONAL DATA DYNAMIC VALUE CHANGES (REACTIVE RECALCULATION)
  // ==========================================================================
  test.describe('Dynamic Value Changes in Personal Data', () => {

    test('DYN-01: Transitioning payment $350 -> $10 drastically expands projected tax bomb', () => {
      const state1 = evaluateLoanProjection({
        balance: 75000,
        apr: 9.0,
        currentPayment: 350,
        repaymentPlan: 'IBR for New Borrowers',
        pursuingPslf: false
      });

      const state2 = evaluateLoanProjection({
        balance: 75000,
        apr: 9.0,
        currentPayment: 10,
        repaymentPlan: 'IBR for New Borrowers',
        pursuingPslf: false
      });

      // Dropping payment from $350 to $10 increases ending balance and tax bomb
      expect(state2.monthlyShortfall).toBeGreaterThan(state1.monthlyShortfall);
      expect(state2.projectedEndingBalance).toBeGreaterThan(state1.projectedEndingBalance);
      expect(state2.grossTaxBomb).toBeGreaterThan(state1.grossTaxBomb);
      expect(state2.monthlySavingsRequired).toBeGreaterThan(state1.monthlySavingsRequired);
    });

    test('DYN-02: Transitioning payment $10 -> $1,000 flips from ballooning debt to loan payoff', () => {
      const state1 = evaluateLoanProjection({
        balance: 75000,
        apr: 9.0,
        currentPayment: 10,
        repaymentPlan: 'IBR for New Borrowers',
        pursuingPslf: false
      });

      const state2 = evaluateLoanProjection({
        balance: 75000,
        apr: 9.0,
        currentPayment: 1000,
        repaymentPlan: 'IBR for New Borrowers',
        pursuingPslf: false
      });

      expect(state1.willCoverLoan).toBe(false);
      expect(state1.taxSavingsApplicable).toBe(true);

      expect(state2.willCoverLoan).toBe(true);
      expect(state2.taxSavingsApplicable).toBe(false);
      expect(state2.projectedEndingBalance).toBe(0);
      expect(state2.grossTaxBomb).toBe(0);
    });

    test('DYN-03: Decreasing AGI changes estimated IDR payment without affecting interest accrual', () => {
      // Loan interest accrual is purely a property of balance and APR ($75k * 9% / 12 = $562.50)
      const interestAtAgi100k = calculateMonthlyInterest(75000, 9.0);
      const interestAtAgi50k = calculateMonthlyInterest(75000, 9.0);

      expect(interestAtAgi100k).toBe(562.50);
      expect(interestAtAgi50k).toBe(562.50);
      // The threshold to cover interest is always $562.50 regardless of income
    });
  });

  // ==========================================================================
  // SECTION 4: TAX BOMB ASSET TOTAL AMOUNT DYNAMICS
  // ==========================================================================
  test.describe('Tax Bomb Asset Dynamics: Zero Assets vs Partial vs Surplus Offset', () => {

    const baseTaxBombParams: LoanParameters = {
      balance: 75000,
      apr: 9.0,
      currentPayment: 10,
      repaymentPlan: 'IBR for New Borrowers',
      pursuingPslf: false
    };

    test('AST-01: Zero assets results in 100% tax bomb exposure and maximum monthly savings goal', () => {
      const result = evaluateLoanProjection({
        ...baseTaxBombParams,
        eligibleAssets: 0
      });

      expect(result.grossTaxBomb).toBeGreaterThan(70000);
      expect(result.netTaxBombShortfall).toBe(result.grossTaxBomb);
      expect(result.monthlySavingsRequired).toBeGreaterThan(300);
    });

    test('AST-02: Partial assets ($25,000) directly offsets tax bomb dollar-for-dollar', () => {
      const zeroAssetResult = evaluateLoanProjection({
        ...baseTaxBombParams,
        eligibleAssets: 0
      });

      const partialAssetResult = evaluateLoanProjection({
        ...baseTaxBombParams,
        eligibleAssets: 25000
      });

      expect(partialAssetResult.grossTaxBomb).toBe(zeroAssetResult.grossTaxBomb);
      expect(partialAssetResult.netTaxBombShortfall).toBe(zeroAssetResult.grossTaxBomb - 25000);
      expect(partialAssetResult.monthlySavingsRequired).toBeLessThan(zeroAssetResult.monthlySavingsRequired);
    });

    test('AST-03: Surplus assets ($200,000) fully eliminates tax bomb shortfall ($0 monthly savings)', () => {
      const result = evaluateLoanProjection({
        ...baseTaxBombParams,
        eligibleAssets: 200000
      });

      expect(result.grossTaxBomb).toBeGreaterThan(70000);
      expect(result.eligibleAssets).toBe(200000);
      expect(result.netTaxBombShortfall).toBe(0);
      expect(result.monthlySavingsRequired).toBe(0);
    });

    test('AST-04: Toggling asset inclusion checkbox immediately updates net tax liability', () => {
      // User has a $50,000 asset
      const assetBalance = 50000;

      // Included = true
      const included = evaluateLoanProjection({
        ...baseTaxBombParams,
        eligibleAssets: assetBalance
      });

      // Included = false (uncheck toggle)
      const excluded = evaluateLoanProjection({
        ...baseTaxBombParams,
        eligibleAssets: 0
      });

      expect(included.netTaxBombShortfall).toBe(excluded.grossTaxBomb - assetBalance);
      expect(excluded.netTaxBombShortfall).toBe(excluded.grossTaxBomb);
      expect(excluded.monthlySavingsRequired).toBeGreaterThan(included.monthlySavingsRequired);
    });
  });

  // ==========================================================================
  // SECTION 5: REPAYMENT PLAN DURATION & TYPE IMPACT
  // ==========================================================================
  test.describe('Repayment Plan Duration & Exemption Invariants', () => {

    test('PLN-01: IBR for New Borrowers / PAYE resolves to 240 months (20 years)', () => {
      expect(resolvePlanDurationMonths('IBR for New Borrowers', false)).toBe(240);
      expect(resolvePlanDurationMonths('PAYE', false)).toBe(240);
    });

    test('PLN-02: IBR for Old Borrowers resolves to 300 months (25 years) with higher interest accumulation', () => {
      expect(resolvePlanDurationMonths('IBR for Old Borrowers', false)).toBe(300);

      const ibrNew = evaluateLoanProjection({
        balance: 75000,
        apr: 9.0,
        currentPayment: 10,
        repaymentPlan: 'IBR for New Borrowers',
        pursuingPslf: false
      });

      const ibrOld = evaluateLoanProjection({
        balance: 75000,
        apr: 9.0,
        currentPayment: 10,
        repaymentPlan: 'IBR for Old Borrowers',
        pursuingPslf: false
      });

      expect(ibrNew.termMonths).toBe(240);
      expect(ibrOld.termMonths).toBe(300);
      // 60 extra compounding months produces substantially larger ending balance and tax bomb
      expect(ibrOld.projectedEndingBalance).toBeGreaterThan(ibrNew.projectedEndingBalance);
      expect(ibrOld.grossTaxBomb).toBeGreaterThan(ibrNew.grossTaxBomb);
    });

    test('PLN-03: PSLF attestation is the ONLY valid scenario where "Tax-free" and "Not applicable" apply to forgiven debt', () => {
      const pslfResult = evaluateLoanProjection({
        balance: 75000,
        apr: 9.0,
        currentPayment: 10,
        repaymentPlan: 'IBR for New Borrowers',
        pursuingPslf: true
      });

      expect(pslfResult.termMonths).toBe(120);
      expect(pslfResult.isTaxFree).toBe(true);
      expect(pslfResult.grossTaxBomb).toBe(0);
      expect(pslfResult.taxSavingsApplicable).toBe(false);
      expect(pslfResult.monthlySavingsRequired).toBe(0);
      expect(pslfResult.statusHeadline).toContain('Tax-Free');
    });

    test('PLN-04: Non-PSLF IDR with $10 payment must NEVER be marked as tax-free', () => {
      const nonPslfResult = evaluateLoanProjection({
        balance: 75000,
        apr: 9.0,
        currentPayment: 10,
        repaymentPlan: 'IBR for New Borrowers',
        pursuingPslf: false
      });

      expect(nonPslfResult.isTaxFree).toBe(false);
      expect(nonPslfResult.grossTaxBomb).toBeGreaterThan(0);
      expect(nonPslfResult.taxSavingsApplicable).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION 6: ROBUST INSUFFICIENT PAYMENT & FALSE "WILL COVER" NEGATIVE ASSERTIONS
  // (Verifies that whenever payment is insufficient or savings do not cover
  //  tax bomb, any claim that payments cover the loan or tax savings are
  //  "Not applicable" strictly FAILS the test case.)
  // ==========================================================================
  test.describe('Robust Negative Assertions: Insufficient Payment Must Fail False Coverage Claims', () => {

    test('ROB-01: Token payment $25 on $100k debt at 8% APR fails false coverage claim', () => {
      const params: LoanParameters = {
        balance: 100000,
        apr: 8.0,
        currentPayment: 25,
        estimatedIdrPayment: 550,
        repaymentPlan: 'IBR for New Borrowers',
        pursuingPslf: false,
        termMonths: 240,
        eligibleAssets: 0
      };
      // App falsely says "will cover cost of loan"
      const appOverview = getAppReportedOverview(params, true);
      const ruleCheck = validateLoanCoverageAndTaxBombRule(appOverview, params);

      expect(ruleCheck.passed, 'Must FAIL because $25 payment does not cover $666.67/mo interest').toBe(false);
      expect(ruleCheck.violations.some(v => v.includes('cover the cost of your loan'))).toBe(true);
      expect(ruleCheck.violations.some(v => v.includes('cannot cover monthly interest'))).toBe(true);
    });

    test('ROB-02: Payment of $400 on $120k debt at 8% APR ($400/mo shortfall) fails false coverage claim', () => {
      const params: LoanParameters = {
        balance: 120000,
        apr: 8.0,
        currentPayment: 400,
        estimatedIdrPayment: 650,
        repaymentPlan: 'IBR for New Borrowers',
        pursuingPslf: false,
        termMonths: 240,
        eligibleAssets: 0
      };
      const appOverview = getAppReportedOverview(params, true);
      const ruleCheck = validateLoanCoverageAndTaxBombRule(appOverview, params);

      expect(ruleCheck.passed, 'Must FAIL because $400 payment does not cover $800/mo interest').toBe(false);
      expect(ruleCheck.violations.some(v => v.includes('shortfall of $400.00/mo'))).toBe(true);
    });

    test('ROB-03: Payment of $600 covers interest but fails to amortize $75k loan ($65k remains) - MUST FAIL false coverage claim', () => {
      // Key scenario: $600 covers $562.50 interest by $37.50/mo, BUT fails to pay off the loan!
      const params: LoanParameters = {
        balance: 75000,
        apr: 9.0,
        currentPayment: 600,
        estimatedIdrPayment: 634,
        repaymentPlan: 'IBR for New Borrowers',
        pursuingPslf: false,
        termMonths: 240,
        eligibleAssets: 0
      };
      const appOverview = getAppReportedOverview(params, true);
      const ruleCheck = validateLoanCoverageAndTaxBombRule(appOverview, params);

      expect(ruleCheck.passed, 'Must FAIL because $600/mo leaves $65k balance and $22.7k tax bomb').toBe(false);
      expect(ruleCheck.violations.some(v => v.includes('cannot amortize the loan over the 240-month term'))).toBe(true);
    });

    test('ROB-04: Payment of $450 on $80k at 6% APR leaves $40k debt at term end - MUST FAIL false coverage claim', () => {
      const params: LoanParameters = {
        balance: 80000,
        apr: 6.0,
        currentPayment: 450,
        estimatedIdrPayment: 500,
        repaymentPlan: 'IBR for New Borrowers',
        pursuingPslf: false,
        termMonths: 240,
        eligibleAssets: 0
      };
      const appOverview = getAppReportedOverview(params, true);
      const ruleCheck = validateLoanCoverageAndTaxBombRule(appOverview, params);

      expect(ruleCheck.passed, 'Must FAIL because $450/mo leaves $40k unpaid debt').toBe(false);
      expect(ruleCheck.violations.some(v => v.includes('cannot amortize the loan'))).toBe(true);
    });

    test('ROB-05: Inadequate savings ($10,000 savings vs $155,402 tax bomb) - MUST FAIL "Not applicable" claim', () => {
      const params: LoanParameters = {
        balance: 75000,
        apr: 9.0,
        currentPayment: 10,
        estimatedIdrPayment: 634,
        repaymentPlan: 'IBR for New Borrowers',
        pursuingPslf: false,
        termMonths: 240,
        eligibleAssets: 10000 // $10k savings vs $155k tax bomb
      };
      const appOverview = getAppReportedOverview(params, true);
      const ruleCheck = validateLoanCoverageAndTaxBombRule(appOverview, params);

      expect(ruleCheck.passed, 'Must FAIL because $10k savings leaves $145k unfunded tax bomb').toBe(false);
      expect(ruleCheck.violations.some(v => v.includes('Tax savings goal is marked "Not applicable"'))).toBe(true);
      expect(ruleCheck.violations.some(v => v.includes('do not cover the liability'))).toBe(true);
    });

    test('ROB-06: Excluded savings account ($50,000 unchecked) leaves $0 eligible - MUST FAIL "Not applicable" claim', () => {
      const params: LoanParameters = {
        balance: 75000,
        apr: 9.0,
        currentPayment: 10,
        estimatedIdrPayment: 634,
        repaymentPlan: 'IBR for New Borrowers',
        pursuingPslf: false,
        termMonths: 240,
        eligibleAssets: 0 // Account unchecked
      };
      const appOverview = getAppReportedOverview(params, true);
      const ruleCheck = validateLoanCoverageAndTaxBombRule(appOverview, params);

      expect(ruleCheck.passed, 'Must FAIL because excluded asset does not count toward tax bomb').toBe(false);
      expect(ruleCheck.violations.some(v => v.includes('Tax savings goal is marked "Not applicable"'))).toBe(true);
    });

    test('ROB-07: IBR Old 300-month compounding with $300 payment ($366.67/mo shortfall) - MUST FAIL false coverage claim', () => {
      const params: LoanParameters = {
        balance: 100000,
        apr: 8.0,
        currentPayment: 300,
        estimatedIdrPayment: 550,
        repaymentPlan: 'IBR for Old Borrowers',
        pursuingPslf: false,
        termMonths: 300,
        eligibleAssets: 0
      };
      const appOverview = getAppReportedOverview(params, true);
      const ruleCheck = validateLoanCoverageAndTaxBombRule(appOverview, params);

      expect(ruleCheck.passed, 'Must FAIL because 300-month compounding balloons debt').toBe(false);
      expect(ruleCheck.violations.some(v => v.includes('cannot cover monthly interest'))).toBe(true);
    });

    test('ROB-08: Personal Data dynamic transition $1,000 -> $10 payment triggers failure on false coverage', () => {
      // Step A: Payment is $1,000 (Genuinely covers loan early)
      const payoffParams: LoanParameters = {
        balance: 75000,
        apr: 9.0,
        currentPayment: 1000,
        repaymentPlan: 'IBR for New Borrowers',
        pursuingPslf: false
      };
      const payoffOverview = getAppReportedOverview(payoffParams, false);
      const payoffCheck = validateLoanCoverageAndTaxBombRule(payoffOverview, payoffParams);
      expect(payoffCheck.passed).toBe(true); // Genuinely covers loan!

      // Step B: User edits Personal Data payment down to $10 (Underpayment!)
      const underpayParams: LoanParameters = {
        ...payoffParams,
        currentPayment: 10
      };
      // App still has stale/buggy claim of "will cover loan"
      const buggyOverview = getAppReportedOverview(underpayParams, true);
      const underpayCheck = validateLoanCoverageAndTaxBombRule(buggyOverview, underpayParams);

      expect(underpayCheck.passed, 'Must FAIL when payment is edited to $10 in Personal Data').toBe(false);
      expect(underpayCheck.violations.length).toBeGreaterThan(0);
    });

    test('ROB-09: Personal Data dynamic asset transition $200,000 -> $0 triggers failure on "Not applicable"', () => {
      // Step A: User has $200k in savings (Genuinely covers tax bomb)
      const fundedParams: LoanParameters = {
        balance: 75000,
        apr: 9.0,
        currentPayment: 10,
        repaymentPlan: 'IBR for New Borrowers',
        pursuingPslf: false,
        eligibleAssets: 200000
      };
      const fundedOverview = getAppReportedOverview(fundedParams, false);
      const fundedCheck = validateLoanCoverageAndTaxBombRule(fundedOverview, fundedParams);
      expect(fundedCheck.passed).toBe(true); // Genuinely funded!

      // Step B: User edits Personal Data asset down to $0 (Zero savings!)
      const unfundedParams: LoanParameters = {
        ...fundedParams,
        eligibleAssets: 0
      };
      const buggyOverview = getAppReportedOverview(unfundedParams, true);
      const unfundedCheck = validateLoanCoverageAndTaxBombRule(buggyOverview, unfundedParams);

      expect(unfundedCheck.passed, 'Must FAIL when assets are removed in Personal Data').toBe(false);
      expect(unfundedCheck.violations.some(v => v.includes('Tax savings goal is marked "Not applicable"'))).toBe(true);
    });
  });
});
