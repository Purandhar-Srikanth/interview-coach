import { useState } from 'react'

export type Theme = 'light' | 'dark'

function readTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/** Current theme plus a toggle. The choice is saved in localStorage (index.html applies it on load). */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme)

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', next === 'dark')
    try {
      localStorage.setItem('theme', next)
    } catch {
      // Storage blocked: theme still works for this visit.
    }
    setTheme(next)
  }

  return { theme, toggle }
}
