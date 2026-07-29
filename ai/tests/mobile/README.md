# Mobile Test Case Workspace

This folder stores review-first mobile test cases as Markdown.

## Workflow

1. Generate or refine one Markdown test case per file in this folder.
2. Review and approve the `.md` test cases.
3. Generate corresponding `.ts` specs only after approval.

## Naming Convention

Use one test case per file:

- `tc-<area>-<short-scenario>.md`

Examples:

- `tc-auth-login-invalid-credentials.md`
- `tc-auth-create-account-password-mismatch.md`

## Required Sections

Every test case Markdown file should include:

- ID
- Title
- Objective
- Preconditions
- Test Data
- Steps
- Expected Results
- Locator Hints
- Notes

Use `TEST_CASE_TEMPLATE.md` as the base.

## Build Selection

Approved specs run against whichever build is named in the platform config, not a
fixed artifact path:

- Android: `test-data/mobile-app/gri/android/config.yml` (`MOBILE_ANDROID_BUILD`)
- iOS: `test-data/mobile-app/gri/ios/config.yml` (`MOBILE_IOS_BUILD`)

State the environment a test case targets (qa, stage, prod) rather than a file
path, so the same case can run against any published build.

## Related Guides

- [Root framework guide](../../../readme.md)
- [API how-to guide](../../../api/README.md)
- [Android build artifact guide](../../../test-data/mobile-app/gri/android/README.md)
- [iOS build artifact guide](../../../test-data/mobile-app/gri/ios/README.md)
