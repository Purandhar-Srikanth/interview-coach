import clsx from 'clsx'
import { useEffect, useState } from 'react'

type Props = {
  startedAt: number // ms timestamp when the question appeared (or retry began)
  limitS: number // suggested answer time
  stoppedAt: number | null // ms timestamp when submitted; freezes the timer
}

const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** Soft countdown ring: grey → amber (last 25%) → red (over time). It never blocks you. */
export default function AnswerTimer({ startedAt, limitS, stoppedAt }: Props) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (stoppedAt) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [stoppedAt])

  const elapsed = Math.max(0, Math.floor(((stoppedAt ?? now) - startedAt) / 1000))
  const remaining = limitS - elapsed
  const fraction = Math.max(0, remaining / limitS)
  const tone = remaining < 0 ? 'over' : fraction < 0.25 ? 'low' : 'ok'

  const radius = 15
  const circumference = 2 * Math.PI * radius

  return (
    <div
      className="flex items-center gap-2"
      title={`Suggested time: ${formatTime(limitS)}. The timer is a guide only.`}
      role="timer"
      aria-label={remaining >= 0 ? `${formatTime(remaining)} remaining` : `${formatTime(-remaining)} over`}
    >
      <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
        <circle cx="18" cy="18" r={radius} fill="none" strokeWidth="3" className="stroke-subtle" />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className={clsx(
            'transition-[stroke-dashoffset] duration-1000 ease-linear',
            tone === 'ok' && 'stroke-accent',
            tone === 'low' && 'stroke-amber-500',
            tone === 'over' && 'stroke-red-500',
          )}
        />
      </svg>
      <span
        className={clsx(
          'font-mono text-sm tabular-nums',
          tone === 'low' && 'text-amber-600 dark:text-amber-400',
          tone === 'over' && 'text-red-600 dark:text-red-400',
        )}
      >
        {remaining >= 0 ? formatTime(remaining) : `+${formatTime(-remaining)}`}
      </span>
    </div>
  )
}
