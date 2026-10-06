# Student IDR - Filing Status, Household Size & State Calculation Test Plan & Test Cases

**Document Version:** 1.0.0  
**Date:** 2026-09-21  
**Target Module:** Student Loan IDR Repayment & Tax Bomb Calculation Engine  
**Source Reference:** Historical input path `test-data/student-IDR/test_cases_automation.csv` (absent from this checkout)
**Applicability:** Local calculation verification only; this plan does not represent live UI coverage

---

## 1. Executive Summary & Purpose

The purpose of this test plan is to establish a rigorous, automated verification framework for the **Student Loan Income-Driven Repayment (IDR)** calculations. Specifically, the suite validates 50 comprehensive scenarios covering:
- Filing statuses: Married Filing Separately vs. Married Filing Jointly
- Dependent counts ranging from 0 to 5 dependents
- Geographic variations: Contiguous US states (WA, CA, OR), Alaska (AK), and Hawaii (HI)
- Income brackets: Low ($15k–$30k), Median ($40k–$60k), High ($75k–$80k)
- Calculation boundaries: Discretionary income floor ($0 payment minimum), tax bomb estimations at 35% tax rate, and monthly savings requirements based on a 156-month (13-year) forgiveness timeline at 5% annual interest.

---

## 2. Calculation Rules & Verification Formulas

### 2.1 Household Size Logic

| Filing Status | Household Size Formula | Notes |
|---|---|---|
| **Separately** | $\text{Household Size}_{\text{Borrower}} = 1 + \lfloor \frac{\text{Dependents}}{2} \rfloor$ | Dependents are assumed split evenly between spouses for separate returns. In baseline scenarios with 0–5 dependents, individual borrower base is 1. |
| **Jointly** | $\text{Household Size}_{\text{Joint}} = 2 + \text{Dependents}$ | Both spouses are included in the household count plus all claimed dependents. |

---

### 2.2 150% Federal Poverty Line (FPL) Lookup Tables

The statutory discretionary income threshold deduction corresponds to 150% of the Federal Poverty Line based on household size and state of residence:

| Household Size | Contiguous US (WA, CA, OR, etc.) | Alaska (AK) | Hawaii (HI) |
|:---:|:---:|:---:|:---:|
| **1** | $23,940 | $29,925 | $27,540 |
| **2** | $32,460 | $40,575 | $37,335 |
| **3** | $40,980 | $51,225 | $47,130 |
| **4** | $49,500 | $61,875 | $56,925 |
| **5** | $58,020 | $72,525 | $66,720 |
| **6** | $66,540 | $83,175 | $76,515 |
| **7** | $75,060 | $93,825 | $86,310 |
| **Each Additional (8+)** | +$8,520 | +$10,650 | +$9,795 |

---

### 2.3 Monthly IDR Payment Calculation

$$\text{Discretionary Income} = \max(0, \text{AGI} - \text{150\% FPL Deduction})$$
$$\text{Annual Payment} = \text{Discretionary Income} \times 10\%$$
$$\text{Monthly IDR Payment} = \frac{\text{Annual Payment}}{12}$$

**Floor Rule:** If $\text{AGI} \le \text{150\% FPL Deduction}$, the monthly IDR payment is strictly $\$0$.

---

### 2.4 Estimated Tax Bomb Calculation

$$\text{Tax Bomb} = \text{Remaining Loan Balance at Forgiveness} \times \text{Tax Rate (35\%)}$$
$$\text{Combined Tax Bomb} = \text{John Tax Bomb} + \text{Mary Tax Bomb}$$

*Behavioral Rule:* Lower monthly payment leads to less principal amortization and higher accrued balance, leading to a larger forgiveness amount and resulting tax bomb.

---

### 2.5 Monthly Tax Bomb Savings Calculation

To prepare for the tax bomb due at loan forgiveness (156 months / 13 years):
- **Simple Amortization:** $\text{Monthly Savings} = \frac{\text{Tax Bomb}}{156}$
- **Annuity Sinking Fund at 5% APR (Monthly Rate $r = \frac{0.05}{12} \approx 0.004167$):**
  $$\text{Annuity Factor} = \frac{(1 + r)^{156} - 1}{r} \approx 223.28$$
  $$\text{Monthly Savings} = \frac{\text{Tax Bomb}}{223.28}$$
$$\text{Combined Monthly Savings} = \text{John Monthly Savings} + \text{Mary Monthly Savings}$$

