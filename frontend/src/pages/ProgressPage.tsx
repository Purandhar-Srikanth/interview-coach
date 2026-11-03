import clsx from 'clsx'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Brain, Loader2, Target, TrendingUp } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Alert from '../components/Alert'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import ChartCard, { DataTable } from '../components/progress/ChartCard'
import ScoreTrendChart from '../components/progress/ScoreTrendChart'
import StatTile from '../components/progress/StatTile'
import TopicBars from '../components/progress/TopicBars'
import { getProgress, practiceAgain, type Progress } from '../lib/api'
import { DIMENSIONS, scoreTone } from '../lib/format'

export default function ProgressPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<Progress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    getProgress()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load your progress.'))
  }, [])

  async function practise(topic: string | null) {
    if (!data?.latest_session_id) return
    setStarting(topic ?? 'mixed')
    try {
      const session = await practiceAgain(data.latest_session_id, topic)
      navigate(`/interview/${session.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start a round.')
      setStarting(null)
    }
  }

  const header = <PageHeader title="Progress" subtitle="Your scores over time and the topics the coach will focus on." />

  if (error && !data) {
    return (
      <>
        {header}
        <Alert message={error} />
      </>
    )
  }
  if (!data) {
    return (
      <>
        {header}
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-accent" aria-label="Loading" />
        </div>
      </>
    )
  }
  if (data.questions_answered === 0) {
    return (
      <>
        {header}
        <EmptyState icon={TrendingUp} title="No progress yet">
          Answer your first questions to see score charts and your weak areas here.{' '}
          <Link to="/" className="font-medium text-accent hover:underline">
            Start an interview
          </Link>
        </EmptyState>
      </>
    )
  }

  const rounds = data.sessions
  const last = rounds.at(-1)?.average ?? null
  const previous = rounds.at(-2)?.average ?? null
  const change = last != null && previous != null ? last - previous : null
  const weak = data.topics.filter((t) => t.weak)
  const weakest = data.topics[0]

  return (
    <>
      {header}
      {error && (
        <div className="mb-4">
          <Alert message={error} onClose={() => setError(null)} />
        </div>
      )}

      {/* Headline numbers */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Rounds completed" value={data.rounds_completed} />
        <StatTile label="Questions answered" value={data.questions_answered} detail="first attempts" />
        <StatTile
          label="Latest round"
          value={last != null ? `${last}/100` : '–'}
          detail={
            change != null ? (
              <span className={clsx('inline-flex items-center gap-0.5 font-medium', change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                {change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {change >= 0 ? '+' : ''}
                {change} vs previous round
              </span>
            ) : (
              `overall average ${data.overall_average}`
            )
          }
        />
        <StatTile
          label="Weakest topic"
          icon={weakest?.weak ? <AlertTriangle size={13} className="text-amber-600" /> : undefined}
          value={<span className="text-lg">{weakest?.label ?? '–'}</span>}
          detail={weakest ? `average ${weakest.avg_score} · ${weakest.attempts} ${weakest.attempts === 1 ? 'answer' : 'answers'}` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ChartCard
          title="Average score per round"
          subtitle={rounds.length < 2 ? 'Finish another round to see your trend.' : 'First attempts only; retries are practice.'}
          chart={<ScoreTrendChart sessions={rounds} />}
          table={
            <DataTable
              head={['Round', 'Date', 'Type', 'Average']}
              rows={rounds.map((s, i) => [
                `R${i + 1}`,
                new Date(s.created_at).toLocaleDateString(),
                s.focus_topic ? `Focus` : 'Mixed',
                s.average ?? '–',
              ])}
            />
          }
        />

        <ChartCard
          title="Rubric dimensions"
          subtitle="Average of each dimension (1–5) across all answers."
          chart={
            <div className="space-y-4 pt-2">
              {DIMENSIONS.map(({ key, label, hint }, i) => {
                const value = data.dimensions?.[key] ?? 0
                return (
                  <div key={key}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium">
                        {key === 'correctness' ? 'Correctness / STAR' : label}
                      </span>
                      <span className="text-muted tabular-nums">{value.toFixed(1)} / 5</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-subtle">
                      <motion.div
                        className={clsx('h-full rounded-full', scoreTone(((value - 1) / 4) * 100).bar)}
                        initial={{ width: 0 }}
                        animate={{ width: `${(value / 5) * 100}%` }}
                        transition={{ delay: 0.2 + i * 0.1, duration: 0.6 }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted">{hint}</p>
                  </div>
                )
              })}
            </div>
          }
          table={
            <DataTable
              head={['Dimension', 'Average (1–5)']}
              rows={DIMENSIONS.map(({ key, label }) => [label, (data.dimensions?.[key] ?? 0).toFixed(2)])}
            />
          }
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ChartCard
          title="Topics (the coach's memory)"
          subtitle="Moving average per topic, weakest first. Topics below 70 get priority in your next round."
          chart={<TopicBars topics={data.topics} />}
          table={
            <DataTable
              head={['Topic', 'Average', 'Last', 'Answers', 'Status']}
              rows={data.topics.map((t) => [t.label, t.avg_score, t.last_score, t.attempts, t.weak ? 'Weak' : 'OK'])}
            />
          }
        />

        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Target size={16} className="text-accent" /> Practise your weak areas
          </h2>
          <p className="mt-1 mb-4 text-xs text-muted">
            Click a topic for a focused 5-question round, using your latest job description and resume.
          </p>
          {weak.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {weak.map((t) => (
                <button
                  key={t.topic}
                  type="button"
                  onClick={() => practise(t.topic)}
                  disabled={starting !== null || !data.latest_session_id}
                  className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/70"
                >
                  {starting === t.topic ? <Loader2 size={12} className="animate-spin" /> : <AlertTriangle size={12} />}
                  {t.label} <span className="opacity-70">· {t.avg_score}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No weak topics right now. Every topic averages 70 or more.</p>
          )}
          <button
            type="button"
            onClick={() => practise(null)}
            disabled={starting !== null || !data.latest_session_id}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            {starting === 'mixed' ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
            Start a round (weak topics first)
          </button>
        </section>
      </div>
    </>
  )
}
