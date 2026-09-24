import fs from 'fs';
(async ()=>{
  const { chromium } = await import('playwright');
  const statusPath = 'test-results/explore-auth/execution_status.txt';
  if (!fs.existsSync(statusPath)) { console.error('status file not found'); process.exit(2); }
  const s = fs.readFileSync(statusPath,'utf8');
  const m = s.match(/created_account:([^\n]+)/);
  if (!m) { console.error('created_account not found in status'); process.exit(2); }
  const email = m[1].trim();
  const local = email.split('@')[0];
  console.log('Checking inbox for', email);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const yop = 'https://yopmail.com/en/';
  await page.goto(yop, { waitUntil: 'domcontentloaded' });
  // enter local part
  const login = page.locator('#login, input#login, input[name="login"]');
  if (await login.count() === 0) {
    console.error('yopmail login input not found');
    await browser.close(); process.exit(2);
  }
  await login.fill(local);
  // click check
  const checkBtn = page.locator('button[onclick*="check"], input[value="Check Inbox"], button:has-text("Check Inbox")');
  if (await checkBtn.count() > 0) await checkBtn.first().click();
  await page.waitForTimeout(3000);

  // messages load in iframe 'ifinbox' or 'ifmail'
  let verificationLink = '';
  for (let attempt=0; attempt<12; attempt++) {
    const frames = page.frames();
    for (const f of frames) {
      try {
        const html = await f.content();
        // search for http links in frame content
        const links = html.match(/https?:\/\/[^"'>\s]+/g);
        if (links) {
          for (const l of links) {
            const low = l.toLowerCase();
            if (low.includes('confirm') || low.includes('verification') || low.includes('verify') || low.includes('sso') || low.includes('wealth') || low.includes('fitbux') ) {
              verificationLink = l.replace(/\\\\/g, '');
              break;
            }
          }
        }
        if (verificationLink) break;
      } catch(e){}
    }
    if (verificationLink) break;
    await page.waitForTimeout(5000);
    // refresh inbox
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(()=>{});
  }

  if (!verificationLink) {
    console.error('No verification link found in yopmail inbox');
    await browser.close(); process.exit(3);
  }

  console.log('Found verification link:', verificationLink.substring(0,80)+'...');
  // open verification link in new page
  const p2 = await browser.newPage();
  try {
    await p2.goto(verificationLink, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p2.waitForTimeout(2000);
    // capture resulting url
    const final = p2.url();
    console.log('Visited verification link, landed on', final);
    // now crawl starting from final
    const toVisit = [final];
    const visited = new Set<string>();
    const pages = [] as any[];
    while (toVisit.length && visited.size < 100) {
      const u = toVisit.shift()!;
      if (visited.has(u)) continue;
      try {
        await p2.goto(u, { waitUntil: 'domcontentloaded' });
        await p2.waitForTimeout(800);
        const text = await p2.locator('body').innerText();
        pages.push({url: u, text});
        visited.add(u);
        const anchors = await p2.$$eval('a[href]', as=>as.map(a=>a.getAttribute('href')));
        for (let href of anchors) {
          if (!href) continue;
          try { href = new URL(href, u).toString(); } catch { continue; }
          const h = new URL(href);
          if (h.host === new URL(final).host && !visited.has(href) && !toVisit.includes(href)) toVisit.push(href);
        }
      } catch(e){ visited.add(u); }
    }
    fs.mkdirSync('test-results/explore-auth', { recursive: true });
    const pageCsv = ['page_name,url,text_snippet'];
    pages.forEach((p,idx)=> pageCsv.push([`page-${idx+1}`, p.url, JSON.stringify(p.text.substring(0,200))].join(',')));
    fs.writeFileSync('test-results/explore-auth/page_inventory.csv', pageCsv.join('\n'));
    pages.forEach((p,idx)=> fs.writeFileSync(`test-results/explore-auth/page-${idx+1}.txt`, p.text));
    fs.writeFileSync('test-results/explore-auth/execution_status.txt', `verified:true\nverification_link:${verificationLink}\npages_crawled:${pages.length}`);
    console.log('Crawled', pages.length, 'pages');
  } catch(e){ console.error('Error following verification link', e); }
  await browser.close();
})();