---

### 2.6 Acceptance Tolerances

To account for standard rounding differences in financial conversions:
- **Monthly Payments:** $\pm \$2$
- **Tax Bombs:** $\pm \$500$
- **Monthly Savings:** $\pm \$2$
- **Tax Rate:** Exact ($35\%$)
- **State / Filing Status:** Exact match

---

## 3. Test Suite Architecture & Categorization

The 50 test cases are classified into 13 test categories:

| Category ID | Verification Type | Test Cases | Objective / Test Intent |
|---|---|---|---|
| **CAT-01** | `FULL_CALC` | TC_001, TC_002 | Complete end-to-end baseline calculation for Married Filing Separately vs Jointly. |
| **CAT-02** | `HOUSEHOLD_SIZE` | TC_003 – TC_012 | Verify payment and tax bomb impact across dependent counts (0 to 5 dependents). |
| **CAT-03** | `STATE_VARIATION` | TC_013 – TC_020 | Verify regional FPL variances across Contiguous US (WA, CA, OR), Alaska (AK), and Hawaii (HI). |
| **CAT-04** | `INCOME_VARIATION` | TC_021 – TC_024 | Verify high income ($75k/$60k) and low income ($30k/$25k) scaling. |
| **CAT-05** | `FILING_STATUS` | TC_025, TC_026 | Direct comparison of Married Filing Separately vs Married Filing Jointly for identical inputs. |
| **CAT-06** | `FILING_STATUS_TOGGLE` | TC_027, TC_028 | Dynamic state recalculation when switching filing status back and forth. |
| **CAT-07** | `COMBINED` | TC_029 – TC_032 | Multi-variable variations (State + Dependents + Filing Status). |
| **CAT-08** | `EDGE_CASE` | TC_033 – TC_036 | Extreme income levels ($80k/$70k) and low income with multiple dependents ($20k/$15k + 3 deps). |
| **CAT-09** | `PAYMENT_FLOOR` | TC_037 – TC_040 | Enforcement of the $0 minimum payment threshold when income falls below 150% FPL. |
| **CAT-10** | `TAX_BOMB_CALC` | TC_041, TC_042 | Accuracy of estimated tax liability at 35% federal tax rate. |
| **CAT-11** | `TAX_BOMB_INCREASE` | TC_044, TC_044 | Inverse relationship validation: lower payments result in higher remaining balance and larger tax liability. |
| **CAT-12** | `MONTHLY_SAVINGS` / `SAVINGS_GOAL` | TC_045 – TC_048 | Mathematical validation of monthly sinking fund savings required for tax liability. |
| **CAT-13** | `FULL_REGRESSION` | TC_049, TC_050 | End-to-end multi-parameter regression (AK separate, HI joint with 5 dependents). |

---

## 4. Complete Test Case Matrix (TC_001 to TC_050)

