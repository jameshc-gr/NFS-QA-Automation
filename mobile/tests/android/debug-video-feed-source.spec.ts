import { describe, it, before, after } from 'mocha';
import * as fs from 'fs';
import * as path from 'path';
import { AuthPage } from '../../src/pages/auth.page';
import { getAutomationAccount } from '../../src/utils/mobile-auth';

describe('Debug Video Feed Page Source', function () {
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

  it('should capture and analyze page source at video feed', async function () {
    // Login
    const { email, password } = getAutomationAccount('login');
    await authPage.openLogin();
    await authPage.login(email, password);
    await authPage.completeLoginVerification(email);
    
    console.log('\n[1] Authenticated. Navigating to video feed...');
    await browser.pause(3000);

    // Scroll to wellness
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

    console.log('[2] Scrolled to wellness section.');

    // Click YouTube icon
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
      console.log('Tap failed');
    }

    console.log('[3] Clicked to video player. Analyzing content...\n');

    // Get available contexts
    const contexts = await browser.getContexts();
    console.log(`Available contexts: ${JSON.stringify(contexts)}`);

    // Get page source
    const pageSource = await browser.getPageSource();
    const sourceLines = pageSource.split('\n').length;
    console.log(`Page source: ${sourceLines} lines\n`);

    // Save full page source for analysis
    const sourceFile = path.resolve(process.cwd(), 'mobile/.builds/debug-page-source.xml');
    fs.writeFileSync(sourceFile, pageSource);
    console.log(`✓ Saved page source to: mobile/.builds/debug-page-source.xml\n`);

    // Analyze page source for video content
    console.log('[4] Searching page source for video URLs...\n');

    const patterns = {
      youtube: /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/gi,
      youtubeEmbed: /https?:\/\/(?:www\.)?youtube\.com\/embed\/[\w-]+/gi,
      youtubeShort: /https?:\/\/youtu\.be\/[\w-]+/gi,
      vimeo: /https?:\/\/(?:www\.)?vimeo\.com\/(\d+)/gi,
      vimeoPlayer: /https?:\/\/player\.vimeo\.com\/video\/(\d+)/gi,
      instagram: /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[\w-]+/gi,
      pendoYoutube: /pendo[._]youtube/gi,
      pendoVimeo: /pendo[._]vimeo/gi,
      iframeSrc: /iframe[^>]*src="([^"]*[Yy]ou[Tt]ube|[Vv]imeo|[Ii]nstagram[^"]*)"/gi
    };

    const results: { [key: string]: string[] } = {};
    let totalFound = 0;

    for (const [name, pattern] of Object.entries(patterns)) {
      const matches = pageSource.match(pattern) || [];
      if (matches.length > 0) {
        results[name] = Array.from(new Set(matches));
        totalFound += matches.length;
        console.log(`  ${name}: Found ${matches.length}`);
        matches.slice(0, 3).forEach(m => console.log(`    - ${m.substring(0, 80)}`));
      }
    }

    console.log(`\nTotal matches: ${totalFound}\n`);

    // Try to find WebView element information
    console.log('[5] Checking for WebView element...');
    try {
      // Find WebView element
      const webviewElements = await browser.$$(
        '//android.webkit.WebView'
      );
      console.log(`WebView elements found: ${webviewElements.length}`);

      if (webviewElements.length > 0) {
        for (let i = 0; i < webviewElements.length; i++) {
          const elem = webviewElements[i];
          const bounds = await elem.getAttribute('bounds');
          console.log(`  WebView ${i}: ${bounds}`);
        }
      }
    } catch (e) {
      console.log(`WebView XPath search failed`);
    }

    // Look for specific text that indicates video content
    console.log('\n[6] Searching for video-related text elements...');
    const textPatterns = ['Belize', 'Epic Travel', 'Video', 'youtube', 'vimeo', 'instagram', 'Play', 'Watch'];
    
    for (const text of textPatterns) {
      try {
        const elements = await browser.$$(
          `//*[contains(translate(@text, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')]`
        );
        if (elements.length > 0) {
          console.log(`  Found ${elements.length} elements containing "${text}"`);
        }
      } catch (e) {
        // Continue
      }
    }

    // Save detailed analysis
    console.log('\n[7] Saving analysis...\n');
    const analysis = {
      timestamp: new Date().toISOString(),
      availableContexts: contexts,
      pageSourceLineCount: sourceLines,
      urlPatternsFound: results,
      totalUrlsFound: totalFound,
      notes: [
        'Page source captured in debug-page-source.xml',
        'Searched for YouTube, Vimeo, Instagram patterns',
        'If totalUrlsFound > 0, URLs are extracted above',
        'If totalUrlsFound = 0, WebView content is not exposed in page source'
      ]
    };

    const analysisFile = path.resolve(process.cwd(), 'mobile/.builds/debug-analysis.json');
    fs.writeFileSync(analysisFile, JSON.stringify(analysis, null, 2));

    console.log(`✓ Analysis saved to: mobile/.builds/debug-analysis.json`);
    console.log(`\nConclusion: ${totalFound > 0 ? '✓ Found video URLs!' : '✗ No video URLs in page source (WebView not exposed)'}`);
  });
});
