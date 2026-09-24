import fs from 'fs';
(async ()=>{
  const { chromium } = await import('playwright');
  const allowedHost = 'www.gr-dev.com';
  const url = 'https://www.gr-dev.com/fitbux-signup';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Prevent any form submission
  await page.evaluate(()=>{
    document.querySelectorAll('form').forEach(f=>{
      f.addEventListener('submit', e=>{ e.preventDefault(); e.stopPropagation(); });
    });
  });

  const title = await page.title();
  const headings = await page.$$eval('h1,h2,h3', els => els.map(e=>({tag:e.tagName,text:(e.textContent||'').trim()})));
  const links = await page.$$eval('a[href]', els => els.map(a=>({text:(a.textContent||'').trim(), href:a.getAttribute('href')})));
  const images = await page.$$eval('img', imgs => imgs.map(i=>({src:i.getAttribute('src'), alt:i.getAttribute('alt')})));
  const inputs = await page.$$eval('input,select,textarea', els=>els.map((el,idx)=>{
    const id = el.id||''; const name = el.getAttribute('name')||''; const type = (el.getAttribute('type')||el.tagName||'').toLowerCase(); const required = el.hasAttribute('required'); const placeholder = el.getAttribute('placeholder')||''; const aria = el.getAttribute('aria-label')||''; let label=''; if(id){ const lab = document.querySelector(`label[for="${id}"]`); if(lab) label=(lab.textContent||'').trim(); } if(!label){ const parent = el.closest('label'); if(parent) label=(parent.textContent||'').trim(); }
    return { id,name,type,required,placeholder,aria,label };
  }));

  // Page CSV (append additional info)
  const pageCsv = ['page_name,url,title,heading_count,form_count,response_status,response_headers'];
  pageCsv.push(["Signup Page", url, JSON.stringify(title), headings.length, (await page.$$eval('form', f=>f.length)), resp?.status()||'', JSON.stringify(resp?.headers()||{})].join(','));
  fs.writeFileSync('test-results/explore-signup/page_inventory.csv', pageCsv.join('\n'));

  // Input CSV
  const inputHeader = ['field_id','page','url','section','field_label','control_type','id','name','required','placeholder','aria_label','notes'];
  const inputRows = [inputHeader.join(',')];
  inputs.forEach((i,idx)=>{
    const fid = i.id||`field-${idx+1}`;
    const row = [fid,'Signup Page',url,'',JSON.stringify(i.label),i.type,i.id,i.name,i.required? 'true':'false',JSON.stringify(i.placeholder),JSON.stringify(i.aria),''];
    inputRows.push(row.join(','));
  });
  fs.writeFileSync('test-results/explore-signup/input_field_inventory.csv', inputRows.join('\n'));

  // Link validation CSV
  const linkHeader = ['link_text','href','type','status','notes'];
  const linkRows = [linkHeader.join(',')];
  for(const l of links){
    let href = l.href || '';
    let type = 'relative';
    let status = '';
    let notes = '';
    try{
      if(href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')){ type = 'anchor'; status='n/a'; }
      else if(href.startsWith('http')){ type = href.includes(allowedHost)?'internal':'external';
        const r = await page.request.get(href, {timeout: 5000}); status = String(r.status());
      } else if(href.startsWith('/')){ type='internal'; const full = `https://${allowedHost}${href}`; const r = await page.request.get(full, {timeout:5000}); status=String(r.status()); href=full; }
      else { type='other'; status='n/a'; }
    }catch(e){ status='error'; notes = (e as any).message.substring(0,200); }
    linkRows.push([JSON.stringify(l.text), href, type, status, JSON.stringify(notes)].join(','));
  }
  fs.writeFileSync('test-results/explore-signup/link_validation_results.csv', linkRows.join('\n'));

  // Image checks
  const imgHeader = ['src','alt','status','notes'];
  const imgRows = [imgHeader.join(',')];
  for(const im of images){
    let src = im.src || '';
    let status=''; let notes='';
    try{
      const absolute = src.startsWith('http')?src:`https://${allowedHost}${src}`;
      const r = await page.request.get(absolute, {timeout:5000}); status=String(r.status());
      src = absolute;
    }catch(e){ status='error'; notes=(e as any).message.substring(0,200); }
    imgRows.push([JSON.stringify(src), JSON.stringify(im.alt||''), status, JSON.stringify(notes)].join(','));
  }
  fs.writeFileSync('test-results/explore-signup/image_check_results.csv', imgRows.join('\n'));

  // Accessibility label findings
  const a11yHeader = ['field_id','label','aria_label','has_label','notes'];
  const a11yRows = [a11yHeader.join(',')];
  inputs.forEach((i,idx)=>{
    const hasLabel = (i.label && i.label.length>0) || (i.aria && i.aria.length>0);
    const notes = hasLabel? '':'Missing label or aria-label';
    a11yRows.push([i.id||`field-${idx+1}`, JSON.stringify(i.label), JSON.stringify(i.aria), hasLabel? 'true':'false', JSON.stringify(notes)].join(','));
  });
  fs.writeFileSync('test-results/explore-signup/ui_content_findings.csv', a11yRows.join('\n'));

  // Basic security findings: response headers
  const secHeader = ['finding_id','title','route','preconditions','steps','expected','observed','severity','recommendation','notes'];
  const secRows = [secHeader.join(',')];
  const headers = resp?.headers()||{};
  // Check for insecure cookie flags? We can't easily read cookies set for other hosts; check headers for x-frame-options and content-security-policy
  if(!headers['x-frame-options'] && !headers['frame-options']){
    secRows.push(['SEC-01','Missing X-Frame-Options',url,'N/A','Load page','X-Frame-Options header present to prevent clickjacking','X-Frame-Options header not present','Low','Add X-Frame-Options: DENY or CSP frame-ancestors',''].join(','));
  }
  if(!headers['content-security-policy']){
    secRows.push(['SEC-02','Missing Content-Security-Policy',url,'N/A','Load page','CSP header present to mitigate XSS','CSP header not present','Medium','Add Content-Security-Policy restricting script sources and frame ancestors',''].join(','));
  }
  fs.writeFileSync('test-results/explore-signup/security_findings.csv', secRows.join('\n'));

  // Functional test cases (non-destructive)
  const funcHeader = ['test_case_id','module','title','preconditions','steps','expected_result','automation_candidate'];
  const funcRows = [funcHeader.join(',')];
  funcRows.push(['FW-SIGNUP-001','Signup','Signup page loads and displays form',`Navigate to ${url}`,'Verify Title, headings, email/username and Continue button are visible','Signup form visible and required fields present','High'].join(','));
  funcRows.push(['FW-SIGNUP-002','Signup','Form required-field validation triggers without submission',`Navigate to ${url}`,'Focus and blur required inputs, click Continue (form submit prevented)','Client-side required validation messages shown or fields marked required','Medium'].join(','));
  fs.writeFileSync('test-results/explore-signup/functional_test_cases.csv', funcRows.join('\n'));

  // Test execution results summary
  const execHeader = ['run_id','target','url','checks','passed','failed','blocked','notes'];
  const execRows = [execHeader.join(',')];
  execRows.push(['run-1','Signup Page',url,'links,images,a11y,headers','n/a','n/a','n/a','See generated CSVs in test-results/explore-signup']);
  fs.writeFileSync('test-results/explore-signup/test_execution_results.csv', execRows.join('\n'));

  console.log('UI and security checks complete. Files written to test-results/explore-signup/');
  await browser.close();
  process.exit(0);
})();
