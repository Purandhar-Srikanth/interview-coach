import clsx from 'clsx'
import { ArrowRight, Keyboard, Loader2, RotateCcw, Send, SkipForward, Trophy } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import Alert from '../components/Alert'
import Markdown from '../components/Markdown'
import AnswerTimer from '../components/interview/AnswerTimer'
import { AgentBubble, SkippedNote, TypingDots, UserBubble } from '../components/interview/ChatBubbles'
import ScoreCard from '../components/interview/ScoreCard'
import ShortcutsHelp from '../components/interview/ShortcutsHelp'
import { useInterview } from '../hooks/useInterview'
import { QTYPE_LABELS, scoreTone } from '../lib/format'

const MAX_ATTEMPTS = 3
const ANSWER_MAX = 6000

export default function InterviewPage() {
  const { id = '' } = useParams()
  const interview = useInterview(id)
  const { session, streaming, busy, error, pendingAnswer, memoryNote } = interview

  const [draft, setDraft] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  // A retry restarts the timer for the same question.
  const [retryStart, setRetryStart] = useState<{ questionId: string; at: number } | null>(null)
  const [stoppedAt, setStoppedAt] = useState<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const questions = session?.questions ?? []
  const current = questions.at(-1)
  const lastAnswer = current?.answers.at(-1)
  const completed = session?.status === 'completed'

  // What the user can do right now.
  const phase = completed
    ? 'done'
    : busy === 'loading' || busy === 'starting' || !current
      ? 'waiting'
      : busy === 'scoring'
        ? 'scoring'
        : busy === 'next'
          ? 'waiting'
          : !lastAnswer || retrying
            ? 'answering'
            : 'reviewing'

  const startedAt =
    retryStart && retryStart.questionId === current?.id ? retryStart.at : interview.questionShownAt

  // Put the cursor in the answer box when a new question arrives.
  useEffect(() => {
    textareaRef.current?.focus()
  }, [current?.id])

  // Keep the newest content in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [questions.length, lastAnswer?.id, pendingAnswer, phase, streaming?.text.length])

  async function submit() {
    const text = draft.trim()
    if (!current || !text || phase !== 'answering') return
    const now = Date.now()
    setStoppedAt(now)
    setRetrying(false)
    setDraft('')
    const ok = await interview.submitAnswer(current.id, text, Math.round((now - startedAt) / 1000))
    if (!ok) {
      setDraft(text) // give the answer back so nothing is lost
      setStoppedAt(null)
      setRetrying(Boolean(lastAnswer))
    }
  }

  function retry() {
    if (phase !== 'reviewing' || !current || current.answers.length >= MAX_ATTEMPTS) return
    setRetrying(true)
    setRetryStart({ questionId: current.id, at: Date.now() })
    setStoppedAt(null)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const skip = () => {
    if (phase !== 'answering' || !current || lastAnswer) return
    setDraft('')
    interview.skip(current.id)
  }
  const next = () => {
    if (phase === 'reviewing') interview.next()
  }

  // Keyboard shortcuts (letters only when not typing).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const typing = event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement
      if (event.key === 'Escape') {
        setShowHelp(false)
        textareaRef.current?.blur()
        return
      }
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === '?') setShowHelp((v) => !v)
      else if (key === 'n') next()
      else if (key === 'r') retry()
      else if (key === 's') skip()
      else if (key === '/') {
        event.preventDefault()
        textareaRef.current?.focus()
      } else return
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!session) {
    return error ? (
      <div className="space-y-4">
        <Alert message={error} />
        <Link to="/" className="text-sm font-medium text-accent hover:underline">
          ← Start a new interview
        </Link>
      </div>
    ) : (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-accent" />
      </div>
    )
  }

  const total = session.num_questions
  const answeredCount = questions.filter((q) => q.answers.length > 0).length
  const isLast = questions.length >= total

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      {/* Header: role, progress dots, current question info, timer */}
      <header className="sticky top-[57px] z-10 -mx-4 mb-4 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur md:top-0 md:-mx-10 md:px-10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold">{session.role_title}</h1>
            <div className="mt-1.5 flex items-center gap-1.5" aria-label={`${answeredCount} of ${total} answered`}>
              {Array.from({ length: total }, (_, i) => (
                <span
                  key={i}
                  className={clsx(
                    'h-1.5 w-5 rounded-full transition-colors sm:w-8',
                    i < answeredCount ? 'bg-accent' : i === questions.length - 1 && !completed ? 'bg-accent/40' : 'bg-subtle',
                  )}
                />
              ))}
              <span className="ml-2 text-xs whitespace-nowrap text-muted">
                {completed ? 'Complete' : `Question ${Math.max(questions.length, 1)} of ${total}`}
              </span>
            </div>
          </div>
          {current && !completed && (
            <div className="flex items-center gap-3">
              <span className="hidden rounded-full bg-subtle px-2.5 py-1 text-xs font-medium sm:inline">
                {QTYPE_LABELS[current.qtype]}
              </span>
              <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent capitalize">
                {session.difficulty}
              </span>
              {(phase === 'answering' || phase === 'scoring' || phase === 'reviewing') && (
                <AnswerTimer startedAt={startedAt} limitS={current.time_limit_s} stoppedAt={phase === 'answering' ? null : (stoppedAt ?? startedAt)} />
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="hidden rounded-lg p-2 text-muted hover:bg-subtle hover:text-text md:block"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard size={18} />
          </button>
        </div>
      </header>

      {/* Conversation */}
      <div className="flex-1 space-y-5 pb-4">
        {questions.map((q) => (
          <div key={q.id} className="space-y-4">
            <AgentBubble index={q.index} topic={q.topic} qtype={q.qtype} text={q.text} />
            {q.answers.map((a) =>
              a.skipped ? (
                <SkippedNote key={a.id} />
              ) : (
                <div key={a.id} className="space-y-4">
                  <UserBubble text={a.text} />
                  {a.score && (
                    <ScoreCard
                      score={a.score}
                      qtype={q.qtype}
                      attempt={a.attempt}
                      expectedPoints={a.id === lastAnswer?.id ? q.expected_points : null}
                      memoryNote={a.id === lastAnswer?.id && a.attempt === 1 ? memoryNote : null}
                    />
                  )}
                </div>
              ),
            )}
          </div>
        ))}

        {pendingAnswer && (
          <>
            <UserBubble text={pendingAnswer} />
            <TypingDots label="Scoring your answer against the rubric…" />
          </>
        )}

        {streaming?.kind === 'question' && (
          <AgentBubble index={streaming.index} topic={streaming.topic} qtype={streaming.qtype} text={streaming.text} typing />
        )}
        {busy === 'starting' && !streaming && <TypingDots label="Planning your interview…" />}
        {busy === 'next' && !streaming && <TypingDots label={isLast ? 'Wrapping up…' : 'Preparing the next question…'} />}

        {(streaming?.kind === 'summary' || completed) && (
          <RoundSummary text={streaming?.kind === 'summary' ? streaming.text : (session.summary ?? '')} average={interview.average ?? averageOf(questions)} done={completed} />
        )}

        {error && (
          <div className="space-y-2">
            <Alert message={error} onClose={interview.clearError} />
            {!current && session.status === 'analyzed' && (
              <button type="button" onClick={interview.retryStart} className="text-sm font-medium text-accent hover:underline">
                Try again
              </button>
            )}
            {current && lastAnswer && !retrying && phase === 'reviewing' && (
              <p className="text-xs text-muted">You can press Next to try again.</p>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Bottom bar: answer box, or Retry/Next after scoring */}
      {!completed && current && (
        <div className="sticky bottom-[57px] -mx-4 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur md:bottom-0 md:-mx-10 md:px-10">
          {phase === 'reviewing' ? (
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={retry}
                disabled={current.answers.length >= MAX_ATTEMPTS}
                title={current.answers.length >= MAX_ATTEMPTS ? 'No retries left' : 'Answer again (R)'}
                className="flex items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-medium hover:bg-subtle disabled:opacity-40"
              >
                <RotateCcw size={16} /> Retry
              </button>
              <button
                type="button"
                onClick={next}
                title="Next (N)"
                className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
              >
                {isLast ? 'Finish round' : 'Next question'} <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, ANSWER_MAX))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    submit()
                  }
                }}
                disabled={phase !== 'answering'}
                rows={Math.min(8, Math.max(2, draft.split('\n').length))}
                placeholder={phase === 'answering' ? 'Type your answer… (Ctrl+Enter to submit)' : 'Please wait…'}
                aria-label="Your answer"
                className="min-h-[60px] flex-1 resize-none rounded-xl border border-line bg-surface p-3 text-sm outline-none transition-colors focus:border-accent disabled:opacity-60"
              />
              <div className="flex flex-col gap-2">
                {!lastAnswer && (
                  <button
                    type="button"
                    onClick={skip}
                    disabled={phase !== 'answering'}
                    title="Skip (S)"
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-muted hover:bg-subtle hover:text-text disabled:opacity-40"
                  >
                    <SkipForward size={15} /> <span className="hidden sm:inline">Skip</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={submit}
                  disabled={phase !== 'answering' || !draft.trim()}
                  title="Submit (Ctrl+Enter)"
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
                >
                  {phase === 'scoring' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  <span className="hidden sm:inline">Submit</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
    </div>
  )
}

function averageOf(questions: { answers: { score: { overall: number } | null }[] }[]) {
  const scores = questions.map((q) => q.answers[0]?.score?.overall).filter((s): s is number => s != null)
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
}

function RoundSummary({ text, average, done }: { text: string; average: number | null; done: boolean }) {
  const tone = average != null ? scoreTone(average) : null
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-accent/30 bg-accent-soft/50 p-6">
      <div className="mb-3 flex items-center gap-3">
        <Trophy size={22} className="text-accent" />
        <h2 className="text-lg font-semibold">Round complete</h2>
        {done && average != null && tone && (
          <span className={clsx('ml-auto text-2xl font-bold tabular-nums', tone.text)}>
            {average}
            <span className="text-sm font-normal text-muted">/100 avg</span>
          </span>
        )}
      </div>
      {text ? <Markdown>{text}</Markdown> : <TypingDots />}
      {done && (
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/" className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110">
            Start a new interview
          </Link>
          <Link to="/progress" className="rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-medium hover:bg-subtle">
            See my progress
          </Link>
        </div>
      )}
    </motion.div>
  )
}
