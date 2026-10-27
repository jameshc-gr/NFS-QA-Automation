# Rate App Exploratory Sitemap and Testing Manual

> Archived workflow as of 2026-10-27. The one-off crawlers, capture specs, media
> backlog runner, and report/snapshot-generation scripts referenced below were
> retired. Do not execute their historical commands or infer current coverage
> from these notes. Start from the [test-data continuation guide](../../../README.md)
> for retained regression inputs and commands. Existing October evidence is
> preserved without being incorporated into the handoff.

Latest route counts and blockers are generated in
`test-results/rate-localization/media-deep/RATE-MEDIA-SITEMAP.md` and
`media-route-coverage.csv`; this manual is the workflow guide, not a current count
source. The active Android QA run recorded EN terminal checkpoints for Today,
Home, Health, and Wealth roots, then attempted four nested branches; all nested
outcomes are blocked/unverified, and no ES content route completed. The root
capture files referenced by that run are missing from the checkout, so their
strings are not reportable. Historical Home/Accounts/Tools/Financial/Personal
records do not map to the current Today/Home/Health/Wealth Compose tabs. Session
summaries and WDIO pass status are not page coverage. No Android cross-locale
video-detail pair is established. The generated 939-route-state sitemap includes
iOS inventory candidates and is not a full Android inventory. Legacy navigation
and paired-root descriptions below are historical baseline material.
The generated sitemap's `Complete Route Mapping` appendix lists each coverage
CSV route identity by platform and locale, with status and entry/blocker context.
Android map entries require a route-identified capture plus a verified terminal
checkpoint in the active manifest run; legacy route IDs and unrelated historical
CSV statuses are excluded.


## Start Here

This manual is a reusable exploration plan, not a declaration of full coverage.
Baseline: [2026-10-20 QA localization snapshot](2026-10-20-qa-localization/SNAPSHOT.md).
That snapshot is an immutable root/localization reference. For deeper media
routes, use the latest live manifests and CSVs in
`test-results/rate-localization/media-deep/`; do not infer current deep-route
coverage from the older snapshot.
Read repository `README.md` and
`ai/jobs/skills/playwright-framework-context/SKILL.md` before a run. Follow
`docs/mobile-testing-rules.md` if available; it was absent in the saved checkout.
Do not invent replacement rules or relax authorization because it is absent.

Use WebdriverIO/Appium for native testing. Playwright browser tooling is not a
substitute for native app interaction. The iOS source clone is read-only.

## Simulator Lifecycle

- At the start and end of every exploration/test phase, inventory booted iOS
  simulators, Android devices, and active test workers. Match each test-owned
  device hub to its current worker. Promptly shut down inactive test-owned
  devices, including after failures and before the final report. Keep an active
  test device running; never close another tester's device.
- Before an iOS run, inventory booted simulators with
  `xcrun simctl list devices booted`. Reuse an existing test-owned device; do not
  start extra simulators for retries or stop another tester's active device.
- Hard user limit: never boot more than 10 iOS simulator hubs. WDIO enforces a
  fixed cap of 10 and requires an explicit `MOBILE_IOS_DEVICE_UDID` that is
  already booted. Appium auto-creation/selection is refused. Boot the single
  selected simulator explicitly, verify the boot count, then pass its UDID.
- For the media backlog, use `scripts/run-rate-media-backlog.ts`. It pins the
  iPhone 17 Pro at `4818495C-7C61-40FF-A50A-DF3B3A9FAAB5` by default, reuses it
  across child batches, and accepts `MOBILE_IOS_DEVICE_UDID` to select another
  authorized simulator. It shuts down the selected simulator on
  completion/failure and handles termination signals; if a worker is interrupted,
  inspect WDA/Appium processes and ports and clean up only the test-owned worker.
- Android exploration must likewise reuse one named, test-owned AVD and stop
  that emulator after its test phase. Do not launch Android for an iOS-only run.

## Safety and Evidence Contract

## Latest Deep Media Coverage Reconciliation (2026-10-23)

- Counts below use unique route rows in `media-route-coverage.csv`, not screenshots
  or WDIO suite status. The generated `route-count-summary.json` partitions these
  coverage rows by mutually exclusive branch. Inventory-only candidates are not
  completed routes.
- Historical iOS coverage snapshot rows: EN 463 total (113 complete, 4 blocked, 1 incomplete/unverified,
  345 inventory-only); ES 464 total (49 complete, 69 blocked, 346 inventory-only).
