import clsx from 'clsx'
import { Brain, Check, ChevronDown, ListChecks, Sparkles, TrendingUp } from 'lucide-react'
import { motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import type { Score } from '../../lib/api'
import type { MemoryNote } from '../../hooks/useInterview'
import { scoreTone } from '../../lib/format'
import { topicLabel } from '../../lib/topics'
import Markdown from '../Markdown'

const DIMENSIONS = [
  { key: 'correctness', label: 'Correctness' },
  { key: 'depth', label: 'Depth' },
  { key: 'clarity', label: 'Clarity' },
  { key: 'relevance', label: 'JD relevance' },
] as const

function Collapsible({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-line pt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-sm font-medium hover:text-accent"
      >
        {icon}
        {title}
        <ChevronDown size={16} className={clsx('ml-auto transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2">
          {children}
        </motion.div>
      )}
    </div>
  )
}

type Props = {
  score: Score
  qtype: string
  attempt: number
  expectedPoints: string[] | null
  memoryNote: MemoryNote | null
}

/** Rubric breakdown and feedback for one answer. */
export default function ScoreCard({ score, qtype, attempt, expectedPoints, memoryNote }: Props) {
  const tone = scoreTone(score.overall)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 rounded-2xl border border-line bg-surface p-5"
    >
      <div className="flex items-center gap-4">
        <div className={clsx('text-4xl font-bold tabular-nums', tone.text)}>{score.overall}</div>
        <div>
          <div className={clsx('text-sm font-semibold', tone.text)}>{tone.label}</div>
          <div className="text-xs text-muted">
            out of 100{attempt > 1 && ` · attempt ${attempt} (practice, not counted in memory)`}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {DIMENSIONS.map(({ key, label }, i) => {
          const value = score[key]
          const name = key === 'correctness' && qtype === 'behavioural' ? 'STAR structure' : label
          return (
            <div key={key}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium">{name}</span>
                <span className="text-muted tabular-nums">{value}/5</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-subtle">
                <motion.div
                  className={clsx('h-full rounded-full', scoreTone(((value - 1) / 4) * 100).bar)}
                  initial={{ width: 0 }}
                  animate={{ width: `${(value / 5) * 100}%` }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.5 }}
                />
              </div>
              <p className="mt-1 text-xs text-muted">{score.justifications[key]}</p>
            </div>
          )
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-1.5 text-xs font-semibold text-muted uppercase">What went well</h4>
          <ul className="space-y-1 text-sm">
            {score.strengths.map((s) => (
              <li key={s} className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" /> {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-1.5 text-xs font-semibold text-muted uppercase">To improve</h4>
          <ul className="space-y-1 text-sm">
            {score.improvements.map((s) => (
              <li key={s} className="flex gap-2">
                <TrendingUp size={16} className="mt-0.5 shrink-0 text-amber-500" /> {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Collapsible icon={<Sparkles size={16} className="text-accent" />} title="Stronger sample answer">
        <Markdown>{score.sample_answer}</Markdown>
      </Collapsible>

      {expectedPoints && expectedPoints.length > 0 && (
        <Collapsible icon={<ListChecks size={16} className="text-accent" />} title="What a strong answer covers">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {expectedPoints.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Collapsible>
      )}

      {memoryNote && (
        <div className="flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
          <Brain size={14} />
          Memory updated: your {topicLabel(memoryNote.topic)} average is now {memoryNote.average}/100
          ({memoryNote.attempts} {memoryNote.attempts === 1 ? 'answer' : 'answers'})
        </div>
      )}
    </motion.div>
  )
}
