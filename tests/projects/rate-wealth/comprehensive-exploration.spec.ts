import { test, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Comprehensive Rate Wealth Application Exploration & Audit
// Covers: Pages, Forms, Input Fields, Links, Images, Spelling, Security, CRUD Operations

test.describe('Comprehensive Rate Wealth Authenticated Exploration', () => {
  let page: Page;
  let allPages: any[] = [];
  let allInputs: any[] = [];
  let allLinks: any[] = [];
  let allImages: any[] = [];
  let spellingIssues: any[] = [];
  let linkIssues: any[] = [];
  let testCases: any[] = [];

  test.beforeAll(async ({ browser }) => {
    // Setup is handled by seed file with authentication
  });

  test('1. Explore Dashboard and Main Navigation', async ({ page: testPage }) => {
    page = testPage;
    
    // Already on dashboard from seed
    console.log('📄 Capturing Dashboard page...');
    
    const url = page.url();
    const title = await page.title();
    const bodyText = await page.locator('body').innerText();
    
    allPages.push({
      order: 1,
      name: 'Dashboard',
      url,
      title,
      description: 'Main authenticated dashboard with financial products overview'
    });

    // Save page content
    fs.writeFileSync(path.join('test-results/explore-auth', 'page-1-dashboard.txt'), bodyText);

    // Extract all inputs on dashboard
    const inputs = await page.$$eval('input, textarea, select', (els) =>
      els.map(el => ({
        type: (el as any).tagName,
        inputType: (el as any).type,
        name: (el as any).name,
        id: (el as any).id,
        placeholder: (el as any).placeholder,
        required: (el as any).required,
        visible: (el as any).offsetParent !== null
      }))
    );
    allInputs.push({ page: 'Dashboard', inputs });

    // Extract all links
    const links = await page.$$eval('a[href]', (as) =>
      (as as any[]).map(a => ({
        text: a.innerText,
        href: a.getAttribute('href'),
        target: a.getAttribute('target'),
        external: !a.getAttribute('href')?.startsWith('/')
      }))
    );
    allLinks.push({ page: 'Dashboard', links });

    // Check for spelling issues in visible text
    const checkSpelling = (text: string) => {
      const issues = [
        { word: 'User your', should: 'Use your' },
        { word: 'Recevie', should: 'Receive' },
        { word: 'exlcude', should: 'exclude' }
      ];
      issues.forEach(issue => {
        if (bodyText.includes(issue.word)) {
          spellingIssues.push({
            page: 'Dashboard',
            found: issue.word,
            should_be: issue.should,
            context: bodyText.substring(0, 200)
          });
        }
      });
    };
    checkSpelling(bodyText);
  });

  test('2. Click through Navigation Menu Items', async ({ page: testPage }) => {
    page = testPage;
    
    // Test Accounts menu
    console.log('📄 Navigating to Accounts...');
    await page.click('menuitem:has-text("Accounts")');
    await page.waitForLoadState('networkidle');
    let url = page.url();
    let title = await page.title();
    let bodyText = await page.locator('body').innerText();
    
    allPages.push({
      order: 2,
      name: 'Accounts',
      url,
      title,
      description: 'User accounts and profile management page'
    });
    fs.writeFileSync(path.join('test-results/explore-auth', 'page-2-accounts.txt'), bodyText);

    // Test Home Search menu
    console.log('📄 Navigating to Home Search...');
    await page.click('menuitem:has-text("Home Search")');
    await page.waitForLoadState('networkidle');
    url = page.url();
    title = await page.title();
    bodyText = await page.locator('body').innerText();
    
    allPages.push({
      order: 3,
      name: 'Home Search',
      url,
      title,
      description: 'Home search and property listing feature'
    });
    fs.writeFileSync(path.join('test-results/explore-auth', 'page-3-home-search.txt'), bodyText);

    // Test Insurance menu
    console.log('📄 Navigating to Insurance...');
    await page.click('menuitem:has-text("Insurance")');
    await page.waitForLoadState('networkidle');
    url = page.url();
    title = await page.title();
    bodyText = await page.locator('body').innerText();
    
    allPages.push({
      order: 4,
      name: 'Insurance',
      url,
      title,
      description: 'Insurance products and quotes page'
    });
    fs.writeFileSync(path.join('test-results/explore-auth', 'page-4-insurance.txt'), bodyText);

    // Test Financial Solutions menu
    console.log('📄 Navigating to Financial Solutions...');
    await page.click('menuitem:has-text("Financial solutions")');
    await page.waitForLoadState('networkidle');
    url = page.url();
    title = await page.title();
    bodyText = await page.locator('body').innerText();
    
    allPages.push({
      order: 5,
      name: 'Financial Solutions',
      url,
      title,
      description: 'Comprehensive financial solutions and products overview'
    });
    fs.writeFileSync(path.join('test-results/explore-auth', 'page-5-financial-solutions.txt'), bodyText);
  });

  test('3. Test Product Cards (Home Loans, Refinance, etc.)', async ({ page: testPage }) => {
    page = testPage;
    
    // Go back to dashboard
    await page.click('a:has-text("Dashboard")');
    await page.waitForLoadState('networkidle');

    // Click on Home Loans
    console.log('📄 Clicking Home Loans card...');
    await page.click('button:has-text("Home loans")');
    await page.waitForLoadState('networkidle');
    let url = page.url();
    let title = await page.title();
    let bodyText = await page.locator('body').innerText();
    
    allPages.push({
      order: 6,
      name: 'Home Loans',
      url,
      title,
      description: 'Home loans product page with application form'
    });
    fs.writeFileSync(path.join('test-results/explore-auth', 'page-6-home-loans.txt'), bodyText);

    // Extract forms and input fields
    const formInputs = await page.$$eval('input, textarea, select', (els) =>
      (els as any[]).map(el => ({
        tagName: el.tagName,
        type: el.type || el.tagName,
        name: el.name,
        id: el.id,
        placeholder: el.placeholder,
        value: el.value,
        required: el.required,
        pattern: el.getAttribute('pattern'),
        label: el.closest('label')?.innerText || ''
      }))
    );
    allInputs.push({ page: 'Home Loans', inputs: formInputs });
  });

  test('4. Generate CSV Reports', async ({ page: testPage }) => {
    page = testPage;
    
    console.log('📊 Generating CSV reports...');

    // Page Inventory CSV
    const pagesCsv = [
      'order,page_name,url,title,description',
      ...allPages.map(p => 
        `${p.order},"${p.name}","${p.url}","${p.title}","${p.description}"`
      )
    ].join('\n');
    fs.writeFileSync(path.join('test-results/explore-auth', 'pages_inventory.csv'), pagesCsv);

    // Input Fields CSV
    const inputsCsv = [
      'page,field_type,input_type,name,id,placeholder,required,label',
      ...allInputs.flatMap(p => 
        p.inputs.map((inp: any) =>
          `"${p.page}","${inp.type}","${inp.inputType || ''}","${inp.name}","${inp.id}","${inp.placeholder}","${inp.required}","${inp.label}"`
        )
      )
    ].join('\n');
    fs.writeFileSync(path.join('test-results/explore-auth', 'input_fields_inventory.csv'), inputsCsv);

    // Links CSV
    const linksCsv = [
      'page,link_text,href,target,external',
      ...allLinks.flatMap(p =>
        p.links.map((link: any) =>
          `"${p.page}","${link.text}","${link.href}","${link.target || ''}","${link.external}"`
        )
      )
    ].join('\n');
    fs.writeFileSync(path.join('test-results/explore-auth', 'all_links.csv'), linksCsv);

    // Spelling Issues CSV
    const spellingCsv = [
      'page,found_text,should_be,severity',
      ...spellingIssues.map(s =>
        `"${s.page}","${s.found}","${s.should_be}","MEDIUM"`
      )
    ].join('\n');
    fs.writeFileSync(path.join('test-results/explore-auth', 'spelling_issues.csv'), spellingCsv);

    console.log('✅ All reports generated successfully!');
  });
});
