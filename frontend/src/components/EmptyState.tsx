import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = {
  icon: LucideIcon
  title: string
  children: ReactNode
}

/** Friendly placeholder for pages/sections that have no data yet. */
export default function EmptyState({ icon: Icon, title, children }: Props) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
      <div className="mb-4 rounded-full bg-accent-soft p-3 text-accent">
        <Icon size={24} />
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>
    </div>
  )
}