- The active Android manifest run has one verified EN QA authentication/Home
  checkpoint, no verified ES authentication checkpoint, and no verified terminal bilingual content routes. Five EN content
  rows are blocked at legacy Home/Accounts/Tools/Financial/Personal root IDs;
  these do not identify current Today/Home/Health/Wealth routes. Earlier EN 3
  complete/5 blocked and ES 1 complete/6 blocked counts are not reconciled to the
  active manifest. No full Android inventory or completed bilingual crawl is
  established.
- The iOS discovery inventory contains 49 `subclass-view-button-class-open-*`
  candidates: 47 EN terminal-complete, zero ES terminal-complete, and zero exact
  same-ID nested class-detail EN/ES pairs. This means the retry/selector flow did
  not verify Spanish detail routes; it does not prove those Spanish screens do
  not exist.
- Four `p0` records formerly listed as video detail pairs were actually
  `personal-tab.button.featured.*` Featured-entry captures. They contain internal
  detail text, but are not nested `class_open` route checkpoints. Keep the two
  route classes distinct; the route coverage has zero nested detail pairs.
- Seven insurance source titles have bilingual p0 text records in
  `insurance-video-text-pairs.csv`, but those records do not certify route
  completion. Check each title's terminal row in `media-route-coverage.csv`.
- Android `locale-complete` summaries are not route evidence. A selected-parent
  Login-tab checkpoint passed in an earlier QA run, but a later login submission
  returned to the launcher. Android category, filter, instructor, and video
  details are unverified, not established as absent. The focused route crawler
  requires current-root path identities and route-specific terminal captures.
- Offscreen card bounds and the iOS Spanish Personal overlay block some Featured
  entries; never tap by guessed coordinates. Report the target as blocked until
  it is fully inside the viewport and the resulting detail title is verified.

- Confirm environment, installed bundle/package, version, and build before login.
- Use only accounts authorized for that environment. Supply credentials through
  runtime environment variables; never put passwords in this manual or CSVs.
- Do not submit loan applications, change passwords, delete accounts, send
  messages, initiate calls, share content, buy services, or launch external media
  without separate authorization. Stop at the last safe read-only checkpoint.
- After each interaction assert the expected destination, selected tab, modal,
  result count, or control state. Do not equate a successful click with navigation.
- On failure stop that route, capture source/screenshot/filtered logs, classify
  selector/timing/verification/crash/infrastructure, repair safely, and retest.
  Start another route only after restoring a proven root state.
- Preserve each language/platform route independently. An offscreen hierarchy
  label proves inventory, not visual verification or a visited destination.
- Mark missing pairs `NOT COMPARABLE`; unmatched components are not defects.
- QA evidence contains account information. Keep it internal and redact before
  external sharing.

## Baseline and Status Legend

| Status | Meaning |
| --- | --- |
| Paired root verified (historical baseline) | English and Spanish root screenshots/XML and route identity were checked in the dated baseline captures. Does not assert current Android route mapping or cover every scroll position. |
| iOS modal paired | English and Spanish Tools goals prompt captured on iOS only. |
| Inventory only | Label appeared in current mapping or a historical/offscreen hierarchy; the destination was not independently verified. |
| Untested | No verified destination evidence; execute the checklist next time. |
| Safety boundary | Inspect visible entry only; do not execute the consequential action. |

Baseline targets: Android QA `1.54/105400085`, profile `qa-local`; iOS QA
`30.3/1000`, profile `qa-simulator`. Both use
`com.guaranteedrate.superapp.qa`. For another build resolve profiles from
`test-data/mobile-app/gri/{android,ios}/config.yml` and confirm actual artifact
metadata. Older Stage/Prod/QA captures are not current QA proof.

## Historical Navigation Tree

The following legacy tree describes the dated exploratory baseline, not current
Android navigation. The current Android tabs are Today, Home, Health, and Wealth;
the legacy Home/Accounts/Tools/Financial/Personal roots have not been mapped to
those tabs. The active manifest contains no route-identified content capture for
any current Android root.

```text
Rate QA app
  Authentication / first-use gates
    Login -> optional verification -> Face ID / rating / system password prompts
  Historical bottom navigation
    Home [historical paired-root baseline]
    Accounts [historical paired-root baseline]
    Tools [historical paired-root baseline]
      First-use goals prompt [iOS modal paired]
    Financial [historical paired-root baseline]
    Personal [historical paired-root baseline]
  Home greeting / profile icon
    Profile [historical paired-root baseline]
      Settings [historical paired-root baseline]
        Language Preference [historical paired-root baseline]
        Membership / security / notifications / contact / legal [inventory only]
      Other Profile cards [inventory only]
  Content families needing deeper exploration
    Education Station / Financial Videos
    Collections / Challenges / categories
    Instructors / filters / video landing and detail
```

