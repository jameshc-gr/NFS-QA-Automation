# ALP Product Offer Sorting & Display — QA Test Plan

**Story**: ALP Offer Organization from DESK (HELOAN) and Figure (Fixed/Variable HELOC)  
**Products**: HELOAN · Fixed Rate HELOC · Variable Rate HELOC  
**PE Sources**: DESK (HELOAN) | Figure (HELOCs)  
**"Best" Rule**: Lowest rate at requested loan amount; fallback to max eligible amount if ineligible

---

## 1. TEST SCENARIOS (by Feature Area)

### 1.1 Best Offer Selection & Ranking
- Lowest rate is selected from DESK for HELOAN across multiple returned offers
- Lowest rate is selected from Figure for Fixed Rate HELOC (rateType = FIXED)
- Lowest rate is selected from Figure for Variable Rate HELOC (rateType = VARIABLE)
- When requested amount > max eligible, system falls back to max eligible and shows lowest rate at that amount
- All three products are ranked and displayed correctly when all sources respond successfully
- Offers with tied rates are handled deterministically (consistent ordering)

### 1.2 API Response Mapping — DESK (HELOAN)
- `products[].rate` is correctly read and used as the offer rate
- `products[].loanTerm` (e.g., "30 Yr") is mapped to the Term display field
- `eligibilityCriteria[].totalLoanAmount.max` is used when max < requested loan amount
- Multiple products in the DESK response are sorted by rate to select the lowest

### 1.3 API Response Mapping — Figure (HELOCs)
- `underwriting.offers[].rate` is correctly read and used as the offer rate
- `underwriting.offers[].rateType` is used to distinguish FIXED vs. VARIABLE products
- `underwriting.offers[].term` (numeric) is mapped to the Term display field
- `maxOfferAmount` is used when max < requested loan amount
- `costs.fixedCosts[].totalPaidByBorrower` values are summed for closing cost calculation
- `originationFeePercent` is multiplied by loan amount and added to fixed costs

### 1.4 Static Data Display (All Products)
- Product names are displayed exactly as: "HELOAN", "Fixed Rate HELOC", "Variable Rate HELOC"
- Badges are displayed exactly as: HELOAN = "Lowest rate", Fixed = "fast, consistent payments", Variable = "fast, flexible"
- Static credit score minimums are displayed per product and occupancy type
- Static early payoff penalty values are displayed (HELOAN = investor-specific; HELOCs = None)
- Static processing times are displayed (HELOAN = 10–14 days; HELOCs = 1–5 days)
- Static rate types are displayed (HELOAN = Fixed; Fixed HELOC = Fixed at each draw; Variable HELOC = Variable)
- Static Max LTV values are displayed correctly per product and occupancy type

### 1.5 Loan Amount & Occupancy Permutations
- HELOAN with Primary occupancy: max LTV 90%, credit score 660
- HELOAN with Second Home occupancy: max LTV 85%, credit score 660
- HELOAN with Investment occupancy: max LTV 75%, credit score 680
- Fixed HELOC and Variable HELOC: max LTV 85%, credit score 600 (no occupancy variation)
- Loan amount displayed as-requested when within eligibility
- Loan amount displayed as max eligible when requested > max

### 1.6 Estimated Closing Costs — HELOAN
- Low end formula: `$1,550 + (loan_amount × 0.05%)` calculated correctly
- High end formula: `$2,750 + (loan_amount × 0.05%)` calculated correctly
- Both values displayed as a range: `$xx,xxx ⎯ $yy,yyy`
- Currency formatting: dollar sign, comma separators, no decimal places

### 1.7 Estimated Closing Costs — Figure (Fixed & Variable HELOC)
- Fixed costs summed from all entries in `fixedCosts[].totalPaidByBorrower`
- Origination fee calculated as `loan_amount × originationFeePercent`
- Total closing cost = sum of fixed costs + origination fee
- Displayed as a single dollar amount (not a range)

