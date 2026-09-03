# Student Loan Forgiveness Scenarios: Input & Output Analysis

**Assumptions:**
- Repayment Plan: IBR for New Borrowers / PAYE (10% discretionary income cap)
- Forgiveness Timeline: 13 years (2026–2039)
- Annual Interest Compounding: Monthly
- Tax Rate at Forgiveness: As stated per scenario
- 2026 HHS Poverty Guidelines (150% deduction baseline)
- Income assumed flat across 13 years (conservative; actual may rise)

---

## **SCENARIO 1: BASE CASE (FROM SCREENSHOTS)**

| Input | Value |
|-------|-------|
| AGI | $72,000 |
| Household Size | 2 (estimated from $200 payment) |
| Loan Balance | $80,000 |
| APR | 4.00% |
| Tax Rate | 35% |
| Dependents | 1 |

| Calculation | Formula | Expected Value |
|---|---|---|
| Poverty Line (150% for HH of 2) | 150% × $19,280 | $28,920 |
| Discretionary Income | $72,000 − $28,920 | $43,080 |
| Annual IDR Payment | $43,080 × 10% | $4,308 |
| **Monthly IDR Payment** | $4,308 ÷ 12 | **$359/mo** |
| Monthly Interest Accrual | $80,000 × (4.00% ÷ 12) | $267/mo |
| Est. Remaining Balance @ Yr 13 | ~$90,000–95,000* | **~$92,000** |
| Est. Forgiveness Amount | Remaining balance | **$92,000** |
| Tax Bomb | $92,000 × 35% | **$32,200** |
| Monthly Savings Required | $32,200 ÷ 156 months | **$206/mo** |

*Estimated by running negative amortization forward 13 years with ~$100 underpayment vs. interest monthly.

**Note:** App shows $401/mo; this suggests either income growth assumptions or younger dependents being claimed.

---

## **SCENARIO 2: LOWER INCOME (50% reduction)**

| Input | Value |
|-------|-------|
| AGI | **$36,000** |
| Household Size | 2 |
| Loan Balance | $80,000 |
| APR | 4.00% |
| Tax Rate | 35% |
| Dependents | 1 |

| Calculation | Formula | Expected Value |
|---|---|---|
| Discretionary Income | $36,000 − $28,920 | $7,080 |
| Annual IDR Payment | $7,080 × 10% | $708 |
| **Monthly IDR Payment** | $708 ÷ 12 | **$59/mo** |
| Monthly Interest Accrual | $80,000 × (4.00% ÷ 12) | $267/mo |
| Net Negative Amortization/mo | $267 − $59 | **$208 underpayment** |
| Est. Remaining Balance @ Yr 13 | $80,000 + ($208 × 156 months × growth) | **~$113,000** |
| Tax Bomb | $113,000 × 35% | **$39,550** |
| Monthly Savings Required | $39,550 ÷ 156 months | **$253/mo** |

**Key Insight:** Lower income → smaller payments → larger tax bomb (despite smaller balance, more of it is unpaid interest).

---

## **SCENARIO 3: HIGHER INCOME (100% increase)**

| Input | Value |
|-------|-------|
| AGI | **$144,000** |
| Household Size | 2 |
| Loan Balance | $80,000 |
| APR | 4.00% |
| Tax Rate | 35% |
| Dependents | 1 |

| Calculation | Formula | Expected Value |
|---|---|---|
| Discretionary Income | $144,000 − $28,920 | $115,080 |
| Annual IDR Payment | $115,080 × 10% | $11,508 |
| **Monthly IDR Payment** | $11,508 ÷ 12 | **$959/mo** |
| Monthly Interest Accrual | $80,000 × (4.00% ÷ 12) | $267/mo |
| Net Amortization/mo | $959 − $267 | **$692 principal paydown** |
| Est. Remaining Balance @ Yr 13 | $80,000 − ($692 × 156 months) | **~$0 (fully paid)** |
| Tax Bomb | $0 × 35% | **$0** |
| Monthly Savings Required | $0 ÷ 156 months | **$0/mo** |

**Key Insight:** High earners likely pay off loan before forgiveness; no tax bomb risk.

---

## **SCENARIO 4: HIGHER APR (6%)**

| Input | Value |
|-------|-------|
| AGI | $72,000 |
| Household Size | 2 |
| Loan Balance | $80,000 |
| APR | **6.00%** |
| Tax Rate | 35% |
| Dependents | 1 |

| Calculation | Formula | Expected Value |
|---|---|---|
| Discretionary Income | $72,000 − $28,920 | $43,080 |
| **Monthly IDR Payment** | ($43,080 × 10%) ÷ 12 | **$359/mo** (unchanged) |
| Monthly Interest Accrual | $80,000 × (6.00% ÷ 12) | **$400/mo** |
| Net Negative Amortization/mo | $400 − $359 | **$41 underpayment** |
| Est. Remaining Balance @ Yr 13 | $80,000 + ($41 × 156 × growth factor) | **~$108,000** |
| Tax Bomb | $108,000 × 35% | **$37,800** |
| Monthly Savings Required | $37,800 ÷ 156 months | **$242/mo** |

**Key Insight:** APR doesn't change payment, but higher interest → larger forgiveness amount → larger tax bomb (compare $32,200 at 4% to $37,800 at 6%).

---

## **SCENARIO 5: EVEN HIGHER APR (8%)**

| Input | Value |
|-------|-------|
| AGI | $72,000 |
| Household Size | 2 |
| Loan Balance | $80,000 |
| APR | **8.00%** |
| Tax Rate | 35% |
| Dependents | 1 |

| Calculation | Formula | Expected Value |
|---|---|---|
| **Monthly IDR Payment** | ($43,080 × 10%) ÷ 12 | **$359/mo** (unchanged) |
| Monthly Interest Accrual | $80,000 × (8.00% ÷ 12) | **$533/mo** |
| Net Negative Amortization/mo | $533 − $359 | **$174 underpayment** |
| Est. Remaining Balance @ Yr 13 | $80,000 + ($174 × 156 × growth factor) | **~$123,000** |
| Tax Bomb | $123,000 × 35% | **$43,050** |
| Monthly Savings Required | $43,050 ÷ 156 months | **$276/mo** |

