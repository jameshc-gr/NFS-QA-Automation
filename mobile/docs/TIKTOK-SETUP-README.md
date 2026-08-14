# MSAM-7880: TikTok Feed URL Extraction Test Suite - Implementation Summary

## Overview

A complete automated test suite has been created to extract TikTok video URLs from the mobile app's "Wellness that works" section and validate them against a reference Excel file. This solution handles both Android and iOS platforms with platform-specific optimizations.

## What Was Created

### 1. Test Specifications (2 files)
- **mobile/tests/android/tiktok-feed-urls.spec.ts** - Android test runner
- **mobile/tests/ios/tiktok-feed-urls.spec.ts** - iOS test runner

Both tests:
- Log into the app using existing credentials from `login.yml`
- Find and click the "Wellness that works" banner (with fallback selectors)
- Swipe through the TikTok feed collecting URLs
- Extract URLs from both network requests and page source
- Deduplicate URLs automatically
- Save results to JSON files
- Compare with Excel reference file (if provided)
- Generate detailed mismatch reports

### 2. Page Object Layer (1 file)
**mobile/src/pages/tiktok.page.ts** - TikTokPage class
- Platform-aware selectors (iOS accessibility IDs vs Android resource-ids)
- `findAndClickWellnessBanner()` - Multiple fallback selector strategies
- `swipeUpToNextVideo()` - Gesture handling for both platforms
- `captureNetworkRequests()` - Network log extraction
- `extractUrlsFromPageSource()` - HTML pattern matching
- `closeTikTokFeed()` - Clean shutdown

### 3. Business Logic Layer (1 file)
**mobile/src/utils/tiktok-url-manager.ts** - TikTokUrlManager class
- URL collection with automatic deduplication
- URL normalization (protocol-agnostic, query-param stripping)
- Excel file parsing and loading
- URL comparison and mismatch detection
- Report generation with human-readable summaries
- JSON persistence for results

### 4. Helper Script (1 file)
**scripts/tiktok-url-validator.ts** - Command-line utility
- Validate Excel file format
- Compare collected URLs with Excel reference
- Generate reports from collected data

### 5. Documentation (2 files)
- **mobile/docs/TIKTOK-FEED-EXTRACTION.md** - Complete user guide
- **TIKTOK-SETUP-README.md** - This implementation summary

### 6. NPM Scripts (8 commands)
Test runners:
```bash
npm run test:mobile:android:tiktok           # Android default
npm run test:mobile:android:tiktok:qa        # Android QA
npm run test:mobile:android:tiktok:stage     # Android stage
npm run test:mobile:android:tiktok:prod      # Android prod

npm run test:mobile:ios:tiktok               # iOS default
npm run test:mobile:ios:tiktok:qa            # iOS QA
npm run test:mobile:ios:tiktok:stage         # iOS stage
npm run test:mobile:ios:tiktok:prod          # iOS prod
```

Validation helpers:
```bash
npm run validate:tiktok-excel                # Validate Excel file
npm run compare:tiktok-urls                  # Compare collected vs Excel
npm run report:tiktok                        # Generate report
```

## Quick Start

### Prerequisites
1. Mobile app with "Wellness that works" banner (stage build mentioned in MSAM-7880)
2. Appium + WebdriverIO setup (already configured in your workspace)
3. Login credentials in `test-data/mobile-app/gri/android/login.yml`
4. Excel file: `everything-wellness-content.xlsx` from MSAM-7880 attachment

### Get the Excel File
1. Open MSAM-7880 in Jira
2. Download the `everything-wellness-content.xlsx` attachment
3. Save to: `mobile/.builds/everything-wellness-content.xlsx`

### Run Extraction Test

**For Android:**
```bash
# QA build (easiest to start)
npm run test:mobile:android:tiktok:qa

# Stage build (as mentioned in MSAM-7880)
npm run test:mobile:android:tiktok:stage

# Production build
npm run test:mobile:android:tiktok:prod
```

**For iOS:**
```bash
# QA build
npm run test:mobile:ios:tiktok:qa

# Stage build
npm run test:mobile:ios:tiktok:stage

# Production build
npm run test:mobile:ios:tiktok:prod
```

### Review Results

After the test completes, three outputs are available:

1. **Console Output** - Real-time progress and summary
   - Videos processed
   - URLs collected
   - Duplicates found
   - Excel match percentage

