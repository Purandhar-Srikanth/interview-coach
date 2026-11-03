import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SessionSummary } from '../../lib/api'
import { topicLabel } from '../../lib/topics'

type Point = { round: string; average: number; date: string; detail: string }

/** Tooltip card in the app's own style (text uses text colours, never the series colour). */
function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold text-text">
        {p.round} · {p.date}
      </div>
      <div className="mt-0.5 text-muted">{p.detail}</div>
      <div className="mt-1 text-sm font-semibold text-text tabular-nums">{p.average} / 100</div>
    </div>
  )
}

/** Average score per round over time. One series, so no legend: the card title names it. */
export default function ScoreTrendChart({ sessions }: { sessions: SessionSummary[] }) {
  const data: Point[] = sessions.map((s, i) => ({
    round: `R${i + 1}`,
    average: s.average ?? 0,
    date: new Date(s.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    detail: `${s.focus_topic ? `Focus: ${topicLabel(s.focus_topic)}` : 'Mixed round'} · ${s.difficulty}`,
  }))

  return (
    <div className="h-64" role="img" aria-label={`Average score per round: ${data.map((d) => d.average).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="0" />
          <XAxis dataKey="round" tickLine={false} axisLine={{ stroke: 'var(--line)' }} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
          <ReferenceLine
            y={70}
            stroke="var(--muted)"
            strokeDasharray="4 4"
            label={{ value: 'weak below 70', position: 'insideTopRight', fill: 'var(--muted)', fontSize: 11 }}
          />
          <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'var(--muted)', strokeWidth: 1 }} />
          <Line
            type="monotone"
            dataKey="average"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={{ r: 4, fill: 'var(--accent)', stroke: 'var(--surface)', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: 'var(--accent)', stroke: 'var(--surface)', strokeWidth: 2 }}
            isAnimationActive
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
