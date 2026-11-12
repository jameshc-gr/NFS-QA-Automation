# QA Autonomy Capability Assessment

Assessment date: 2026-11-11

## Executive summary

```yaml
repository: jameshc-gr/NFS-QA-Automation
current_mcp_coverage: "4/22 requested MCP categories exposed and verified (18.2%)"
local_mobile_stack:
  appium: installed
  appium_android_driver: installed
  appium_ios_driver: installed
  android_sdk_and_adb: installed; adb is not on PATH
  android_device: none connected
  xcode_and_ios_simulator: installed; available simulators are shut down
  ios_app_artifact: not found in repository mobile build directory
figma_access: "Authenticated; current selection returned a top-level page listing"
missing_high_priority:
  - Maestro
  - BrowserStack access/MCP
  - OCR engine
  - axe-core accessibility dependencies
  - image-difference package beyond Playwright snapshots
  - network proxy tooling
not_end_to_end_verified:
  - Jira ticket to executed test to defect
  - Figma node crawl to app screenshot comparison
  - APK or IPA execution on a device
  - five-locale app UI coverage
  - native accessibility audit
```

The 18.2% figure counts only requested MCP categories available in this session;
it is not a measure of QA coverage. Local capabilities such as Appium and the
Postman runner are tracked separately. No app, ticket, Figma node target, device,
or test environment was supplied for an end-to-end run.

## MCP discovery and connection validation

An MCP is marked available only when its tools were exposed in this session.
GitHub repository search, Jira project browsing, Figma identity, and Playwright
tab listing were invoked successfully. The Playwright browser is connected but
currently has only an `about:blank` tab.

| Requested MCP | Session status | Validation / local alternative |
|---|---|---|
| GitHub MCP | Connected; authenticated | Repository search succeeded. `gh` is also authenticated. |
| Jira MCP | Connected; authenticated | Atlassian and Rovo toolsets are exposed; Jira project browse succeeded through the Atlassian provider, and read/write Jira scopes are exposed. |
| Figma MCP | Connected; authenticated | Two Figma toolsets are exposed; identity succeeded and metadata returned the current selection's top-level page list. Node-level traversal and screenshot comparison were not run. |
| Playwright MCP | Connected | Browser tab listing succeeded; blank tab only. Two Playwright MCP providers are exposed. |
| Appium MCP | Missing | Appium package and both native drivers are installed locally. |
| Maestro MCP | Missing | Maestro CLI is not installed. |
| BrowserStack MCP | Missing | No BrowserStack MCP or BrowserStack environment-key names were found. |
| Firebase MCP | Missing | Repository Firebase build/access scripts exist; Firebase Test Lab access was not verified. |
| Localization MCP | Missing | Localization procedures and repository evidence exist; no dedicated MCP. |
| REST API MCP | Missing | Local Postman/API runner is available. |
| GraphQL MCP | Missing | No dedicated MCP was exposed. |
| Swagger MCP | Missing | No dedicated MCP was exposed. |
| Fastlane MCP | Missing | Fastlane CLI is not installed. |
| Android SDK MCP | Missing | Android SDK, emulator, and ADB are installed locally; no emulator is running. |
| iOS Simulator MCP | Missing | Xcode `simctl` is installed; simulators are shut down. |
| Accessibility MCP | Missing | Existing web-a11y skill describes axe, but axe packages are not installed. |
| OCR MCP | Missing | No OCR MCP or local OCR engine was found. |
| Visual Testing MCP | Missing | Playwright screenshot assertions and `sharp` are available locally. |
| Network Proxy MCP | Missing | Playwright network APIs and a mobile interceptor are local alternatives. |
| Charles MCP | Missing | Charles is not installed. |
| Mitmproxy MCP | Missing | Mitmproxy is not installed. |
| OpenAPI MCP | Missing | No dedicated MCP was exposed; API schemas and contract tests exist locally. |

An unavailable MCP here means it is not exposed to this session; it does not
prove that the organization has no separately configured service.

Other exposed providers include Microsoft Learn, Pylance, the Playwright Test
server, and general VS Code browser/file/task tools. Microsoft Learn and Pylance
are available but are not core mobile-QA execution systems; they were not used
to validate an app or device.

## Local capability inventory