**Key Insight:** Every 2% APR increase adds ~$5,000–6,000 to tax bomb. Massive lever.

---

## **SCENARIO 6: LARGER LOAN BALANCE ($120K)**

| Input | Value |
|-------|-------|
| AGI | $72,000 |
| Household Size | 2 |
| Loan Balance | **$120,000** |
| APR | 4.00% |
| Tax Rate | 35% |
| Dependents | 1 |

| Calculation | Formula | Expected Value |
|---|---|---|
| Discretionary Income | $72,000 − $28,920 | $43,080 |
| **Monthly IDR Payment** | ($43,080 × 10%) ÷ 12 | **$359/mo** (unchanged) |
| Monthly Interest Accrual | $120,000 × (4.00% ÷ 12) | **$400/mo** |
| Net Negative Amortization/mo | $400 − $359 | **$41 underpayment** |
| Est. Remaining Balance @ Yr 13 | $120,000 + ($41 × 156 × growth) | **~$130,000–135,000** |
| Tax Bomb | $132,000 × 35% | **$46,200** |
| Monthly Savings Required | $46,200 ÷ 156 months | **$296/mo** |

**Key Insight:** Loan size doesn't affect payment, but it compounds interest faster and increases forgiveness amount proportionally.

---

## **SCENARIO 7: LARGER LOAN BALANCE ($150K)**

| Input | Value |
|-------|-------|
| AGI | $72,000 |
| Household Size | 2 |
| Loan Balance | **$150,000** |
| APR | 4.00% |
| Tax Rate | 35% |
| Dependents | 1 |

| Calculation | Formula | Expected Value |
|---|---|---|
| **Monthly IDR Payment** | ($43,080 × 10%) ÷ 12 | **$359/mo** (unchanged) |
| Monthly Interest Accrual | $150,000 × (4.00% ÷ 12) | **$500/mo** |
| Net Negative Amortization/mo | $500 − $359 | **$141 underpayment** |
| Est. Remaining Balance @ Yr 13 | $150,000 + ($141 × 156 × growth) | **~$160,000–165,000** |
| Tax Bomb | $162,000 × 35% | **$56,700** |
| Monthly Savings Required | $56,700 ÷ 156 months | **$363/mo** |

**Key Insight:** High loan + low payment = permanent negative amortization loop.

---

## **SCENARIO 8: MORE DEPENDENTS (Household of 4)**

| Input | Value |
|-------|-------|
| AGI | $72,000 |
| Household Size | **4** |
| Loan Balance | $80,000 |
| APR | 4.00% |
| Tax Rate | 35% |
| Dependents | **3** |

| Calculation | Formula | Expected Value |
|---|---|---|
| Poverty Line (150% for HH of 4) | 150% × $29,720 | **$44,580** |
| Discretionary Income | $72,000 − $44,580 | **$27,420** |
| Annual IDR Payment | $27,420 × 10% | $2,742 |
| **Monthly IDR Payment** | $2,742 ÷ 12 | **$229/mo** |
| Monthly Interest Accrual | $80,000 × (4.00% ÷ 12) | $267/mo |
| Net Negative Amortization/mo | $267 − $229 | **$38 underpayment** |
| Est. Remaining Balance @ Yr 13 | $80,000 + ($38 × 156 × growth) | **~$89,000** |
| Tax Bomb | $89,000 × 35% | **$31,150** |
| Monthly Savings Required | $31,150 ÷ 156 months | **$200/mo** |

**Key Insight:** More dependents → higher poverty deduction → lower IDR payment → higher tax bomb (compared to HH of 2). Dependents hurt, not help.

---

## **SCENARIO 9: FEWER DEPENDENTS (Single, HH of 1)**

| Input | Value |
|-------|-------|
| AGI | $72,000 |
| Household Size | **1** |
| Loan Balance | $80,000 |
| APR | 4.00% |
| Tax Rate | 35% |
| Dependents | **0** |

| Calculation | Formula | Expected Value |
|---|---|---|
| Poverty Line (150% for HH of 1) | 150% × $15,060 | **$22,590** |
| Discretionary Income | $72,000 − $22,590 | **$49,410** |
| Annual IDR Payment | $49,410 × 10% | $4,941 |
| **Monthly IDR Payment** | $4,941 ÷ 12 | **$412/mo** |
| Monthly Interest Accrual | $80,000 × (4.00% ÷ 12) | $267/mo |
| Net Amortization/mo | $412 − $267 | **$145 principal paydown** |
| Est. Remaining Balance @ Yr 13 | $80,000 − ($145 × 156) | **~$57,500** |
| Tax Bomb | $57,500 × 35% | **$20,125** |
| Monthly Savings Required | $20,125 ÷ 156 months | **$129/mo** |

**Key Insight:** Single filers with same income pay significantly more monthly but actually pay down principal; much smaller tax bomb.

---

## **SCENARIO 10: LOWER TAX RATE (25%)**

| Input | Value |
|-------|-------|
| AGI | $72,000 |
| Household Size | 2 |
| Loan Balance | $80,000 |
| APR | 4.00% |
| Tax Rate | **25%** |
| Dependents | 1 |

| Calculation | Formula | Expected Value |
|---|---|---|
| Discretionary Income | $72,000 − $28,920 | $43,080 |
| **Monthly IDR Payment** | ($43,080 × 10%) ÷ 12 | **$359/mo** (unchanged) |
| Est. Remaining Balance @ Yr 13 | (same calculation as base) | ~$92,000 |
| Tax Bomb | $92,000 × **25%** | **$23,000** |
| Monthly Savings Required | $23,000 ÷ 156 months | **$147/mo** |

**Key Insight:** 10% reduction in tax rate (35% → 25%) = ~$9,200 reduction in tax bomb (~28% savings). Tax rate is a huge lever.

---

## **SCENARIO 11: HIGHER TAX RATE (45%)**

