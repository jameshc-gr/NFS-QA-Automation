# Solution Finder form helpers

`inquiry-form.ts` supplies the original regression form utilities and the
shared `selectInquiryIncomeSource` used by original, workbook and lab automation.

The selector maps employment, self-employment and Retired SSI to exact Navigator
labels. It supports native selects and custom dropdowns, primary and additional
income. Missing/unknown sources fail explicitly; no employment or first-option
substitution is allowed. Enter DOB before selecting age-gated income.

Navigator's observed Retired SSI option appears from the 62nd birthday and
automatically submits `SOCIAL_SECURITY`. This is application behavior, not a
federal SSI eligibility rule. The label must not conflate Social Security
retirement benefits with age-based SSI.

## Work history

### 2026-11-02 - Strict shared income selection

- Request/root cause: the original retirement spec and legacy form helper
  could select employment while claiming to exercise retired SSI.
- Added one exact selector reused across original, workbook and lab paths.
  Removed first-option fallbacks from primary/additional shared helper inputs.
- Validation: native/custom/all-supported-source and missing-source regressions
  are part of 49 passing focused checks. Scoped typecheck and two targeted live
  GRI tests passed, with only one real inquiry and no retries.
- Limits: full regression suites/other tenants were not executed; benefit
  eligibility is outside these UI tests. See the [project history](../README.md).
