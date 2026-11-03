import clsx from 'clsx'
import { ArrowLeft, ChevronDown, Clock, Loader2, RefreshCw, Target } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Alert from '../components/Alert'
import Markdown from '../components/Markdown'
import ScoreRing from '../components/score/ScoreRing'
import { getSession, practiceAgain, type Question, type SessionDetail } from '../lib/api'
import { DIMENSIONS, dimensionLabel, formatDuration, QTYPE_LABELS, scoreTone } from '../lib/format'
import { topicLabel } from '../lib/topics'

const WEAK_BELOW = 70 // same threshold the round planner uses

/** First attempts count as "the" score (retries are practice). */
const firstScore = (q: Question) => q.answers[0]?.score ?? null
const bestScore = (q: Question) => Math.max(...q.answers.map((a) => a.score?.overall ?? -1))

export default function SummaryPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState<string | null>(null) // which practice button is busy

  useEffect(() => {
    getSession(id)
      .then(setSession)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load this interview.'))
  }, [id])

  async function practise(topic: string | null) {
    setStarting(topic ?? 'mixed')
    try {
      const next = await practiceAgain(id, topic)
      navigate(`/interview/${next.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start a new round.')
      setStarting(null)
    }
  }

  if (error && !session) return <Alert message={error} />
  if (!session) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-accent" />
      </div>
    )
  }

  const scoredQs = session.questions.filter((q) => firstScore(q))
  const scores = scoredQs.map((q) => firstScore(q)!.overall)
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
  const skipped = session.questions.filter((q) => q.answers[0]?.skipped)
  const totalTime = session.questions.reduce((sum, q) => sum + q.answers.reduce((s, a) => s + a.time_taken_s, 0), 0)

  // Topics to practise: low first-attempt scores, plus anything skipped.
  const weak = [
    ...scoredQs
      .filter((q) => firstScore(q)!.overall < WEAK_BELOW)
      .sort((a, b) => firstScore(a)!.overall - firstScore(b)!.overall)
      .map((q) => ({ topic: q.topic, note: `${firstScore(q)!.overall}/100` })),
    ...skipped.map((q) => ({ topic: q.topic, note: 'skipped' })),
  ].filter((w, i, all) => all.findIndex((x) => x.topic === w.topic) === i)

  // Average of each rubric dimension across first attempts.
  const dimensionAverages = DIMENSIONS.map(({ key }) => ({
    key,
    value: scoredQs.length ? scoredQs.reduce((sum, q) => sum + firstScore(q)![key], 0) / scoredQs.length : 0,
  }))

  return (
    <div className="space-y-6">
      <Link to={`/interview/${session.id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} /> Back to the interview
      </Link>

      {session.status !== 'completed' && (
        <Alert message="This round isn't finished yet, so the summary is incomplete." />
      )}

      {/* Overview */}
      <section className="flex flex-col items-center gap-6 rounded-2xl border border-line bg-surface p-6 sm:flex-row">
        <ScoreRing value={average} size={140} label="avg / 100" />
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-2xl font-semibold tracking-tight">Round summary</h1>
          <p className="mt-1 text-sm text-muted">
            {session.role_title} · <span className="capitalize">{session.difficulty}</span>
            {session.focus_topic && ` · Focus: ${topicLabel(session.focus_topic)}`} ·{' '}
            {new Date(session.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-6 text-sm sm:justify-start">
            <Stat label="Answered" value={`${scoredQs.length} / ${session.questions.length}`} />
            <Stat label="Skipped" value={String(skipped.length)} />
            <Stat label="Time" value={formatDuration(totalTime)} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {session.summary && (
            <section className="rounded-2xl border border-line bg-surface p-6">
              <h2 className="mb-2 text-sm font-semibold">Coach's feedback</h2>
              <Markdown>{session.summary}</Markdown>
            </section>
          )}

          <section className="rounded-2xl border border-line bg-surface">
            <h2 className="border-b border-line px-6 py-4 text-sm font-semibold">Question by question</h2>
            <ul className="divide-y divide-line">
              {session.questions.map((q) => (
                <QuestionRow key={q.id} question={q} />
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="mb-4 text-sm font-semibold">Rubric averages</h2>
            <div className="space-y-3">
              {dimensionAverages.map(({ key, value }, i) => (
                <div key={key}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium">{key === 'correctness' ? 'Correctness / STAR' : dimensionLabel(key, '')}</span>
                    <span className="text-muted tabular-nums">{value.toFixed(1)} / 5</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-subtle">
                    <motion.div
                      className={clsx('h-full rounded-full', scoreTone(((value - 1) / 4) * 100).bar)}
                      initial={{ width: 0 }}
                      animate={{ width: `${(value / 5) * 100}%` }}
                      transition={{ delay: 0.3 + i * 0.1, duration: 0.6 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <Target size={16} className="text-accent" /> Practise next
            </h2>
            <p className="mb-4 text-xs text-muted">
              Start a focused 5-question round on one topic, using the same job description and resume.
            </p>
            {weak.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {weak.map((w) => (
                  <button
                    key={w.topic}
                    type="button"
                    onClick={() => practise(w.topic)}
                    disabled={starting !== null}
                    className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                  >
                    {starting === w.topic && <Loader2 size={12} className="animate-spin" />}
                    {topicLabel(w.topic)} <span className="opacity-70">· {w.note}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No weak topics this round. Nice work!</p>
            )}
            <button
              type="button"
              onClick={() => practise(null)}
              disabled={starting !== null}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              {starting === 'mixed' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Another mixed round
            </button>
            {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
          </section>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}

function QuestionRow({ question: q }: { question: Question }) {
  const [open, setOpen] = useState(false)
  const first = firstScore(q)
  const best = bestScore(q)
  const skipped = q.answers[0]?.skipped
  const tone = first ? scoreTone(first.overall) : null

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-6 py-4 text-left hover:bg-subtle/60"
      >
        <span className="w-6 text-sm text-muted tabular-nums">{q.index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{topicLabel(q.topic)}</div>
          <div className="text-xs text-muted">
            {/* project/behavioural topics already read as their type */}
            {q.qtype === 'project' || q.qtype === 'behavioural' ? 'Open question' : QTYPE_LABELS[q.qtype]}
            {q.answers.length > 1 && ` · best of ${q.answers.length}: ${best}`}
          </div>
        </div>
        {q.answers[0] && !skipped && (
          <span className="hidden items-center gap-1 text-xs text-muted sm:flex">
            <Clock size={12} /> {formatDuration(q.answers[0].time_taken_s)}
          </span>
        )}
        <span className={clsx('w-12 text-right font-semibold tabular-nums', tone?.text ?? 'text-muted')}>
          {skipped ? 'skip' : (first?.overall ?? '–')}
        </span>
        <ChevronDown size={16} className={clsx('text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-4 px-6 pb-5 pl-16">
          <Markdown className="text-muted">{q.text}</Markdown>
          {q.answers.map((a) =>
            a.skipped ? null : (
              <div key={a.id} className="space-y-2 rounded-xl bg-subtle/70 p-4">
                <div className="text-xs font-medium text-muted">
                  Your answer{q.answers.length > 1 && ` (attempt ${a.attempt})`}
                  {a.score && ` · ${a.score.overall}/100`}
                </div>
                <p className="text-sm whitespace-pre-wrap">{a.text}</p>
                {a.score && (
                  <ul className="space-y-1 text-xs text-muted">
                    {a.score.improvements.map((tip) => (
                      <li key={tip}>→ {tip}</li>
                    ))}
                  </ul>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </li>
  )
}
