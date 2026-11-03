import { Compass } from 'lucide-react'
import { Link } from 'react-router'
import EmptyState from '../components/EmptyState'

export default function NotFoundPage() {
  return (
    <EmptyState icon={Compass} title="Page not found">
      That page doesn't exist.{' '}
      <Link to="/" className="font-medium text-accent hover:underline">
        Start a new interview
      </Link>
    </EmptyState>
  )
}
