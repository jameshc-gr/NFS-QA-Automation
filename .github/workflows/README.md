# Workflow history

## 2026-10-30 - Repository-root hygiene

- Request/cause: generated diagnostics could remain in the root because
  existing jobs invoked Playwright directly, bypassing npm lifecycle hooks.
- Change: all three browser-test workflows now run the dependency-free root
  guard with `if: always()`, including after failed tests.
- Validation: all three YAML files parsed and their always-run guard steps
  were checked locally. GitHub-hosted jobs were not dispatched.
- Guard behavior and offline checks: [scripts guide](../../scripts/README.md).
