# TikTok Feed URL Extraction - MSAM-7880

## Overview

This test suite extracts all TikTok video URLs from the "Wellness that works" section of the mobile app and validates them against the reference Excel file (`everything-wellness-content.xlsx`) attached to MSAM-7880.

## Features

- **Automated login** using existing credentials from `login.yml`
- **Wellness banner discovery** with fallback selectors for both iOS and Android
- **Network log capture** to extract TikTok URLs from requests
- **Page source analysis** as a fallback method for URL extraction
- **URL deduplication** to ensure accurate counting
- **Excel file comparison** to identify:
  - URLs in the feed that should NOT be there (unlisted URLs)
  - URLs in the Excel reference that are missing from the feed
- **Comprehensive reporting** with mismatch analysis

## Prerequisites

### Required
1. **Mobile app build** (stage, QA, or prod) - ensure MOBILE_ENV and build version match
2. **Login credentials** in `test-data/mobile-app/gri/android/login.yml` (shared for iOS)
3. **Appium + WebdriverIO setup** (already configured in your project)

### Optional
1. **Excel file**: `everything-wellness-content.xlsx` from MSAM-7880
   - Place at: `mobile/.builds/everything-wellness-content.xlsx`
   - Expected format: URL column (first column by default, configurable)
   - Without this file, the test will still collect URLs but won't generate the comparison report

## Installation

No additional dependencies beyond what's already in the project. The test uses:
- `xlsx` (if available) for Excel parsing - optional, will skip comparison if not installed
- Built-in WebdriverIO network capture methods

## Running the Tests

### Android
```bash
# Run with default QA build
npm run test:mobile:android:tiktok

# Run with specific build
MOBILE_ANDROID_BUILD=prod MOBILE_ENV=prod npx wdio run mobile/wdio.conf.ts --spec="tests/android/tiktok-feed-urls.spec.ts"

# Run with stage build (if available)
MOBILE_ENV=stage npx wdio run mobile/wdio.conf.ts --spec="tests/android/tiktok-feed-urls.spec.ts"
```

### iOS
```bash
# Run with default QA build
MOBILE_PLATFORM=ios npm run test:mobile:ios:tiktok

# Run with specific build
MOBILE_PLATFORM=ios MOBILE_IOS_BUILD=stage-simulator MOBILE_ENV=stage npx wdio run mobile/wdio.conf.ts --spec="tests/ios/tiktok-feed-urls.spec.ts"

# Run with prod build
MOBILE_PLATFORM=ios MOBILE_IOS_BUILD=prod MOBILE_ENV=prod npx wdio run mobile/wdio.conf.ts --spec="tests/ios/tiktok-feed-urls.spec.ts"
```

## Output Files

All files are saved to `mobile/.builds/`:

1. **tiktok-urls-collected.json**
   - Complete list of all unique URLs collected
   - Metadata: timestamp, build info, platform, environment, duration
   - Example:
     ```json
     {
       "timestamp": "2024-08-10T15:30:00.000Z",
       "buildInfo": "1.50-prod (401)",
       "platform": "android",
       "environment": "prod",
       "totalVideos": 45,
       "urls": ["https://www.tiktok.com/...", ...],
       "duplicatesFound": 3,
       "sessionDuration": 245
     }
     ```

2. **tiktok-urls-mismatch-report.json** (if Excel file provided)
   - Detailed comparison results
   - Lists URLs that are problematic (in feed but not in Excel)
   - Match percentage

3. **before-wellness-click.png**
   - Screenshot of the home screen before clicking wellness banner

4. **Diagnostic XML/screenshots** (if errors occur)
   - Used for debugging selector issues

## Excel File Setup

### Getting the File
1. Go to MSAM-7880 in Jira
2. Download the `everything-wellness-content.xlsx` attachment
3. Save to: `mobile/.builds/everything-wellness-content.xlsx`

### Expected Format
- Column 1: TikTok URLs (full URLs like `https://www.tiktok.com/@creator/video/12345`)
- Any additional columns are ignored
- Empty rows are skipped
- The script auto-detects rows containing "tiktok" domain

### Custom Column
If your Excel file has URLs in a different column:
```typescript
// In the test file, modify the comparison call:
await urlManager.compareWithExcelFile(excelPath, 2); // 0-indexed, so 2 = 3rd column
```

## Test Logic

1. **Login Phase**
   - Opens app and logs in using credentials from `login.yml`
   - Completes any MFA/email verification
   - Asserts successful navigation to home screen

2. **Banner Discovery**
   - Finds "Wellness that works" banner using multiple selector strategies
   - Handles both iOS (accessibility IDs) and Android (resource-id/content-desc)
   - Takes screenshot before click for debugging

3. **URL Collection Loop**
   - For each video in the feed:
     - Attempts to capture network requests
     - Extracts URLs from page source as fallback
     - Deduplicates all URLs
     - Swipes up to next video
   - Stops when:
     - 3 consecutive videos show no new URLs (likely reached end)
     - Safety limit of 100 videos is reached
     - Feed appears empty