| Input | Value |
|-------|-------|
| AGI | $72,000 |
| Household Size | 2 |
| Loan Balance | $80,000 |
| APR | 4.00% |
| Tax Rate | **45%** |
| Dependents | 1 |

| Calculation | Formula | Expected Value |
|---|---|---|
| Discretionary Income | $72,000 − $28,920 | $43,080 |
| **Monthly IDR Payment** | ($43,080 × 10%) ÷ 12 | **$359/mo** (unchanged) |
| Est. Remaining Balance @ Yr 13 | (same calculation as base) | ~$92,000 |
| Tax Bomb | $92,000 × **45%** | **$41,400** |
| Monthly Savings Required | $41,400 ÷ 156 months | **$265/mo** |

**Key Insight:** 10% increase in tax rate (35% → 45%) = ~$9,200 increase in tax bomb (~28% increase). Bracket creep matters.

---

## **SCENARIO 12: MIXED — HIGHER INCOME + HIGHER APR**

| Input | Value |
|-------|-------|
| AGI | **$100,000** |
| Household Size | 2 |
| Loan Balance | $80,000 |
| APR | **6.00%** |
| Tax Rate | 35% |
| Dependents | 1 |

| Calculation | Formula | Expected Value |
|---|---|---|
| Discretionary Income | $100,000 − $28,920 | $71,080 |
| Annual IDR Payment | $71,080 × 10% | $7,108 |
| **Monthly IDR Payment** | $7,108 ÷ 12 | **$593/mo** |
| Monthly Interest Accrual | $80,000 × (6.00% ÷ 12) | $400/mo |
| Net Amortization/mo | $593 − $400 | **$193 principal paydown** |
| Est. Remaining Balance @ Yr 13 | $80,000 − ($193 × 156) | **~$50,000** |
| Tax Bomb | $50,000 × 35% | **$17,500** |
| Monthly Savings Required | $17,500 ÷ 156 months | **$112/mo** |

**Key Insight:** Higher income beats higher APR — you're paying down principal fast enough to overcome the interest; tax bomb is actually *smaller* than base case (income growth is the strongest lever).

---

## **SCENARIO 13: MIXED — LOWER INCOME + LARGE LOAN + HIGH APR**

| Input | Value |
|-------|-------|
| AGI | **$45,000** |
| Household Size | 2 |
| Loan Balance | **$150,000** |
| APR | **7.00%** |
| Tax Rate | 40% |
| Dependents | 1 |

| Calculation | Formula | Expected Value |
|---|---|---|
| Discretionary Income | $45,000 − $28,920 | $16,080 |
| Annual IDR Payment | $16,080 × 10% | $1,608 |
| **Monthly IDR Payment** | $1,608 ÷ 12 | **$134/mo** |
| Monthly Interest Accrual | $150,000 × (7.00% ÷ 12) | **$875/mo** |
| Net Negative Amortization/mo | $875 − $134 | **$741 underpayment** |
| Est. Remaining Balance @ Yr 13 | $150,000 + ($741 × 156 × growth) | **~$265,000** |
| Tax Bomb | $265,000 × 40% | **$106,000** |
| Monthly Savings Required | $106,000 ÷ 156 months | **$680/mo** |

**Key Insight:** Perfect storm scenario — low income, large loan, high APR, high tax bracket. Tax bomb nearly *doubles* original loan balance.

---

## **SCENARIO 14: OPTIMIZED — HIGH INCOME + LOW APR + SINGLE**

| Input | Value |
|-------|-------|
| AGI | **$120,000** |
| Household Size | **1** |
| Loan Balance | $80,000 |
| APR | **2.00%** |
| Tax Rate | 25% |
| Dependents | 0 |

| Calculation | Formula | Expected Value |
|---|---|---|
| Discretionary Income | $120,000 − $22,590 | $97,410 |
| Annual IDR Payment | $97,410 × 10% | $9,741 |
| **Monthly IDR Payment** | $9,741 ÷ 12 | **$812/mo** |
| Monthly Interest Accrual | $80,000 × (2.00% ÷ 12) | **$133/mo** |
| Net Amortization/mo | $812 − $133 | **$679 principal paydown** |
| Est. Remaining Balance @ Yr 13 | $80,000 − ($679 × 156) | **~$0 (fully paid by Yr 7)** |
| Tax Bomb | $0 × 25% | **$0** |
| Monthly Savings Required | $0 ÷ 156 months | **$0/mo** |

**Key Insight:** High income + favorable loan terms = loan paid before forgiveness; no tax bomb risk at all.

---

## **SCENARIO 15: REALISTIC MIDDLE CLASS**

| Input | Value |
|-------|-------|
| AGI | **$85,000** |
| Household Size | **3** |
| Loan Balance | **$95,000** |
| APR | **5.00%** |
| Tax Rate | 32% |
| Dependents | **2** |

| Calculation | Formula | Expected Value |
|---|---|---|
| Poverty Line (150% for HH of 3) | 150% × $24,500 | **$36,750** |
| Discretionary Income | $85,000 − $36,750 | $48,250 |
| Annual IDR Payment | $48,250 × 10% | $4,825 |
| **Monthly IDR Payment** | $4,825 ÷ 12 | **$402/mo** |
| Monthly Interest Accrual | $95,000 × (5.00% ÷ 12) | **$396/mo** |
| Net Amortization/mo | $402 − $396 | **~$6 principal paydown** (nearly flat) |
| Est. Remaining Balance @ Yr 13 | $95,000 + (negligible reduction) | **~$95,000–98,000** |
| Tax Bomb | $96,500 × 32% | **$30,880** |
| Monthly Savings Required | $30,880 ÷ 156 months | **$198/mo** |

**Key Insight:** Typical middle-class scenario: payment barely covers interest, balance stays flat, moderate tax bomb (~36% of original loan). Tax planning essential.

---

## **SUMMARY TABLE: ALL SCENARIOS**

