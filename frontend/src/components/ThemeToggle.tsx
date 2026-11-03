import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

export default function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? 'Light mode' : 'Dark mode'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-subtle hover:text-text"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
      {showLabel && <span>{label}</span>}
    </button>
  )
}