| ID | Status | John AGI | Mary AGI | Deps | State | HH | FPL Ded | Exp John Pmt | Exp Mary Pmt | Exp Comb Pmt | Exp John TB | Exp Mary TB | Exp Comb TB | Exp John Sav | Exp Mary Sav | Exp Comb Sav | Category | Notes |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| TC_001 | Separately | $50,000 | $40,000 | 0 | WA | 1 | $23,940 | $219 | $133 | $352 | $120,000 | $60,000 | $180,000 | $410 | $310 | $720 | FULL_CALC | Base case: 0 dependents - separate filing |
| TC_002 | Jointly | $50,000 | $40,000 | 0 | WA | 2 | $32,460 | $156 | $104 | $260 | $100,000 | $50,000 | $150,000 | $370 | $250 | $620 | FULL_CALC | Base case: 0 dependents - joint filing |
| TC_003 | Separately | $50,000 | $40,000 | 1 | WA | 1 | $23,940 | $219 | $133 | $352 | $120,000 | $60,000 | $180,000 | $410 | $310 | $720 | HOUSEHOLD_SIZE | 1 dependent each |
| TC_004 | Jointly | $50,000 | $40,000 | 1 | WA | 3 | $40,980 | $80 | $40 | $120 | $140,000 | $80,000 | $220,000 | $520 | $370 | $890 | HOUSEHOLD_SIZE | 1 dependent - should decrease payments |
| TC_005 | Separately | $50,000 | $40,000 | 2 | WA | 1 | $23,940 | $219 | $133 | $352 | $120,000 | $60,000 | $180,000 | $410 | $310 | $720 | HOUSEHOLD_SIZE | 2 dependents each |
| TC_006 | Jointly | $50,000 | $40,000 | 2 | WA | 4 | $49,500 | $33 | $0 | $33 | $160,000 | $100,000 | $260,000 | $610 | $460 | $1070 | HOUSEHOLD_SIZE | 2 dependents - Mary payment may hit floor |
| TC_007 | Separately | $50,000 | $40,000 | 3 | WA | 1 | $23,940 | $219 | $133 | $352 | $120,000 | $60,000 | $180,000 | $410 | $310 | $720 | HOUSEHOLD_SIZE | 3 dependents each |
| TC_008 | Jointly | $50,000 | $40,000 | 3 | WA | 5 | $58,020 | $0 | $0 | $0 | $180,000 | $120,000 | $300,000 | $700 | $550 | $1250 | HOUSEHOLD_SIZE | 3 dependents - both may hit $0 floor |
| TC_009 | Separately | $50,000 | $40,000 | 4 | WA | 1 | $23,940 | $219 | $133 | $352 | $120,000 | $60,000 | $180,000 | $410 | $310 | $720 | HOUSEHOLD_SIZE | 4 dependents each |
| TC_010 | Jointly | $50,000 | $40,000 | 4 | WA | 6 | $66,540 | $0 | $0 | $0 | $200,000 | $140,000 | $340,000 | $800 | $650 | $1450 | HOUSEHOLD_SIZE | 4 dependents |
| TC_011 | Separately | $50,000 | $40,000 | 5 | WA | 1 | $23,940 | $219 | $133 | $352 | $120,000 | $60,000 | $180,000 | $410 | $310 | $720 | HOUSEHOLD_SIZE | 5 dependents each |
| TC_012 | Jointly | $50,000 | $40,000 | 5 | WA | 7 | $75,060 | $0 | $0 | $0 | $220,000 | $160,000 | $380,000 | $900 | $750 | $1650 | HOUSEHOLD_SIZE | 5 dependents |
| TC_013 | Separately | $50,000 | $40,000 | 0 | CA | 1 | $23,940 | $219 | $133 | $352 | $120,000 | $60,000 | $180,000 | $410 | $310 | $720 | STATE_VARIATION | California - should match WA (same FPL) |
| TC_014 | Jointly | $50,000 | $40,000 | 0 | CA | 2 | $32,460 | $156 | $104 | $260 | $100,000 | $50,000 | $150,000 | $370 | $250 | $620 | STATE_VARIATION | California joint - should match WA |
| TC_015 | Separately | $50,000 | $40,000 | 0 | OR | 1 | $23,940 | $219 | $133 | $352 | $120,000 | $60,000 | $180,000 | $410 | $310 | $720 | STATE_VARIATION | Oregon - should match WA |
| TC_016 | Jointly | $50,000 | $40,000 | 0 | OR | 2 | $32,460 | $156 | $104 | $260 | $100,000 | $50,000 | $150,000 | $370 | $250 | $620 | STATE_VARIATION | Oregon joint - should match WA |
| TC_017 | Separately | $50,000 | $40,000 | 0 | AK | 1 | $29,925 | $167 | $98 | $265 | $115000 | $57,500 | $172,500 | $395 | $295 | $690 | STATE_VARIATION | Alaska - higher FPL (should lower payments) |
| TC_018 | Jointly | $50,000 | $40,000 | 0 | AK | 2 | $40,575 | $94 | $56 | $150 | $95,000 | $47,500 | $142,500 | $355 | $215 | $570 | STATE_VARIATION | Alaska joint - significantly lower payments |
| TC_019 | Separately | $50,000 | $40,000 | 0 | HI | 1 | $27,540 | $187 | $114 | $301 | $118,000 | $59,000 | $177,000 | $405 | $305 | $710 | STATE_VARIATION | Hawaii - higher FPL than contiguous |
| TC_020 | Jointly | $50,000 | $40,000 | 0 | HI | 2 | $37,335 | $126 | $84 | $210 | $98,000 | $49,000 | $147,000 | $365 | $240 | $605 | STATE_VARIATION | Hawaii joint - lower than contiguous |
| TC_021 | Separately | $75,000 | $60,000 | 0 | WA | 1 | $23,940 | $510 | $376 | $886 | $150,000 | $90,000 | $240,000 | $520 | $420 | $940 | INCOME_VARIATION | Higher income - higher payments |
| TC_022 | Jointly | $75,000 | $60,000 | 0 | WA | 2 | $32,460 | $406 | $327 | $733 | $130,000 | $80,000 | $210,000 | $460 | $360 | $820 | INCOME_VARIATION | Higher income joint |
| TC_023 | Separately | $30,000 | $25,000 | 0 | WA | 1 | $23,940 | $61 | $0 | $61 | $90,000 | $30,000 | $120,000 | $310 | $150 | $460 | INCOME_VARIATION | Lower income |
| TC_024 | Jointly | $30,000 | $25,000 | 0 | WA | 2 | $32,460 | $0 | $0 | $0 | $85,000 | $25,000 | $110,000 | $290 | $125 | $415 | INCOME_VARIATION | Lower income joint - may hit floor |
| TC_025 | Separately | $50,000 | $40,000 | 0 | WA | 1 | $23,940 | $219 | $133 | $352 | $120,000 | $60,000 | $180,000 | $410 | $310 | $720 | FILING_STATUS | Base case separately |
| TC_026 | Jointly | $50,000 | $40,000 | 0 | WA | 2 | $32,460 | $156 | $104 | $260 | $100,000 | $50,000 | $150,000 | $370 | $250 | $620 | FILING_STATUS | Same couple jointly |
| TC_027 | Separately | $50,000 | $40,000 | 0 | WA | 1 | $23,940 | $219 | $133 | $352 | $120,000 | $60,000 | $180,000 | $410 | $310 | $720 | FILING_STATUS_TOGGLE | Toggle from jointly to separately |
| TC_028 | Jointly | $50,000 | $40,000 | 0 | WA | 2 | $32,460 | $156 | $104 | $260 | $100,000 | $50,000 | $150,000 | $370 | $250 | $620 | FILING_STATUS_TOGGLE | Toggle from separately to jointly |
| TC_029 | Separately | $60,000 | $50,000 | 2 | AK | 1 | $29,925 | $300 | $200 | $500 | $135,000 | $80,000 | $215,000 | $480 | $380 | $860 | COMBINED | Multiple variables: AK + 2 deps + separate |
| TC_030 | Jointly | $60,000 | $50,000 | 2 | AK | 4 | $61,875 | $0 | $0 | $0 | $145,000 | $95,000 | $240,000 | $550 | $420 | $970 | COMBINED | Multiple variables: AK + 2 deps + joint |
| TC_031 | Separately | $45,000 | $35,000 | 1 | HI | 1 | $27,540 | $173 | $80 | $253 | $105,000 | $50,000 | $155,000 | $380 | $220 | $600 | COMBINED | Multiple variables: HI + 1 dep + separate |
| TC_032 | Jointly | $45,000 | $35,000 | 1 | HI | 3 | $47,130 | $0 | $0 | $0 | $115,000 | $60,000 | $175,000 | $430 | $280 | $710 | COMBINED | Multiple variables: HI + 1 dep + joint |
| TC_033 | Separately | $80,000 | $70,000 | 0 | WA | 1 | $23,940 | $630 | $486 | $1116 | $170,000 | $110,000 | $280,000 | $600 | $520 | $1120 | EDGE_CASE | Very high income |
| TC_034 | Jointly | $80,000 | $70,000 | 0 | WA | 2 | $32,460 | $531 | $438 | $969 | $155,000 | $105,000 | $260,000 | $540 | $470 | $1010 | EDGE_CASE | Very high income joint |
| TC_035 | Separately | $20,000 | $15,000 | 3 | WA | 1 | $23,940 | $0 | $0 | $0 | $80,000 | $20,000 | $100,000 | $300 | $80 | $380 | EDGE_CASE | Low income with dependents |
| TC_036 | Jointly | $20,000 | $15,000 | 3 | WA | 5 | $58,020 | $0 | $0 | $0 | $85,000 | $22,000 | $107,000 | $310 | $90 | $400 | EDGE_CASE | Low income with dependents joint |
| TC_037 | Separately | $50,000 | $40,000 | 0 | WA | 1 | $23,940 | $219 | $133 | $352 | $120,000 | $60,000 | $180,000 | $410 | $310 | $720 | PAYMENT_FLOOR | Base case - verify positive payments |
| TC_038 | Separately | $25,000 | $20,000 | 0 | WA | 1 | $23,940 | $0 | $0 | $0 | $75,000 | $15,000 | $90,000 | $280 | $60 | $340 | PAYMENT_FLOOR | Income below poverty deduction |
| TC_039 | Jointly | $35,000 | $30,000 | 0 | WA | 2 | $32,460 | $25 | $8 | $33 | $95,000 | $40,000 | $135,000 | $340 | $180 | $520 | PAYMENT_FLOOR | Both above individually but joint floor check |
| TC_040 | Jointly | $20,000 | $15,000 | 0 | WA | 2 | $32,460 | $0 | $0 | $0 | $80,000 | $20,000 | $100,000 | $290 | $70 | $360 | PAYMENT_FLOOR | Combined income below deduction |
| TC_041 | Separately | $50,000 | $40,000 | 0 | WA | 1 | $23,940 | $219 | $133 | $352 | $120,000 | $60,000 | $180,000 | $410 | $310 | $720 | TAX_BOMB_CALC | Verify tax bomb accuracy |
| TC_042 | Jointly | $50,000 | $40,000 | 0 | WA | 2 | $32,460 | $156 | $104 | $260 | $100,000 | $50,000 | $150,000 | $370 | $250 | $620 | TAX_BOMB_CALC | Tax bomb with joint payments |
| TC_043 | Separately | $50,000 | $40,000 | 2 | WA | 1 | $23,940 | $219 | $133 | $352 | $120,000 | $60,000 | $180,000 | $410 | $310 | $720 | TAX_BOMB_INCREASE | Tax bomb should increase with fewer payments |
| TC_044 | Jointly | $50,000 | $40,000 | 2 | WA | 4 | $49,500 | $33 | $0 | $33 | $140,000 | $80,000 | $220,000 | $610 | $460 | $1070 | TAX_BOMB_INCREASE | Tax bomb increase verification with more dependents |
| TC_045 | Separately | $50,000 | $40,000 | 0 | WA | 1 | $23,940 | $219 | $133 | $352 | $120,000 | $60,000 | $180,000 | $410 | $310 | $720 | MONTHLY_SAVINGS | Monthly savings should be tax_bomb/156 |
| TC_046 | Jointly | $50,000 | $40,000 | 0 | WA | 2 | $32,460 | $156 | $104 | $260 | $100,000 | $50,000 | $150,000 | $370 | $250 | $620 | MONTHLY_SAVINGS | Monthly savings verification joint |
| TC_047 | Separately | $50,000 | $40,000 | 1 | WA | 1 | $23,940 | $219 | $133 | $352 | $120,000 | $60,000 | $180,000 | $410 | $310 | $720 | SAVINGS_GOAL | Savings goal = tax_bomb / (1.05^13) |
| TC_048 | Jointly | $50,000 | $40,000 | 1 | WA | 3 | $40,980 | $80 | $40 | $120 | $140,000 | $80,000 | $220,000 | $520 | $370 | $890 | SAVINGS_GOAL | Savings goal with dependents |
| TC_049 | Separately | $50,000 | $40,000 | 0 | AK | 1 | $29,925 | $167 | $98 | $265 | $115,000 | $57,500 | $172,500 | $395 | $295 | $690 | FULL_REGRESSION | Alaska + separate filing comprehensive check |
| TC_050 | Jointly | $50,000 | $40,000 | 5 | HI | 7 | $86,310 | $0 | $0 | $0 | $220,000 | $160,000 | $380,000 | $900 | $750 | $1650 | FULL_REGRESSION | Hawaii + 5 dependents + joint comprehensive |

---

## 5. Execution Strategy

1. **Automated CSV Loader:** Ingest `test_cases_automation.csv` dynamically to prevent hardcoded drift.
2. **Tolerance Checking Engine:** Encapsulate validation helper methods enforcing the $\pm \$2$ (payment, savings) and $\pm \$500$ (tax bomb) thresholds.
3. **Dual Validation Protocol:**
   - **Data Ground Truth Verification:** Match actual calculated/model outputs against CSV `Expected_*` ground-truth fields.
   - **Internal Consistency Verification:** Validate that $\text{Combined} = \text{John} + \text{Mary}$ for payment, tax bomb, and monthly savings.
   - **Boundary Condition Auditing:** Ensure negative discretionary incomes yield $\$0$ payment without NaN or negative values.
4. **Execution & Reporting:** Run in Playwright test runner, log all individual comparisons, generate aggregated category-level metrics, and export execution artifacts.