| Capability | Installed | Connected / authenticated | Functional evidence | Training / readiness |
|---|---|---|---|---|
| Playwright web automation | Yes (`playwright`, `@playwright/test`) | MCP connected; browser blank | Repository runner/config and MCP tab listing | Existing framework-context, execution, visual, and accessibility skills; accessibility package absent |
| WebdriverIO | Yes | No mobile session | `mobile/wdio.conf.ts`, Android/iOS specs, local package | `mobile-testing` skill and canonical rules now cover agent intake, pinned device setup, login, registration, and MFA; no device-backed run |
| Appium | Yes (`3.5.2`) | Server not started | `uiautomator2@8.0.0` and `xcuitest@11.16.3` drivers installed | Ready for a device-backed run after a device is available |
| Android SDK / ADB | Yes under `~/Library/Android/sdk` | ADB daemon starts; no device attached | SDK tools and APK inputs exist; device list empty | Local build/download and preflight scripts exist |
| Android APKs | Yes | Not installed on a device | Multiple QA/PROD APKs exist under `test-data/mobile-app/gri/android/` | APK inspection is possible with SDK tools; no execution was attempted |
| Xcode / iOS Simulator | Yes (Xcode 27.2) | No simulator booted | `simctl` lists available iOS 26.3-27.2 simulators | Existing simulator automation and build-management documentation |
| iOS app artifact | Not found in the repository's configured iOS build directory | N/A | No `.ipa` or `.app` found there | Build/download workflows are documented; no target artifact was tested |
| Firebase | CLI/API state not verified | Not verified | Firebase build/access scripts exist | Requires an approved account/project and valid local session |
| Visual comparison | Partial | Playwright MCP connected | Playwright snapshot APIs and `sharp` are installed | Baseline workflow skill exists; no dedicated vision model or OCR engine |
| OCR / image CV | No | No | `tesseract`, `tesseract.js`, OpenCV, `cv2`, and `pytesseract` absent | Add only if screenshot text or CV is needed beyond accessibility trees |
| Accessibility | Partial | No native device session | Existing web skill describes axe, but `axe-core` and `@axe-core/playwright` are absent | No verified WCAG 2.2, TalkBack, or VoiceOver run |
| Localization | Partial | No localization MCP | Repository contains Spanish-oriented historical evidence and localization reports | New five-language procedure added; per-locale live coverage remains unverified |
| API / Postman | Yes | No target service was called | API runner, Postman conversion, mappings, schemas, and collection inputs exist | API-testing skill and runner guide exist; no GraphQL/OpenAPI MCP |
| Network inspection | Partial | No proxy session | Playwright network APIs and mobile interceptor code exist | No Charles, mitmproxy, BrowserStack network logs, or proxy certificate setup |
| Jira | N/A | Jira MCP authenticated with read/write scopes | Project browsing succeeded | Jira/TWG skills exist; ticket-to-test-to-defect workflow not executed |
| Figma | N/A | Figma MCP authenticated | Identity and current-selection top-level metadata succeeded; design-context/variables/screenshot tools are exposed | No node-level traversal or app comparison was performed |
| GitHub | N/A | GitHub MCP search and authenticated `gh` work | Repository search and metadata queries succeeded | Repository overviews and fit recommendations are recorded below |

### APK and IPA testing actions

These are local-framework capabilities, not proof of a successful run. No
connected device, booted simulator, IPA, or test target was available.

| Action | Android APK | iOS IPA / Simulator |
|---|---|---|
| Install / launch | Appium, UIAutomator2 driver, SDK, and APKs exist; no device connected | Xcode/simctl and XCUITest driver exist; no simulator booted and no IPA/app found |
| Inspect / UI tree | ADB and UIAutomator2 can inspect packages and expose page source when attached; not run | XCUITest/Appium page source can expose accessibility-backed elements when attached; not run |
| Decompile | No decompiler was verified | No IPA inspection/decompilation workflow was verified |
| Emulator / simulator control | Android emulator binary exists; ADB reports no attached device | `xcrun simctl` lists available simulators, all shut down |
| Screenshots / video | ADB/Appium capture is available in principle; no device evidence captured | simctl/Appium capture is available in principle; no simulator evidence captured |
| Gestures | Appium/WDIO interaction APIs are installed | Appium/XCUITest interaction APIs are installed |
| Logs / crash evidence | ADB logcat and Appium logs require an attached device; no crash was collected | Xcode/simulator logs require a running target; no crash was collected |
| Performance metrics | No mobile performance collection was verified | No iOS performance collection was verified |

### Setup recommendations for missing requested services

