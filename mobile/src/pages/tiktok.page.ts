import { BasePage } from './base.page';

export interface TikTokVideoUrl {
  url: string;
  timestamp: number;
  index: number;
}

export class TikTokPage extends BasePage {
  private readonly wellnessChecklistBannerCandidates = this.platform === 'ios'
    ? [
        // The "Wellness that works" banner with social media icons (TikTok, Instagram, YouTube)
        // Try to find by the text "Wellness that works"
        '//XCUIElementTypeStaticText[contains(@value, "Wellness that works")]/..',
        '//XCUIElementTypeStaticText[contains(@name, "Wellness that works")]/..',
        // Try the full banner button/container
        '//XCUIElementTypeButton[contains(@name, "Wellness") or contains(@label, "Wellness")]',
        // Try by the subtitle text about "Browse videos"
        '//XCUIElementTypeStaticText[contains(@value, "Browse videos")]/..', 
        '//XCUIElementTypeStaticText[contains(@value, "workouts")]/ancestor::XCUIElementTypeButton',
        // Look for elements that might contain the social icons
        '//XCUIElementTypeOther[contains(@name, "wellness")]',
        // Try to find any visible button near the text
        '//XCUIElementTypeButton[ancestor::*[contains(@name, "wellness") or contains(@label, "wellness")]]'
      ]
    : [
        '//android.widget.Button[contains(@text, "Webview Feed for TikTok")]',
        '//android.view.View[contains(@content-desc, "Webview Feed for TikTok")]',
        '//android.widget.Button[contains(@text, "Wellness") and contains(@text, "works")]',
        `//android.view.View[@content-desc][contains(translate(@content-desc, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'wellness')]`,
        `//android.widget.TextView[contains(@text, "Wellness that works")]/.`,
        `//android.widget.TextView[contains(@text, "Wellness that works")]/..`
      ];

  private readonly tiktokFeedContainer = this.platform === 'ios'
    ? '//XCUIElementTypeWebView | //XCUIElementTypeScrollView[contains(@name, "tiktok") or contains(@name, "feed")]'
    : '//android.webkit.WebView | //android.view.View[@resource-id or @content-desc][contains(translate(@content-desc, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "tiktok")]';

  private readonly closeButtonCandidates = this.platform === 'ios'
    ? [
        '~navigation_top.button.close',
        '//XCUIElementTypeButton[@name="close" or @name="Close" or @label="Close"]',
        '//XCUIElementTypeButton[contains(@name, "X") or contains(@label, "X")]'
      ]
    : [
        '//android.widget.Button[@content-desc="Close"]',
        `//android.view.View[@resource-id][contains(translate(@content-desc, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'close')]`,
        `//android.view.View[contains(@content-desc, "X")]`
      ];

  /**
   * Find and click the "Wellness that works" banner
   */
  async findAndClickWellnessBanner(): Promise<void> {
    const candidates = this.wellnessChecklistBannerCandidates;
    let banner: WebdriverIO.Element | null = null;

    for (const candidate of candidates) {
      try {
        const element = $(candidate);
        if (await element.isDisplayed({ wait: 3000 }).catch(() => false)) {
          banner = element;
          try {
            const bannerName = await element.getAttribute('name');
            const bannerLabel = await element.getAttribute('label');
            console.log(`[TikTok] Found wellness banner using selector: ${candidate}`);
            console.log(`[TikTok] Element details - name: "${bannerName}", label: "${bannerLabel}"`);
          } catch (e) {
            console.log(`[TikTok] Found wellness banner using selector: ${candidate}`);
          }
          break;
        }
      } catch (e) {
        // Continue to next candidate
      }
    }

    if (!banner) {
      throw new Error(`Could not find "Wellness that works" banner. Tried candidates: ${JSON.stringify(candidates)}`);
    }

    // Screenshot before clicking
    await browser.saveScreenshot(`${process.cwd()}/mobile/.builds/before-wellness-click.png`);
    await banner.click();
    console.log('[TikTok] Clicked wellness banner');

    // Wait a bit for page to load
    await browser.pause(2000);
    
    // Take screenshot and save page source to debug
    try {
      await browser.saveScreenshot(`${process.cwd()}/mobile/.builds/after-wellness-click.png`);
      const pageSource = await browser.getPageSource();
      const fs = require('fs');
      fs.writeFileSync(
        `${process.cwd()}/mobile/.builds/after-wellness-click-source.xml`,
        pageSource
      );
      console.log('[TikTok] Saved page state for debugging');
      
      // Check what's actually on the page
      if (pageSource.toLowerCase().includes('tiktok')) {
        console.log('  ✓ Found "tiktok" in page source');
      } else if (pageSource.toLowerCase().includes('video')) {
        console.log('  ✓ Found "video" references in page source');
      } else {
        console.log('  ⚠️  No TikTok or video references found - might be wrong page');
        // Show first few text elements to see what's on page
        const lines = pageSource.split('\n');
        const textElements = lines.filter(l => l.includes('StaticText') && l.includes('value='));
        console.log(`  Found ${textElements.length} text elements. First few:`);
        textElements.slice(0, 5).forEach(line => console.log(`    ${line.substring(0, 100)}`));
      }
    } catch (debugError) {
      console.log(`[TikTok] Warning: Could not capture debug info: ${debugError}`);
    }

    // Wait for TikTok feed to load
    await browser.waitUntil(
      async () => {
        try {
          const feedContainer = $(this.tiktokFeedContainer);
          return await feedContainer.isDisplayed({ wait: 2000 }).catch(() => false);
        } catch {
          return false;
        }
      },
      { timeout: 15000, timeoutMsg: 'TikTok feed did not load within 15 seconds' }
    );

    console.log('[TikTok] Wellness banner clicked and feed loaded');
  }

