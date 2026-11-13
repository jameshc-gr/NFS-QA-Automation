# DMX Test Data

## 2026-11-12 - Purchase and refinance scenarios

- Added `PUR-10-single-alice-signed-contract` and
  `REF-04-single-andy-america-rate-term` to `dmx-scenarios.yml`, then regenerated
  the catalog and per-case specs. Alice's purchase intent explicitly selects
  the fourth purchase-needs choice, "I signed a purchase agreement"; preapproval
  cases select the researching/affordability choice.
- The catalog now contains 16 complete scenarios, 5 resume definitions and 23
  generated rows including relogin and entry checks.
- Validation and live outcomes are recorded in the
  [DMX maintenance history](../../tests/projects/DMX/README.md). Test results,
  screenshots and diagnostics belong under `test-results/`; the account registry
  remains append-only and must not be overwritten.
- Do not store account credentials, loan identifiers or raw application data in
  this history.