The tree is an exploration inventory, not a confirmed deep-link/routing graph.
Labels and ordering may differ by build, account, platform, locale, or backend
content. Rediscover the actual visible controls each run.

## Root-by-Root Exploration

### Home

Historical paired-root baseline only. This does not establish a current Android
Home route. If this legacy route is relevant to another target, scroll through
the entire vertical page and each horizontal rail; capture every newly visible
section separately.

| Family | Observed controls / labels | Next safe checkpoints |
| --- | --- | --- |
| Header | Greeting, profile icon, search control where exposed | Correct profile/search title; selected Home on return. |
| Home loan zone | Pre-approval, Purchase, Refinance | Inspect landing copy only; do not submit an application. |
| Advisor | Your team of experts, loan-officer name, mortgage-advisor caption | Open informational detail if safe; do not call/email/message. |
| Home search | Home search, Find your dream home | Verify entry title, search fields, empty/results state; avoid saving/changing data without authorization. |
| Insurance | Auto, Home, Life, Commercial, Umbrella, Pet | Identify native/web/external boundary and title; do not request quotes or purchase. |
| Equity empowered | Cash-out refinance, HELOC, Reverse mortgage | Inventory-only baseline; inspect safe entry and back navigation. |
| Loan lounge | Personal loans, Auto loans, Student loan refinancing | Inventory-only baseline; record correct environment and safe boundary. |
| Homebuyer tools | Mortgage calculator, Purchase power, Home valuation | Exercise reversible input/filter states; do not create an application or submit personal data. |
| Membership / home services | Everything for your home, savings/offers | Verify card title/subtitle and read-only destination. |
| Education / wellness | Education station, collections/categories, personal-wellness offers | Follow the dedicated media checklist below. |
| Feedback / foundation | Feedback and Rate Foundation labels, where present | Inspect dialog/landing only; no feedback submission or donation. |

Some lower sections were observed only offscreen in historical hierarchy dumps.
They must be scrolled into view and re-inventoried on the next target build.

### Accounts

Historical paired-root baseline only; no current Android Accounts route is
verified. Baseline account showed an empty-loan state: `Nothing to see
here`, an explanatory message, `Apply now`, and `Start a new loan`. Service cards
include Home Warranty, Rate Tech Support, and home-security offers where exposed.

Test empty-state wording, CTA labels, back/close behavior, and safe entry screens.
Populated-loan states require a separately authorized appropriate account; do not
manufacture loan data. App submission is a safety boundary.

### Tools

Historical paired-root baseline only; no current Android Tools route is
verified. Inventory: Tools for success, advisor block, Home search,
Credit scores, Home value, Calculators, Financial videos.

The first-use goals prompt asks whether the user is a current homeowner. It was
captured in EN/ES on iOS. Dismiss using the observed close accessibility ID
`navigation_top.button.close` instead of answering a profile-changing question.
After dismissal verify Tools is selected and the root is no longer occluded.

For each tool verify the title, help text, inputs/defaults, errors, and reversible
results state. Credit/security/consent actions require separate authorization.

### Financial

Historical paired-root baseline only; no current Android Financial route is
verified. Inventory includes Financial wellness, Education station,
`Watch 100+ informative videos to guide you`, loan-purpose cards, Home search,
and insurance cards. Historical insurance text captures include student renters,
actual cash value, pet, small business, business equipment, umbrella, and
life-insurance age. The current generated route map marks iOS insurance route
identities incomplete/unverified; text captures do not establish current route
completion or an Android locale pair. Cyber-insurance and jewelry detail routes
remain unverified. Video playback was never started.

The baseline Education Station card click did not prove a separate landing;
earlier claims of a verified landing are superseded. Assert changed route/title
before naming a landing capture. Do not relabel an unchanged Financial screenshot
as Education Station.

### Personal

Historical paired-root baseline only; no current Android Personal route is
verified, and this was not a complete media traversal. Inventory includes Personal
wellness, featured/new cards, offers, and content metadata. Baseline examples:
Imposter Syndrome, Nervous System Regulation, Deep Hip Release, Flow & Fire,
Balance & Breathe, All Fours Core, Breath of Joy, Energizing Flow, Square to Sky,
and Rest & Renew. Content can vary; do not hard-code these as an exhaustive list.

