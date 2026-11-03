import clsx from 'clsx'
import { Mic, Square } from 'lucide-react'

type Props = { listening: boolean; disabled: boolean; onClick: () => void }

/** Round mic button next to the answer box; pulses red while listening. */
export default function MicButton({ listening, disabled, onClick }: Props) {
  const label = listening ? 'Stop voice input' : 'Answer by voice'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={listening}
      title={`${label} (M)`}
      className={clsx(
        'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-40',
        listening
          ? 'border-red-500 bg-red-500 text-white'
          : 'border-line bg-surface text-muted hover:border-accent/60 hover:text-accent',
      )}
    >
      {listening && <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" aria-hidden />}
      {listening ? <Square size={14} fill="currentColor" /> : <Mic size={18} />}
    </button>
  )
}
