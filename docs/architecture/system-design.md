# System Design

## Overview

This framework is organized into layers to support parallel migration and autonomous test tooling.

- web/: Playwright page objects, locators, resilience helpers, and UI tests
- api/: API client wrappers, schemas, and contract tests
- mobile/: WebdriverIO + Appium page objects, verification providers, and native specs
- ai/: agent modules for test generation, failure analysis, self-healing, and coverage analysis
- core/: shared cross-layer utilities (reserved for shared business abstractions)

## Migration strategy

Hybrid migration is used to keep existing tests stable while a TypeScript-first structure is proven.

- Existing and refactored tests live in tests/projects/student-loan-refi
- Playwright config uses TEST_SUITE_DIR to run either suite without reconfiguration

## Web layer design

- Page objects encapsulate each form segment: personal info, loan details, address/education, employment, financial profile, and identity consent.
- Resilience patterns (dropdown and address completion) are centralized in web/utils/resilience.ts.
- Profile loading and restoration behavior is centralized in web/utils/profiles.ts.

## API layer design

- ApplicationClient centralizes auth headers, retries, and endpoint wrappers.
- Contract tests validate runtime payload shapes against zod schemas.
- JSON schemas under api/schemas provide machine-readable schema contracts.

## Mobile layer design

The mobile stack is WebdriverIO + Appium (not Playwright), driven by
`mobile/wdio.conf.ts`. Specs are selected with `MOBILE_SPECS`, using paths
relative to `mobile/`.

### Build acquisition

`mobile/src/config/mobile.config.ts` resolves a named build from
`test-data/mobile-app/gri/<platform>/config.yml` and normalizes it to an
installable artifact:

```
config.yml (android.builds.<name>)
  └─ source: local | url | firebase | firebase-web
       └─ firebase-web -> scripts/download-firebase-build.ts   (browser session)
       └─ firebase     -> App Distribution REST API            (needs IAM role)
            └─ ensureApk(): .aab -> bundletool -> universal.apk (debug-signed)
                 └─ published to <artifactRoot>/<version>/<environment>/app.apk
```

Prod App Distribution releases are `.aab` and QA releases are `.apk`, so only
prod goes through bundletool. The browser downloader reuses the saved Google
profile (`mobile/.auth/gv-session-user-data`) rather than a service account,
because tester-level console access is enough to download a build while the REST
API additionally requires project IAM.

### Environment-driven verification

A single `MOBILE_ENV` switch decides which inbox a signup code is read from,
because the app build itself determines where the backend sends mail:

```
MOBILE_ENV=prod -> com.guaranteedrate.superapp     -> Guerrilla Mail
MOBILE_ENV=qa   -> com.guaranteedrate.superapp.qa  -> Outlook v3test@rate.com
```

`mobile/src/utils/mobile-auth.ts` merges `environments.<env>` over the base
config and derives the signup address (prefix/domain/tag) per environment.
`mobile/src/utils/verification-service.ts` dispatches to a provider module under
`mobile/src/utils/verification/` and logs the resolved source and outcome.
`AuthPage.assertEnvironmentMatchesBuild()` fails fast on an env/build mismatch so
a run cannot poll an inbox that will never receive the code.

Both platforms share one config tree: `authRoot` in `mobile-auth.ts` points at
`test-data/mobile-app/gri/android/`, so the `android` login/config files govern
iOS runs too. The iOS `config.yml` supplies only the `ios.builds` section.

## AI layer design
- test_generator produces runnable Playwright specs from structured ticket input.
- failure_analyzer classifies failures and recommends triage actions.
- self_healing proposes minimal locator and wait strategy fixes.
- coverage_analyzer maps requirements and ticket inventory to test gaps.
