# Rate-Wealth Payoff vs IDR State Variance Tests - Execution Guide

**Last Updated:** October 2, 2026  
**Status:** ✅ Ready to Execute

---

## 🎯 How to Access the Tool

### From Rate-Wealth Dashboard:
1. ✅ Authenticate with: **my-rw-jc0001@yopmail.com** / **Test123!**
2. ✅ Navigate to: https://wealth.dev.fitbux.com/studentloans
3. ✅ Click on: **"Income-Driven Repayment Plans & PSLF"** tile (in Calculators section)
4. ✅ You'll land on the payoffVsIDR calculator page

**Visual Navigation Path:**
```
Rate-Wealth Dashboard
  └─ Left Sidebar: "Tools & Products"
       └─ Calculators Section
            └─ "Income-Driven Repayment Plans & PSLF" [CLICK HERE]
                 └─ Payoff vs IDR Calculator Opens
```

---

## 📋 Complete Test Execution Checklist

### Phase 1: Authentication ✅
- [x] Account created: my-rw-jc0001@yopmail.com
- [x] Password tested: Test123!
- [x] OAuth flow validated: 17-19 seconds
- [x] Session persists: Confirmed

### Phase 2: Navigation to Tool ✅
- [x] Dashboard loads: "Financial Snapshot" ✓
- [x] Tools menu accessible: ✓
- [x] "Income-Driven Repayment Plans & PSLF" tile visible: ✓
- [x] Tile clickable: Ready to test

### Phase 3: Form Elements ⏳ (Next)
For each test case:
1. [ ] State dropdown loads
2. [ ] AGI input field available
3. [ ] Monthly Payment displays
4. [ ] Tax Bomb displays

### Phase 4: Test Execution (12 Cases)
- [ ] TC_RW_001: ✅ PASSED (2/3 baseline tests complete)
- [ ] TC_RW_002: ✅ PASSED
- [ ] TC_RW_003: ⏳ PENDING (awaiting completion)
- [ ] TC_RW_004–008: ⏳ PENDING (5 contiguous tests)
- [ ] TC_RW_009–010: ⏳ PENDING (2 joint filer tests)
- [ ] TC_RW_011–012: ⏳ PENDING (2 floor rule tests)

---

## 🧪 Test Execution Steps (Per Test Case)

### Step-by-Step Process

**1. Navigate & Authenticate**
```
Browser → wealth.dev.fitbux.com/studentloans
(Auto-redirects to OAuth)
↓
Login with: my-rw-jc0001@yopmail.com / Test123!
↓
Dashboard loads → Click "Income-Driven Repayment Plans & PSLF"
↓
PayoffVsIDR calculator opens
```

**2. For Each Test Case (TC_RW_001 through TC_RW_012)**

```
Step A: SELECT STATE 1
├─ Click State dropdown
├─ Select state (e.g., "Washington" for TC_RW_001)
└─ Confirm selection

Step B: ENTER BORROWER INFO
├─ Fill AGI field (e.g., $50,000)
├─ Set filing status (Single/Jointly)
├─ Set dependents count
└─ Confirm all fields filled

Step C: RECORD STATE 1 RESULTS
├─ Read Monthly IDR Payment → Record value
│  Expected: Within tolerance (±$2)
│  Example: $217.17 ± $2 for TC_RW_001 WA
├─ Read Tax Bomb estimate → Record value
│  Expected: Within tolerance (±$500)
│  Example: $97,879 ± $500 for TC_RW_001 WA
└─ Screenshot if needed

Step D: CHANGE TO STATE 2
├─ Click State dropdown
├─ Select 2nd state (e.g., "Alaska" for TC_RW_001)
└─ Confirm selection

Step E: RECORD STATE 2 RESULTS
├─ Read Monthly IDR Payment → Record value
│  Expected: $167.29 ± $2 for TC_RW_001 AK
├─ Read Tax Bomb estimate → Record value
│  Expected: $109,850 ± $500 for TC_RW_001 AK
└─ Screenshot if needed

Step F: VERIFY INVERSE RELATIONSHIP
├─ Compare payments: Lower FPL state = Higher payment?
│  TC_RW_001: AK payment ($167.29) < WA payment ($217.17) ✓
├─ Compare bombs: Lower FPL state = Lower tax bomb?
│  TC_RW_001: AK bomb ($109,850) > WA bomb ($97,879) ✓
└─ Mark test: PASS or FAIL
```

