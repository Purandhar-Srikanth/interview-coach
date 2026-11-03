import clsx from 'clsx'
import { ArrowDownRight, ArrowUpRight, Brain, Check, ChevronDown, Clock, ListChecks, Sparkles, TrendingUp } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import type { MemoryNote } from '../../hooks/useInterview'
import type { Answer, Question } from '../../lib/api'
import { formatDuration, QTYPE_LABELS, scoreTone } from '../../lib/format'
import { topicLabel } from '../../lib/topics'
import Markdown from '../Markdown'
import RubricBars from './RubricBars'
import ScoreRing from './ScoreRing'

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
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 overflow-hidden">
          {children}
        </motion.div>
      )}
    </div>
  )
}

type Props = {
  question: Question
  answer: Answer
  previousOverall?: number // score of the attempt before this one (for retries)
  memoryNote?: MemoryNote | null
}

/** Full, animated breakdown of one scored answer: ring → bars → feedback. */
export default function ScoreReveal({ question, answer, previousOverall, memoryNote }: Props) {
  const reduceMotion = useReducedMotion()
  const score = answer.score!
  const tone = scoreTone(score.overall)
  const delta = previousOverall != null ? score.overall - previousOverall : null
  const fadeIn = (delay: number) =>
    reduceMotion ? {} : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { delay } }

  return (
    // Re-keying on the answer replays the animation whenever a different answer is shown.
    <div key={answer.id} className="space-y-5">
      <div className="text-xs text-muted">
        Question {question.index + 1} · {QTYPE_LABELS[question.qtype]}
        {question.qtype !== 'project' && question.qtype !== 'behavioural' && ` · ${topicLabel(question.topic)}`}
        {answer.attempt > 1 && ` · attempt ${answer.attempt}`}
      </div>

      <div className="flex items-center gap-5">
        <ScoreRing value={score.overall} />
        <div className="space-y-2">
          <motion.div {...fadeIn(0.9)} className={clsx('inline-block rounded-full px-3 py-1 text-sm font-semibold', tone.soft, tone.text)}>
            {tone.label}
          </motion.div>
          {delta != null && (
            <motion.div {...fadeIn(1.1)} className={clsx('flex items-center gap-1 text-sm font-medium', delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
              {delta >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              {delta >= 0 ? '+' : ''}
              {delta} vs previous attempt
            </motion.div>
          )}
          <motion.div {...fadeIn(1.2)} className="flex items-center gap-1.5 text-xs text-muted">
            <Clock size={13} /> {formatDuration(answer.time_taken_s)} of {formatDuration(question.time_limit_s)} suggested
          </motion.div>
          {answer.attempt > 1 && <p className="text-xs text-muted">Practice attempt, not counted in your memory.</p>}
        </div>
      </div>

      <RubricBars score={score} qtype={question.qtype} delay={reduceMotion ? 0 : 0.5} />

      <motion.div {...fadeIn(1.2)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <div>
          <h4 className="mb-1.5 text-xs font-semibold text-muted uppercase">What went well</h4>
          <ul className="space-y-1.5 text-sm">
            {score.strengths.map((s) => (
              <li key={s} className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" /> {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-1.5 text-xs font-semibold text-muted uppercase">To improve</h4>
          <ul className="space-y-1.5 text-sm">
            {score.improvements.map((s) => (
              <li key={s} className="flex gap-2">
                <TrendingUp size={16} className="mt-0.5 shrink-0 text-amber-500" /> {s}
              </li>
            ))}
          </ul>
        </div>
      </motion.div>

      <motion.div {...fadeIn(1.4)} className="space-y-3">
        <Collapsible icon={<Sparkles size={16} className="text-accent" />} title="Stronger sample answer">
          <Markdown>{score.sample_answer}</Markdown>
        </Collapsible>
        {question.expected_points && question.expected_points.length > 0 && (
          <Collapsible icon={<ListChecks size={16} className="text-accent" />} title="What a strong answer covers">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {question.expected_points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Collapsible>
        )}
      </motion.div>

      {memoryNote && (
        <motion.div {...fadeIn(1.6)} className="flex items-start gap-2 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
          <Brain size={14} className="mt-0.5 shrink-0" />
          <span>
            Memory updated: your <b>{topicLabel(memoryNote.topic)}</b> average is now {memoryNote.average}/100 (
            {memoryNote.attempts} {memoryNote.attempts === 1 ? 'answer' : 'answers'}). Later rounds focus on topics below 70.
          </span>
        </motion.div>
      )}
    </div>
  )
}
