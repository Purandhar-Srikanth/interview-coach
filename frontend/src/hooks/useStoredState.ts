import { useEffect, useState } from 'react'

/** Like useState, but remembered in this browser (so a page refresh doesn't lose your draft). */
export function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved === null ? initial : (JSON.parse(saved) as T)
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage blocked or full: the app still works, the draft just isn't remembered.
    }
  }, [key, value])

  return [value, setValue] as const
}