### 1.8 FE Display Format Consistency
- All rates formatted consistently (e.g., X.XX%)
- Loan amounts formatted as `$xxx,xxx`
- Terms formatted consistently (DESK term as-is "30 Yr"; Figure numeric term rendered as "xx years")
- Closing costs formatted with dollar signs and comma separators
- All static data labels present and correctly associated with the right product card

### 1.9 Error & Degraded State Handling
- DESK returns empty `products[]` array → HELOAN card not shown or shows graceful fallback
- Figure returns empty `offers[]` array → HELOC cards not shown or show graceful fallback
- One source times out → remaining source's products still display
- Malformed JSON from either source → error is caught, UI does not crash
- Both sources fail → user-facing message shown, no product cards displayed

---

## 2. DATA VALIDATION RULES

### 2.1 Product Name
| Field | Rule | Valid Values |
|---|---|---|
| Product Name | Exact static string match | "HELOAN", "Fixed Rate HELOC", "Variable Rate HELOC" |
| Figure rateType mapping | FIXED → Fixed Rate HELOC; VARIABLE → Variable Rate HELOC | "FIXED", "VARIABLE" |

### 2.2 Rate
| Field | Source Field | Format | Validation |
|---|---|---|---|
| HELOAN Rate | `products[].rate` | Percentage (e.g., 6.50%) | Numeric, ≥ 0, ≤ 100; lowest value selected |
| Fixed HELOC Rate | `offers[].rate` where rateType=FIXED | Percentage | Numeric, ≥ 0, ≤ 100; lowest value selected |
| Variable HELOC Rate | `offers[].rate` where rateType=VARIABLE | Percentage | Numeric, ≥ 0, ≤ 100; lowest value selected |
| FE Display | Rendered rate | `X.XX%` | 2 decimal places, percent sign |

### 2.3 Loan Amount
| Condition | Source Field | Expected FE Value |
|---|---|---|
| Requested ≤ DESK max | `eligibilityCriteria[].totalLoanAmount.max` | Display requested amount |
| Requested > DESK max | `eligibilityCriteria[].totalLoanAmount.max` | Display max eligible |
| Requested ≤ Figure max | `maxOfferAmount` | Display requested amount |
| Requested > Figure max | `maxOfferAmount` | Display max eligible |
| FE format | — | `$xxx,xxx` with dollar sign and comma separators |

### 2.4 Term
| Source | Raw Field | Expected FE Format |
|---|---|---|
| DESK | `products[].loanTerm` e.g. `"30 Yr"` | Display as-is or normalized: "30 years" |
| Figure | `offers[].term` e.g. `360` (months) | Convert to years: "xx years" |

### 2.5 Estimated Closing Costs — HELOAN
| Component | Formula | Validation |
|---|---|---|
| Low end | `1550 + (loan_amount × 0.0005)` | Numeric result ≥ 1550 |
| High end | `2750 + (loan_amount × 0.0005)` | Numeric result ≥ 2750; always > low end |
| FE format | `$xx,xxx ⎯ $yy,yyy` | Both values currency formatted; dash separator present |

### 2.6 Estimated Closing Costs — Figure
| Component | Formula | Validation |
|---|---|---|
| Fixed costs | `SUM(fixedCosts[].totalPaidByBorrower)` | Sum of all entries; 0 if array empty |
| Origination fee | `loan_amount × originationFeePercent` | Numeric; 0 if originationFeePercent = 0 |
| Total | Fixed costs + origination fee | Always ≥ 0 |
| FE format | `$xx,xxx` | Single value; currency formatted |

### 2.7 Credit Score Required (Static)
| Product | Occupancy | Min Credit Score |
|---|---|---|
| HELOAN | Primary | 660 |
| HELOAN | Second Home | 660 |
| HELOAN | Investment | 680 |
| Fixed Rate HELOC | Any | 600 |
| Variable Rate HELOC | Any | 600 |

