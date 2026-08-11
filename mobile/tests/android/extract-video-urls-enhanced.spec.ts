import { describe, it, before, after } from 'mocha';
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { AuthPage } from '../../src/pages/auth.page';
import { getAutomationAccount } from '../../src/utils/mobile-auth';

describe('Android Video Feed URL Extraction - Enhanced', function () {
  let authPage: AuthPage;

  before(async function () {
    authPage = new AuthPage();
    console.log('\n══════════════════════════════════════════════════');
    console.log('ENHANCED VIDEO URL EXTRACTION - Android QA Build');
    console.log('Platforms: YouTube / Vimeo / Instagram');
    console.log('══════════════════════════════════════════════════\n');
  });

  after(async function () {
    try {
      await browser.deleteSession();
    } catch (e) {
      console.log('Session cleanup skipped');
    }
  });

  it('should extract all video URLs using enhanced methods', async function () {
    // Step 1: Login
    console.log('[Step 1] Authenticating...');
    const { email, password } = getAutomationAccount('login');
    await authPage.openLogin();
    await authPage.login(email, password);
    await authPage.completeLoginVerification(email);
    console.log('✓ Logged in\n');

    // Step 2: Navigate and wait for video feed
    console.log('[Step 2] Accessing video feed...');
    await browser.pause(3000);
    
    // Scroll to wellness section
    const size = await browser.getWindowSize();
    for (let i = 0; i < 3; i++) {
      try {
        await browser.executeScript('mobile: swipeGesture', {
          left: Math.floor(size.width * 0.5),
          top: Math.floor(size.height * 0.7),
          width: Math.floor(size.width * 0.5),
          height: Math.floor(size.height * 0.3),
          direction: 'up',
          percent: 0.75
        });
        await browser.pause(500);
      } catch (e) {
        // Continue
      }
    }

    // Click YouTube icon at coordinates
    try {
      await browser.performActions([
        {
          type: 'pointer',
          id: 'finger',
          parameters: { pointerType: 'touch' },
          actions: [
            { type: 'pointerMove', duration: 0, x: Math.floor(size.width * 0.78), y: Math.floor(size.height * 0.72) },
            { type: 'pointerDown', button: 0 },
            { type: 'pause', duration: 50 },
            { type: 'pointerUp', button: 0 }
          ]
        }
      ]);
      await browser.pause(2000);
    } catch (e) {
      console.log('YouTube tap skipped');
    }

    console.log('✓ Video feed accessed\n');

    // Step 3: Try to extract via adb shell and WebView debugging
    console.log('[Step 3] Extracting video URLs via multiple methods...\n');
    
    const collectedUrls = new Set<string>();
    
    // Method A: Check device logs for HTTP requests
    try {
      console.log('  Method A: Checking device logs for video URLs...');
      const udid = 'emulator-5554';
      const logcat = execSync(`adb -s ${udid} logcat -d | grep -i "youtube\\|vimeo\\|instagram" | head -20`).toString();
      
      if (logcat.length > 0) {
        const urlMatches = logcat.match(/https?:\/\/[^\s]+/g) || [];
        urlMatches.forEach(url => collectedUrls.add(url));
        console.log(`    Found ${urlMatches.length} URLs in logs`);
      } else {
        console.log(`    No video URLs in logcat`);
      }
    } catch (e) {
      console.log(`    Logcat method unavailable`);
    }

    // Method B: Try to access WebView through direct execution
    try {
      console.log('\n  Method B: Attempting direct WebView JavaScript execution...');
      
      // First, take a screenshot and check page source
      const pageSource = await browser.getPageSource();
      
      // Look for iframe data attributes
      const iframeMatches = pageSource.match(/data-url="[^"]*(?:youtube|vimeo|instagram)[^"]*"/gi) || [];
      iframeMatches.forEach(match => {
        const url = match.replace('data-url="', '').replace('"', '');
        collectedUrls.add(url);
      });
      
      if (iframeMatches.length > 0) {
        console.log(`    Found ${iframeMatches.length} iframe URLs`);
      }
      
      // Look for src attributes
      const srcMatches = pageSource.match(/src="[^"]*(?:youtube|vimeo|instagram)[^"]*"/gi) || [];
      srcMatches.forEach(match => {
        const url = match.replace('src="', '').replace('"', '');
        collectedUrls.add(url);
      });
      
      if (srcMatches.length > 0) {
        console.log(`    Found ${srcMatches.length} src attributes`);
      }
    } catch (e) {
      console.log(`    Direct execution method failed`);
    }

    // Method C: Capture network requests (if available)
    try {
      console.log('\n  Method C: Checking network interceptor...');
      const networkRequests = await browser.getNetworkRequests?.() || [];
      const videoRequests = networkRequests.filter((req: any) => 
        (req.url || '').includes('youtube') || 
        (req.url || '').includes('vimeo') || 
        (req.url || '').includes('instagram')
      );
      
      videoRequests.forEach((req: any) => {
        if (req.url) collectedUrls.add(req.url);
      });
      
      if (videoRequests.length > 0) {
        console.log(`    Found ${videoRequests.length} network requests`);
      } else {
        console.log(`    No video network requests intercepted`);
      }
    } catch (e) {
      console.log(`    Network intercept unavailable`);
    }

    // Step 4: Save results
    console.log('\n[Step 4] Saving results...\n');
    
    const results = {
      timestamp: new Date().toISOString(),
      platform: 'android',
      buildInfo: '1.48-qa (build 1214)',
      environment: 'qa',
      videoSource: 'YouTube/Vimeo/Instagram',
      methodsAttempted: ['logcat', 'direct-webview', 'network-intercept'],
      urlsFound: Array.from(collectedUrls),
      totalUrls: collectedUrls.size,
      note: 'WebView content in hybrid Compose app is not directly accessible via Appium UiAutomator2'
    };

    const outputPath = path.resolve(process.cwd(), 'mobile/.builds/android-all-video-urls.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    
    console.log(`✓ Results saved to: mobile/.builds/android-all-video-urls.json`);
    console.log(`\nURLs Found: ${collectedUrls.size}`);
    
    if (collectedUrls.size > 0) {
      console.log('\nExtracted URLs:');
      Array.from(collectedUrls).forEach((url, idx) => {
        console.log(`  [${idx + 1}] ${url}`);
      });
    } else {
      console.log('\n⚠️  No video URLs could be extracted via available methods.');
      console.log('This is a known limitation: WebView content in Appium hybrid apps');
      console.log('requires specialized debugging setup or alternative extraction methods.');
    }
  });
});