Check visible title/subtitle, badges, category, instructor, duration, thumbnails,
and truncation. Open only internal detail pages; do not launch external playback.
Historical iOS media text captures are separate from current route-pair evidence.
The current generated route map reports zero exact EN/ES nested video-detail
terminal pairs; do not infer a cross-locale video pair from historical string
records. See `media-deep/video-detail-route-pairs.csv` and
`media-deep/insurance-video-text-pairs.csv` for their evidence scope. Historical
text observations included retained English wellness titles/descriptions and
blank Spanish class-category metadata, alongside translated Play/help/navigation
labels. These observations are not current route verification or proof of a
paired video-detail visit.

Android aggregate-route title observations EN Imposter Syndrome and ES Deep Hip
Release are different feed items and do not by themselves prove individual detail
visits; they are NOT COMPARABLE. Historical Android counts EN 3 complete/5 blocked
and ES 1 complete/6 blocked cannot be reconciled to route-identified captures in
the active manifest; they are not current verified outcomes. `locale-complete`
summaries are not route evidence. The historical iOS inventory snapshot contained
942 route/language rows on 2026-10-23, including discovery candidates; this is not
a current or visited-route count.
The earlier iOS coverage-CSV snapshot listed EN 113 complete, 4 blocked, 1
incomplete, 345 inventory-only; ES 49 complete, 69 blocked, 346 inventory-only.
These are historical counts, not current generated sitemap route statuses.
Counts change on subsequent runs; do not convert locale-session summaries or
WDIO spec pass counts into route completion.

### Profile

Historical paired-root baseline only. Reach from Home greeting/profile icon (`ic_contact_person`
on baseline iOS). Inventory:

| Control | Checkpoint / boundary |
| --- | --- |
| Account header | Name, masked email, membership date, last-login formatting; exclude PII from gap findings. |
| Message center | Read-only list/empty state; no sending. |
| Real-estate-agent features | Entry copy; no enrollment/profile-role changes. |
| Challenges | Active/completed tabs and empty state; no joining unless authorized. |
| Home value / Saved homes | Read-only entry, search, and empty state; no persistence changes. |
| Loan officer | Advisor detail; no calls/messages/external intents. |
| Purchase power | Reversible calculator/entry only. |
| Everything for your home | Title/subtitle and offers; inspect iOS retained-English baseline finding. |
| Settings | Verify title before entering settings checklist. |

Individual Profile card destinations remain unverified unless a future run adds
their own checkpoints and evidence.

### Settings and Language Preference

Historical paired-screen baseline only. Inventory: Language preference, My membership, Change
password, Face ID, Notifications, Technical support, Loan servicing, Corporate
support, Partnerships, Do not call, FAQs, Share app with a friend, About us,
Privacy policies, Terms of use, and Log out.

Security, membership, opt-out, sharing, and contact controls are safety boundaries.
Opening a read-only page does not authorize changing state or opening another app.
Inspect legal pages for native/web context, title, locale, scrolling, and return.

## Media, Category, Instructor, and Filter Checklist

No nested media/filter/instructor/detail family below is verified by the baseline
root screenshots. Most category names came from offscreen/historical Home
hierarchies. Treat them as discovery seeds, not promised controls or working
routes.

| Family | Observed discovery seeds |
| --- | --- |
| Collections | Train like a champion, California, Chicago, Miami, Sleep Harmony, 5-day morning routine, Introduction to yoga, Dr. Paul Savage, Tone n' tunes. |
| Challenges | Chakra flow, Flexibility, Breath of life. |
| Outdoor studio | Chicago, Miami, California. |
| Guru garden / instructors | Lama Lobsang, Dr. Paul Savage, Andrea Metcalf. |
| Yoga yard | Power flow, Restorative, Sculpt, Stretching. |
| Zen den | Breathwork, Guided, Mantra, Sound healing. |
| Power patio | Barre, Core strength, Pilates, HIIT, Sculpt, Boxing, Warm up. |
| Nutrition kitchen | Nutrient density, Food allergies, Digestive health, Sports nutrition, Meal planning, Toxin reduction. |
| Sports performance | Golf, Pickleball, Tennis, Padel. |
| Sleep sanctuary | Soundscapes, Pro tips for better sleep, Sleep soundly. |
| Soundscapes | Rainy city night, Japanese garden, Bird sanctuary, Mountain train journey, Jungle, Alpine meadow, Farm, Forest, National parks, Waves, Storm, Campfire, Waterfall, Whale. |

