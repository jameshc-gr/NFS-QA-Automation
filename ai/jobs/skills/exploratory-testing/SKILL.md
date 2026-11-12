---
name: exploratory-testing
description: "Run bounded, risk-led exploratory testing without relying on prewritten test cases, with evidence and reproducible defect reports."
argument-hint: "Provide the app/build or URL, test environment, user journey, test account, and any excluded actions."
---

# Exploratory Testing

## When to Use
- Discovering defects in new or changed workflows before regression coverage is
  complete.
- Testing unusual paths, boundary values, invalid input, interrupted flows, and
  navigation recovery.
- Investigating unexpected behavior with a reproducible session narrative.

## Inputs
- Authorized app/build or URL, environment, device/browser, and account strategy.
- Feature or journey under exploration and time/scope boundary.
- Excluded or irreversible actions and required evidence format.

## Procedure
1. Establish a bounded charter: target risk, starting state, allowed actions,
   locale, and time/step limit. Read existing specs and skills to avoid
   duplicating coverage. Use only approved QA accounts/data.
2. Explore one hypothesis at a time: normal path, alternate navigation,
   boundary/empty/invalid values, repeated actions, back/cancel/reload, and
   recoverability after interruption. Do not send an action until its intended
   target and effect are understood.
3. After each action, assert the expected screen/state and absence of blocking
   errors. Stop the affected path immediately on failure; do not continue from
   an unknown state.
4. Capture relevant page source/accessibility tree, logs, network evidence, and
   screenshots/video under
   `test-results/<YYYY-MM-DD>/<project>/<run>/`. Classify likely cause
   (selector, timing, app crash, data, backend, localization, accessibility,
   or environment) without presenting a guess as confirmed root cause.
5. Produce a defect draft with title, severity/priority rationale, environment,
   build, prerequisites, steps, expected/actual behavior, and evidence links.
   Create a Jira issue only when Jira write access and defect creation are
   explicitly authorized for the current run; otherwise export the draft in an
   approved local format.
6. Summarize covered risks, discovered screens/components/APIs, test gaps, and
   candidate regression cases. Do not automatically promote exploratory
   observations to approved baselines.

## Output Contract
- Charter, environment/build, and exact exploration boundary.
- Pass/fail/blocked outcomes for each explored path and checkpoint.
- Reproducible defect drafts with evidence paths and confidence.
- Coverage notes and next regression candidates.

## Guardrails
- Never use production accounts or perform financial, destructive, externally
  visible, or irreversible actions without explicit authorization.
- Do not bypass authentication, rate limits, CAPTCHA, app security controls, or
  certificate pinning.
- For mobile runs, follow the repository's canonical mobile rules and
  environment/account procedures. If the referenced
  `docs/mobile-testing-rules.md` is unavailable, stop before changing mobile
  rules or running account/verification flows and report the blocker.
- Do not store screenshots, logs, or generated reports under `test-data/`.
- Do not file duplicate or speculative Jira issues; search for duplicates and
  distinguish observed facts from root-cause hypotheses.