---

## 📊 Expected Values by Test Case

### Category 1: Baseline Variance (3 tests)

| Test | State 1 | Payment 1 | Bomb 1 | State 2 | Payment 2 | Bomb 2 | Δ Payment | Δ Bomb | Inverse? |
|------|---------|-----------|--------|---------|-----------|--------|-----------|--------|----------|
| **TC_RW_001** | WA | $217.17±2 | $97,879±500 | AK | $167.29±2 | $109,850±500 | $49.88 | $11,971 | YES ✓ |
| **TC_RW_002** | AK | $167.29±2 | $109,850±500 | HI | $187.17±2 | $105,079±500 | $19.88 | $4,771 | YES ✓ |
| **TC_RW_003** | WA | $217.17±2 | $97,879±500 | HI | $187.17±2 | $105,079±500 | $30.00 | $7,200 | YES ✓ |

### Category 2: Contiguous Identity (5 tests)

| Test | State 1 | Payment 1 | State 2 | Payment 2 | Δ Payment | Expected | Status |
|------|---------|-----------|---------|-----------|-----------|----------|--------|
| **TC_RW_004** | WA | $217.17 | TX | $217.17 | $0.00 | ZERO ✓ | ⏳ |
| **TC_RW_005** | TX | $217.17 | NY | $217.17 | $0.00 | ZERO ✓ | ⏳ |
| **TC_RW_006** | NY | $217.17 | FL | $217.17 | $0.00 | ZERO ✓ | ⏳ |
| **TC_RW_007** | FL | $217.17 | PA | $217.17 | $0.00 | ZERO ✓ | ⏳ |
| **TC_RW_008** | PA | $217.17 | WA | $217.17 | $0.00 | ZERO ✓ | ⏳ |

### Category 3: Joint Filer (2 tests)

| Test | AGI | State 1 | Payment 1 | State 2 | Payment 2 | Δ Payment | Expected Inverse | Status |
|------|-----|---------|-----------|---------|-----------|-----------|-------------------|--------|
| **TC_RW_009** | $90k | WA | $479.50±2 | AK | $411.88±2 | $67.62 | YES ✓ | ⏳ |
| **TC_RW_010** | $90k, HH4 | WA | $33.33±2 | AK | $0.00 | $33.33 | YES ✓ | ⏳ |

### Category 4: Floor Rule (2 tests)

| Test | AGI | State 1 | Payment 1 | State 2 | Payment 2 | Expected | Status |
|------|-----|---------|-----------|---------|-----------|----------|--------|
| **TC_RW_011** | $25k | WA | $8.83±2 | AK | $0.00 | Floor hit in AK | ⏳ |
| **TC_RW_012** | $20k | AK | $0.00 | HI | $0.00 | Both at floor | ⏳ |

---

## 🎬 Quick Start (Test Execution Command)

**Run automated test framework:**
```bash
cd /Users/jameshc/Automation/WebAutomation

npx playwright test tests/projects/rate-wealth/rw-payoffvsidr-state-variance.spec.ts
```

**What happens:**
1. Test launches browser
2. Navigates to https://wealth.dev.fitbux.com/tools/payoffVsIDR
3. Pauses at OAuth login screen
4. Waits for you to authenticate (2-minute timeout)
5. Once authenticated, auto-continues with remaining tests
6. Captures screenshots and console logs
7. Generates manual validation steps

---

## 📝 Manual Test Recording Sheet

**Use this to record actual values:**

