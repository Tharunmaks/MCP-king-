// Browser check of the website: loads index.html in Chromium (Playwright), fails on console errors or
// horizontal scroll at phone width, and generates the setup for every server x app x device, checking that
// JSON blocks parse and nothing prints "undefined". Usage: node tests/site.check.cjs http://127.0.0.1:8000/
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:8000/';
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: new URL(url).hostname } : undefined;
  const browser = await chromium.launch({ proxy });
  let failed = 0;
  for (const vp of [{ width: 360, height: 740 }, { width: 1280, height: 900 }]) {
    const page = await (await browser.newContext({ viewport: vp, ignoreHTTPSErrors: true })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|registry/.test(m.text())) errors.push(m.text()); });
    await page.goto(url, { waitUntil: 'load' });
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    if (width > vp.width) { failed++; console.log(`FAIL horizontal scroll at ${vp.width}px: ${width}px`); }
    if (errors.length) { failed++; console.log('FAIL errors:', errors); }
    if (vp.width === 360) {
      const problems = await page.evaluate(() => {
        const { setupFor, CATALOG, CLIENTS, DEVICES } = window.MCPKING;
        const out = [];
        let n = 0;
        for (const s of CATALOG) for (const c of CLIENTS) for (const d of DEVICES) {
          n++;
          let r;
          try { r = setupFor(s, c.id, d.id); } catch (e) { out.push(`${s.id}/${c.id}/${d.id}: threw ${e.message}`); continue; }
          if (!r.blocks.length && !s.note) out.push(`${s.id}/${c.id}/${d.id}: no setup`);
          for (const b of r.blocks) {
            if (/undefined|\[object|\bnull\b/.test(b.code + b.label)) out.push(`${s.id}/${c.id}/${d.id}: bad text in ${b.label}`);
            if (b.code.trim().startsWith('{')) { try { JSON.parse(b.code); } catch { out.push(`${s.id}/${c.id}/${d.id}: invalid JSON`); } }
            if (d.id === 'windows' && /"command": "npx"/.test(b.code) && !/mcp-remote/.test(b.code)) out.push(`${s.id}/${c.id}/windows: npx without cmd /c`);
          }
        }
        return { n, out };
      });
      console.log(`checked ${problems.n} server/app/device combinations`);
      if (problems.out.length) { failed++; console.log(problems.out.slice(0, 40).join('\n')); }
    }
  }
  await browser.close();
  console.log(failed ? `${failed} check(s) failed` : 'all site checks passed');
  process.exit(failed ? 1 : 0);
})();
