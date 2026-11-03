import { X } from 'lucide-react'
import { motion } from 'motion/react'

const SHORTCUTS = [
  ['Ctrl + Enter', 'Submit answer'],
  ['S', 'Skip question'],
  ['R', 'Retry the question'],
  ['N', 'Next question'],
  ['/', 'Focus the answer box'],
  ['Esc', 'Leave the answer box / close this'],
  ['?', 'Show this help'],
]

export default function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <motion.div
        role="dialog"
        aria-label="Keyboard shortcuts"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Keyboard shortcuts</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-text">
            <X size={18} />
          </button>
        </div>
        <dl className="space-y-2 text-sm">
          {SHORTCUTS.map(([key, action]) => (
            <div key={key} className="flex justify-between">
              <dt className="text-muted">{action}</dt>
              <dd>
                <kbd className="rounded border border-line bg-subtle px-1.5 py-0.5 font-mono text-xs">{key}</kbd>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted">Letter shortcuts work when you're not typing in the answer box.</p>
      </motion.div>
    </div>
  )
}
