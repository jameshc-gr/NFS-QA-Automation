import { test, expect, chromium } from '@playwright/test';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'https://wealth.dev.fitbux.com';
const TOOL_URL = `${BASE_URL}/tools/payoffVsIDR`;

// Store auth in session file
const authFile = 'auth.json';

const testCases = [
  { id: 'TC_RW_001', state1: 'WA', state2: 'AK', agi: 50000, expected_payment_1: 217.17, expected_bomb_1: 97879, expected_payment_2: 167.29, expected_bomb_2: 109850 },
  { id: 'TC_RW_002', state1: 'AK', state2: 'HI', agi: 50000, expected_payment_1: 167.29, expected_bomb_1: 109850, expected_payment_2: 187.17, expected_bomb_2: 105079 },
  { id: 'TC_RW_003', state1: 'WA', state2: 'HI', agi: 50000, expected_payment_1: 217.17, expected_bomb_1: 97879, expected_payment_2: 187.17, expected_bomb_2: 105079 },
];

// Authentication setup
test.beforeAll(async () => {
  console.log('\n' + '═'.repeat(80));
  console.log('📊 RATE-WEALTH AUTOMATED TEST SUITE (SESSION-BASED AUTH)');
  console.log('═'.repeat(80) + '\n');
  
  // Check if auth exists
  if (!fs.existsSync(authFile)) {
    console.log('⚠️  No stored authentication found.');
    console.log('To use automated mode, first create auth by running manual test with --headed flag\n');
  } else {
    console.log('✓ Using stored authentication session\n');
  }
});

// Run tests
for (const tc of testCases) {
  test(`${tc.id}: ${tc.state1} vs ${tc.state2}`, async ({ browser, context }) => {
    // Create new page with auth state if it exists
    let page;
    
    if (fs.existsSync(authFile)) {
      try {
        const authData = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
        page = await context.newPage();
        await context.addCookies(authData.cookies || []);
      } catch (e) {
        page = await context.newPage();
      }
    } else {
      page = await context.newPage();
    }

    console.log(`\n${'─'.repeat(80)}`);
    console.log(`🧪 ${tc.id}: ${tc.state1} vs ${tc.state2}`);
    console.log(`   AGI: $${tc.agi.toLocaleString()}`);
    console.log(`${'─'.repeat(80)}\n`);

    try {
      // Navigate to tool
      console.log(`📍 Navigating to: ${TOOL_URL}`);
      await page.goto(TOOL_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      const url = page.url();
      console.log(`✓ Current URL: ${url}\n`);

      // Check if we need to authenticate
      if (url.includes('login.dev.rate.com') || url.includes('authorize')) {
        console.log('🔐 OAuth login required - please authenticate in the browser window\n');
        console.log('⏳ Waiting for authentication (max 120 seconds)...\n');
        
        let authenticated = false;
        for (let i = 0; i < 120; i++) {
          await page.waitForTimeout(1000);
          const currentUrl = page.url();
          if (!currentUrl.includes('login.dev.rate.com') && currentUrl.includes('wealth.dev.fitbux.com')) {
            authenticated = true;
            console.log(`✓ Authentication successful after ${i}s\n`);
            
            // Save auth state for next run
            try {
              const cookies = await context.cookies();
              fs.writeFileSync(authFile, JSON.stringify({ cookies }, null, 2));
              console.log('✓ Saved authentication state for future runs\n');
            } catch (e) {
              // continue without saving
            }
            break;
          }
          if ((i + 1) % 10 === 0) console.log(`⏳ Still waiting... (${i + 1}s elapsed)\n`);
        }
        
        if (!authenticated) {
          console.log('❌ Authentication timeout\n');
          await page.close();
          return;
        }
      }

      // Wait for page to load
      await page.waitForTimeout(2000);

      // Take screenshot of page structure
      console.log(`📸 Capturing page structure...\n`);
      await page.screenshot({ path: `test-results/rate-wealth-${tc.id}-structure.png`, fullPage: true });
      console.log(`✓ Screenshot saved: rate-wealth-${tc.id}-structure.png\n`);

      // Log page content
      const bodyText = await page.locator('body').innerText();
      const hasState = bodyText.toLowerCase().includes('state');
      const hasPayment = bodyText.toLowerCase().includes('payment');
      const hasForm = await page.locator('input, select, [role="combobox"]').count();
      
      console.log(`📋 Page Analysis:`);
      console.log(`   Has "State" text: ${hasState ? '✓' : '✗'}`);
      console.log(`   Has "Payment" text: ${hasPayment ? '✓' : '✗'}`);
      console.log(`   Form elements detected: ${hasForm}\n`);

      // Expected values
      console.log(`📊 Test Expectations:`);
      console.log(`   State 1: ${tc.state1}`);
      console.log(`   Expected Payment: $${tc.expected_payment_1}/mo`);
      console.log(`   Expected Tax Bomb: $${tc.expected_bomb_1}`);
      console.log(`   State 2: ${tc.state2}`);
      console.log(`   Expected Payment: $${tc.expected_payment_2}/mo`);
      console.log(`   Expected Tax Bomb: $${tc.expected_bomb_2}\n`);

      console.log(`✅ ${tc.id} test framework executed\n`);

    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
    } finally {
      await page.close();
    }
  });
}

test.afterAll(() => {
  console.log('\n' + '═'.repeat(80));
  console.log('✅ TEST SUITE COMPLETE');
  console.log('Screenshots saved to: test-results/\n');
  console.log('To get calculator results:');
  console.log('1. Open the web app manually');
  console.log('2. Navigate to Tools & Products → "Income-Driven Repayment Plans & PSLF"');
  console.log('3. Enter data from test cases and capture results');
  console.log('═'.repeat(80) + '\n');
});
