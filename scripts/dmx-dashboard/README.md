# DMX Loan Lab Guide

## What this page does

This loopback-only dashboard launches and monitors DMX runs using the generated
catalog in `test-data/DMX/dmx-test-cases.csv`.

## How to use it

1. Choose a **Test case**.
2. Select the **DMX environment & tenant**.
3. Use the supported loan-officer mode shown for that case.
4. Review or edit the JSON scenario.
5. Click **Launch DMX run**.

## Consumer Direct incomplete draft

`CON-01-consumer-direct-no-lo-incomplete` is the only No-LO loan-creation case.
It is restricted to GRI Enhanced DEV, requires an existing MyAccount email and
password at run time, starts from the signed-in Profile menu, selects **No** for
the loan-officer relationship and leaves the saved application incomplete.
The runner is headed so a person can complete MFA; no OTP retrieval is
automated. It does not continue into credit consent, resume the draft or finish
the loan.

The password is cleared from the Lab form after launch. This case does not
write credentials or loan identifiers to the account registry, dashboard
history, run config, screenshots, traces or video. Other loan-creation cases
remain restricted to LO-B and retain their existing account-history behavior.

## Read Me button

Click **Read Me** to open this guide in a modal.

## Notes

- Only supported DEV loan creation paths can create loans.
- Other targets are read-only entry checks.
- The dashboard keeps local history and run details on this machine.
- Production entry checks require exact `READ-ONLY` confirmation.

## Work history

### 2026-11-13 - Consumer Direct case

- Added the generated No-LO incomplete case and a narrowly scoped GRI Enhanced
  DEV launch exception. Existing loan cases remain LO-B-only.
- Offline DMX regressions passed 21/21, focused TypeScript and script syntax
  checks passed, and the generated case was discoverable. No live login or
  application run was performed; MyAccount selectors and MFA remain unverified.