  /**
   * Swipe up to go to the next TikTok video
   */
  async swipeUpToNextVideo(): Promise<void> {
    if (this.platform === 'ios') {
      // iOS swipe: middle of screen, swipe up
      const size = await browser.getWindowSize();
      await browser.performActions([
        {
          type: 'pointer',
          id: 'finger',
          parameters: { pointerType: 'touch' },
          actions: [
            { type: 'pointerMove', duration: 0, x: Math.floor(size.width / 2), y: Math.floor(size.height / 2) },
            { type: 'pointerDown', button: 0 },
            { type: 'pause', duration: 100 },
            { type: 'pointerMove', duration: 500, x: Math.floor(size.width / 2), y: Math.floor(size.height / 4) },
            { type: 'pointerUp', button: 0 }
          ]
        }
      ]);
    } else {
      // Android: use mobile: swipeUp gesture or manual touch actions
      try {
        await browser.execute('mobile: swipeGesture', {
          left: Math.floor(await (await browser.getWindowSize()).width / 2),
          top: Math.floor((await browser.getWindowSize()).height * 0.7),
          width: 100,
          height: (await browser.getWindowSize()).height / 2,
          direction: 'up',
          percent: 0.75
        });
      } catch {
        // Fallback to manual touch actions
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
      }
    }

    // Wait a bit for the next video to load
    await browser.pause(1500);
    console.log('[TikTok] Swiped up to next video');
  }

  /**
   * Get all network requests captured during video load
   * This should be called after a video loads
   */
  async captureNetworkRequests(): Promise<string[]> {
    try {
      // Get all network requests
      const requests = await browser.getNetworkRequests?.() || [];
      console.log(`[TikTok] captureNetworkRequests: Found ${requests.length} total requests`);
      
      const urls: string[] = [];

      for (const req of requests) {
        if (req.url && typeof req.url === 'string') {
          // Look for TikTok URLs or video URLs
          if (
            req.url.includes('tiktok.com') ||
            req.url.includes('www.tiktok.com') ||
            req.url.includes('vm.tiktok.com') ||
            req.url.includes('.tiktok.com/v/') ||
            req.url.match(/tiktok.*video|video.*tiktok/i)
          ) {
            console.log(`[TikTok] ✓ Found TikTok URL: ${req.url}`);
            urls.push(req.url);
          }
        }
      }

      console.log(`[TikTok] captureNetworkRequests: Extracted ${urls.length} TikTok URLs`);
      return urls;
    } catch (error) {
      console.log(`[TikTok] Network request capture not available (${error?.message}), will use alternative method`);
      return [];
    }
  }

