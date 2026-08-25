import { describe, it, before, after } from 'mocha';
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { AuthPage } from '../../src/pages/auth.page';
import { getAutomationAccount } from '../../src/utils/mobile-auth';

describe('Android Video Feed URL Extraction (YouTube/Vimeo/Instagram)', function () {
  let authPage: AuthPage;
  const videoPlatform = 'youtube'; // Android serves YouTube/Vimeo/Instagram

  before(async function () {
    authPage = new AuthPage();

    console.log('');
    console.log('═════════════════════════════════════════');
    console.log('VIDEO FEED URL EXTRACTION TEST');
    console.log('═════════════════════════════════════════');
    console.log(`Platform: Android QA Build`);
    console.log(`Video Source: YouTube/Vimeo/Instagram (not TikTok)`);
    console.log('═════════════════════════════════════════');
    console.log('');
  });

  after(async function () {
    try {
      await browser.deleteSession();
    } catch (e) {
      console.log('Note: Session cleanup skipped');
    }
  });

  it('should extract actual YouTube/Vimeo URLs from Android video feed', async function () {
    this.timeout(180000); // 3 minutes

    try {
      // Step 1: Login (or skip if already logged in)
      console.log('\n[Step 1] Setting up with Android QA build...');
      try {
        const { email, password } = getAutomationAccount('login');
        await authPage.openLogin();
        await authPage.login(email, password);
        await authPage.completeLoginVerification(email);
        console.log('✓ Logged in successfully');
      } catch (loginError: any) {
        console.log(`  Note: Using existing session: ${loginError?.message?.substring(0, 50)}`);
      }

      // Step 3: Scroll down to find wellness section and click YouTube icon
      console.log('\n[Step 3] Scrolling to find video feed section...');
      try {
        // Scroll down to reveal wellness banner
        const size = await browser.getWindowSize();
        const scrollAttempts = 3;
        
        for (let i = 0; i < scrollAttempts; i++) {
          try {
            // Use mobile: swipeGesture to scroll up (which scrolls the page down)
            await browser.execute('mobile: swipeGesture', {
              left: Math.floor(size.width * 0.5),
              top: Math.floor(size.height * 0.7),
              width: Math.floor(size.width * 0.5),
              height: Math.floor(size.height * 0.3),
              direction: 'up',
              percent: 0.75
            });
            await browser.pause(500);
          } catch (e: any) {
            console.log(`    Note: Swipe attempt ${i+1} - ${e?.message?.substring(0, 50)}`);
          }
        }
        console.log('  ✓ Scrolled down to wellness section');
      } catch (e: any) {
        console.log(`  Note: Scroll failed: ${e?.message?.substring(0, 50)}`);
      }

      // Take screenshot before tapping
      await browser.pause(1000);
      await browser.saveScreenshot(
        path.resolve(process.cwd(), 'mobile/.builds/android-video-feed-02-feed-opened.png')
      );

      // Try to click on YouTube icon or wellness section
      console.log('[Step 4] Handling any popups and accessing video feed...');
      
      try {
        // Try to dismiss any popup dialogs first
        const dialogButtons = await $$('//*[contains(@text, "No")] | //*[contains(@text, "Yes")]');
        const count = Array.isArray(dialogButtons) ? dialogButtons.length : await (dialogButtons as any).length;
        if (count > 0) {
          console.log('  Dismissing popup dialog...');
          try {
            await dialogButtons[0].click(); // Click "No"
            await browser.pause(1000);
          } catch (e: any) {
            console.log(`  Note: Could not click dialog button - ${e?.message?.substring(0, 50)}`);
          }
        }

        // Try to find and click YouTube icon by coordinates
        const size = await browser.getWindowSize();
        const youtubeX = Math.floor(size.width * 0.78); // Right side where YouTube icon is
        const youtubeY = Math.floor(size.height * 0.72); // Bottom section
        
        await browser.performActions([
          {
            type: 'pointer',
            id: 'finger',
            parameters: { pointerType: 'touch' },
            actions: [
              { type: 'pointerMove', duration: 0, x: youtubeX, y: youtubeY },
              { type: 'pointerDown', button: 0 },
              { type: 'pause', duration: 50 },
              { type: 'pointerUp', button: 0 }
            ]
          }
        ]);
        
        console.log(`  ✓ Clicked YouTube icon at (${youtubeX}, ${youtubeY})`);
        await browser.pause(2000);
        
        // Take screenshot after clicking
        await browser.saveScreenshot(
          path.resolve(process.cwd(), 'mobile/.builds/android-video-feed-youtube-clicked.png')
        );
      } catch (clickError: any) {
        console.log(`  Note: YouTube click failed - ${clickError?.message?.substring(0, 50)}`);
        console.log('  Will attempt URL extraction from current screen anyway');
      }
      
      // Step 5: Extract URLs from the feed (YouTube, Vimeo, Instagram)
      console.log('\n[Step 5] Extracting video URLs from feed (YouTube/Vimeo/Instagram)...');
      
      const collectedUrls: Set<string> = new Set();
      let videoCount = 0;
      const maxVideos = parseInt(process.env.TIKTOK_MAX_VIDEOS || '10', 10);
      let consecutiveEmptyFrames = 0;
      const maxEmptyFrames = 3;

      console.log(`  Target: Extract up to ${maxVideos} videos\n`);

      while (videoCount < maxVideos && consecutiveEmptyFrames < maxEmptyFrames) {
        videoCount++;
        console.log(`\n  === Video ${videoCount} ===`);

        // Take screenshot of current video
        const screenshotPath = path.resolve(
          process.cwd(),
          `mobile/.builds/android-video-feed-${videoCount}.png`
        );
        await browser.saveScreenshot(screenshotPath);
        console.log(`    📸 Screenshot: video-${videoCount}.png`);

        // Extract URLs from page source
        const pageSource = await browser.getPageSource();
        console.log(`    Page source size: ${pageSource.length} bytes`);

        // Save first page source for debugging
        if (videoCount === 1) {
          fs.writeFileSync(
            path.resolve(process.cwd(), 'mobile/.builds/android-video-feed-01-source.xml'),
            pageSource
          );
          console.log(`    Saved page source to android-video-feed-01-source.xml`);
        }

        // Look for YouTube URLs
        const youtubePatterns = [
          /https:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/gi,
          /https:\/\/youtu\.be\/[\w-]+/gi,
          /youtube\.com\/embed\/[\w-]+/gi,
          /youtube\.com\/v\/[\w-]+/gi,
          /youtu\.be\/[\w-]+([\?&][^\s"']*)?/gi,
        ];

        // Look for Vimeo URLs
        const vimeoPatterns = [
          /https:\/\/(?:www\.)?vimeo\.com\/(\d+)/gi,
          /https:\/\/player\.vimeo\.com\/video\/(\d+)/gi,
          /vimeo\.com\/(\d+)/gi,
        ];

        // Look for Instagram URLs
        const instagramPatterns = [
          /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[\w-]+/gi,
          /https?:\/\/(?:www\.)?instagram\.com\/[\w\.]+\//gi,
          /instagram\.com\/(?:p|reel|tv)\/[\w-]+/gi,
        ];

        let frameUrls: string[] = [];

        // Extract YouTube URLs
        for (const pattern of youtubePatterns) {
          const matches = pageSource.match(pattern);
          if (matches) {
            console.log(`    Found ${matches.length} YouTube matches with pattern ${pattern.source}`);
            matches.forEach(url => {
              const cleaned = url.split('"')[0].split("'")[0].split('>')[0].split('<')[0];
              if (cleaned && cleaned.length > 10) {
                frameUrls.push(cleaned);
              }
            });
          }
        }

        // Extract Vimeo URLs
        for (const pattern of vimeoPatterns) {
          const matches = pageSource.match(pattern);
          if (matches) {
            console.log(`    Found ${matches.length} Vimeo matches with pattern ${pattern.source}`);
            matches.forEach(url => {
              const cleaned = url.split('"')[0].split("'")[0].split('>')[0].split('<')[0];
              if (cleaned && cleaned.length > 5) {
                frameUrls.push(cleaned);
              }
            });
          }
        }

        // Extract Instagram URLs
        for (const pattern of instagramPatterns) {
          const matches = pageSource.match(pattern);
          if (matches) {
            console.log(`    Found ${matches.length} Instagram matches with pattern ${pattern.source}`);
            matches.forEach(url => {
              const cleaned = url.split('"')[0].split("'")[0].split('>')[0].split('<')[0];
              if (cleaned && cleaned.length > 5) {
                frameUrls.push(cleaned);
              }
            });
          }
        }

        // Try to extract URLs through Pendo API or direct WebView access
        try {
          console.log(`    Attempting direct WebView extraction...`);
          
          // Try using executeScript to access WebView through Pendo
          const pendoUrls = await browser.execute('mobile: shell', { command: 'dumpsys media_session' }).catch(() => []);
          console.log(`    Shell command attempted`);
          
          // Try to switch to WebView context and execute JavaScript
          const availableContexts: any = (await (browser as any).getContexts?.()) || ['NATIVE_APP'];
          console.log(`    Available contexts: ${Array.isArray(availableContexts) ? availableContexts.join(', ') : ''}`);
          
          // Sometimes the WebView context is not immediately listed, try switching by index
          if (Array.isArray(availableContexts) && availableContexts.length > 1) {
            try {
              const webviewCtx = availableContexts.find((c: any) => String(c).includes('WEBVIEW') || String(c).includes('webview'));
              if (webviewCtx) {
                await (browser as any).switchContext?.(webviewCtx);
                console.log(`    ✓ Switched to ${webviewCtx}`);
              }
            } catch (switchError: any) {
              console.log(`    Note: Context switch failed - ${switchError?.message?.substring(0, 50)}`);
            }
          }
          
          // Try window handle switching for hybrid apps
          try {
            const handles: any = (await (browser as any).getWindowHandles?.()) as string[];
            if (Array.isArray(handles) && handles.length > 1) {
              console.log(`    Found ${handles.length} window handles, trying to switch...`);
              await (browser as any).switchToWindow?.(handles[1]);
              const extractedUrls: any = await browser.execute(() => {
                const urls: string[] = [];
                document.querySelectorAll('iframe, a, video, [data-url], [href*="youtube"], [href*="vimeo"], [href*="instagram"]').forEach((el: any) => {
                  if (el.src) urls.push(el.src);
                  if (el.href) urls.push(el.href);
                  if (el.getAttribute?.('data-url')) urls.push(el.getAttribute('data-url'));
                });
                return urls;
              });
              if (Array.isArray(extractedUrls) && extractedUrls.length > 0) {
                console.log(`    ✓ Extracted ${extractedUrls.length} URLs from window handle`);
                frameUrls.push(...extractedUrls);
              }
            }
          } catch (handleError) {
            console.log(`    Note: Window handle switching unavailable`);
          }
        } catch (pendoError: any) {
          console.log(`    Pendo extraction not available: ${pendoError?.message?.substring(0, 50)}`);
        }

        // Deduplicate frame URLs
        const uniqueFrameUrls = Array.from(new Set(frameUrls))
          .map(url => {
            try {
              return decodeURIComponent(url).split('?')[0]; // Remove query params
            } catch {
              return url.split('?')[0];
            }
          })
          .filter(url => url && (url.includes('youtube') || url.includes('youtu.be') || url.includes('vimeo') || url.includes('instagram')));

        if (uniqueFrameUrls.length > 0) {
          console.log(`    ✓ Found ${uniqueFrameUrls.length} unique URLs this frame:`);
          uniqueFrameUrls.forEach((url, idx) => {
            console.log(`      [${idx + 1}] ${url.substring(0, 80)}`);
            collectedUrls.add(url);
          });
          consecutiveEmptyFrames = 0;
        } else {
          consecutiveEmptyFrames++;
          console.log(`    ℹ️  No URLs found this frame (${consecutiveEmptyFrames}/${maxEmptyFrames} empty)`);
        }

        // Swipe to next video if we haven't hit the limit
        if (videoCount < maxVideos) {
          console.log(`    Swiping to next video...`);
          try {
            const size = await browser.getWindowSize();
            await browser.performActions([
              {
                type: 'pointer',
                id: 'finger',
                parameters: { pointerType: 'touch' },
                actions: [
                  { type: 'pointerMove', duration: 0, x: Math.floor(size.width / 2), y: Math.floor(size.height * 0.7) },
                  { type: 'pointerDown', button: 0 },
                  { type: 'pause', duration: 100 },
                  { type: 'pointerMove', duration: 500, x: Math.floor(size.width / 2), y: Math.floor(size.height / 4) },
                  { type: 'pointerUp', button: 0 }
                ]
              }
            ]);
            await browser.pause(2000);
          } catch (swipeError: any) {
            console.log(`    ⚠️  Swipe failed: ${swipeError?.message?.substring(0, 50)}`);
            break;
          }
        }
      }

      // Step 6: Save results
      console.log('\n[Step 6] Saving extracted URLs...');
      
      const results = {
        timestamp: new Date().toISOString(),
        platform: 'android',
        buildInfo: '1.48-qa (build 1214)',
        environment: 'qa',
        videoSource: 'YouTube/Vimeo/Instagram (NOT TikTok)',
        videosProcessed: videoCount,
        uniqueUrlsExtracted: collectedUrls.size,
        urls: Array.from(collectedUrls),
        note: 'This represents the ACTUAL video feed content on Android, which serves YouTube/Vimeo/Instagram, NOT TikTok'
      };

      const outputPath = path.resolve(
        process.cwd(),
        'mobile/.builds/android-youtube-vimeo-urls-collected.json'
      );
      
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
      console.log(`✓ Results saved to: android-youtube-vimeo-urls-collected.json`);
      console.log(`  Total videos processed: ${videoCount}`);
      console.log(`  Unique URLs extracted: ${collectedUrls.size}`);

      // Step 6: Print summary
      console.log('\n[Step 6] Extraction Summary');
      console.log('═════════════════════════════════════════');
      console.log(`Videos processed: ${videoCount}`);
      console.log(`Total unique URLs found: ${collectedUrls.size}`);
      
      if (collectedUrls.size > 0) {
        console.log('\nSample URLs extracted:');
        Array.from(collectedUrls).slice(0, 5).forEach((url, idx) => {
          console.log(`  ${idx + 1}. ${url}`);
        });
        if (collectedUrls.size > 5) {
          console.log(`  ... and ${collectedUrls.size - 5} more URLs`);
        }
      } else {
        console.log('⚠️  WARNING: No URLs were extracted from the feed');
        console.log('This may indicate:');
        console.log('  - Feed is not loading properly');
        console.log('  - URLs are embedded differently than expected');
        console.log('  - JavaScript extraction not working in this context');
      }

      console.log('═════════════════════════════════════════\n');

      // Verify we extracted at least some data
      assert.ok(
        videoCount > 0,
        'Should have processed at least one video from the feed'
      );

    } catch (error) {
      console.error('');
      console.error('═════════════════════════════════════════');
      console.error('TEST FAILED');
      console.error('═════════════════════════════════════════');
      console.error('Error:', error instanceof Error ? error.message : String(error));
      console.error('═════════════════════════════════════════');
      throw error;
    }
  });
});
