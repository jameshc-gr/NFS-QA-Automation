# Repository memory

[webautomation.md](webautomation.md) retains durable repository decisions and
dated validated learnings. Other files here support locator, healing and flaky
test workflows. Assistant memory is selective; it is not an exhaustive work log.

Use affected-folder README work histories for requests, changes, validation and
open limitations, linked from the [root README](../README.md). Preserve earlier
entries and keep secrets and raw account/response data out of documentation.

## Work history

### 2026-11-02 - Shared ignore policy

- Synced the validated generated-output cleanup to root/input documentation and
  tracked repository memory. Shared ignores must be paired with index removal
  for previously tracked output; local copies are preserved by `git rm --cached`.
- Validation: 22 ignored-output and 12 visible-input cases passed; 99 generated
  files left the index, four local session/temp captures remained, and root
  hygiene and scoped whitespace checks passed. No live tests were run.
- First-pull backup guidance is explicit; reusable account registries/counters
  and historical Git commits remain unchanged.
