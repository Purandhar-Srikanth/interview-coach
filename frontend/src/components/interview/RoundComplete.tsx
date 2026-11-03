import clsx from 'clsx'
import { BarChart3, Trophy } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import { scoreTone } from '../../lib/format'
import Markdown from '../Markdown'
import { TypingDots } from './ChatBubbles'

type Props = { sessionId: string; text: string; average: number | null; done: boolean }

/** End-of-round card in the chat: streamed coach summary + link to the full summary page. */
export default function RoundComplete({ sessionId, text, average, done }: Props) {
  const tone = average != null ? scoreTone(average) : null
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-accent/30 bg-accent-soft/50 p-6"
    >
      <div className="mb-3 flex items-center gap-3">
        <Trophy size={22} className="text-accent" />
        <h2 className="text-lg font-semibold">Round complete</h2>
        {done && average != null && tone && (
          <span className={clsx('ml-auto text-2xl font-bold tabular-nums', tone.text)}>
            {average}
            <span className="text-sm font-normal text-muted">/100 avg</span>
          </span>
        )}
      </div>
      {text ? <Markdown>{text}</Markdown> : <TypingDots />}
      {done && (
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to={`/interview/${sessionId}/summary`}
            className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            <BarChart3 size={16} /> View round summary
          </Link>
          <Link to="/" className="rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-medium hover:bg-subtle">
            New interview
          </Link>
        </div>
      )}
    </motion.div>
  )
}
