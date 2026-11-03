import { expect, test, type Page } from '@playwright/test'

// A fake browser speech engine: when started it "hears" two phrases (one in-progress, then
// final), then waits until stop() is called. Lets us test voice answers without a microphone.
const FAKE_SPEECH = `
  class FakeRecognition {
    start() {
      const emit = (text, isFinal) =>
        this.onresult && this.onresult({ resultIndex: 0, results: [{ isFinal, 0: { transcript: text } }] })
      setTimeout(() => emit('I would use', false), 100)
      setTimeout(() => emit('I would use ROW_NUMBER partitioned by customer', true), 300)
    }
    stop() { setTimeout(() => this.onend && this.onend(), 50) }
  }
  window.SpeechRecognition = FakeRecognition
  window.webkitSpeechRecognition = FakeRecognition
`

async function startInterview(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try with sample data' }).click()
  await page.getByRole('button', { name: /Analyse/ }).click()
  await page.getByRole('button', { name: 'Start interview' }).click()
  await expect(page.getByLabel('Your answer')).toBeEnabled()
}

test('voice answer: spoken words are added after typed text, then can be submitted', async ({ page }) => {
  await page.addInitScript(FAKE_SPEECH)
  await startInterview(page)

  const box = page.getByLabel('Your answer')
  await box.fill('Typed start.')
  await page.getByRole('button', { name: 'Answer by voice' }).click()
  await expect(page.getByText(/Listening… speak your answer/)).toBeVisible()
  await expect(box).toHaveValue('Typed start. I would use ROW_NUMBER partitioned by customer')

  await page.getByRole('button', { name: 'Stop voice input' }).click()
  await expect(page.getByText(/Listening…/)).toBeHidden()
  await expect(box).toHaveValue('Typed start. I would use ROW_NUMBER partitioned by customer')

  await box.press('Control+Enter')
  await expect(page.getByRole('button', { name: /^Score \d+ out of 100/ })).toBeVisible()
})

test('voice button is hidden when the browser has no speech support', async ({ page }) => {
  await page.addInitScript(`delete window.SpeechRecognition; delete window.webkitSpeechRecognition;`)
  await startInterview(page)
  await expect(page.getByRole('button', { name: 'Answer by voice' })).toHaveCount(0)
  await expect(page.getByLabel('Your answer')).toHaveAttribute('placeholder', /Type your answer/)
})
