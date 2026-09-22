import { test } from '@playwright/test';
import { runIdrFlow, loadProfile, activateProfile, getEnv } from './test-setup';

test('Debug: Capture dashboard content', async ({ page }) => {
  console.log('\n=== DEBUG: Capturing dashboard content ===');
  
  // Load User A profile
  loadProfile('SCN-021');
  activateProfile('SCN-021');
  const userAEmail = getEnv('EMAIL');
  console.log(`Loading User A: ${userAEmail}`);
  
  // Run flow
  await runIdrFlow(page, 'SCN-021');
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
  await page.waitForTimeout(2000);
  
  // Get full page HTML
  const pageHTML = await page.content();
  
  // Print key sections
  console.log('\n--- PAGE URL ---');
  console.log(page.url());
  
  console.log('\n--- PAGE TITLE ---');
  console.log(await page.title());
  
  console.log('\n--- BODY TEXT CONTENT (first 2000 chars) ---');
  const bodyText = await page.textContent('body');
  console.log(bodyText?.substring(0, 2000));
  
  // Look for payment-related elements
  console.log('\n--- SEARCHING FOR PAYMENT TEXT ---');
  const allText = bodyText || '';
  
  // Find all occurrences of payment-like content
  const paymentMatches = allText.match(/(?:payment|amount|monthly|estimated|est\.).*?(\$[\d,]+\.?\d*)/gi);
  console.log('Payment-related content:');
  if (paymentMatches) {
    paymentMatches.slice(0, 10).forEach((match, idx) => {
      console.log(`  ${idx + 1}: ${match}`);
    });
  }
  
  // Extract all dollar amounts
  console.log('\n--- ALL DOLLAR AMOUNTS ---');
  const dollarMatches = allText.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
  console.log(`Found ${dollarMatches.length} dollar amounts:`);
  dollarMatches.forEach((amount, idx) => {
    console.log(`  ${idx + 1}: ${amount}`);
  });
  
  // Save the full HTML for inspection
  const fs = await import('fs');
  const path = await import('path');
  const dateStr = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(process.cwd(), 'test-results', dateStr, 'debug-dashboard.html');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, pageHTML);
  console.log(`\nFull HTML saved to: ${reportPath}`);
});
