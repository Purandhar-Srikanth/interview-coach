import { Bot, SkipForward } from 'lucide-react'
import { motion } from 'motion/react'
import { QTYPE_LABELS } from '../../lib/format'
import { topicLabel } from '../../lib/topics'
import Markdown from '../Markdown'

type AgentProps = { index: number; topic: string; qtype: string; text: string; typing?: boolean }

/** The interviewer's question. `typing` shows a blinking caret while it streams in. */
export function AgentBubble({ index, topic, qtype, text, typing }: AgentProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white">
        <Bot size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-xs text-muted">
          Question {index + 1} · {QTYPE_LABELS[qtype] ?? qtype}
          {topic !== 'project_deep_dive' && topic !== 'behavioural' && ` · ${topicLabel(topic)}`}
        </div>
        <div className="rounded-2xl rounded-tl-sm border border-line bg-surface px-4 py-3">
          {text ? (
            <Markdown>{text + (typing ? ' ▍' : '')}</Markdown>
          ) : (
            <TypingDots />
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function UserBubble({ text }: { text: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-accent px-4 py-3 text-sm whitespace-pre-wrap text-white">
        {text}
      </div>
    </motion.div>
  )
}

export function SkippedNote() {
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-muted">
      <SkipForward size={14} /> Skipped
    </div>
  )
}

export function TypingDots({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-1" role="status" aria-label={label ?? 'Typing'}>
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2 w-2 rounded-full bg-muted"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </span>
      {label && <span className="text-sm text-muted">{label}</span>}
    </div>
  )
}
