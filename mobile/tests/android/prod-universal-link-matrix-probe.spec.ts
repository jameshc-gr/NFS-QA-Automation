import fs from 'node:fs';
import path from 'node:path';

const links = [
  { url: 'https://mobileapp.rate.com/accounts', landing: 'Accounts' },
  { url: 'https://mobileapp.rate.com/financial-wellness-landing', landing: 'Financial wellness' },
  { url: 'https://mobileapp.rate.com/membership-landing', landing: 'Membership' },
  { url: 'https://mobileapp.rate.com/outdoor', landing: 'Outdoor' },
  { url: 'https://mobileapp.rate.com/tlac-landing', landing: 'TLAC' },
  { url: 'https://mobileapp.rate.com/personal-wellness-collections/all-collections', landing: 'Collection' },
  { url: 'https://mobileapp.rate.com/auto-loan?product_name=auto-loan', landing: 'Auto loan' },
  { url: 'https://mobileapp.rate.com/membership-product/home?product=home', landing: 'Membership' },
  { url: 'https://mobileapp.rate.com/personal-wellness-challenges/all-challenges', landing: 'Challenge' },
  { url: 'https://mobileapp.rate.com/personal-wellness', landing: 'Personal wellness' },
  { url: 'https://mobileapp.rate.com/financial-wellness-category/1?category_id=1', landing: 'Financial wellness' },
  { url: 'https://mobileapp.rate.com/financial-wellness-subcategory/1/1?category_id=1&sub_category_id=1', landing: 'Financial wellness' },
  { url: 'https://mobileapp.rate.com/financial-wellness-video/1?video_id=1', landing: 'Video' },
  { url: 'https://mobileapp.rate.com/personal-wellness-subcategory/1/1?category_id=1&sub_category_id=1', landing: 'Personal wellness' },
  { url: 'https://mobileapp.rate.com/personal-wellness-video/1?video_id=1', landing: 'Video' },
  { url: 'https://mobileapp.rate.com/tlac-champion/1?champion_id=1', landing: 'Champion' },
  { url: 'https://mobileapp.rate.com/personal-wellness-category1', landing: 'Personal wellness' },
  { url: 'https://mobileapp.rate.com/outdoor-category/1?collection_id=1', landing: 'Outdoor' }
];

describe('Android PROD Universal Link matrix probe', () => {
  it('records every supplied route without stopping at the first failure', async () => {
    const email = process.env.MOBILE_LOGIN_EMAIL;
    const password = process.env.MOBILE_LOGIN_PASSWORD;
    if (!email || !password) {
      throw new Error('Set MOBILE_LOGIN_EMAIL and MOBILE_LOGIN_PASSWORD for the one-time authenticated matrix run.');
    }

    const loginIfRequired = async (): Promise<void> => {
      const source = await browser.getPageSource();
      if (source.includes('Financial wellness')) {
        return;
      }

      const fields = await $$('android.widget.EditText');
      if (await fields.length < 2) {
        throw new Error('Expected the Android login form before the one-time login.');
      }
      await fields[0].setValue(email);
      await fields[1].setValue(password);
      await browser.keys(['Escape']).catch(() => {});

      const rememberMe = $('//android.widget.CheckBox');
      if (!(await rememberMe.isDisplayed().catch(() => false))) {
        throw new Error('Remember me checkbox was not displayed on the Android login form.');
      }
      if (await rememberMe.getAttribute('checked').catch(() => 'false') !== 'true') {
        await rememberMe.click();
      }
      if (await rememberMe.getAttribute('checked').catch(() => 'false') !== 'true') {
        throw new Error('Remember me checkbox did not become checked.');
      }

      const submit = $('//android.widget.ScrollView//android.view.View[(.//android.widget.TextView[@text="Log in"] or .//android.widget.TextView[@text="Go!"]) and .//android.widget.Button and @clickable="true"]');
      if (!(await submit.isDisplayed().catch(() => false))) {
        throw new Error('Login submit button was not displayed after selecting Remember me.');
      }
      await submit.click();
      await browser.pause(8000);
    };

    const triggerFromChrome = async (url: string): Promise<string> => {
      await browser.activateApp('com.android.chrome');
      await browser.pause(1500);

      const dismissChromeFirstRun = $('//*[@resource-id="com.android.chrome:id/signin_fre_dismiss_button"]');
      if (await dismissChromeFirstRun.isDisplayed().catch(() => false)) {
        await dismissChromeFirstRun.click();
        await browser.pause(1500);
      }

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const noThanks = $('//*[@resource-id="com.android.chrome:id/negative_button"]');
        if (!(await noThanks.isDisplayed().catch(() => false))) {
          break;
        }
        await noThanks.click();
        await browser.pause(1500);
      }

      await browser.keys(['Control', 'l']).catch(() => {});
      await browser.execute('mobile: pressKey', { keycode: 84 }).catch(() => {});
      await browser.pause(500);
      const addressBar = $('//*[@resource-id="com.android.chrome:id/url_bar"]');
      if (!(await addressBar.isDisplayed().catch(() => false))) {
        throw new Error('Chrome address bar was not available after first-run initialization.');
      }
      await addressBar.click();
      await addressBar.clearValue();
      await addressBar.setValue(url);
      await browser.keys(['Enter']);
      await browser.pause(5000);
      return await browser.getUrl().catch(() => 'unavailable');
    };

    const results: Array<Record<string, unknown>> = [];

    for (const link of links) {
      const startedAt = new Date().toISOString();
      try {
        await browser.terminateApp('com.guaranteedrate.superapp');
        const browserUrl = await triggerFromChrome(link.url);
        await browser.activateApp('com.guaranteedrate.superapp');
        await browser.pause(5000);
        await loginIfRequired();
        const source = await browser.getPageSource();
        results.push({
          url: link.url,
          startedAt,
          browserUrl,
          delivered: true,
          landing: link.landing,
          landingSignal: source.toLowerCase().includes(link.landing.toLowerCase()),
          homeSignal: source.includes('Financial wellness'),
          loginSignal: source.includes('Create account'),
          routeSignals: ['Accounts', 'Membership', 'Outdoor', 'Challenges', 'Video', 'Champion', 'Auto loan', 'Collection', 'Personal wellness', 'Financial wellness']
            .filter((signal) => source.toLowerCase().includes(signal.toLowerCase())),
          sourceLength: source.length
        });
      } catch (error) {
        results.push({
          url: link.url,
          startedAt,
          landing: link.landing,
          delivered: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const reportPath = path.resolve(process.cwd(), 'test-results/2026-09-08/mobile/android-universal-link-matrix.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify({ platform: 'android', links, results }, null, 2)}\n`);
  });
});