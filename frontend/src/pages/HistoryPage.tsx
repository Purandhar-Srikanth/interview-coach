import { History } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'

export default function HistoryPage() {
  return (
    <>
      <PageHeader title="History" subtitle="Review past interviews, answers and feedback." />
      <EmptyState icon={History} title="No interviews yet">
        Your completed interviews will be listed here so you can review every answer and score.
      </EmptyState>
    </>
  )
}