| Scenario | AGI | HH Size | Balance | APR | Tax Rate | Monthly Payment | Tax Bomb | Monthly Savings |
|---|---|---|---|---|---|---|---|---|
| 1. Base Case | $72k | 2 | $80k | 4.0% | 35% | $359 | $32,200 | $206 |
| 2. Lower Income (50%) | $36k | 2 | $80k | 4.0% | 35% | $59 | $39,550 | $253 |
| 3. Higher Income (100%) | $144k | 2 | $80k | 4.0% | 35% | $959 | $0 | $0 |
| 4. APR = 6% | $72k | 2 | $80k | 6.0% | 35% | $359 | $37,800 | $242 |
| 5. APR = 8% | $72k | 2 | $80k | 8.0% | 35% | $359 | $43,050 | $276 |
| 6. Loan = $120k | $72k | 2 | $120k | 4.0% | 35% | $359 | $46,200 | $296 |
| 7. Loan = $150k | $72k | 2 | $150k | 4.0% | 35% | $359 | $56,700 | $363 |
| 8. HH of 4 | $72k | 4 | $80k | 4.0% | 35% | $229 | $31,150 | $200 |
| 9. Single (HH of 1) | $72k | 1 | $80k | 4.0% | 35% | $412 | $20,125 | $129 |
| 10. Tax Rate = 25% | $72k | 2 | $80k | 4.0% | 25% | $359 | $23,000 | $147 |
| 11. Tax Rate = 45% | $72k | 2 | $80k | 4.0% | 45% | $359 | $41,400 | $265 |
| 12. Income $100k + APR 6% | $100k | 2 | $80k | 6.0% | 35% | $593 | $17,500 | $112 |
| 13. Income $45k + Balance $150k + APR 7% | $45k | 2 | $150k | 7.0% | 40% | $134 | $106,000 | $680 |
| 14. Optimized (High income, Low APR, Single) | $120k | 1 | $80k | 2.0% | 25% | $812 | $0 | $0 |
| 15. Realistic Middle Class | $85k | 3 | $95k | 5.0% | 32% | $402 | $30,880 | $198 |

---

## **KEY FINDINGS & LEVERS**

### **Strongest Impact on Tax Bomb (ranked):**
1. **APR** — Every 2% change ≈ ±$5,000–7,000 tax bomb
2. **Loan Balance** — Direct 1:1 correlation (larger balance = larger forgiveness)
3. **Income** — Determines payment size; high income can pay off loan before forgiveness (→ $0 tax bomb)
4. **Tax Rate** — Each 1% change ≈ ±$900 tax bomb
5. **Household Size** — Indirect; affects poverty deduction and payment size

### **Payment is NOT affected by:**
- Loan balance
- APR
- Tax rate
- Forgiveness date

**Payment IS affected by:**
- Income (AGI)
- Household size / dependents
- Repayment plan chosen

### **Worst-Case Scenario:**
Scenario 13: $680/mo required savings (8.5× the monthly IDR payment of $134).

### **Best-Case Scenario:**
Scenarios 3, 14: $0 required savings (loan paid off before forgiveness OR high enough income to outpace interest).

---

---

# **ASSET-BASED TEST CASES: TAX BOMB COVERAGE ANALYSIS**

**New Assumptions:**
- All scenarios based on existing loan/income profiles
- Assets represent current liquid savings (checking, savings, investment accounts)
- Forgiveness date: 2039 (13 years from 2026)
- Asset scenarios: Single account holder, joint accounts, spouse accounts
- Gap calculation: Tax bomb needed − Current assets = Shortfall
- Monthly savings rate: Shortfall ÷ 156 months (to bridge gap by forgiveness date)

---

## **SCENARIO 16: BASE CASE + SINGLE ACCOUNT HOLDER (ZERO ASSETS)**

| Input | Value |
|-------|-------|
| **Loan Scenario** | Scenario 1 (Base Case) |
| AGI | $72,000 |
| Household Size | 2 |
| Loan Balance | $80,000 |
| APR | 4.00% |
| Tax Rate | 35% |
| Current Payment | $200/mo (from app) |
| Estimated IDR Payment | $359/mo |

| Asset Input | Value |
|-------|-------|
| **Asset Holder** | Single |
| **Account Type** | Checking/Savings |
| **Current Asset Balance** | **$0** |

| Tax Bomb Analysis | Calculation | Value |
|---|---|---|
| Est. Tax Bomb (Forgiveness Year) | $92,000 × 35% | **$32,200** |
| Current Assets on Hand | — | **$0** |
| **Asset Shortfall** | $32,200 − $0 | **$32,200** |
| **Monthly Savings Required to Cover Gap** | $32,200 ÷ 156 months | **$206/mo** |

| Payment Verification | Calculation | Value |
|---|---|---|
| Current Loan Payment | — | **$200/mo** |
| Estimated IDR Payment (tool) | — | **$401/mo** |
| Gap: Est. vs. Actual | $401 − $200 | **$201/mo underpayment** |
| **Total Monthly Cash Needed by 2039** | Current payment + Tax savings | **$200 + $206 = $406/mo** |

| Year-by-Year Projection | Cumulative Amount | Status |
|---|---|---|
| Year 1 (2026) | $206 saved | On track |
| Year 5 (2030) | $12,360 saved | On track |
| Year 10 (2035) | $24,720 saved | On track |
| Year 13 (2039 - Forgiveness) | **$32,200 saved** | **SUFFICIENT** ✓ |

**Key Finding:** At $206/mo tax savings + $200/mo loan payment = $406 total out-of-pocket needed. If borrower currently paying only $200/mo, must increase to $406/mo or save $206/mo separately to cover tax bomb.

---

## **SCENARIO 17: BASE CASE + SINGLE ACCOUNT (PARTIAL ASSETS)**

| Asset Input | Value |
|-------|-------|
| **Asset Holder** | Single |
| **Account Type** | Savings Account + Emergency Fund |
| **Current Asset Balance** | **$8,000** |

| Tax Bomb Analysis | Calculation | Value |
|---|---|---|
| Est. Tax Bomb (Forgiveness Year) | $92,000 × 35% | **$32,200** |
| Current Assets on Hand | — | **$8,000** |
| **Asset Shortfall** | $32,200 − $8,000 | **$24,200** |
| **Monthly Savings Required to Cover Gap** | $24,200 ÷ 156 months | **$155/mo** |

