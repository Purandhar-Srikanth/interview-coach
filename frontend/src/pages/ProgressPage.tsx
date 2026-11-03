import { TrendingUp } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import PageHeader from '../components/PageHeader'

export default function ProgressPage() {
  return (
    <>
      <PageHeader title="Progress" subtitle="Your scores over time and the topics to work on." />
      <EmptyState icon={TrendingUp} title="No progress yet">
        Finish your first interview round to see score charts and your weak areas here.
      </EmptyState>
    </>
  )
}
