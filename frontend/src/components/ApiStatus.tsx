import { useEffect, useState } from 'react'
import { getHealth } from '../lib/api'

type Status = 'checking' | 'online' | 'offline'

/** Small dot in the sidebar showing whether the backend is reachable. */
export default function ApiStatus() {
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    getHealth()
      .then(() => setStatus('online'))
      .catch(() => setStatus('offline'))
  }, [])

  const styles = {
    checking: { dot: 'bg-amber-400 animate-pulse', text: 'Connecting…' },
    online: { dot: 'bg-emerald-500', text: 'Server online' },
    offline: { dot: 'bg-red-500', text: 'Server offline' },
  }[status]

  return (
    <div className="flex items-center gap-2 px-3 text-xs text-muted" role="status">
      <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
      {styles.text}
    </div>
  )
}