  /**
   * Extract TikTok URLs from the current page source or visible elements
   * This is a fallback when network logs are not available
   */
  async extractUrlsFromPageSource(): Promise<string[]> {
    const urls: string[] = [];

    try {
      // First, try to get available contexts and switch to WebView if available
      try {
        const contexts = await browser.getContexts?.() || [];
        console.log(`[TikTok] Available contexts: ${contexts.join(', ')}`);
        
        const webviewContext = contexts.find((c: string) => c.toLowerCase().includes('webview'));
        if (webviewContext) {
          console.log(`[TikTok] Switching to WebView context: ${webviewContext}`);
          await browser.switchContext?.(webviewContext);
          console.log(`[TikTok] Successfully switched to WebView context`);
          
          // Try to execute JavaScript in WebView to extract URLs
          try {
            const pageUrls: any = await browser.execute(() => {
              const urls = [];
              // Look for all links with tiktok.com
              const links = document.querySelectorAll('a[href*="tiktok"]');
              links.forEach((link: any) => urls.push(link.href));
              // Look for tiktok URLs in any text
              const bodyText = document.body.innerText;
              const matches = bodyText.match(/https?:\/\/(?:www\.)?tiktok\.com\/[@\w]+\/video\/\d+/gi) || [];
              urls.push(...matches);
              return [...new Set(urls)];
            });
            console.log(`[TikTok] JavaScript found ${pageUrls.length} URLs from WebView`);
            if (Array.isArray(pageUrls)) {
              urls.push(...pageUrls);
            }
          } catch (jsError) {
            console.log(`[TikTok] JavaScript execution failed: ${jsError?.message}`);
          }
          
          // Switch back to native context
          await browser.switchContext?.('NATIVE_APP');
        }
      } catch (contextError) {
        console.log(`[TikTok] Could not use WebView context: ${contextError?.message}`);
      }
      
      // Also try native page source method as fallback
      const source = await browser.getPageSource();
      console.log(`[TikTok] extractUrlsFromPageSource: Page source length: ${source.length} chars`);

      // Look for TikTok URLs in various formats
      const patterns = [
        /https:\/\/(?:www\.)?tiktok\.com\/[@\w]+\/video\/\d+/gi,
        /https:\/\/vm\.tiktok\.com\/[\w]+/gi,
        /https:\/\/vt\.tiktok\.com\/[\w]+/gi,
        /(?:tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)[^\s"'<>]*/gi,
        /(?:"|')(?:https?:)?\/\/[^"']*tiktok[^"']*(?:"|')/gi
      ];

      for (const pattern of patterns) {
        const matches = source.match(pattern);
        if (matches) {
          console.log(`[TikTok] Pattern found ${matches.length} matches`);
          urls.push(...matches);
        }
      }

      // Remove duplicates and clean up URLs
      const uniqueUrls = Array.from(new Set(urls))
        .map(url => {
          // Clean up URL encoding if present
          try {
            // Remove quotes if present
            let cleaned = url.replace(/^[\'\"]|[\'\"]$/g, '');
            return decodeURIComponent(cleaned);
          } catch {
            return url.replace(/^[\'\"]|[\'\"]$/g, '');
          }
        })
        .filter(url => url.length > 0 && url.includes('tiktok'));

      console.log(`[TikTok] extractUrlsFromPageSource: Found ${uniqueUrls.length} unique TikTok URLs`);
      return uniqueUrls;
    } catch (error) {
      console.error('[TikTok] Failed to extract URLs from page source:', error);
      return urls;
    }
  }

  /**
   * Check if there are more videos in the feed (heuristic check)
   */
  async hasMoreVideos(): Promise<boolean> {
    try {
      const feedContainer = $(this.tiktokFeedContainer);
      return await feedContainer.isDisplayed({ wait: 2000 }).catch(() => false);
    } catch {
      return false;
    }
  }

  /**
   * Close the TikTok feed modal if open
   */
  async closeTikTokFeed(): Promise<void> {
    const candidates = this.closeButtonCandidates;

    for (const candidate of candidates) {
      try {
        const closeButton = $(candidate);
        if (await closeButton.isDisplayed({ wait: 1000 }).catch(() => false)) {
          await closeButton.click();
          console.log(`[TikTok] Closed feed using selector: ${candidate}`);
          return;
        }
      } catch (e) {
        // Continue to next candidate
      }
    }

    console.log('[TikTok] No close button found, attempting back navigation');
    try {
      await browser.back();
    } catch (e) {
      console.log('[TikTok] Back navigation failed');
    }
  }

  /**
   * Get the current video index/position in the feed (if available)
   */
  async getCurrentVideoIndex(): Promise<number | null> {
    try {
      if (this.platform === 'ios') {
        const pageSource = await browser.getPageSource();
        // Look for video counter like "1/10"
        const match = pageSource.match(/(\d+)\s*\/\s*(\d+)/);
        if (match) {
          return parseInt(match[1], 10);
        }
      } else {
        // Android approach
        const pageSource = await browser.getPageSource();
        const match = pageSource.match(/video[_-]?(?:index|number|count)[^>]*>(\d+)</i);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
    } catch {
      // Continue - index is optional
    }
    return null;
  }
}
