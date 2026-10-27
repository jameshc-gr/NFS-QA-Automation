# Rate QA Localization Reference Snapshot

Saved 2026-10-20. This is a historical reference, not current verification of a
future app build. Do not overwrite it when generating new reports.

## Builds and Scope

| Platform | Environment | Package / Bundle | Version | Build | Profile |
| --- | --- | --- | --- | --- | --- |
| Android | QA | com.guaranteedrate.superapp.qa | 1.54 | 105400085 | qa-local |
| iOS | QA | com.guaranteedrate.superapp.qa | 30.3 | 1000 | qa-simulator |

Both platforms have English and Spanish captures for Home, Accounts, Tools,
Financial, Personal, Profile, Settings, and Language Preference. iOS additionally
has English and Spanish Tools goals-prompt captures: 34 accepted captures total.
This does not verify every scroll position, nested CTA, video, filter, or
instructor destination.

## Saved Files

| File | Purpose |
| --- | --- |
| rate-spanish-localization.csv | Entire consolidated mapping: 349 screen/element rows with occurrence counts, source/target paths, matching method, and provenance. |
| platform-discrepancies.csv | Five reviewed issue rows: three unique wording inconsistencies, one repeated location, and one untranslated iOS title. |
| untranslated-spanish-report.csv | Two exact-English phrase findings requiring localization review. |
| spanish-translation-review-candidates.csv | Eleven low-confidence retained-string candidates; not confirmed defects. |
| platform-comparison-unmatched.csv | Eighty-five unmatched component candidates; not asserted discrepancies. |
| coverage.csv | Twenty-nine coverage rows; distinguishes captured roots from unverified nested routes. |
| localization-report-summary.txt | Generator summary and interpretation limitations. |
| qa-current-ios-capture-manifest.json | iOS capture provenance and language/route checkpoints. |
| qa-current-android-capture-manifest.json | Android capture provenance and language/route checkpoints. |
| qa-current-*.xml / qa-current-*.png | All 34 manifest-referenced capture pairs, preserved with original names so CSV evidence references resolve. |
| snapshot-integrity.json | Source-relative filenames, byte counts, and SHA-256 hashes for copied files. |

## Reviewed Findings

| Location | English Source | iOS Spanish | Android Spanish |
| --- | --- | --- | --- |
| Home and Financial | Home search | Búsqueda de vivienda | Búsqueda de hogar |
| Tools heading | Tools for success | Herramientas para el éxito | Herramientas para comprar una vivienda |
| Profile card subtitle | Savings and offers for you | Ahorros y ofertas para ti | Descubre lo que está incluido |
| Profile card title | Everything for your home | Everything for your home | Todo lo que necesitas para tu hogar |

Android Personal also retains `New brands for better living`. Wording differences
are consistency findings, not automatic linguistic-error judgments. `No` and
`Personal` are valid Spanish terms; names, brands, and account values are not
automatically translation gaps. The reordered sauna-card candidate was excluded
because its component correspondence was false.

## Reuse and Privacy

Start with [the exploratory manual](../RATE-APP-EXPLORATORY-SITEMAP.md). Generate
new live reports with `npx tsx scripts/build-rate-localization-report.ts`; this
reads the live `test-results/rate-localization` directory, not this snapshot.
Create a separate dated snapshot after validating future builds. Do not compare
captures from different builds as though they were a single current run.

The authenticated screenshots/XML include QA account names, masked account data,
and advisor names. Treat this directory as internal QA evidence. No login
password is stored in the manual or snapshot metadata. Do not publish raw
artifacts externally without redaction.
