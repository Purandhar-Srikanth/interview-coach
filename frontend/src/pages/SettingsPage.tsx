import { CheckCircle2, Loader2, ShieldCheck, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import Alert from '../components/Alert'
import PageHeader from '../components/PageHeader'
import ThemeToggle from '../components/ThemeToggle'
import { deleteMyData, getMyData, type MyData } from '../lib/api'

const usd = (value: number) => `$${value.toFixed(value < 0.01 ? 4 : 2)}`

export default function SettingsPage() {
  const [data, setData] = useState<MyData | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMyData()
      .then(setData)
      .catch(() => setData(null))
  }, [])

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await deleteMyData()
      setDeleted(true)
      setConfirming(false)
      setData({ sessions: 0, answers: 0, total_cost_usd: 0, today_cost_usd: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete your data.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <section className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
          <div>
            <h2 className="text-sm font-semibold">Appearance</h2>
            <p className="text-sm text-muted">Switch between light and dark mode.</p>
          </div>
          <ThemeToggle showLabel />
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck size={16} className="text-accent" /> Your data
          </h2>
          <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Interviews', data?.sessions ?? '–'],
              ['Answers', data?.answers ?? '–'],
              ['AI cost today', data ? usd(data.today_cost_usd) : '–'],
              ['AI cost total', data ? usd(data.total_cost_usd) : '–'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-subtle px-3 py-2.5">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="space-y-2 text-sm text-muted">
            <p>
              <b className="text-text">What is stored:</b> the job description and resume <i>text</i> you
              submit, your questions, answers, scores and feedback, and a per-topic average (the coach's
              memory). Uploaded files are read in memory and never saved.
            </p>
            <p>
              <b className="text-text">Who you are:</b> nobody. You're identified only by a random ID kept
              in this browser. No name, email or password.
            </p>
            <p>
              <b className="text-text">AI provider:</b> answers are sent to OpenAI for scoring, with
              storage turned off on their side.
            </p>
            <p>
              <b className="text-text">Voice answers:</b> the mic uses your browser’s own speech service
              (Google in Chrome, Microsoft in Edge) to turn speech into text. Audio never reaches this app’s
              server; only the text you submit does.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-red-200 bg-surface p-5 dark:border-red-900/60">
          <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">Delete my data</h2>
          <p className="mt-1 text-sm text-muted">
            Permanently deletes all your interviews, answers, scores and memory, and gives this browser a
            new ID. Anonymous cost records (no content) are kept for the daily spending limit.
          </p>
          {error && (
            <div className="mt-3">
              <Alert message={error} />
            </div>
          )}
          {deleted && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              role="status"
              className="mt-3 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400"
            >
              <CheckCircle2 size={16} /> All your data has been deleted.
            </motion.p>
          )}
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-4 flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <Trash2 size={16} /> Delete my data
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30"
              role="alertdialog"
              aria-label="Confirm delete"
            >
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Delete everything? This can't be undone.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Yes, delete
                  everything
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={deleting}
                  className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-subtle"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </section>
      </div>
    </>
  )
}
