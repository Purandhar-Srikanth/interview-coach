import clsx from 'clsx'
import { BarChart3, CheckCircle2, CircleDashed, History, Loader2, MessageSquareText, Play } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import Alert from '../components/Alert'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import { getHistory, type SessionSummary } from '../lib/api'
import { scoreTone } from '../lib/format'
import { topicLabel } from '../lib/topics'

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getHistory()
      .then(setSessions)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load your history.'))
  }, [])

  return (
    <>
      <PageHeader title="History" subtitle="Review past interviews, answers and feedback." />
      {error && <Alert message={error} />}
      {!sessions && !error && (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-accent" aria-label="Loading" />
        </div>
      )}
      {sessions?.length === 0 && (
        <EmptyState icon={History} title="No interviews yet">
          Your interviews will be listed here so you can review every answer and score.{' '}
          <Link to="/" className="font-medium text-accent hover:underline">
            Start one now
          </Link>
        </EmptyState>
      )}
      {sessions && sessions.length > 0 && (
        <ul className="space-y-3">
          {sessions.map((s, i) => (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 10) * 0.04 }}
            >
              <SessionCard session={s} />
            </motion.li>
          ))}
        </ul>
      )}
    </>
  )
}

function SessionCard({ session: s }: { session: SessionSummary }) {
  const done = s.status === 'completed'
  const tone = s.average != null ? scoreTone(s.average) : null
  const date = new Date(s.created_at)

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-4">
      <div
        className={clsx(
          'flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl',
          tone ? tone.soft : 'bg-subtle',
        )}
        aria-label={s.average != null ? `Average ${s.average}` : 'No score yet'}
      >
        <span className={clsx('text-lg font-bold tabular-nums', tone?.text ?? 'text-muted')}>{s.average ?? '–'}</span>
        <span className="text-[10px] text-muted">avg</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate font-medium">{s.role_title}</h2>
          {s.focus_topic && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
              Focus: {topicLabel(s.focus_topic)}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>
            {date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })},{' '}
            {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="capitalize">{s.difficulty}</span>
          <span>
            {s.answered}/{s.total} answered{s.skipped > 0 && ` · ${s.skipped} skipped`}
          </span>
          <span className={clsx('flex items-center gap-1', done ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
            {done ? <CheckCircle2 size={12} /> : <CircleDashed size={12} />}
            {done ? 'Completed' : 'In progress'}
          </span>
        </div>
      </div>

      <div className="flex w-full gap-2 sm:w-auto">
        {done ? (
          <>
            <Link
              to={`/interview/${s.id}/summary`}
              className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-subtle"
            >
              <BarChart3 size={15} /> Summary
            </Link>
            <Link
              to={`/interview/${s.id}`}
              className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-subtle"
            >
              <MessageSquareText size={15} /> Transcript
            </Link>
          </>
        ) : (
          <Link
            to={`/interview/${s.id}`}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            <Play size={15} /> Resume
          </Link>
        )}
      </div>
    </div>
  )
}