| Payment Verification | Calculation | Value |
|---|---|---|
| Current Loan Payment | — | **$200/mo** |
| Tax Savings Required | — | **$155/mo** |
| **Total Monthly Cash Needed** | $200 + $155 | **$355/mo** |
| Monthly Surplus/(Deficit) for avg HH income | Estimated discretionary | **Feasible** ✓ |

| Savings Projection with Initial Assets | Year | Cumulative Savings | Total Available by Forgiveness |
|---|---|---|---|
| Start (2026) | — | $0 | **$8,000** |
| Year 1 (2026) | $1,860 | **$9,860** |
| Year 5 (2030) | $9,300 | **$17,300** |
| Year 10 (2035) | $18,600 | **$26,600** |
| Year 13 (2039 - Forgiveness) | **$24,200 saved** | **$32,200 total** | **SUFFICIENT** ✓ |

**Key Finding:** $8,000 current assets covers ~25% of tax bomb. Borrower needs to save $155/mo more (in addition to $200/mo loan payment = $355/mo total).

---

## **SCENARIO 18: BASE CASE + JOINT ACCOUNT (COUPLE, HEALTHY SAVINGS)**

| Asset Input | Value |
|-------|-------|
| **Asset Holder** | Joint (Married Couple) |
| **Account Types** | Joint Savings + Joint Investment Accounts |
| **Current Asset Balance** | **$25,000** |

| Tax Bomb Analysis | Calculation | Value |
|---|---|---|
| Est. Tax Bomb (Forgiveness Year) | $92,000 × 35% | **$32,200** |
| Current Joint Assets | — | **$25,000** |
| **Asset Shortfall** | $32,200 − $25,000 | **$7,200** |
| **Monthly Savings Required to Cover Gap** | $7,200 ÷ 156 months | **$46/mo** |

