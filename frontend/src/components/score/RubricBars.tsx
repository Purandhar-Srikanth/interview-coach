import clsx from 'clsx'
import { motion, useReducedMotion } from 'motion/react'
import type { Score } from '../../lib/api'
import { DIMENSIONS, dimensionLabel, scoreTone } from '../../lib/format'

type Props = {
  score: Pick<Score, 'correctness' | 'depth' | 'clarity' | 'relevance'> & { justifications?: Record<string, string> }
  qtype: string
  delay?: number // seconds before the first bar starts filling
  compact?: boolean // no justifications, tighter spacing
}

/** The four rubric dimensions as 1-5 bars that fill one after another. */
export default function RubricBars({ score, qtype, delay = 0, compact = false }: Props) {
  const reduceMotion = useReducedMotion()

  return (
    <div className={clsx('grid', compact ? 'gap-2' : 'gap-3.5')}>
      {DIMENSIONS.map(({ key }, i) => {
        const value = score[key]
        return (
          <motion.div
            key={key}
            initial={reduceMotion ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay + i * 0.12 }}
          >
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-medium">{dimensionLabel(key, qtype)}</span>
              <span className="text-muted tabular-nums">{value}/5</span>
            </div>
            {/* five segments, like a 1-5 scale */}
            <div className="grid grid-cols-5 gap-1">
              {[1, 2, 3, 4, 5].map((level) => (
                <div key={level} className="h-2 overflow-hidden rounded-full bg-subtle">
                  {level <= value && (
                    <motion.div
                      className={clsx('h-full rounded-full', scoreTone(((value - 1) / 4) * 100).bar)}
                      initial={reduceMotion ? false : { width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ delay: delay + i * 0.12 + level * 0.06, duration: 0.15 }}
                    />
                  )}
                </div>
              ))}
            </div>
            {!compact && score.justifications?.[key] && (
              <p className="mt-1 text-xs leading-relaxed text-muted">{score.justifications[key]}</p>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
