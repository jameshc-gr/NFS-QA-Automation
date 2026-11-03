# Workbook scenario inputs

## 2026-11-02 — Replace 52 identity slots with Tri-Bureau IR profiles

- Preserve all 102 IDs/financial variations and the original23 source unchanged.
  NSF-001–050 retain every prior field value; added metadata declares workbook
  comparison. NSF-051–102 no longer contain old response/UI/credit baselines.
- Mapping: NSF-063–102 → TB-001–040; NSF-051–062 → TB-001–012.
  Repeating the first twelve preserves the extra financial variants, including
  all negative/pending profiles rather than screening out unsuccessful identities.
- Active source is
  [HELOAN_102_scenarios_with_Tri_Bureau_IR_profiles.xlsx](../HELOAN_102_scenarios_with_Tri_Bureau_IR_profiles.xlsx).
  Sheet1 retains 102 rows/four columns. Comparison Metadata carries explicit
  modes, provenance and lossless notes; IR Profiles Last Four contains only
  last-four identity data and source bureau scores labeled **not baselines**.
  Migration records source hashes and unchanged-input hashes.
- Identity/residence/last-four match the supplied workbook through the normalized
  profiles. Contact is normalized synthetic QA contact, not supplied IR contact.
  DOB and residence start preserve existing synthetic scenario intent; no DOB is
  supplied/certified by IR. Two PRIMARY subjects move to IR residence for UI
  equality; other subject properties and all financial inputs remain unchanged.
  Prior AVM, credit, DTI/CLTV, offer and pricing expectations are invalidated.
- `comparisonMode: actual-ui-api` and
  `provenance.baselineStatus: pending-approved-variant-baseline` make the 52
  no-baseline cases explicit. Threshold names were changed to honest amount
  probes; source credit/freeze thresholds are not claimed as verified.
- Old workbook/registry and pre-migration JSON were archived beneath
  `test-results/2026-11-02/solution-finder/workbook-scenarios/profile-migration/`;
  old workbook/registry were removed only from active inputs. Historical reports
  and supplied IR workbook/completed40 evidence are untouched.
- Checks: 18 new-unit and 53 lab tests passed; scoped typecheck/root guard passed;
  102 independent specs discovered, all 125 lab inputs remain runnable.
  Export is byte-stable and source SHA verified. Detailed non-sensitive mapping,
  hashes and evidence:
  [migration-evidence.json](../../../test-results/2026-11-02/solution-finder/workbook-scenarios/profile-migration/migration-evidence.json).
  Observations come from the existing completed40 screening summary referenced
  there; screening responses are **not** baselines for financial variants.
- Limitation: zero new live submissions; all 52 variants await live execution
  and separately approved baselines. No pricing/eligibility certification.