| Payment Verification | Calculation | Value |
|---|---|---|
| Current Loan Payment (Alex's name) | — | **$200/mo** |
| Spouse's Income | Assume $55k | Est. $220/mo IDR payment |
| **Combined Household Payment** | $200 + $220 | **$420/mo** |
| Tax Savings Gap Required | — | **$46/mo** |
| **Total Monthly Cash Needed** | $420 + $46 | **$466/mo** |

| Savings Projection with Joint Assets | Year | Cumulative Savings | Total Available by Forgiveness |
|---|---|---|---|
| Start (2026) | — | $0 | **$25,000** |
| Year 5 (2030) | $3,600 | **$28,600** |
| Year 10 (2035) | $7,200 | **$32,200** |
| Year 13 (2039 - Forgiveness) | **$7,200 saved** | **$32,200 total** | **SUFFICIENT** ✓ |

**Key Finding:** Couple with $25k joint savings only needs to save $46/mo more to cover entire tax bomb. Joint accounts provide substantial buffer.

---

## **SCENARIO 19: BASE CASE + SPOUSE SEPARATE ACCOUNT (MARITAL SEPARATION RISK)**

| Asset Input | Value |
|-------|-------|
| **Asset Holder** | Separate (Spouse's Account Only) |
| **Account Type** | Spouse's Personal Savings |
| **Alex's Assets** | **$0** |
| **Spouse's Assets** | **$20,000** (separate account) |
| **Joint Assets** | **$0** |

| Tax Bomb Analysis | Calculation | Value |
|---|---|---|
| Est. Tax Bomb (Alex's Loan, Forgiveness Year) | $92,000 × 35% | **$32,200** |
| **Assets Directly Accessible to Alex** | — | **$0** |
| **Asset Shortfall (Alex's perspective)** | $32,200 − $0 | **$32,200** |
| **Monthly Savings Required** | $32,200 ÷ 156 months | **$206/mo** |

| Legal / Marital Risk Analysis | Issue | Impact |
|---|---|---|
| Spouse account separation | Spouse not on loan | Spouse has no legal obligation to cover tax bomb |
| Tax bomb is Alex's sole liability | IDR in Alex's name | IRS pursues Alex for unpaid taxes, not spouse |
| Divorce scenario | If marriage ends pre-2039 | Spouse assets may not be available; Alex liable for full $32,200 |
| **Recommendation** | Asset pooling strategy | Move funds to joint account or formal agreement |

| Payments & Savings | Value |
|---|---|---|
| Current Loan Payment (Alex) | $200/mo |
| Required Tax Bomb Savings (Alex) | $206/mo |
| **Total Needed from Alex's Income Alone** | **$406/mo** |
| **Problem:** Alex has $0 savings, must save 206/mo independently | — | **HIGH RISK** ⚠️ |

**Key Finding:** Spouse's separate assets do NOT reduce Alex's tax liability. Alex must independently accumulate $32,200 or formalize a spousal commitment in writing.

---

## **SCENARIO 20: ALEX + SPOUSE JOINT ACCOUNT WITH PARTIAL COVERAGE**

| Asset Input | Value |
|-------|-------|
| **Asset Holder** | Joint (Married Couple) |
| **Account Types** | Joint Checking + Joint Savings + Brokerage |
| **Current Joint Asset Balance** | **$15,000** |

| Tax Bomb Analysis | Calculation | Value |
|---|---|---|
| Est. Tax Bomb (Forgiveness Year) | $92,000 × 35% | **$32,200** |
| Current Joint Assets | — | **$15,000** |
| **Asset Shortfall** | $32,200 − $15,000 | **$17,200** |
| **Monthly Savings Required to Cover Gap** | $17,200 ÷ 156 months | **$110/mo** |

| Combined Household Verification | Value |
|---|---|---|
| Alex's Current Payment | $200/mo |
| Spouse's Est. IDR Payment | ~$220/mo |
| **Combined household loan payment** | **$420/mo** |
| **Additional tax savings required** | **$110/mo** |
| **Total household monthly cash outflow** | **$530/mo** |

| Savings Projection | Year | Cumulative Savings | Total Assets by Forgiveness |
|---|---|---|---|
| Start (2026) | — | $0 | **$15,000** |
| Year 3 (2028) | $3,960 | **$18,960** |
| Year 7 (2032) | $9,240 | **$24,240** |
| Year 13 (2039 - Forgiveness) | **$17,200 saved** | **$32,200 total** | **SUFFICIENT** ✓ |

**Key Finding:** Joint account with $15k provides 46% coverage of tax bomb. Couple needs to discipline-save only $110/mo more to reach full coverage by 2039.

---

## **SCENARIO 21: SCENARIO 2 (LOW INCOME) + SINGLE + MINIMAL ASSETS**

| Loan Profile | Value |
|-------|-------|
| **Base Scenario** | Scenario 2 (Lower Income, 50% reduction) |
| AGI | $36,000 |
| Monthly IDR Payment | $59/mo |
| Current Payment | $200/mo (higher than required) |
| Est. Tax Bomb | **$39,550** |

| Asset Input | Value |
|-------|-------|
| **Asset Holder** | Single |
| **Current Assets** | **$2,000** |

| Tax Bomb Analysis | Calculation | Value |
|---|---|---|
| Est. Tax Bomb (Forgiveness Year) | $113,000 × 35% | **$39,550** |
| Current Assets on Hand | — | **$2,000** |
| **Asset Shortfall** | $39,550 − $2,000 | **$37,550** |
| **Monthly Savings Required to Cover Gap** | $37,550 ÷ 156 months | **$241/mo** |

| Payment Verification — CRITICAL ISSUE | Value | Status |
|---|---|---|
| Current Loan Payment | $200/mo | — |
| **Monthly Tax Bomb Savings Needed** | **$241/mo** | — |
| **Total Monthly Cash Outflow Required** | **$441/mo** | — |
| Monthly Discretionary Income (10% of $7,080) | $59/mo | — |
| **Monthly Shortfall** | $441 − $59 = **$382/mo** | **⚠️ UNAFFORDABLE** |

| Ability to Pay Analysis | Calculation | Result |
|---|---|---|
| Current monthly income (gross) | $36,000 ÷ 12 | $3,000/mo |
| Income after payroll taxes (~15%) | $3,000 × 0.85 | **$2,550/mo (net)** |
| Standard living expenses (approx) | Rent, food, utilities, insurance | ~$1,800/mo |
| Available discretionary income | $2,550 − $1,800 | **$750/mo** |
| Required savings ($241) + Current payment ($200) | — | **$441/mo** |
| **Feasibility** | $750 available vs. $441 needed | **POSSIBLE but TIGHT** |

**Key Finding:** Low-income borrower with minimal assets faces severe cash flow pressure. $241/mo tax savings target is ~32% of available discretionary income. Missing months would create compounding shortfall.

---

## **SCENARIO 22: SCENARIO 9 (SINGLE, HIGHER INCOME) + JOINT ACCOUNT**

| Loan Profile | Value |
|-------|-------|
| **Base Scenario** | Scenario 9 (Single, HH of 1) |
| AGI | $72,000 |
| Monthly IDR Payment | $412/mo |
| Est. Tax Bomb | **$20,125** |

| Asset Input | Value |
|-------|-------|
| **Asset Holder** | Single or Cohabiting Partner (Joint Account) |
| **Current Joint Assets** | **$18,000** |

| Tax Bomb Analysis | Calculation | Value |
|---|---|---|
| Est. Tax Bomb (Forgiveness Year) | $57,500 × 35% | **$20,125** |
| Current Joint Assets | — | **$18,000** |
| **Asset Shortfall** | $20,125 − $18,000 | **$2,125** |
| **Monthly Savings Required to Cover Gap** | $2,125 ÷ 156 months | **$14/mo** |

| Payment & Savings Verification | Value |
|---|---|---|
| Current Loan Payment (IDR) | $412/mo |
| **Additional monthly savings needed** | **$14/mo** |
| **Total monthly cash outflow** | **$426/mo** |

| Savings Projection | Year | Cumulative Savings | Total Assets Available |
|---|---|---|---|
| Start (2026) | — | $0 | **$18,000** |
| Year 5 (2030) | $1,050 | **$19,050** |
| Year 13 (2039 - Forgiveness) | **$2,125 saved** | **$20,125 total** | **SUFFICIENT** ✓ |

**Key Finding:** High-income single filer with modest assets ($18k) only needs to save $14/mo to fully cover tax bomb. Very achievable.

---

## **SCENARIO 23: SCENARIO 13 (WORST CASE) + SINGLE + NO ASSETS**

| Loan Profile | Value |
|-------|-------|
| **Base Scenario** | Scenario 13 (Low Income + Large Loan + High APR) |
| AGI | $45,000 |
| Monthly IDR Payment | $134/mo |
| Est. Tax Bomb | **$106,000** |

| Asset Input | Value |
|-------|-------|
| **Asset Holder** | Single |
| **Current Assets** | **$0** |

| Tax Bomb Analysis | Calculation | Value |
|---|---|---|
| Est. Tax Bomb (Forgiveness Year) | $265,000 × 40% | **$106,000** |
| Current Assets on Hand | — | **$0** |
| **Asset Shortfall** | $106,000 − $0 | **$106,000** |
| **Monthly Savings Required to Cover Gap** | $106,000 ÷ 156 months | **$679/mo** |

| CRITICAL AFFORDABILITY ANALYSIS | Calculation | Result |
|---|---|---|
| Monthly gross income | $45,000 ÷ 12 | **$3,750/mo** |
| After payroll taxes (~15%) | $3,750 × 0.85 | **$3,188/mo (net)** |
| Estimated living expenses | Housing, food, utilities, insurance, childcare | **~$2,500/mo** |
| Available discretionary income | $3,188 − $2,500 | **$688/mo** |
| **Required monthly tax bomb savings** | — | **$679/mo** |
| Current loan payment | — | **$134/mo** |
| **Total cash outflow needed** | $679 + $134 | **$813/mo** |

| AFFORDABILITY VERDICT | Status |
|---|---|
| Monthly shortfall | $813 − $688 = **$125/mo under** | ⚠️ **IMPOSSIBLE** |
| Feasible alternative: Forbearance? | Could extend payments; worsens tax bomb | Not helpful |
| Feasible alternative: Spousal income? | Combine with spouse income to cover | **Only realistic option** |
| **Recommendation** | Marital asset pooling essential; or explore forgiveness programs | **CRITICAL INTERVENTION NEEDED** |

**Key Finding:** Worst-case borrower cannot independently save $679/mo. Tax bomb ($106k) becomes *unmanageable liability*. Options: (1) Spousal income pooling, (2) Accept IRS payment plan for unpaid tax liability, (3) Explore bankruptcy, or (4) Aggressive income growth before 2039.

---

## **SCENARIO 24: SCENARIO 15 (MIDDLE CLASS) + JOINT ACCOUNT + 401k**

| Loan Profile | Value |
|-------|-------|
| **Base Scenario** | Scenario 15 (Realistic Middle Class) |
| AGI | $85,000 |
| Household Size | 3 |
| Monthly Payment | $402/mo |
| Est. Tax Bomb | **$30,880** |

| Asset Input | Value |
|-------|-------|
| **Asset Holder** | Joint (Married Couple) |
| **Account Types** | Joint Savings + Joint Emergency Fund + One spouse's 401k (not included in liquid assets) |
| **Current Liquid Joint Assets** | **$12,000** |
| **401k Balance (not liquid yet)** | **$85,000** (excluded from tax bomb planning) |

| Tax Bomb Analysis | Calculation | Value |
|---|---|---|
| Est. Tax Bomb (Forgiveness Year) | $96,500 × 32% | **$30,880** |
| Current Liquid Joint Assets | — | **$12,000** |
| **Asset Shortfall** | $30,880 − $12,000 | **$18,880** |
| **Monthly Savings Required to Cover Gap** | $18,880 ÷ 156 months | **$121/mo** |

| Combined Household Cash Flow Analysis | Value |
|---|---|---|
| Combined AGI (est. Alex $85k + Spouse $45k) | **$130,000** |
| Combined monthly net income (after taxes) | ~$8,800/mo |
| Living expenses (family of 3) | ~$5,200/mo |
| Available discretionary income | **~$3,600/mo** |
| Combined loan payments (both on IDR) | **~$700/mo** |
| Tax bomb savings gap | **$121/mo** |
| **Total financial outflow** | **$821/mo** |
| **Feasibility** | $821 ÷ $3,600 = 22.8% of discretionary | **✓ VERY FEASIBLE** |

| Savings Projection with Liquid Assets | Year | Cumulative Savings | Total Liquid Available |
|---|---|---|---|
| Start (2026) | — | $0 | **$12,000** |
| Year 5 (2030) | $7,260 | **$19,260** |
| Year 10 (2035) | $14,520 | **$26,520** |
| Year 13 (2039 - Forgiveness) | **$18,880 saved** | **$30,880 total** | **SUFFICIENT** ✓ |

**Key Finding:** Middle-class couple in good financial position. $121/mo additional tax savings, combined with $12k existing assets, fully funds tax bomb without stress. 401k provides additional safety net.

---

## **SCENARIO 25: BASE CASE + JOINT ACCOUNT + PORTFOLIO DIVERSIFICATION**

| Loan Profile | Value |
|-------|-------|
| **Base Scenario** | Scenario 1 (Base Case) |
| Est. Tax Bomb | **$32,200** |

| Asset Input | Value |
|-------|-------|
| **Asset Holder** | Joint (Married Couple) |
| **Asset Breakdown** |  |
| — High-Yield Savings Account | **$8,000** |
| — Money Market Account | **$7,000** |
| — Index Fund (Brokerage) | **$12,000** |
| — 529 Plan (Kids' College, locked) | **$10,000** |
| **Total Liquid Assets (for tax bomb)** | **$27,000** |

| Tax Bomb Analysis | Calculation | Value |
|---|---|---|
| Est. Tax Bomb (Forgiveness Year) | $92,000 × 35% | **$32,200** |
| Liquid Assets Available | $8,000 + $7,000 + $12,000 | **$27,000** |
| Assets Locked (529, not accessible) | $10,000 | — |
| **Asset Shortfall** | $32,200 − $27,000 | **$5,200** |
| **Monthly Savings Required to Cover Gap** | $5,200 ÷ 156 months | **$33/mo** |

| Savings Projection | Year | Cumulative Tax Bomb Savings | Total Liquid Assets Available |
|---|---|---|---|
| Start (2026) | — | $0 | **$27,000** |
| Year 5 (2030) | $1,980 | **$28,980** |
| Year 13 (2039 - Forgiveness) | **$5,200 saved** | **$32,200 total** | **SUFFICIENT** ✓ |

| Risk Management & Liquidity | Issue | Status |
|---|---|---|
| Market risk (index fund $12k) | If market drops 20% by 2039 = $9,600 left | Still have $15k cash buffer |
| Emergency access | High-yield savings ($8k) remains liquid | ✓ Accessible anytime |
| Tax efficiency | Money market interest rates rising | More efficient than savings account |
| 529 Plan | Cannot tap for tax bomb without penalty | Stay in plan for child's college |

**Key Finding:** Diversified household with $27k liquid assets only needs $33/mo to cover tax bomb gap. Portfolio structure allows both emergency access and long-term planning.

---

## **SCENARIO 26: JOINT ACCOUNT WITH SPOUSE'S DEBT (CONFLICTING FINANCIAL GOALS)**

| Loan Profile | Value |
|-------|-------|
| **Base Scenario** | Scenario 1 (Base Case) — Alex's Loan |
| Alex's Est. Tax Bomb | **$32,200** |
| **Spouse's Separate Profile** | — |
| Spouse's Loan Balance | **$65,000** (grad school debt) |
| Spouse's Est. Tax Bomb (same terms) | **~$28,500** |

| Asset Input | Value |
|-------|-------|
| **Asset Holder** | Joint (Married Couple) |
| **Current Joint Assets** | **$20,000** |

| COMPETING LIABILITIES ANALYSIS | Value |
|---|---|---|
| Alex's tax bomb due 2039 | **$32,200** |
| Spouse's tax bomb due 2040 (1 year later) | **$28,500** |
| **Combined household tax liabilities** | **$60,700** |
| Current joint liquid assets | **$20,000** |
| **Total shortfall for BOTH** | $60,700 − $20,000 = **$40,700** |
| **Monthly savings needed for both** | $40,700 ÷ (156 × 2 years) | **$130/mo** |

| Priority & Timing Conflict | Value | Issue |
|---|---|---|
| Alex's forgiveness date | 2039 (13 years) | Earlier |
| Spouse's forgiveness date | 2040 (14 years) | 1 year later |
| Both need full funding by 2039 for Alex | Need $32,200 by 2039 | — |
| Both need full funding by 2040 for spouse | Need $28,500 by 2040 | — |
| **Strategy:** Prioritize Alex's deadline | Accumulate $32,200 by end of 2038 | **$206/mo** |
| **Then** shift to spouse's by 2040 | Accumulate spouse's $28,500 starting 2039 | **$365/mo starting 2039** |

| Year-by-Year Plan | Year | Alex Savings | Spouse Savings | Total Assets |
|---|---|---|---|---|
| Start | 2026 | $0 | $0 | **$20,000** |
| 2030 | $12,360 | $0 | **$32,360** |
| 2038 | $31,536 | $0 | **$51,536** (Alex covered) |
| 2039 | $31,536 | $3,650 | **$55,186** (Spouse starts) |
| 2040 | $31,536 | $21,320 | **$52,856** (Both covered) ✓ |

**Key Finding:** Dual-tax-bomb household needs strategic timeline. Prioritize earlier debt (Alex), then shift savings to spouse. Requires joint accountability and discipline.

---

## **ASSET SUMMARY TABLE: ALL TEST CASES (16–26)**

| Scenario | Loan Base | Tax Bomb | Current Assets | Shortfall | Monthly Savings Needed | Feasibility |
|---|---|---|---|---|---|---|
| 16. Single, Zero Assets | Base | $32,200 | $0 | $32,200 | $206/mo | Tight |
| 17. Single, Partial Assets | Base | $32,200 | $8,000 | $24,200 | $155/mo | Feasible |
| 18. Joint, Healthy Savings | Base | $32,200 | $25,000 | $7,200 | $46/mo | Easy |
| 19. Spouse Separate Account | Base | $32,200 | $0 | $32,200 | $206/mo | High Risk |
| 20. Joint, Partial Coverage | Base | $32,200 | $15,000 | $17,200 | $110/mo | Feasible |
| 21. Low Income, Minimal Assets | Scenario 2 | $39,550 | $2,000 | $37,550 | $241/mo | Tight/Difficult |
| 22. Single High Income, Joint Assets | Scenario 9 | $20,125 | $18,000 | $2,125 | $14/mo | Very Easy |
| 23. Worst Case, No Assets | Scenario 13 | $106,000 | $0 | $106,000 | $679/mo | **Unaffordable** |
| 24. Middle Class, Joint + 401k | Scenario 15 | $30,880 | $12,000 | $18,880 | $121/mo | Very Feasible |
| 25. Diversified Portfolio | Base | $32,200 | $27,000 | $5,200 | $33/mo | Very Easy |
| 26. Dual Tax Bombs (Spouse) | Base + Spouse | $60,700 | $20,000 | $40,700 | $206/mo (Alex) + $365/mo (Spouse 2039+) | Requires Planning |

---

## **KEY ASSET INSIGHTS**

### **Asset Coverage Status (Ranked by Risk):**

**HIGH RISK (Must save heavily):**
- Scenario 23: $679/mo needed (worst case, unaffordable alone)
- Scenario 21: $241/mo needed (low income, very tight)
- Scenario 16: $206/mo needed (single, no assets)

**MODERATE RISK (Feasible with discipline):**
- Scenario 19: $206/mo needed (but spouse assets separated; legal risk)
- Scenario 20: $110/mo needed (manageable joint savings)
- Scenario 17: $155/mo needed (single, partial assets)

**LOW RISK (Comfortable position):**
- Scenario 24: $121/mo needed (middle class, strong cash flow)
- Scenario 25: $33/mo needed (diversified, substantial assets)
- Scenario 18: $46/mo needed (joint account, healthy savings)
- Scenario 22: $14/mo needed (high income, good asset base)

**SPECIAL CASE (Requires planning):**
- Scenario 26: Dual tax bombs; needs prioritized timeline and spousal coordination

### **Critical Verification Logic:**

For each scenario, the tool should verify:
1. ✓ **Est. tax bomb** = Remaining loan balance × Tax rate at forgiveness
2. ✓ **Current assets coverage** = % of tax bomb already covered
3. ✓ **Monthly savings gap** = (Tax bomb − Current assets) ÷ 156 months
4. ✓ **Total cash flow needed** = Current loan payment + Tax savings gap
5. ✓ **Affordability check** = Total cash flow ÷ Available discretionary income
   - **< 20%:** Very feasible
   - **20–40%:** Feasible with discipline
   - **40–60%:** Tight, requires lifestyle adjustment
   - **> 60%:** Unaffordable; needs intervention (spouse income, refinancing, etc.)
6. ⚠️ **Marital asset risk** = If spouse holds assets separately, ensure written agreement or joint account setup before forgiveness

### **Recommendations by Scenario Type:**

| Situation | Action | Priority |
|---|---|---|
| Single, zero assets, moderate tax bomb | Start saving immediately; automated transfer to high-yield savings | HIGH |
| Single, zero assets, large tax bomb (Scenario 23) | Requires income growth, spousal support, or debt restructuring | CRITICAL |
| Joint account, adequate assets | Minimal additional action; maintain current savings rate | LOW |
| Spouse separate account (Scenario 19) | Formalize agreement in writing or consolidate to joint account | MEDIUM |
| Dual tax bombs (Scenario 26) | Create priority timeline; prioritize earlier forgiveness date | MEDIUM |
| Diversified portfolio (Scenario 25) | Monitor market risk; rebalance annually to protect tax bomb fund | MEDIUM |