### 2.8 Max LTV (Static)
| Product | Occupancy | Max LTV |
|---|---|---|
| HELOAN | Primary | 90% |
| HELOAN | Second Home | 85% |
| HELOAN | Investment | 75% |
| Fixed Rate HELOC | Any | 85% |
| Variable Rate HELOC | Any | 85% |

### 2.9 Static Fields Summary
| Field | HELOAN | Fixed Rate HELOC | Variable Rate HELOC |
|---|---|---|---|
| Badge | "Lowest rate" | "fast, consistent payments" | "fast, flexible" |
| Rate Type | Fixed | Fixed at each draw | Variable |
| Early Payoff Penalty | Investor specific | None | None |
| Processing Time | 10–14 days | 1–5 days | 1–5 days |

---

## 3. TEST CASES

### TC-001: HELOAN — Lowest Rate Selected at Requested Loan Amount
**Precondition**: User eligible for $300,000. DESK returns rates: 6.5%, 6.7%, 6.9%.  
**Steps**: Enter $300,000 → fetch DESK → sort by rate → display lowest.  
**Expected**:
- Product Name: HELOAN
- Rate: 6.5%
- Badge: "Lowest rate"
- Loan Amount: $300,000
- Closing Costs: Low = $1,550 + ($300,000 × 0.05%) = $1,700 | High = $2,750 + $150 = $2,900
- Credit Score: 660 (primary)
- Max LTV: 90%
- Rate Type: Fixed
- Processing Time: 10–14 days
- Early Payoff: Investor specific

---

### TC-002: HELOAN — Requested Amount Exceeds Max Eligible
**Precondition**: User requests $400,000. DESK max eligible = $350,000. Rates: 6.8%, 7.0%.  
**Steps**: Enter $400,000 → eligibility check → max = $350,000 → display lowest rate at $350,000.  
**Expected**:
- Loan Amount displayed: $350,000 (not $400,000)
- Rate: 6.8%
- All other HELOAN static fields correct

---

### TC-003: Fixed Rate HELOC — Lowest Rate Selected
**Precondition**: User requests $150,000. Figure returns offers with rateType=FIXED: 4.2%, 4.5%.  
**Steps**: Fetch Figure → filter rateType=FIXED → select 4.2%.  
**Expected**:
- Product Name: Fixed Rate HELOC
- Rate: 4.2%
- Badge: "fast, consistent payments"
- Credit Score: 600
- Max LTV: 85%
- Rate Type: Fixed at each draw
- Early Payoff Penalty: None
- Processing Time: 1–5 days

---

### TC-004: Variable Rate HELOC — Lowest Rate Selected
**Precondition**: Figure returns rateType=VARIABLE offers: 4.0%, 4.3%.  
**Steps**: Filter rateType=VARIABLE → select 4.0%.  
**Expected**:
- Product Name: Variable Rate HELOC
- Rate: 4.0%
- Badge: "fast, flexible"
- Rate Type: Variable

---

### TC-005: HELOAN — Investment Property Occupancy
**Precondition**: Occupancy = Investment, loan amount $300,000.  
**Expected**:
- Credit Score Required: 680
- Max LTV: 75%
- All other HELOAN fields unchanged

---

### TC-006: HELOAN — Second Home Occupancy
**Precondition**: Occupancy = Second Home.  
**Expected**:
- Credit Score Required: 660
- Max LTV: 85%

---

### TC-007: Figure Closing Cost Calculation — With Fixed Costs
**Precondition**: Loan = $120,000. `fixedCosts = [{totalPaidByBorrower: 500}, {totalPaidByBorrower: 300}]`. `originationFeePercent = 0.005`.  
**Expected**:
- Fixed costs SUM = $800
- Origination fee = $120,000 × 0.005 = $600
- Total = $1,400, displayed as `$1,400`

---

### TC-008: Figure Closing Cost — No Fixed Costs
**Precondition**: `fixedCosts = []`. `originationFeePercent = 0.005`. Loan = $100,000.  
**Expected**:
- Fixed costs = $0
- Origination fee = $500
- Total = $500

