import { FileText, Upload } from 'lucide-react'
import PageHeader from '../components/PageHeader'

export default function SetupPage() {
  return (
    <>
      <PageHeader
        title="New interview"
        subtitle="Paste a job description and add your resume. The coach tailors every question to both."
      />
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <FileText size={16} className="text-accent" /> Job description
          </h2>
          <div className="h-48 rounded-xl bg-subtle" />
        </section>
        <section className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Upload size={16} className="text-accent" /> Resume
          </h2>
          <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-line text-sm text-muted">
            PDF or DOCX
          </div>
        </section>
      </div>
      <p className="mt-6 text-center text-sm text-muted">Upload and interview start arrive in Milestone 1–2.</p>
    </>
  )
}
