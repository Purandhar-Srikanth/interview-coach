import { ArrowRight, FileText, Play, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Alert from '../components/Alert'
import AnalyzingState from '../components/AnalyzingState'
import DifficultyPicker from '../components/DifficultyPicker'
import PageHeader from '../components/PageHeader'
import ProfileCard from '../components/ProfileCard'
import ResumeInput from '../components/ResumeInput'
import { useStoredState } from '../hooks/useStoredState'
import { createSession, type Difficulty, type Session } from '../lib/api'
import { SAMPLE_JD, SAMPLE_RESUME } from '../lib/samples'

const JD_MIN = 50
const JD_MAX = 15_000
const RESUME_MIN = 100

export default function SetupPage() {
  // Drafts are remembered in this browser so a refresh doesn't lose them.
  const [jd, setJd] = useStoredState('draft-jd', '')
  const [resume, setResume] = useStoredState('draft-resume', '')
  const [resumeName, setResumeName] = useStoredState('draft-resume-name', '')
  const [difficulty, setDifficulty] = useStoredState<Difficulty>('draft-difficulty', 'medium')

  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const jdTooShort = jd.trim().length < JD_MIN
  const resumeTooShort = resume.trim().length < RESUME_MIN
  const canSubmit = !jdTooShort && !resumeTooShort && !analyzing

  useEffect(() => {
    if (analyzing || session) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [analyzing, session])

  async function analyze() {
    if (!canSubmit) return
    setError(null)
    setSession(null)
    setAnalyzing(true)
    try {
      setSession(await createSession({ jd_text: jd, resume_text: resume, difficulty }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setAnalyzing(false)
    }
  }

  function fillSamples() {
    setJd(SAMPLE_JD)
    setResume(SAMPLE_RESUME)
    setResumeName('Sample resume (Alex Rao)')
  }

  return (
    <>
      <PageHeader
        title="New interview"
        subtitle="Paste a job description and add your resume. The coach tailors every question to both."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <section className="flex flex-col rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <FileText size={16} className="text-accent" /> Job description
          </h2>
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value.slice(0, JD_MAX))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) analyze()
            }}
            placeholder="Paste the full job description here…"
            aria-label="Job description"
            className="min-h-56 flex-1 resize-y rounded-xl border border-line bg-bg p-3 text-sm outline-none transition-colors focus:border-accent"
          />
          <div className="mt-2 flex justify-between text-xs text-muted">
            <span>{jd.length > 0 && jdTooShort ? `At least ${JD_MIN} characters` : ''}</span>
            <span>
              {jd.length.toLocaleString()} / {JD_MAX.toLocaleString()}
            </span>
          </div>
        </section>

        <section className="flex flex-col rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Upload size={16} className="text-accent" /> Resume
          </h2>
          <ResumeInput
            text={resume}
            fileName={resumeName}
            onChange={(text, name) => {
              setResume(text)
              setResumeName(name)
            }}
          />
        </section>
      </div>

      <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1.5 sm:w-80">
          <span className="text-xs font-semibold text-muted">Difficulty</span>
          <DifficultyPicker value={difficulty} onChange={setDifficulty} />
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
          <button type="button" onClick={fillSamples} className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-subtle hover:text-text">
            Try with sample data
          </button>
          <button
            type="button"
            onClick={analyze}
            disabled={!canSubmit}
            title={jdTooShort || resumeTooShort ? 'Add a job description and a resume first' : 'Ctrl+Enter'}
            className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Analyse <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <div ref={resultRef} className="mt-6 scroll-mt-20 space-y-4">
        {error && <Alert message={error} onClose={() => setError(null)} />}
        {analyzing && <AnalyzingState />}
        {session?.profile && (
          <>
            <ProfileCard profile={session.profile} />
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                disabled
                className="flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white opacity-50"
              >
                <Play size={16} /> Start interview
              </button>
              <p className="text-xs text-muted">The interview itself arrives in Milestone 2.</p>
            </div>
          </>
        )}
      </div>
    </>
  )
}
