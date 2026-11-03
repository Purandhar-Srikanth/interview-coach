// Records the README demo: drives the real app in a browser and saves numbered screenshots
// plus their display times; scripts/make_gif.py then turns them into docs/media/demo.gif.
//
// Uses the mock LLM (free and reproducible) with a throwaway database, and first plays three
// earlier rounds through the API so the progress charts have data.
//
// Usage (from the project folder):
//   npm --prefix frontend run build
//   node frontend/scripts/record-demo.mjs   (set PYTHON to the venv python if needed)
//   .venv\Scripts\python scripts\make_gif.py

import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..', '..')
const FRAMES = join(ROOT, 'docs', 'media', 'frames')
const PORT = 8124
const BASE = `http://localhost:${PORT}`
const VISITOR = '0d0a7c3e-5f1b-4c7a-9a3e-2b6f8d1e4c90'
const python = process.env.PYTHON ?? join(ROOT, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- start the app server (mock LLM, temporary database) ----
const server = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--app-dir', join(ROOT, 'backend'), '--port', String(PORT)], {
  env: {
    ...process.env,
    IGNORE_DOTENV: '1',
    LLM_MODE: 'mock',
    MOCK_DELAY_S: '1.2', // slow enough that the typing effect is visible
    DEMO_MODE: 'false',
    DATABASE_URL: `sqlite:///${join(tmpdir(), `demo-${Date.now()}.db`).replace(/\\/g, '/')}`,
  },
  stdio: 'ignore',
})
process.on('exit', () => server.kill())

for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`${BASE}/api/health`)).ok) break
  } catch {
    // not up yet
  }
  await sleep(500)
}

// ---- seed three earlier rounds for this visitor, so Progress has a trend ----
async function api(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'X-Visitor-Id': VISITOR, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.headers.get('content-type')?.includes('event-stream')) return JSON.parse(text)
  return text.split('\n').filter((l) => l.startsWith('data: ')).map((l) => JSON.parse(l.slice(6)))
}
const questionOf = (events) => events.find((e) => e.type === 'question').question
// Reuse the app's own sample texts (template literals in src/lib/samples.ts).
const samplesSource = readFileSync(join(ROOT, 'frontend', 'src', 'lib', 'samples.ts'), 'utf8')
const sample = (name) => samplesSource.match(new RegExp(`${name} = \`([\\s\\S]*?)\``))[1]
const samples = { SAMPLE_JD: sample('SAMPLE_JD'), SAMPLE_RESUME: sample('SAMPLE_RESUME') }

console.log('Seeding earlier rounds...')
const first = await api('POST', '/sessions', { jd_text: samples.SAMPLE_JD, resume_text: samples.SAMPLE_RESUME })
const lengths = [
  [40, 300, 15, 90, 300],
  [300, 120, 90, 300, 300],
  [300, 300, 300, 120, 300],
]
for (let n = 0; n < lengths.length; n++) {
  const session = n === 0 ? first : await api('POST', `/sessions/${first.id}/practice`, {})
  let q = questionOf(await api('POST', `/sessions/${session.id}/start`))
  for (let i = 0; i < 5; i++) {
    await api('POST', `/sessions/${session.id}/answer`, { question_id: q.id, text: 'x'.repeat(lengths[n][i]), time_taken_s: 60 })
    const events = await api('POST', `/sessions/${session.id}/next`)
    if (i < 4) q = questionOf(events)
  }
}

// ---- record ----
rmSync(FRAMES, { recursive: true, force: true })
mkdirSync(FRAMES, { recursive: true })
const durations = []
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 })
await page.addInitScript((id) => {
  localStorage.setItem('visitor-id', id)
  localStorage.setItem('theme', 'light')
}, VISITOR)

async function shot(ms) {
  await page.screenshot({ path: join(FRAMES, `${String(durations.length).padStart(4, '0')}.png`) })
  durations.push(ms)
}
async function film(totalMs, every = 120) {
  for (let t = 0; t < totalMs; t += every) await shot(every)
}

console.log('Recording...')
await page.goto(`${BASE}/`)
await page.getByRole('heading', { name: 'New interview' }).waitFor()
await shot(1500)
await page.getByRole('button', { name: 'Try with sample data' }).click()
await shot(1400)
await page.getByRole('button', { name: /Analyse/ }).click()
await film(1100, 220)
await page.getByText('Interview topics').waitFor()
await sleep(700)
await page.getByText('Interview topics').scrollIntoViewIfNeeded()
await shot(2600)

await page.getByRole('button', { name: 'Start interview' }).click()
await page.waitForURL(/\/interview\//)
await film(4200, 140) // planning + question typing in
await shot(1200)

const answer =
  'I compared class weights and SMOTE with stratified 5-fold cross-validation, applying SMOTE only inside ' +
  'the training folds to avoid leakage. Recall on churners rose from 0.61 to 0.74 with ROC-AUC steady at 0.86, ' +
  'and I chose the threshold from the cost of a missed churner versus a retention offer.'
const box = page.getByLabel('Your answer')
const words = answer.split(' ')
for (let i = 4; i <= words.length; i += 4) {
  await box.fill(words.slice(0, i).join(' '))
  await shot(110)
}
await box.fill(answer)
await shot(700)
await box.press('Control+Enter')
await film(1300, 180) // "Scoring your answer…"
await page.getByRole('button', { name: /^Score \d+ out of 100/ }).waitFor()
await film(2400, 110) // ring counts up, bars fill, feedback fades in
await shot(2600)

await page.getByRole('link', { name: 'Progress' }).first().click()
await page.getByText('Average score per round').waitFor()
await film(1400, 140) // charts animate in
await shot(3000)

await page.getByRole('link', { name: 'History' }).first().click()
await page.getByText('Completed').first().waitFor()
await sleep(400)
await shot(2200)

await page.getByRole('button', { name: 'Dark mode' }).click()
await sleep(400)
await shot(2400)

writeFileSync(join(FRAMES, 'durations.json'), JSON.stringify(durations))
await browser.close()
server.kill()
console.log(`Saved ${durations.length} frames to docs/media/frames`)
process.exit(0)