---

### TC-009: Figure — Requested Amount Exceeds maxOfferAmount
**Precondition**: User requests $200,000. Figure `maxOfferAmount = $175,000`.  
**Expected**:
- Displayed loan amount = $175,000
- Rate reflects lowest rate available at $175,000

---

### TC-010: All Three Products Display Simultaneously
**Precondition**: DESK returns valid HELOAN. Figure returns FIXED and VARIABLE offers.  
**Expected**:
- All three product cards rendered
- Each card has correct product name, badge, rate, loan amount, term, closing costs, and static fields

---

### TC-011: DESK Returns Empty Products Array
**Precondition**: DESK response `products = []`.  
**Expected**:
- HELOAN card is not shown (or displays a graceful "unavailable" state)
- HELOC cards from Figure still display if available

---

### TC-012: Figure Returns No Offers
**Precondition**: Figure `underwriting.offers = []`.  
**Expected**:
- Fixed Rate HELOC and Variable Rate HELOC cards not shown
- HELOAN card from DESK still displays if available

---

### TC-013: Both Sources Fail/Timeout
**Expected**:
- No product cards displayed
- User-facing error or empty state message shown
- No UI crash

---

### TC-014: Term Format — DESK "30 Yr" Displayed Correctly
**Precondition**: DESK `loanTerm = "30 Yr"`.  
**Expected**: FE displays "30 Yr" or normalized "30 years" consistently.

---

### TC-015: Term Format — Figure Numeric Term Converted
**Precondition**: Figure `offers[].term = 120` (months).  
**Expected**: FE displays "10 years" or "10 Yr" (correctly converted from months).

---

### TC-016: Rate Tie-Breaking — Two Offers at Same Lowest Rate
**Precondition**: DESK returns two offers both at 6.5%.  
**Expected**: One offer selected deterministically (e.g., first in array); no duplicate cards.

---

### TC-017: HELOAN Closing Cost — Boundary Loan Amount
**Precondition**: Loan amount = $0 (edge case).  
**Expected**:
- Low = $1,550 + $0 = $1,550
- High = $2,750 + $0 = $2,750
- System handles without error

---

### TC-018: Figure originationFeePercent = 0
**Precondition**: `originationFeePercent = 0`. Loan = $200,000. `fixedCosts = [{totalPaidByBorrower: 400}]`.  
**Expected**:
- Total = $400 (no origination component)

---

### TC-019: Static Badge Text Exact Match
**Expected values (exact strings)**:
- HELOAN → `Lowest rate`
- Fixed Rate HELOC → `fast, consistent payments`
- Variable Rate HELOC → `fast, flexible`

---

### TC-020: Rate Display Format
**Precondition**: Rate returned as `0.0915` from Figure.  
**Expected FE display**: `9.15%` (converted from decimal to percent, 2 decimal places)

---

## 4. EDGE CASES & NEGATIVE TESTS

### E-001: Null rate value in DESK response → Offer skipped; no null/undefined displayed on FE
### E-002: Null rate value in Figure offer → Offer skipped; product still shown if other valid offers exist
### E-003: rateType not "FIXED" or "VARIABLE" in Figure → Offer ignored; no product card created
### E-004: originationFeePercent missing or null → Treated as 0; no calculation error
### E-005: fixedCosts array contains negative totalPaidByBorrower → System handles gracefully (floor at 0 or includes as-is per business rule)
### E-006: Loan amount field is non-numeric input → Validation error shown; no API calls made
### E-007: maxOfferAmount = 0 from Figure → Product shows $0 loan amount OR card is suppressed (confirm expected behavior)
### E-008: DESK returns loanTerm as null → Term field displays "N/A" or is hidden; no crash
### E-009: All offers from Figure have same rateType (e.g., all FIXED) → Variable HELOC card not shown
### E-010: Both DESK and Figure return data for same loan amount → Products treated independently; no merging

---

*Generated for Jira Story: ALP Offer Sorting & Display | FAL-3148*