| Gap | Why it is needed | Recommended next step |
|---|---|---|
| Connected Android emulator | Required to install/launch APKs, inspect UI, collect logs, and exercise gestures | Set `ANDROID_HOME` to `~/Library/Android/sdk`, add `platform-tools` and `emulator` to the execution PATH, boot an approved AVD, then verify `adb devices` reports `device` |
| Maestro | A second, declarative mobile flow runner; useful for fast smoke and exploratory flows | Follow the [official CLI installation guide](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli), then verify the CLI before adding flows |
| Appium MCP | Allows an agent to start and control bounded Appium sessions through MCP | Use an approved Appium MCP implementation against the already installed local server; scope tools to configured test devices and read-only evidence where possible |
| BrowserStack | Remote device coverage and optional network logs when local hardware is unavailable | Provision an approved plan, configure the official provider/MCP if available, and store credentials only in the environment's secret manager |
| Firebase Test Lab | Cloud Android execution and device-matrix coverage | Configure approved `gcloud` project/API access and billing, then run one non-production APK smoke test; local Firebase scripts are not evidence of Test Lab access |
| axe web accessibility | Automated web rule coverage for labels, contrast, and common WCAG failures | Add `axe-core` and `@axe-core/playwright` as development dependencies, then run a scoped scan; this changes dependency manifests and was not done |
| Native accessibility | TalkBack/VoiceOver, focus order, hints, labels, and touch target checks | Use a connected Android/iOS device and add explicit screen-reader/device checks; pair automation with manual review |
| OCR | Reads text that is absent from DOM/accessibility data and can support screenshot localization checks | Install Tesseract using the [official installation guide](https://tesseract-ocr.github.io/tessdoc/Installation.html), add required language data, then measure confidence before assertions |
| OpenCV / pixel-level diff | CV classification and image processing beyond Playwright's built-in snapshot comparison | Install a platform-supported OpenCV package only after a concrete need and baseline strategy are approved |
| Fastlane | Build/sign/release automation for mobile artifacts | Follow the official Fastlane setup guide; use CI secret storage and avoid local signing-key exposure |
| Charles / mitmproxy | Authorized inspection of API requests, responses, and events from device traffic | Select one proxy, install from its official source, and configure only an approved QA device/app; certificate pinning must not be bypassed |
| REST / GraphQL / Swagger / OpenAPI MCPs | Direct agent access to schemas and endpoint contracts | No dedicated server was exposed. Continue using the repository Postman runner/schemas; add an approved MCP only if it provides a needed capability without duplicating this runner |
| Localization MCP | Centralized translation/workflow integration | No dedicated server was exposed or required for the new procedure; connect approved translation resources and existing Figma/runtime inputs |
| iOS app artifact | Needed to install and launch a simulator-compatible build | Use the documented build/download flow to produce the configured `.app`/simulator build; real-device IPA/TestFlight installation is a separate path |

### Requested Figma capabilities

| Capability | Assessment |
|---|---|
| Read files, frames, components, and layer structure | Current selection's top-level page listing was returned; frame/component traversal requires a concrete node and was not tested |
| Inspect auto-layout and geometry | Partially available from node context/metadata; verify the returned node fields rather than assume every property is exposed |
| Read styles and tokens | Variables can be requested for a concrete file/node; a complete library crawl was not tested |
| Compare screenshots | Figma screenshots and Playwright/native screenshots exist; automated comparison requires matching viewport/state and a baseline |
| Extract visible text, CTAs, labels, and errors | Possible from accessible design node context; completeness depends on traversing all pages/frames and component variants |
| Extract colors and spacing | Possible where values or variables are returned; store source node IDs and distinguish explicit tokens from inferred measurements |
| Crawl the entire design system | Not verified; no file was supplied. The skill requires a page/frame inventory and an explicit completeness report rather than claiming success after a partial traversal. |

## GitHub repository reconnaissance

Repository metadata was queried through GitHub for the requested projects.
Scores are a subjective fit for this repository's QA objectives (5 = strongest).
Maintenance is based on repository metadata and recent activity visible on
2026-11-11; it is not a code audit. The repositories were not cloned or run.

| Repository | Purpose / relevant use cases | Install / entry point | Fit | Maintenance | Agent integration |
|---|---|---|---:|---|---|
| [appium/appium](https://github.com/appium/appium) | Cross-platform WebDriver server for native, hybrid, and mobile web tests; supports current Android/iOS framework | `npm i -g appium`; `appium driver install <driver-name>` | 5/5 | Active; recent 2026 activity | Medium: start/health-check server, route to explicit device and capabilities |
| [appium/appium-inspector](https://github.com/appium/appium-inspector) | Desktop inspector for Appium sessions and UI hierarchy/locator diagnosis | Download desktop release; connect to a separately running Appium server | 4/5 | Active; recent 2026 activity | Medium: useful interactive triage, not a headless test runner |
| [mobile-dev-inc/maestro](https://github.com/mobile-dev-inc/Maestro) | Declarative mobile UI and end-to-end flows | Install per [Maestro docs](https://maestro.mobile.dev/); run `maestro test <flow>` | 4/5 | Active; recent 2026 activity | Low: YAML flows are agent-readable; align device/build and existing WDIO ownership |
| [microsoft/playwright](https://github.com/microsoft/playwright) | Browser automation, web testing, snapshots, tracing, and network observation | `npm init playwright@latest` | 5/5 | Active; recent 2026 activity | Low: already the repository's web/API framework |
| [axe-core](https://github.com/dequelabs/axe-core) | Automated web accessibility rules engine | `npm install --save-dev axe-core @axe-core/playwright` | 4/5 | Active; recent 2026 activity | Low for web; native mobile audits need platform-specific tools/manual checks |
| [fastlane/fastlane](https://github.com/fastlane/fastlane) | iOS/Android build, signing, release, and distribution automation | Use the official [installation guide](https://docs.fastlane.tools/getting-started/ios/setup/) and supported Ruby setup | 3/5 | Active; recent 2026 activity | Medium: signing and distribution changes need credential/side-effect controls |
| [opencv/opencv](https://github.com/opencv/opencv) | Computer vision and image processing | Install an OS package or a project-specific OpenCV binding | 3/5 | Active; recent 2026 activity | High: native bindings, image normalization, and thresholds need engineering |
| [tesseract-ocr/tesseract](https://github.com/tesseract-ocr/tesseract) | Local OCR for screenshots and image text | macOS: `brew install tesseract`; then install language data as needed | 3/5 | Active; recent 2026 activity | Medium: OCR output needs locale-specific confidence and geometry handling |
| [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | Stateful graph orchestration for multi-step agents | `pip install -U langgraph` | 2/5 | Active; recent 2026 activity | High: unnecessary until orchestration needs durable state beyond the existing agent framework |
| [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) | Role/task multi-agent orchestration | `pip install crewai` | 2/5 | Active; recent 2026 activity | High: overlaps existing Copilot team agents and adds another orchestration runtime |
| [browser-use/browser-use](https://github.com/browser-use/browser-use) | LLM-directed browser interaction | `pip install browser-use`; follow its browser setup guide | 2/5 | Active; recent 2026 activity | High: overlaps Playwright MCP and would need strict test-account and action boundaries |
| [microsoft/WinAppDriver](https://github.com/microsoft/WinAppDriver) | Windows desktop UI automation | Windows-only installer and service; not applicable to Android/iOS | 1/5 | Low activity; last observed push 2025-04 | High: platform mismatch; do not prioritize for this mobile objective |
| [webdriverio/webdriverio](https://github.com/webdriverio/webdriverio) | Node.js browser and mobile automation framework | `npm init wdio@latest` | 5/5 | Active; recent 2026 activity | Low: already used by the repository's Appium mobile stack |
| [pytest-dev/pytest](https://github.com/pytest-dev/pytest) | Python unit/integration test runner | `pip install pytest` | 2/5 | Active; recent 2026 activity | Medium: useful for future Python API tooling, not needed for current TypeScript suites |
| [robotframework/robotframework](https://github.com/robotframework/robotframework) | Keyword-driven acceptance and RPA framework | `pip install robotframework` | 2/5 | Active; recent 2026 activity | Medium/high: new syntax/runtime duplicates current Playwright and WDIO coverage |

The requested `axe-core/axe-core` owner/repository did not resolve; the maintained
upstream found by GitHub search is `dequelabs/axe-core`. Public repository
metadata and README quick-start sections were reviewed; repositories were not
cloned or executed. This is not proof of API compatibility or a review of every
source file. Do not copy upstream examples without checking their current
documentation, licensing, and the repository's execution rules.

## Repository QA skills

The repository includes these current QA procedures. The skills exist as
documents; their presence does not mean every referenced dependency or runtime
is installed.

| Skill | Capability | Current readiness |
|---|---|---|
| `playwright-framework-context` | Web framework conventions and repo behavior | Documented; use before Playwright changes |
| `api-testing` | Postman runner, API contracts, schemas | Documented; local runner/configuration exists |
| `mobile-testing` | WDIO/Appium Android/iOS setup and build routing | Documented; canonical agent/run rules now present; device-backed behavior unverified |
| `mobile-triage` | Mobile failure classification and diagnosis | Documented; actual device/log workflow needs a connected device |
| `test-data-engineer` | QA account/profile and test-data guidance | Documented; account-provider access is environment-dependent |
| `test-plan-generation` | Requirements to test plans | Documented |
| `bug-report-writing` | Defect categorization and Jira-ready reports | Documented; Jira write authorization must still be scoped per run |
| `visual-regression-testing` | Screenshot baseline and dynamic-content handling | Documented; Playwright snapshot support is installed |
| `accessibility-testing` | Web accessibility review with axe | Documented; axe dependencies are absent |
| `performance-testing` | Web/API performance testing | Documented; targets and test environment required |
| `flaky-test-management` | Failure isolation and healing | Documented; applies to existing tests, not a substitute for evidence |
| `test-discovery`, `test-execution`, `test-summary` | Test selection, execution, and triage | Documented; Playwright test MCP is exposed |
| `jira twg` family | Jira, Confluence, search, engineering and artifact workflows | Installed in workspace; Atlassian MCP connected |
| `figma-regression-testing` | Figma structure, copy, tokens, screenshot comparison | Added; requires target design and app evidence |
| `localization-testing` | Five-locale copy/layout/RTL/format checks | Added; requires app locale/build coverage |
| `exploratory-testing` | Bounded risk-led exploration and defect drafting | Added; mobile execution is gated on canonical rules and device readiness |

## Localization, visual, accessibility, and network gaps

- **Localization:** existing repository material is strongest for Spanish and
  historical/partial screens. English, Spanish, French, German, and Japanese
  need explicit app/build/locale coverage. No OCR means visual-only text capture
  cannot currently be called complete. The new skill covers missing/mixed or
  hardcoded text, clipping, RTL directionality, and locale-sensitive currency,
  dates, and numbers.
- **Visual regression:** Playwright can compare screenshot snapshots; `sharp`
  can transform images. No OpenCV, pixelmatch, dedicated visual-testing MCP, or
  vision model was verified. Snapshot baselines still require approved expected
  states and controlled viewport/data.
- **Accessibility:** install `axe-core` and `@axe-core/playwright` for web
  scanning. For native apps, add device-backed TalkBack/VoiceOver checks for
  names, hints, focus order, touch target size, and contrast. Automated checks
  alone do not certify WCAG 2.2, ADA, or Section 508 conformance.
- **Network:** Playwright request/response capture and a mobile interceptor are
  available locally. Charles, mitmproxy, BrowserStack network logs, and a
  network MCP are not. Any proxy/certificate testing must be limited to
  authorized test apps and devices; do not bypass production protections.

## Recommended implementation order

1. **Appium:** already installed. Add a connected/emulated Android device and
   booted iOS simulator, verify Appium health, then run one approved smoke flow
   on each platform. Put the Android SDK tools on the execution PATH.
2. **Maestro:** install from the official documentation and pilot a read-only,
   deterministic flow alongside WDIO before choosing a long-term owner.
3. **Figma MCP:** connection and top-level page listing are verified. Select an
   approved page/node; inventory frames, components, variables, and text; record
   unvisited nodes and access limitations.
4. **Jira MCP:** already connected. Validate ticket fields/comments/attachments
   on an approved ticket, map acceptance criteria to tests, and gate Jira
   writes behind the run's explicit defect-creation authorization.
5. **GitHub MCP:** already connected. Link execution output and test changes to
   the current repository/branch without exposing private data to third parties.
6. **Visual regression:** establish controlled screenshot baselines with
   Playwright; later evaluate OpenCV only if pixel-level classification is
   needed beyond native snapshot diffs.
7. **OCR:** install Tesseract and required language packs if accessibility
   trees/source strings cannot supply UI copy.
8. **Accessibility:** add axe dependencies for web; define device-backed native
   TalkBack/VoiceOver checks and human review.
9. **BrowserStack:** provision an approved account/plan and MCP, use secret
   storage for access keys, then verify device availability and network logs.
10. **Network validation:** choose Charles or mitmproxy for authorized QA
    environments, document certificate handling, and correlate API responses,
    analytics, feature flags, and contracts.

Additional dependencies before the ultimate objective: use the restored
canonical mobile runbook; decide whether Firebase Test Lab is required; provide
an app, build, authorized test account, Figma node, Jira issue key, locale
matrix, and test environment; and define whether defects may be created
automatically or only drafted.

## Deliverable skills

- [Figma regression testing](skills/figma-regression-testing/SKILL.md)
- [Localization testing](skills/localization-testing/SKILL.md)
- [Exploratory testing](skills/exploratory-testing/SKILL.md)

These are execution procedures, not evidence that the missing services or
end-to-end capabilities have been installed or validated.
