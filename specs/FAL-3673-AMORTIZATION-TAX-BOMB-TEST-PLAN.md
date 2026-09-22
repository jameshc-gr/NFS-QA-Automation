# Test Plan: Loan Amortization, Interest Coverage & Tax Bomb Validity

**Jira Reference:** [FAL-3673: Overview incorrectly states that a $10 monthly payment will cover a $75,000 loan at 9% APR est payment of $634](https://rate.atlassian.net/browse/FAL-3673)  
**Component:** Rate Wealth / Student IDR Overview & Personal Data Calculations  
**Document Version:** 1.0.0  
**Date:** 2026-09-21  
**Target Module:** Loan Amortization Projections, Payment vs. Interest Evaluation, Asset Tax Bomb Offsets, and Repayment Plan Duration Engines  
**Applicability:** Playwright E2E UI Suite, Calculation Engine Verification, Regression Matrix  

---

## 1. Executive Summary & Defect Investigation

### 1.1 Defect Summary (FAL-3673)
On the Student IDR / Rate Wealth dashboard, a user entered:
- **Loan Balance:** $\$75,000$ at **9.00% APR**
- **AGI:** $\$100,000$ (resulting in an estimated IDR payment of $\$634/\text{mo}$)
- **Current Monthly Payment:** $\$10/\text{mo}$
- **Repayment Plan:** IBR for New Borrowers / PAYE (20-year / 240-month forgiveness)
- **Pursuing PSLF:** No

#### Actual Erroneous Behavior in Overview:
1. **“You are paying less than we estimated. This is good!”**
2. **“Your monthly payments will cover the cost of your loan.”**
3. **Tax savings goal:** Marked as **“Not applicable”**
4. **Estimated projected total savings:** Marked as **“Tax-free”**

### 1.2 Mathematical Proof of Failure
1. **Monthly Interest Accrual:**
   $$I_{\text{monthly}} = \text{Loan Balance} \times \frac{\text{APR}}{12} = \$75,000 \times \frac{0.09}{12} = \$562.50/\text{month}$$
2. **Payment Shortfall (Negative Amortization):**
   $$\text{Monthly Shortfall} = I_{\text{monthly}} - P_{\text{current}} = \$562.50 - \$10.00 = -\$552.50/\text{month}$$
3. **Unpaid Accrued Interest over 20 Years (240 months):**
   $$\text{Simple Shortfall Total} = 240 \times \$552.50 = \$132,600$$
   $$\text{Projected Ending Balance at Forgiveness} = \$75,000 + \$132,600 = \$207,600 \text{ (over } \$300,000 \text{ with monthly compounding)}$$
4. **Projected Tax Bomb (at 35% Federal Tax Rate):**
   $$\text{Gross Tax Bomb} = \$207,600 \times 35\% = \$72,660 \text{ (up to } \$105,000+\text{)}$$
5. **Monthly Sinking Fund Savings Required:**
   $$\text{Monthly Savings} = \frac{\$72,660}{223.28 \text{ (annuity factor)}} \approx \$325.42/\text{month}$$

### 1.3 Identified Root Causes
1. **Flawed Payment Comparison Heuristic:**
   The UI evaluates `currentPayment < estimatedPayment` and unconditionally emits a congratulatory banner (*"You are paying less than we estimated. This is good!"*), ignoring that paying less than monthly interest triggers ballooning debt.
2. **Wrong Variable Used for Amortization / Payoff:**
   The payoff engine either:
   - Used the calculated IDR payment ($\$634/\text{mo}$, which covers interest by $\$71.50$) instead of the user's entered current payment ($\$10/\text{mo}$), OR
   - Assumed any payment lower than servicer estimates qualifies for tax-free loan payoff.
3. **False "Not Applicable" for Tax Bomb Savings:**
   The tax bomb was marked "Not applicable" because the engine erroneously flagged the remaining loan balance as $\$0$, rather than recognizing that non-PSLF forgiveness of $\$200k+$ carries substantial tax liability.

---

## 2. Core Calculation Rules & Required Logic

### 2.1 Loan Interest & Amortization Classification
For any loan with balance $B$, annual rate $r$, and monthly payment $P$:
- Monthly interest: $I = B \times \frac{r}{12}$
- **Case A: Negative Amortization ($P < I$)**
  - Unpaid interest accrues every month.
  - Loan balance **increases**.
  - Loan **cannot** be paid off by term end.
  - Message must state: **"Payment does not cover monthly interest ($I). Balance is increasing."**
  - Must **never** state *"Payments will cover the cost of your loan"* or *"This is good!"*.
- **Case B: Partial Principal Amortization ($I \le P < P_{\text{amortize\_to\_term}}$)**
  - Payment covers interest and slowly pays down principal.
  - Balance decreases, but a remaining balance persists at term end and is forgiven under IDR.
  - Tax bomb applies to the forgiven balance.
- **Case C: Full Amortization ($P \ge P_{\text{amortize\_to\_term}}$)**
  - Balance reaches $\$0$ before or at term end.
  - No loan forgiveness occurs; tax bomb is genuinely $\$0$ ("Not applicable" / "Fully paid off").

### 2.2 Tax Bomb & Asset Offset Formula
$$\text{Gross Tax Bomb} = \max(0, \text{Projected Balance at Forgiveness}) \times \text{Tax Rate (35\%)}$$
$$\text{Eligible Tax Bomb Assets} = \sum \text{Assets where } \text{IncludeInTaxBomb} = \text{true}$$
$$\text{Net Tax Bomb Shortfall} = \max(0, \text{Gross Tax Bomb} - \text{Eligible Tax Bomb Assets})$$
$$\text{Monthly Tax Savings Goal} = \begin{cases} 
0 & \text{if Net Tax Bomb } = 0 \text{ or PSLF } = \text{true} \\
\frac{\text{Net Tax Bomb}}{\text{Annuity Factor (223.28)}} & \text{otherwise}
\end{cases}$$

### 2.3 Repayment Plan Duration & Taxability Matrix

| Repayment Plan | Term (Months) | Discretionary % | Payment Cap | Forgiveness Taxable? | Tax Bomb Condition |
|---|:---:|:---:|:---:|:---:|---|
| **IBR for New Borrowers** | 240 (20 yrs) | 10% | Standard 10-yr payment | **Yes (Taxable)** | If ending balance $> 0$, Tax Bomb = $35\% \times \text{Balance}$ |
| **PAYE** | 240 (20 yrs) | 10% | Standard 10-yr payment | **Yes (Taxable)** | If ending balance $> 0$, Tax Bomb = $35\% \times \text{Balance}$ |
| **IBR for Old Borrowers** | 300 (25 yrs) | 15% | Standard 10-yr payment | **Yes (Taxable)** | 60 extra compounding months; higher tax bomb |
| **ICR** | 300 (25 yrs) | 20% | 12-yr income-adjusted | **Yes (Taxable)** | 300 months amortization |
| **PSLF (Public Service)** | 120 (10 yrs) | Based on plan | Standard 10-yr payment | **NO (TAX-FREE)** | IRC § 108(f): Tax Bomb = $\$0$; Savings = "Not applicable" |
| **Standard 10-Year** | 120 (10 yrs) | N/A | Fixed amortization | **N/A (Paid in Full)** | Ending balance = $\$0$; Tax Bomb = $\$0$ |

---

## 3. Comprehensive Test Scenarios Matrix (22 Robust Test Cases)

### Group 1: Severe Underpayment & Negative Amortization ($P < I$)
- **TC-FAL-001 (FAL-3673 Bug Reproduction):** $75k balance, 9% APR, $10 payment vs $634 est payment. Shortfall = $552.50/mo. Balance balloons to $444k. App claim of "will cover loan" **FAILS**.
- **TC-FAL-002 (Zero Payment Floor):** $75k balance, 9% APR, $0 payment. Shortfall = $562.50/mo. App claim of "will cover loan" **FAILS**.
- **TC-FAL-003 (Initial State from Ticket):** $75k balance, 9% APR, $350 payment. Shortfall = $212.50/mo. App claim of "will cover loan" **FAILS**.
- **TC-FAL-004 (Token Payment on High Debt):** $100k balance, 8% APR, $25 payment. Shortfall = $641.67/mo. Balance balloons past $475k. App claim of "will cover loan" **FAILS**.
- **TC-FAL-005 (Severe Debt Shortfall):** $150k balance, 7.5% APR, $50 payment. Shortfall = $887.50/mo. Balance balloons to $641k. App claim of "will cover loan" **FAILS**.
- **TC-FAL-006 (Substantial Payment Under Interest):** $120k balance, 8% APR, $400 payment. Shortfall = $400/mo. Balance balloons to $355k. App claim of "will cover loan" **FAILS**.
- **TC-FAL-007 (Moderate Loan Underpayment):** $50k balance, 6.8% APR, $150 payment. Shortfall = $133.33/mo. Balance balloons to $117k. App claim of "will cover loan" **FAILS**.

### Group 2: Payment Covers Interest but Fails Full Amortization ($I \le P < P_{\text{amortize}}$)
- **TC-FAL-008 (Payment Exceeds Interest but Leaves $65k Debt):** $75k balance, 9% APR, $600 payment. Covers $562.50 interest by $37.50, but pays down only ~$9k principal over 240 months. Ending balance = $49.9k with $17.5k tax bomb. Claiming loan is covered **FAILS**.
- **TC-FAL-009 (Slight Principal Paydown on $80k Loan):** $80k balance, 6% APR, $450 payment. Covers $400 interest, but leaves $56.8k balance at 240 months with $19.9k tax bomb. Claiming loan is covered **FAILS**.
- **TC-FAL-010 (Below Estimated IDR Payment):** $60k balance, 7% APR, $200 payment (Est IDR $450). Shortfall = $150/mo. Ending balance balloons to $138k. Claiming loan is covered **FAILS**.

### Group 3: Partial or Excluded Savings Shortfalls
- **TC-FAL-011 (Inadequate Savings Offset):** $75k balance, 9% APR, $10 payment with $10k savings. Tax bomb is $155.4k; unfunded shortfall is $145.4k. Marking tax savings "Not applicable" **FAILS**.
- **TC-FAL-012 (Moderate Debt Partial Savings):** $90k balance, 6.5% APR, $200 payment with $20k savings. Tax bomb is $80.8k; unfunded shortfall is $60.8k. Marking tax savings "Not applicable" **FAILS**.
- **TC-FAL-013 (Excluded Asset Account):** $75k balance, 9% APR, $10 payment with $50k asset unchecked (`eligibleAssets = 0`). Full $155.4k tax bomb remains. Marking tax savings "Not applicable" **FAILS**.

### Group 4: Extended Duration Plans Underpayment
- **TC-FAL-014 (IBR Old 300 Months):** $100k balance, 8% APR, $300 payment. 300 months of compounding balloons balance to $448k with $157k tax bomb. Claiming loan is covered **FAILS**.
- **TC-FAL-015 (ICR 300 Months):** $80k balance, 7.5% APR, $250 payment. 300 months of compounding balloons balance to $299k with $104k tax bomb. Claiming loan is covered **FAILS**.
- **TC-FAL-016 (Dynamic Payment Drop in Personal Data):** Changing payment from $350 -> $10 instantly recalculates to ballooning debt. Claiming loan is covered **FAILS**.

### Group 5: Legitimate Payoff & Exemption Benchmarks (Truly Pass)
- **TC-FAL-017 (Exact Interest Breakeven):** $75k balance, 9% APR, $562.50 payment keeps balance flat at $75k. Tax bomb = $26,250. **PASSES**.
- **TC-FAL-018 (Estimated IDR Payment):** $75k balance, 9% APR, $634 payment slowly reduces principal to $27.2k. **PASSES**.
- **TC-FAL-019 (Standard 10-Year Amortization):** $75k balance, 9% APR, $950.04 payment genuinely pays off loan in full ($0 balance). **PASSES**.
- **TC-FAL-020 (Accelerated Payoff):** $75k balance, 9% APR, $1,000 payment pays off loan early. **PASSES**.
- **TC-FAL-021 (Surplus Assets Offset):** $200,000 in eligible liquid assets genuinely funds the $155.4k tax bomb ($0 shortfall). **PASSES**.
- **TC-FAL-022 (PSLF 120 Months):** 10-year term, statutory 100% tax-free forgiveness under IRC § 108(f). **PASSES**.

---

## 4. Test Acceptance & Exit Criteria

1. **Strict Business Rule Enforcement:** Whenever $\text{Monthly Payment} < \text{Estimated IDR Payment}$ (or cannot cover monthly interest and does not amortize the loan) AND eligible savings do not cover the tax bomb, the system **MUST NOT** show *"Your monthly payments will cover the cost of your loan"* or mark tax savings as *"Not applicable"*.
2. **Defect Failure Expectation:** If the application or overview display asserts that payments cover the loan under this underpayment condition (as reported in FAL-3673), **the test case MUST FAIL**.
3. **Contextual Messaging:** Disables the *"This is good!"* label when a lower payment increases total interest and forgiveness tax bomb.
4. **Tax Savings Goal Accuracy:** Only displays *"Not applicable"* or *"Tax-free"* if PSLF is attested or ending balance is strictly $\$0$.
5. **Reactive Consistency:** Any change to Current Monthly Payment, Asset Balances, or Repayment Plan immediately recalculates Overview and Scenarios without requiring a page refresh.
