import PageHeader from '../components/PageHeader'
import ThemeToggle from '../components/ThemeToggle'

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <section className="divide-y divide-line rounded-2xl border border-line bg-surface">
        <div className="flex items-center justify-between p-5">
          <div>
            <h2 className="text-sm font-semibold">Appearance</h2>
            <p className="text-sm text-muted">Switch between light and dark mode.</p>
          </div>
          <ThemeToggle showLabel />
        </div>
        <div className="p-5">
          <h2 className="text-sm font-semibold">Your data</h2>
          <p className="text-sm text-muted">
            Usage and a “Delete my data” button arrive in Milestone 4.
          </p>
        </div>
      </section>
    </>
  )
}
