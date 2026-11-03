import clsx from 'clsx'
import { BarChart3, Table2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'

type Props = {
  title: string
  subtitle?: string
  chart: ReactNode
  table: ReactNode // same data as a table, for screen readers and anyone who prefers numbers
  className?: string
}

/** Card with a title and a Chart/Table toggle. */
export default function ChartCard({ title, subtitle, chart, table, className }: Props) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  return (
    <section className={clsx('rounded-2xl border border-line bg-surface p-5', className)}>
      <div className="mb-4 flex items-start gap-3">
        <div className="flex-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        <div className="flex rounded-lg bg-subtle p-0.5" role="group" aria-label={`${title} view`}>
          {(['chart', 'table'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              title={v === 'chart' ? 'Chart view' : 'Table view'}
              className={clsx('rounded-md p-1.5', view === v ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text')}
            >
              {v === 'chart' ? <BarChart3 size={14} /> : <Table2 size={14} />}
            </button>
          ))}
        </div>
      </div>
      {view === 'chart' ? chart : <div className="overflow-x-auto">{table}</div>}
    </section>
  )
}

/** Plain table used by the table views. */
export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-line text-xs text-muted">
          {head.map((h) => (
            <th key={h} className="py-2 pr-4 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-line/60 last:border-0">
            {row.map((cell, j) => (
              <td key={j} className="py-2 pr-4 tabular-nums">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
