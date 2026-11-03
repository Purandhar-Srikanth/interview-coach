import { expect, test, type Page } from '@playwright/test'

const GOOD_ANSWER =
  'I compared class weights and SMOTE with stratified cross-validation and kept SMOTE inside the ' +
  'training folds to avoid leakage. Recall on churners went from 0.61 to 0.74 with ROC-AUC steady, ' +
  'and I picked the threshold from the cost of a missed churner versus a retention offer.'

/** Answer the current question and wait for its score. */
async function answer(page: Page, text: string) {
  const box = page.getByLabel('Your answer')
  await expect(box).toBeEnabled()
  await box.fill(text)
  await box.press('Control+Enter')
  await expect(page.getByRole('button', { name: /^Score \d+ out of 100/ }).last()).toBeVisible()
}

test('full interview: setup → 5 questions → summary → progress → history → delete data', async ({ page }) => {
  // The server sends a strict Content-Security-Policy; fail if it blocks anything the app needs.
  const blocked: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Content Security Policy|Refused to/i.test(msg.text())) blocked.push(msg.text())
  })

  // 1. Setup: sample data, analysis, profile card
  await page.goto('/')
  await page.getByRole('button', { name: 'Try with sample data' }).click()
  await page.getByRole('button', { name: /Analyse/ }).click()
  await expect(page.getByText('Interview topics')).toBeVisible()
  await page.getByRole('button', { name: 'Start interview' }).click()
  await expect(page).toHaveURL(/\/interview\//)

  // 2. Question 1: answer, see the score panel, retry once
  await expect(page.getByText('Question 1 ·').first()).toBeVisible()
  await answer(page, GOOD_ANSWER)
  const panel = page.getByRole('complementary', { name: 'Score breakdown' })
  await expect(panel.getByText('What went well')).toBeVisible()
  await expect(panel.getByText('Correctness')).toBeVisible()
  await page.getByRole('button', { name: 'Retry' }).click()
  await answer(page, 'A much shorter second attempt.')
  await expect(panel.getByText(/vs previous attempt/)).toBeVisible()
  await page.getByRole('button', { name: /Next question/ }).click()

  // 3. Question 2: skip it with the keyboard shortcut
  await expect(page.getByText('Question 2 ·').first()).toBeVisible()
  await expect(page.getByLabel('Your answer')).toBeEnabled()
  await page.getByLabel('Your answer').blur()
  await page.keyboard.press('s')
  await expect(page.getByText('Skipped')).toBeVisible()

  // 4. Questions 3-5
  for (const n of [3, 4, 5]) {
    await expect(page.getByText(`Question ${n} ·`).first()).toBeVisible()
    await answer(page, `${GOOD_ANSWER} (answer ${n})`)
    await page.getByRole('button', { name: n === 5 ? /Finish round/ : /Next question/ }).click()
  }

  // 5. Round complete → summary page
  await expect(page.getByRole('heading', { name: 'Round complete' })).toBeVisible()
  await page.getByRole('link', { name: /View round summary/ }).click()
  await expect(page.getByRole('heading', { name: 'Round summary' })).toBeVisible()
  await expect(page.getByText('Rubric averages')).toBeVisible()
  await expect(page.getByText('Practise next')).toBeVisible()

  // 6. Progress dashboard and history
  await page.getByRole('link', { name: 'Progress' }).first().click()
  await expect(page.getByText('Average score per round')).toBeVisible()
  await expect(page.getByText("Topics (the coach's memory)")).toBeVisible()
  await page.getByRole('link', { name: 'History' }).first().click()
  await expect(page.getByText('Completed')).toBeVisible()

  // 7. Delete my data
  await page.getByRole('link', { name: 'Settings' }).first().click()
  await page.getByRole('button', { name: 'Delete my data' }).click()
  await page.getByRole('button', { name: /Yes, delete everything/ }).click()
  await expect(page.getByText('All your data has been deleted.')).toBeVisible()
  await page.getByRole('link', { name: 'History' }).first().click()
  await expect(page.getByText('No interviews yet')).toBeVisible()

  expect(blocked, 'Content-Security-Policy violations').toEqual([])
})

test('a shared interview link opened in another browser explains it is private', async ({ page }) => {
  await page.goto('/interview/11111111-1111-4111-8111-111111111111')
  await expect(page.getByRole('heading', { name: 'This interview is private' })).toBeVisible()
  await page.goto('/interview/11111111-1111-4111-8111-111111111111/summary')
  await expect(page.getByRole('heading', { name: 'This interview is private' })).toBeVisible()
  await page.getByRole('link', { name: /Start your own/ }).click()
  await expect(page.getByRole('heading', { name: 'New interview' })).toBeVisible()
})

test('link previews: the page has Open Graph tags and the preview image is served', async ({ page, request }) => {
  await page.goto('/')
  const image = await page.locator('meta[property="og:image"]').getAttribute('content')
  expect(image).toMatch(/^https:\/\/.+\/og-image\.png$/)
  const response = await request.get('/og-image.png')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toBe('image/png')
})

test('mobile: setup page fits the screen and the theme toggle works', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'New interview' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  await page.getByRole('button', { name: 'Dark mode' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.close()
})
