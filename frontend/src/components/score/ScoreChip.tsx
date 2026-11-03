import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { scoreTone } from '../../lib/format'

type Props = { overall: number; attempt: number; selected: boolean; onClick: () => void }

/** Compact score shown in the chat; click it to see the full breakdown. */
export default function ScoreChip({ overall, attempt, selected, onClick }: Props) {
  const tone = scoreTone(overall)
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={clsx(
        'ml-auto flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
        selected ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-accent/50',
      )}
      aria-label={`Score ${overall} out of 100. Show feedback`}
    >
      <span className={clsx('font-bold tabular-nums', tone.text)}>{overall}</span>
      <span className="text-muted">
        {tone.label}
        {attempt > 1 && ` · attempt ${attempt}`}
      </span>
      <span className="flex items-center text-xs font-medium text-accent">
        Feedback <ChevronRight size={14} />
      </span>
    </motion.button>
  )
}
