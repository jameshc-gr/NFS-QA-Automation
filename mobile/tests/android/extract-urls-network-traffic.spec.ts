import { describe, it, before, after } from 'mocha';
import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import { AuthPage } from '../../src/pages/auth.page';
import { getAutomationAccount } from '../../src/utils/mobile-auth';

describe('Extract Video URLs via Network Traffic', function () {
  let authPage: AuthPage;

  before(async function () {
    authPage = new AuthPage();
  });

  after(async function () {
    try {
      await browser.deleteSession();
    } catch (e) {
      // cleanup
    }
  });

  it('should extract video URLs by monitoring network traffic', async function () {
    console.log('\n════════════════════════════════════════════════');
    console.log('NETWORK TRAFFIC MONITORING - Video URL Extraction');
    console.log('════════════════════════════════════════════════\n');

    // Start tcpdump to capture network traffic
    const tcpdumpLogFile = path.resolve(process.cwd(), 'mobile/.builds/network-traffic.pcap');
    const udid = 'emulator-5554';

    console.log('[1] Starting network traffic capture...');
    try {
      // Start tcpdump on the emulator (captures all traffic)
      const tcpdumpProcess = spawn('adb', ['-s', udid, 'shell', 'tcpdump', '-i', 'any', '-w', '/data/local/tmp/traffic.pcap']);
      
      // Give tcpdump time to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('✓ Network capture started\n');

      // Login
      console.log('[2] Authenticating...');
      const { email, password } = getAutomationAccount('login');
      await authPage.openLogin();
      await authPage.login(email, password);
      await authPage.completeLoginVerification(email);
      console.log('✓ Logged in\n');

      // Navigate to video feed
      console.log('[3] Navigating to video feed...');
      await browser.pause(3000);

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

      // Check for rating dialog and close it
      try {
        const noButton = await browser.$('//android.widget.Button');
        if (noButton) {
          await noButton.click();
          await browser.pause(500);
        }
      } catch (e) {
        // No dialog
      }

      console.log('✓ Video feed accessed\n');

      // Click to play video
      console.log('[4] Playing video...');
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
        await browser.pause(3000);
      } catch (e) {
        console.log('Tap skipped');
      }

      console.log('✓ Video playing\n');

      console.log('[5] Capturing HTTP requests from logcat...');
      
      // Extract tcpdump file and analyze
      try {
        execSync(`adb -s ${udid} pull /data/local/tmp/traffic.pcap ${tcpdumpLogFile}`);
        console.log(`✓ Network capture saved to: mobile/.builds/network-traffic.pcap`);
      } catch (e) {
        console.log(`⚠️ Could not extract pcap file`);
      }

      // Also check logcat for HTTP requests
      const logcatRaw = execSync(`adb -s ${udid} logcat -d | grep -i "http\\|youtube\\|vimeo\\|instagram" | tail -50`).toString();
      
      const logcatFile = path.resolve(process.cwd(), 'mobile/.builds/logcat-http-requests.txt');
      fs.writeFileSync(logcatFile, logcatRaw);
      console.log(`✓ Logcat saved to: mobile/.builds/logcat-http-requests.txt (${logcatRaw.split('\n').length} lines)\n`);

      // Parse URLs from logcat
      const urlPattern = /https?:\/\/[^\s]+/gi;
      const urlMatches = logcatRaw.match(urlPattern) || [];
      const uniqueUrls = Array.from(new Set(urlMatches));

      console.log(`[6] Extracted URLs from logcat:\n`);
      console.log(`Total URL matches: ${urlMatches.length}`);
      console.log(`Unique URLs: ${uniqueUrls.length}\n`);

      if (uniqueUrls.length > 0) {
        console.log('URLs found:');
        uniqueUrls.slice(0, 20).forEach((url, idx) => {
          console.log(`  [${idx + 1}] ${url.substring(0, 100)}`);
        });
        if (uniqueUrls.length > 20) {
          console.log(`  ... and ${uniqueUrls.length - 20} more`);
        }
      }

      // Filter for video platform URLs specifically
      const videoUrls = uniqueUrls.filter(url => 
        url.match(/youtube|youtu\.be|vimeo|instagram/i)
      );

      console.log(`\nVideo platform URLs: ${videoUrls.length}`);
      if (videoUrls.length > 0) {
        videoUrls.forEach((url, idx) => {
          console.log(`  [${idx + 1}] ${url}`);
        });
      }

      // Save results
      const results = {
        timestamp: new Date().toISOString(),
        platform: 'android',
        method: 'network-traffic-capture',
        totalUrlsExtracted: urlMatches.length,
        uniqueUrls: uniqueUrls.length,
        videoPlatformUrls: videoUrls.length,
        videoUrls: videoUrls,
        allUrls: uniqueUrls,
        files: {
          pcap: 'network-traffic.pcap',
          logcat: 'logcat-http-requests.txt'
        }
      };

      const resultsFile = path.resolve(process.cwd(), 'mobile/.builds/network-extracted-urls.json');
      fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));

      console.log(`\n✓ Results saved to: mobile/.builds/network-extracted-urls.json`);

      // Cleanup tcpdump
      try {
        execSync(`adb -s ${udid} shell pkill -f tcpdump`);
      } catch (e) {
        // Cleanup failed, ignore
      }

    } catch (error) {
      console.log(`Network capture error: ${error}`);
    }
  });
});