4. **Data Management**
   - All URLs are normalized (protocol-agnostic, no query params)
   - Duplicates are counted but not stored
   - Timestamp and session metadata are recorded

5. **Comparison Phase** (if Excel file present)
   - Normalizes URLs from both sources for fair comparison
   - Identifies mismatches:
     - **CRITICAL**: URLs in feed but NOT in Excel (unlisted content!)
     - INFO: URLs in Excel but not currently in feed (could be seasonal/rotated)
   - Generates human-readable report

## Common Issues & Troubleshooting

### "Could not find 'Wellness that works' banner"
- Verify the wellness banner is visible on the home screen (might need to scroll)
- Add selector to `wellnessChecklistBannerCandidates` in `tiktok.page.ts`
- Check screenshot: `mobile/.builds/before-wellness-click.png`

### "TikTok feed did not load within 15 seconds"
- Verify the app can reach TikTok content
- Check network connectivity on the device
- Increase timeout in `tiktok.page.ts`: `{ timeout: 30000 }`

### "No new URLs collected"
- Verify network logs are available on your platform/Appium version
- Check the extracted page source for URL patterns
- Add debugging to `extractUrlsFromPageSource()` to log what's found

### Excel comparison not running
- Ensure `mobile/.builds/everything-wellness-content.xlsx` file exists
- Check that `xlsx` npm package is installed: `npm ls xlsx`
- Try installing it: `npm install xlsx --save-dev`

### Mismatches reported but shouldn't be
- Verify URL normalization logic is correct
- Check for encoding issues: URLs with `%20` vs spaces
- Review the generated `tiktok-urls-mismatch-report.json` for actual differences

## Test Reports

### Console Output
The test logs:
- Real-time progress (which video, how many URLs added)
- Session summary with unique/duplicate counts
- Detailed mismatch report if Excel comparison runs

### JSON Reports
Both reports are machine-readable for CI/CD integration:
- Parse `tiktok-urls-mismatch-report.json` to fail a pipeline if unlisted URLs found
- Track `totalVideos` and `duplicatesFound` trends across builds
- Monitor `matchPercentage` for feed quality

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Extract TikTok Feed URLs
  run: |
    MOBILE_ENV=qa MOBILE_ANDROID_BUILD=qa npx wdio run mobile/wdio.conf.ts \
      --spec="tests/android/tiktok-feed-urls.spec.ts"

- name: Check for Unlisted URLs
  run: |
    if [ -f mobile/.builds/tiktok-urls-mismatch-report.json ]; then
      UNLISTED=$(jq '.urlsInFeedButNotInExcel | length' mobile/.builds/tiktok-urls-mismatch-report.json)
      if [ "$UNLISTED" -gt 0 ]; then
        echo "❌ Found $UNLISTED unlisted URLs in TikTok feed!"
        exit 1
      fi
    fi
```

## Platform-Specific Notes

### Android
- Uses both `mobile: swipeGesture` and fallback touch actions for swiping
- Soft keyboard auto-hidden before interacting with UI elements
- Network requests available if Appium supports `getNetworkRequests()`

### iOS
- Accessibility IDs use Xcode naming convention (`~name`)
- Swipe uses WebDriver Actions API (most compatible)
- Page source often available via XCUITest WebDriverAgent

## Extending the Test

### Add Different URLs to Check
Modify `extractUrlsFromPageSource()` patterns in `tiktok.page.ts`:
```typescript
const patterns = [
  // Add custom URL pattern here
  /https:\/\/custom-domain\.com\/[\w]+/gi
];
```

### Change Swipe Behavior
Adjust swipe distance and duration in `swipeUpToNextVideo()`:
```typescript
duration: 500, // ms - increase for slower swipes
percent: 0.75  // 0-1 - portion of screen to swipe
```

### Modify Deduplication Logic
The `normalizeUrl()` method in `TikTokUrlManager` can be customized:
```typescript
// Remove tracking parameters, custom domains, etc.
private normalizeUrl(url: string): string {
  // ... existing code ...
  normalized = normalized.replace(/[utm_|fbclid=].*/g, ''); // Remove tracking
  return normalized;
}
```

## Support & Notes

- **Ticket**: MSAM-7880
- **Created**: 2026-08-10
- **Test Authors**: Automated test suite
- **Maintenance**: Update selectors if app UI changes, validate URL patterns with new TikTok format

## Related Files
- Test specs: `mobile/tests/{android,ios}/tiktok-feed-urls.spec.ts`
- Page object: `mobile/src/pages/tiktok.page.ts`
- URL manager: `mobile/src/utils/tiktok-url-manager.ts`
- Existing login flow: `mobile/tests/{android,ios}/login-logout.spec.ts`
