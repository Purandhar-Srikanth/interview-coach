import type { ReactNode } from 'react'

type Props = {
  label: string
  value: ReactNode
  detail?: ReactNode // small line under the value (e.g. a change since last round)
  icon?: ReactNode
}

/** One headline number. A single value reads better as a tile than as a chart. */
export default function StatTile({ label, value, detail, icon }: Props) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-2xl leading-tight font-semibold tracking-tight break-words tabular-nums">{value}</div>
      {detail && <div className="mt-1 text-xs text-muted">{detail}</div>}
    </div>
  )
}
