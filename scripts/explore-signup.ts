import fs from 'fs';
(async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = 'https://www.gr-dev.com/fitbux-signup';
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const title = await page.title();
  const metaDescription = await page.$eval('meta[name="description"]', el => el.getAttribute('content')).catch(()=>'');
  const headings = await page.$$eval('h1,h2,h3', els => els.map(e => ({ tag: e.tagName, text: e.textContent?.trim() || '' })));

  const forms = await page.$$eval('form', (forms) => forms.map((f, idx) => {
    const id = f.id || `form-${idx+1}`;
    const name = (f.getAttribute('name')||'');
    const action = (f.getAttribute('action')||'');
    const method = (f.getAttribute('method')||'GET').toUpperCase();
    const inputs = Array.from(f.querySelectorAll('input,select,textarea,button')) as HTMLElement[];
    return { id, name, action, method, inputCount: inputs.length };
  }));

  // Page inventory CSV
  const pageCsvLines = [];
  pageCsvLines.push('page_name,url,title,meta_description,heading_count,form_count');
  pageCsvLines.push(["Signup Page", url, JSON.stringify(title), JSON.stringify(metaDescription), headings.length, forms.length].join(','));

  // Write page inventory
  fs.mkdirSync('test-results/explore-signup', { recursive: true });
  fs.writeFileSync('test-results/explore-signup/page_inventory.csv', pageCsvLines.join('\n'));

  // Input field inventory header
  const inputHeader = [
    'field_id','page','url','section','field_label','control_type','id','name','required','placeholder','aria_label','type','min','max','maxlength','pattern','readonly','disabled','notes'
  ];
  const inputRows: string[] = [];
  inputRows.push(inputHeader.join(','));

  // Collect inputs across the page (not only within forms) to be thorough
  const inputs = await page.$$eval('input,select,textarea', els => els.map((el, idx) => {
    const id = el.id || '';
    const name = (el.getAttribute('name')||'');
    const type = (el.getAttribute('type')||el.tagName||'').toLowerCase();
    const placeholder = (el.getAttribute('placeholder')||'');
    const aria = (el.getAttribute('aria-label')||'');
    const required = el.hasAttribute('required') ? 'true' : 'false';
    const min = el.getAttribute('min')||'';
    const max = el.getAttribute('max')||'';
    const maxlength = el.getAttribute('maxlength')||'';
    const pattern = el.getAttribute('pattern')||'';
    const readonly = el.hasAttribute('readonly') ? 'true' : 'false';
    const disabled = el.hasAttribute('disabled') ? 'true' : 'false';
    // find label text if present
    let labelText = '';
    if (id) {
      const lab = document.querySelector(`label[for="${id}"]`);
      if (lab) labelText = (lab.textContent||'').trim();
    }
    if (!labelText) {
      const parentLabel = el.closest('label');
      if (parentLabel) labelText = (parentLabel.textContent||'').trim();
    }
    return { id, name, type, placeholder, aria, required, min, max, maxlength, pattern, readonly, disabled, labelText };
  }));

  // Compose CSV rows
  inputs.forEach((inp, idx) => {
    const fieldId = inp.id || `field-${idx+1}`;
    const section = '';
    const notes = '';
    const row = [fieldId, 'Signup Page', url, section, JSON.stringify(inp.labelText), inp.type || 'input', inp.id, inp.name, inp.required, JSON.stringify(inp.placeholder), JSON.stringify(inp.aria), inp.type, inp.min, inp.max, inp.maxlength, JSON.stringify(inp.pattern), inp.readonly, inp.disabled, JSON.stringify(notes)];
    inputRows.push(row.join(','));
  });

  fs.writeFileSync('test-results/explore-signup/input_field_inventory.csv', inputRows.join('\n'));

  console.log('Exploration completed. Files: test-results/explore-signup/page_inventory.csv, test-results/explore-signup/input_field_inventory.csv');
  await browser.close();
  process.exit(0);
})();
