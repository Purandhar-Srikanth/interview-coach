import clsx from 'clsx'
import type { Difficulty } from '../lib/api'

const OPTIONS: { value: Difficulty; label: string; hint: string }[] = [
  { value: 'easy', label: 'Easy', hint: 'Definitions and basics' },
  { value: 'medium', label: 'Medium', hint: 'Typical entry-level interview' },
  { value: 'hard', label: 'Hard', hint: 'Trade-offs and edge cases' },
]

type Props = { value: Difficulty; onChange: (value: Difficulty) => void }

export default function DifficultyPicker({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Difficulty" className="grid grid-cols-3 gap-1 rounded-xl bg-subtle p-1">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          title={option.hint}
          onClick={() => onChange(option.value)}
          className={clsx(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
            value === option.value
              ? 'bg-surface text-text shadow-sm'
              : 'text-muted hover:text-text',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
