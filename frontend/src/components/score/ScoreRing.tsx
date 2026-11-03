import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect } from 'react'
import { scoreTone } from '../../lib/format'

type Props = { value: number; size?: number; stroke?: number; label?: string }

/** Circular 0-100 gauge: the ring draws in while the number counts up. */
export default function ScoreRing({ value, size = 128, stroke = 10, label = '/ 100' }: Props) {
  const reduceMotion = useReducedMotion()
  const duration = reduceMotion ? 0 : 1.1
  const count = useMotionValue(0)
  const shown = useTransform(count, (v) => Math.round(v))

  useEffect(() => {
    const controls = animate(count, value, { duration, ease: 'easeOut' })
    return () => controls.stop()
  }, [count, value, duration])

  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const tone = scoreTone(value)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Score ${value} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-subtle" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="currentColor"
          className={tone.text}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - value / 100) }}
          transition={{ duration, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span className="font-bold tabular-nums" style={{ fontSize: size * 0.27 }}>
          {shown}
        </motion.span>
        <span className="text-xs text-muted">{label}</span>
      </div>
    </div>
  )
}
