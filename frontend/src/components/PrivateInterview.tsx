import { Lock } from 'lucide-react'
import { Link } from 'react-router'
import EmptyState from './EmptyState'

/**
 * Shown when an interview link opens in a browser that didn't start it (a shared link).
 * There are no accounts: interviews belong to the anonymous ID in the browser that took them,
 * and the server answers "not found" for anyone else's interview.
 */
export default function PrivateInterview() {
  return (
    <EmptyState icon={Lock} title="This interview is private">
      Interviews stay in the browser that started them, so this link only works there.{' '}
      <Link to="/" className="font-medium text-accent hover:underline">
        Start your own free mock interview
      </Link>
    </EmptyState>
  )
}
