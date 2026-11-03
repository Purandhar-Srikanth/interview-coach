// Draws the link-preview card (frontend/public/og-image.png, 1200x630) that WhatsApp, LinkedIn,
// Slack, X etc. show when someone shares the site. Re-run after changing the text below:
//   node frontend/scripts/make-og-image.mjs

import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const PUBLIC = resolve(import.meta.dirname, '..', 'public')
const logo = readFileSync(join(PUBLIC, 'favicon.svg'), 'utf8')

const rubric = [
  ['Correctness', 5],
  ['Depth', 4],
  ['Clarity', 4],
  ['Relevance to JD', 5],
]

const html = `<!doctype html>
<html><head><meta charset="utf-8" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; font-family: Inter, sans-serif; color: #0f172a;
         background: linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #f8fafc 100%);
         display: flex; align-items: center; gap: 56px; padding: 0 72px; }
  .left { flex: 1; }
  .brand { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 700; }
  .brand svg { width: 52px; height: 52px; }
  h1 { margin-top: 36px; font-size: 54px; line-height: 1.08; font-weight: 800; letter-spacing: -1.5px; }
  h1 span { color: #2563eb; }
  ul { margin-top: 28px; padding: 0; list-style: none; font-size: 24px; color: #334155; }
  li { margin-top: 12px; padding-left: 34px; position: relative; }
  li::before { content: ''; position: absolute; left: 0; top: 7px; width: 18px; height: 18px;
               border-radius: 50%; background: #2563eb; }
  .card { width: 400px; background: #fff; border: 1px solid #e2e8f0; border-radius: 24px;
          padding: 32px; box-shadow: 0 24px 60px -20px rgba(15, 23, 42, .25); }
  .q { font-size: 15px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: .6px; }
  .score { display: flex; align-items: baseline; gap: 8px; margin-top: 10px; }
  .score b { font-size: 84px; font-weight: 800; color: #16a34a; letter-spacing: -3px; }
  .score i { font-style: normal; font-size: 26px; color: #94a3b8; }
  .row { margin-top: 18px; }
  .row div:first-child { display: flex; justify-content: space-between; font-size: 18px; font-weight: 500; }
  .bar { margin-top: 8px; height: 10px; border-radius: 6px; background: #e2e8f0; overflow: hidden; }
  .bar span { display: block; height: 100%; border-radius: 6px; background: #2563eb; }
</style></head>
<body>
  <div class="left">
    <div class="brand">${logo}Interview Coach</div>
    <h1>AI mock interviews for <span>data science &amp; ML</span> roles</h1>
    <ul>
      <li>Questions tailored to your JD and resume</li>
      <li>Every answer scored on a clear rubric</li>
      <li>Remembers your weak topics</li>
    </ul>
  </div>
  <div class="card">
    <div class="q">Your answer · Question 1</div>
    <div class="score"><b>86</b><i>/ 100</i></div>
    ${rubric
      .map(
        ([name, value]) =>
          `<div class="row"><div><span>${name}</span><span>${value}/5</span></div>` +
          `<div class="bar"><span style="width:${value * 20}%"></span></div></div>`,
      )
      .join('')}
  </div>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html, { waitUntil: 'networkidle' })
await page.screenshot({ path: join(PUBLIC, 'og-image.png') })
await browser.close()
console.log('saved frontend/public/og-image.png')