2. **JSON Results** - Programmatic access
   - `mobile/.builds/tiktok-urls-collected.json` - All URLs extracted
   - `mobile/.builds/tiktok-urls-mismatch-report.json` - Comparison results

3. **Helper Commands**
   ```bash
   # View comparison report
   npm run compare:tiktok-urls
   
   # Validate Excel file format
   npm run validate:tiktok-excel
   ```

## Test Execution Flow

```
┌─────────────────────────────────────────┐
│ 1. LOGIN                                 │
│   - Open app                             │
│   - Enter credentials from login.yml     │
│   - Complete MFA/email verification     │
│   - Assert home screen reached           │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│ 2. FIND WELLNESS BANNER                 │
│   - Use multiple selector strategies    │
│   - Take screenshot before click        │
│   - Wait for TikTok feed to load        │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│ 3. COLLECT URLS (Loop)                  │
│   For each video:                        │
│   - Capture network requests            │
│   - Extract URLs from page source       │
│   - Deduplicate                         │
│   - Swipe to next video                 │
│   Stop when 3 consecutive show no new   │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│ 4. SAVE RESULTS                         │
│   - tiktok-urls-collected.json          │
│   - Unique URL count                    │
│   - Session metadata                    │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│ 5. COMPARE WITH EXCEL (if available)   │
│   - Load URLs from Excel file           │
│   - Find URLs in feed but not Excel     │
│   - Find URLs in Excel but not in feed  │
│   - Calculate match percentage          │
│   - Save tiktok-urls-mismatch-report.json
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│ 6. CLOSE FEED & CLEANUP                 │
│   - Close TikTok feed modal             │
│   - Verify back on home screen          │
│   - Print final summary                 │
└─────────────────────────────────────────┘
```

## Output Files Explained

### tiktok-urls-collected.json
Contains all URLs extracted from the feed:
```json
{
  "timestamp": "2024-08-10T15:30:00.000Z",
  "buildInfo": "1.50-prod (401)",
  "platform": "android",
  "environment": "prod",
  "totalVideos": 45,
  "urls": [
    "https://www.tiktok.com/@wellness/video/123456",
    "https://vm.tiktok.com/abcdef",
    ...
  ],
  "duplicatesFound": 3,
  "sessionDuration": 245
}
```

### tiktok-urls-mismatch-report.json
Comparison results with Excel file:
```json
{
  "timestamp": "2024-08-10T15:30:00.000Z",
  "totalFromFeed": 45,
  "totalFromExcel": 50,
  "urlsInFeedButNotInExcel": [
    "https://www.tiktok.com/@unlisted/video/999"
  ],
  "urlsInExcelButNotInFeed": [
    "https://www.tiktok.com/@missing/video/111"
  ],
  "commonUrls": [...],
  "matchPercentage": 90
}
```

## Key Features

### URL Deduplication
- Automatically removes duplicate URLs
- Normalizes URLs (protocol-agnostic, removes query params/fragments)
- Handles URL encoding/decoding variants
- Tracks duplicate count separately

### Multiple URL Extraction Methods
1. **Network Request Capture** - Primary method when available
   - Intercepts TikTok API calls
   - Extracts URLs from request payloads

2. **Page Source Parsing** - Fallback method
   - Pattern matching on page HTML
   - Supports multiple URL formats (tiktok.com, vm.tiktok.com, vt.tiktok.com)

### Cross-Platform Compatibility
- **iOS**: Accessibility IDs, XCUITest selectors, SwiftUI handling
- **Android**: resource-id, content-desc, Compose UI handling
- Automatic platform detection and selector routing
- Platform-specific gesture implementation

### Excel Comparison
- Automatic Excel file parsing (requires `xlsx` npm package)
- Identifies **critical issues**: URLs in feed but NOT in Excel (unlisted content!)
- Identifies **informational gaps**: URLs in Excel but not in current feed
- Calculates match percentage for quality metrics

### Detailed Reporting
- Console output with real-time progress
- JSON files for machine-readable results
- Human-readable summary report
- Platform and environment metadata

## Troubleshooting

### Test Won't Find Wellness Banner
```bash
# Check what's visible on home screen
# Screenshot is saved before clicking:
cat mobile/.builds/before-wellness-click.png

# Update selectors in tiktok.page.ts:
# wellnessChecklistBannerCandidates array
```