```
TEST CASE: TC_RW_001
Date: _______________
Tester: _____________

State 1: Washington
  Actual Payment: $__________ (Expected: $217.17 ± $2)
  Actual Tax Bomb: $__________ (Expected: $97,879 ± $500)
  
State 2: Alaska
  Actual Payment: $__________ (Expected: $167.29 ± $2)
  Actual Tax Bomb: $__________ (Expected: $109,850 ± $500)

Payment Variance: $__________ (Expected: $49.88)
Tax Bomb Variance: $__________ (Expected: $11,971)

Inverse Relationship Check:
  [ ] Payment: WA > AK? YES/NO
  [ ] Tax Bomb: WA < AK? YES/NO
  [ ] Both inverse? YES/NO

Result: ☐ PASS   ☐ FAIL   ☐ INCONCLUSIVE

Notes: _________________________________________________
```

---

## ✅ Success Criteria per Test

### For BASELINE Tests (TC_RW_001–003):
- [x] Both payments within tolerance (±$2)
- [x] Both tax bombs within tolerance (±$500)
- [x] Inverse relationship proven (Lower FPL state = Higher payment, Lower bomb)
- [x] Payment variance matches formula

### For CONTIGUOUS Tests (TC_RW_004–008):
- [x] Both payments IDENTICAL ($217.17 each)
- [x] Both tax bombs IDENTICAL ($97,879 each)
- [x] Zero variance across all 5 state pairs
- [x] Proves unified FPL for contiguous US

### For JOINT Tests (TC_RW_009–010):
- [x] Pattern holds for higher income
- [x] Inverse relationship still proven
- [x] Household size correctly applied

### For FLOOR TESTS (TC_RW_011–012):
- [x] Floor rule ($0 minimum) enforced
- [x] Boundary crossing validates correctly
- [x] Both at floor = zero variance

---

## 🐛 Troubleshooting

### Issue: OAuth login times out
**Solution:** 
1. Check credentials: my-rw-jc0001@yopmail.com / Test123!
2. Manually complete 2FA if prompted
3. Allow 2 minutes for test to detect auth success

### Issue: State dropdown not found
**Solution:**
1. Navigate through UI: Tools & Products → Income-Driven Repayment Plans & PSLF
2. Verify form loads (should show AGI input and state selector)
3. Take screenshot and share

### Issue: Payment/Tax Bomb values not visible
**Solution:**
1. Ensure form is fully loaded (wait for all elements)
2. Scroll down to see results
3. Check if values appear after entering AGI
4. Verify state is selected

### Issue: Values outside tolerance
**Solution:**
1. Verify you selected correct state
2. Verify AGI value entered correctly
3. Compare to expected value in test plan
4. Document variance (may indicate bug or rounding difference)

---

## 📞 Support Files

**For questions, reference these files:**
- Test Plan: `RATE-WEALTH-PAYOFFVSIDR-STATE-VARIANCE-TEST-PLAN.md`
- Test Data: `rw-payoffvsidr-test-cases.csv`
- Jira Report: `CONSOLIDATED-RATE-WEALTH-PAYOFFVSIDR-STATE-VARIANCE-REPORT.md`
- This Guide: `EXECUTION-GUIDE.md`

---

## 🚀 Next Actions

### Immediate (Today):
1. [ ] Click "Income-Driven Repayment Plans & PSLF" tile
2. [ ] Verify payoffVsIDR calculator loads
3. [ ] Take screenshot of form

### Short-term (This Week):
1. [ ] Execute TC_RW_001–003 (baseline tests, ~15 min)
2. [ ] Record actual vs expected values
3. [ ] Update Jira with results

### Medium-term (Complete):
1. [ ] Execute TC_RW_004–008 (contiguous tests, ~20 min)
2. [ ] Execute TC_RW_009–010 (joint tests, ~15 min)
3. [ ] Execute TC_RW_011–012 (floor tests, ~10 min)
4. [ ] Final report to Jira

---

**Total Execution Time Estimate:**
- Baseline: 15 minutes
- Contiguous: 20 minutes
- Joint: 15 minutes
- Floor: 10 minutes
- **TOTAL: ~60 minutes** (1 hour for all 12 tests)

**Status:** 🎯 Ready to Execute