1. From a proven root, scroll the category/card into view. Record title and stable
   identifier; capture viewport and source before opening it.
2. Tap once and verify a distinct internal list/landing title. Capture native and
   web context identifiers where applicable; do not cross into external media.
3. Enumerate all visible categories, horizontal rails, sort/filter controls, and
   pagination/load-more behavior. Record counts and actual available values.
4. For each filter, capture default, selected, applied, cleared, combined, and
   empty-results states. Check labels, chips, counts, and selected styling.
5. Open each reachable instructor: verify name/bio, category, associated list,
   back behavior, and localization of non-name copy.
6. Open each reachable internal video detail: verify title, description,
   instructor, duration, equipment/level/category metadata where present,
   related content, and all safe informational controls.
7. Treat Play, share, favorite/save, join, subscribe, and external links as
   consequential boundaries unless separately authorized. Do not infer detail
   coverage from a thumbnail or launch a media intent to obtain text.
8. Repeat EN/ES on the same platform/build/account state. Compare corresponding
   content IDs, not row positions; feeds can reorder or return different content.
9. Restore the originating root and verify selection before the next destination.

## Reliable iOS Language Capture

iOS QA 30.3 reads `AppleLanguages` on process launch; the in-app language preference
requires restart. Repeated same-process switch taps were the earlier harness
failure, not evidence that Spanish resources were absent.

The tested capture flow terminates the QA process and uses:

```ts
await browser.execute('mobile: launchApp', {
  bundleId: 'com.guaranteedrate.superapp.qa',
  arguments: ['-AppleLanguages', '(es)'],
});
```

Use `(en)` for the English reference. Then assert rendered Spanish labels such
as `Cuentas`, `Herramientas`, `Vivienda`, and `Bienestar financiero`, inspect the
screenshot, and verify the selected tab. A switch value alone is insufficient.
Dismiss iOS Save Password with Not Now; never save test credentials to Keychain.
Record the Tools goals dialog independently and close it before root capture.

The app's settings-triggered restart/alert behavior is a separate workflow from
launch-argument localization. This baseline validates the rendered localized app,
not an end-to-end certification of every settings toggle interaction.

## Repeatable Commands

Run from repository root. Acquire authorized QA credentials through the approved
channel and export `MOBILE_FORCE_LOGIN_EMAIL` and `MOBILE_FORCE_LOGIN_PASSWORD`
without writing them into tracked files. Confirm current profiles/device names
before reusing baseline examples.

```bash
# iOS: EN/ES roots, Profile, Settings, Language Preference; runtime language relaunch.
MOBILE_PLATFORM=ios MOBILE_ENV=qa MOBILE_IOS_BUILD=qa-simulator \
MOBILE_IOS_DEVICE_NAME='iPhone 17 Pro' \
MOBILE_SPECS=tests/capture-ios-localization-pair.spec.ts \
npx wdio run mobile/wdio.conf.ts

# Android: EN/ES root/settings capture with live selected-tab checkpoints.
MOBILE_PLATFORM=android MOBILE_ENV=qa MOBILE_ANDROID_BUILD=qa-local \
MOBILE_SPECS=tests/capture-localization-pairs.spec.ts \
npx wdio run mobile/wdio.conf.ts

# Regenerate from live manifests/evidence; do not overwrite the saved snapshot.
npx tsx scripts/build-rate-localization-report.ts
```

Other exploratory specs: `mobile/tests/audit-safe-routes.spec.ts`,
`explore-localization.spec.ts`, and `explore-media-routes.spec.ts`. These are
discovery helpers, not proof of deep coverage. Review their current assertions
before using them. The iOS focused retry supports `MOBILE_CAPTURE_TABS=accounts`
and merges into an existing manifest; use only with the same build/run lineage.

## Mapping and Defect Triage

For every route record platform/build/environment, language selection method,
account-state category, entry/root, selected-tab/title checkpoint, scroll state,
component identifier, English and Spanish text, screenshot/XML paths, and result.
Use each capture manifest as provenance; filenames alone are not evidence.

| Classification | Required handling |
| --- | --- |
| Observed EN/ES mapping | Source and target visible on matching route/component; include matching method. |
| Structural candidate | Manual correspondence review required; hierarchy order can shift. |
| Exact English retention | Check names, brands, cognates, dynamic data, and approved translations before filing a defect. |
| Platform wording difference | Common English source and corresponding component observed on both platforms, with both Spanish outputs. |
| NOT COMPARABLE | Missing locale/screen or uncertain component correspondence; do not invent expected Spanish. |
| Out of scope | Consequential action intentionally not executed; record boundary. |