### No URLs Collected
- Verify app can reach TikTok content
- Check network connectivity on device
- Enable debug logging in `tiktok.page.ts`
- Increase timeout values if content loads slowly

### Excel File Not Found
```bash
# Verify file location
ls -la mobile/.builds/everything-wellness-content.xlsx

# Validate Excel format
npm run validate:tiktok-excel
```

### URL Comparison Not Running
```bash
# Install xlsx if needed
npm install xlsx --save-dev

# Verify collected URLs file exists
ls -la mobile/.builds/tiktok-urls-collected.json
```

## Running in CI/CD

### GitHub Actions Example
```yaml
- name: Run TikTok URL Extraction
  run: |
    npm run test:mobile:android:tiktok:qa

- name: Validate Excel Reference
  run: npm run validate:tiktok-excel

- name: Compare URLs
  run: npm run compare:tiktok-urls

- name: Fail on Unlisted URLs
  run: |
    UNLISTED=$(jq '.urlsInFeedButNotInExcel | length' \
      mobile/.builds/tiktok-urls-mismatch-report.json)
    if [ "$UNLISTED" -gt 0 ]; then
      echo "❌ Found $UNLISTED unlisted URLs!"
      cat mobile/.builds/tiktok-urls-mismatch-report.json
      exit 1
    fi
```

## Platform-Specific Notes

### iOS
- Accessibility IDs must be type-filtered due to shared names
- Swipe uses WebDriver Actions (most compatible)
- Network requests available via XCUITest WebDriverAgent
- May need `appium:connectHardwareKeyboard: true` capability

### Android
- Uses both `mobile: swipeGesture` and fallback touch actions
- Soft keyboard auto-hidden before UI interaction
- Network request capture requires Appium 2.0+
- Compose UI requires specific content-desc patterns

## Extension Points

### Add Custom URL Patterns
Edit `extractUrlsFromPageSource()` in `tiktok.page.ts`:
```typescript
const patterns = [
  // Add your custom pattern here
  /https:\/\/custom-domain\.com\/[\w]+/gi
];
```

### Customize Swipe Behavior
Edit `swipeUpToNextVideo()`:
```typescript
duration: 500,  // Change swipe speed
percent: 0.75   // Change swipe distance
```

### Modify Deduplication Logic
Edit `normalizeUrl()` in `tiktok-url-manager.ts`:
```typescript
// Remove tracking params, special domains, etc.
normalized = normalized.replace(/[utm_|fbclid=].*/g, '');
```

## Related Documentation

- [Complete User Guide](mobile/docs/TIKTOK-FEED-EXTRACTION.md)
- [Login-Logout Test](mobile/tests/android/login-logout.spec.ts) - Reference implementation
- [Mobile Test Setup](mobile/wdio.conf.ts) - WebdriverIO configuration
- [MSAM-7880 Jira Ticket](https://guaranteed-rate.atlassian.net/browse/MSAM-7880)

## Success Criteria

The implementation is complete and ready to use when:
- ✅ Test specs created for Android and iOS
- ✅ Page objects with platform-specific selectors
- ✅ URL manager with deduplication and normalization
- ✅ Excel file parsing and comparison
- ✅ Helper scripts and npm commands
- ✅ Comprehensive documentation
- ⏳ Awaiting Excel file from MSAM-7880 for live testing

## Next Steps

1. **Obtain Excel File** - Download from MSAM-7880 attachment
2. **Place Excel File** - Save to `mobile/.builds/everything-wellness-content.xlsx`
3. **Run Test** - Execute `npm run test:mobile:android:tiktok:stage` (or appropriate build)
4. **Review Results** - Check `tiktok-urls-mismatch-report.json` for any unlisted URLs
5. **Report Findings** - Document results back to MSAM-7880

## Support

For issues or questions:
1. Check [TIKTOK-FEED-EXTRACTION.md](mobile/docs/TIKTOK-FEED-EXTRACTION.md) troubleshooting section
2. Review console output and JSON files for details
3. Take screenshots saved in `mobile/.builds/` for debugging
4. Verify environment variables (MOBILE_ENV, MOBILE_ANDROID_BUILD, etc.)

---

**Implementation Date**: 2026-08-10  
**Status**: Ready for Testing  
**Ticket**: MSAM-7880
