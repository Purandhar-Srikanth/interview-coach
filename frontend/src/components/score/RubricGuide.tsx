import { Gauge } from 'lucide-react'
import { DIMENSIONS } from '../../lib/format'

/** Shown in the score panel before the first answer: how answers are graded. */
export default function RubricGuide() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Gauge size={18} className="text-accent" />
        <h2 className="text-sm font-semibold">How you're scored</h2>
      </div>
      <p className="text-sm text-muted">
        Each answer is graded 1–5 on four dimensions, then combined into a score out of 100. Your
        breakdown and a stronger sample answer appear here after you answer.
      </p>
      <dl className="space-y-3">
        {DIMENSIONS.map((d) => (
          <div key={d.key} className="rounded-xl bg-subtle px-3 py-2.5">
            <dt className="text-sm font-medium">{d.label}</dt>
            <dd className="text-xs text-muted">{d.hint}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted">Behavioural questions use STAR structure instead of correctness.</p>
    </div>
  )
}
