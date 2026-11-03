import { AlertTriangle } from 'lucide-react'
import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TopicProgress } from '../../lib/api'

// Weak topics use the warning colour; it always comes with an icon and a "Weak" label,
// so meaning never depends on colour alone.
const WARNING = '#d97706'

function TopicTooltip({ active, payload }: { active?: boolean; payload?: { payload: TopicProgress }[] }) {
  if (!active || !payload?.length) return null
  const t = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="flex items-center gap-1.5 font-semibold text-text">
        {t.weak && <AlertTriangle size={12} color={WARNING} />}
        {t.label}
        {t.weak && <span className="font-normal text-muted">· Weak</span>}
      </div>
      <div className="mt-1 text-muted">
        Average <b className="text-text tabular-nums">{t.avg_score}</b> · last {t.last_score} · {t.attempts}{' '}
        {t.attempts === 1 ? 'answer' : 'answers'}
      </div>
    </div>
  )
}

/** Topic averages from memory, weakest first (horizontal bars read long topic names well). */
export default function TopicBars({ topics }: { topics: TopicProgress[] }) {
  const height = topics.length * 34 + 30
  return (
    <div style={{ height }} role="img" aria-label={topics.map((t) => `${t.label} ${t.avg_score}`).join(', ')}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={topics} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="label"
            width={150}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text)', fontSize: 12 }}
          />
          <ReferenceLine x={70} stroke="var(--muted)" strokeDasharray="4 4" />
          <Tooltip content={<TopicTooltip />} cursor={{ fill: 'var(--subtle)' }} />
          <Bar dataKey="avg_score" radius={[0, 4, 4, 0]} barSize={14} animationDuration={700}>
            {topics.map((t) => (
              <Cell key={t.topic} fill={t.weak ? WARNING : 'var(--accent)'} />
            ))}
            <LabelList dataKey="avg_score" position="right" fill="var(--muted)" fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
