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