The generator uses iOS packaged EN/ES localization keys only when corresponding
source and target strings are observed at runtime. Bundled strings alone are not
UI coverage. The reviewed discrepancy rows assert their evidence still exists;
new builds need a fresh review, not blind reuse of baseline findings.

Known baseline comparison seeds are in the snapshot: Home Search wording on Home
and Financial, Tools heading, Profile offers subtitle, untranslated iOS Profile
title, and Android Personal's retained-English promotional title. `No` and
`Personal` are not automatically gaps. The sauna-card structural match was false
and must not reappear as a defect.

## Next-Run Completion Checklist

- [ ] Confirm target package/version/build and authorized account/environment.
- [ ] Capture paired roots and Profile/Settings/Language Preference, with screenshots.
- [ ] Scroll every vertical page and horizontal rail into view; distinguish loading,
  empty, populated, error, and unavailable states.
- [ ] Traverse each safe CTA independently; log consequential boundaries.
- [ ] Complete native/web context recovery and selected-root checkpoint after return.
- [ ] Explore media lists, categories, filters, instructor details, and internal
  video details. The 2026-10-21 deep run adds evidence under
  `test-results/rate-localization/media-deep`; consult the live `media-route-coverage.csv`
  before assuming any item is covered. The discovery queue is larger than the
  terminal result count; inventory entries remain `NOT VISITED` until a matching
  route and locale checkpoint completes.
- Paired-detail count is distinct from paired Featured-entry count. Compare stable
  route/title identity, never carousel slot or a similar label. Android EN Imposter
  Syndrome and ES Deep Hip Release are different videos, not an EN/ES pair. Read
  the current `route-count-summary.json` after regenerating.
- [ ] iOS Featured carousel catalog pass captured/confirmed details for the
  accessible visible subset; Balance & Breathe, Energizing Flow, Breath of Joy,
  and Listo para trabajar remained offscreen after bounded horizontal swipes.
  These entries are blocked, not verified as absent. Do not infer their detail
  strings from adjacent cards or feed position.
- [ ] On Android, verify the test command sets `MOBILE_SPECS=tests/android-media-deep.spec.ts`
  explicitly and uses the isolated `mobile/wdio.android-media.conf.ts`; never
  use the general WDIO default suite for a media retry, since it includes unrelated
  platform/auth probes.
- [ ] Check content IDs/order before comparing dynamic feeds.
- [ ] Only pair video detail pages with the same stable content title/ID; do not
  pair first-visible EN/ES carousel slots when feeds differ.
- [ ] On same-title details, compare title, full description, instructor, category,
  duration, related classes, help copy and CTAs. The 2026-10-21 sampled wellness
  descriptions were retained in English despite other detail labels being Spanish.
- [ ] Capture failure source, screenshot, and filtered logs; repair and retest route.
- [ ] Review every discrepancy against both EN/ES components; reject positional
  false matches and exclude PII/cognates from automatic defect counts.
- [ ] Parse all CSVs; verify column counts and every referenced evidence file.
- [ ] Generate a new dated snapshot, update memory/README, and report verified,
  untested, blocked, and out-of-scope areas separately.

## 2026-10-22 Android Recovery Notes

The selected-parent Android Login-tab checkpoint passed in a focused QA session,
but the subsequent authenticated submission returned to the launcher before media
navigation. Personal Filters remains blocked in EN and ES because the chip was not
visible in the measured control row. The current retry manifest therefore contains
no locale-complete route proof; do not equate auth or WDIO checkpoint success with
filter-sheet visitation.

- Android QA media retries must use the isolated `mobile/wdio.android-media.conf.ts`,
  exact `MOBILE_SPECS=tests/android-media-deep.spec.ts`, QA `qa-local`, pinned
  `emulator-5554`, and Appium port `4725`. The spec now foregrounds
  `com.guaranteedrate.superapp.qa` after onboarding; it must refuse interaction if
  a different package remains foreground.
- Personal Filter retry is blocked because no visible Filters chip appears in
  the measured Personal control row. Keep its route record blocked; WDIO “pass” is
  only a completed recording of that blocker.
- Instructor retry previously mistook the unrelated “Train Like a Champ” Home CTA
  for instructor navigation. After restricting targets to instructor/view-all
  labels and controlled scrolling, the “Your team of experts” section arrow still
  was not exposed; no Android instructor detail was visited.
