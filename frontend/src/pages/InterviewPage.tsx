import clsx from 'clsx'
import { ArrowRight, Keyboard, Loader2, RotateCcw, Send, SkipForward } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import Alert from '../components/Alert'
import BottomSheet from '../components/BottomSheet'
import AnswerTimer from '../components/interview/AnswerTimer'
import MicButton from '../components/interview/MicButton'
import { AgentBubble, SkippedNote, TypingDots, UserBubble } from '../components/interview/ChatBubbles'
import RoundComplete from '../components/interview/RoundComplete'
import ShortcutsHelp from '../components/interview/ShortcutsHelp'
import RubricGuide from '../components/score/RubricGuide'
import ScoreChip from '../components/score/ScoreChip'
import ScoreReveal from '../components/score/ScoreReveal'
import { useInterview } from '../hooks/useInterview'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import type { Answer, Question } from '../lib/api'
import { QTYPE_LABELS } from '../lib/format'
import { topicLabel } from '../lib/topics'

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
  // Which answer's breakdown is shown (null = the latest), and whether the mobile sheet is open.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
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

  // All scored answers, in order; the panel shows the selected one (default: the newest).
  const scored = questions.flatMap((q) => q.answers.filter((a) => a.score).map((a) => ({ q, a })))
  const selected = scored.find((s) => s.a.id === selectedId) ?? scored.at(-1)

  // Voice answers: spoken words are added after whatever was already typed.
  const voiceBase = useRef('')
  const voiceActive = useRef(false) // false once the answer is submitted, so late words are ignored
  const speech = useSpeechRecognition((spoken) => {
    if (!voiceActive.current) return
    const typed = voiceBase.current.trimEnd()
    setDraft((typed && spoken ? `${typed} ${spoken}` : typed || spoken).slice(0, ANSWER_MAX))
  })
  function toggleVoice() {
    if (speech.listening) return speech.stop()
    if (phase !== 'answering' || !speech.supported) return
    voiceBase.current = draft
    voiceActive.current = true
    speech.start()
  }
  function stopVoice() {
    voiceActive.current = false
    speech.stop()
  }

  // Stop listening when you can no longer answer (scoring, next question, round over).
  useEffect(() => {
    if (phase !== 'answering' && speech.listening) stopVoice()
  })

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
    stopVoice()
    const now = Date.now()
    setStoppedAt(now)
    setRetrying(false)
    setDraft('')
    const ok = await interview.submitAnswer(current.id, text, Math.round((now - startedAt) / 1000))
    if (ok) {
      setSelectedId(null) // show the new score
      setSheetOpen(true) // (only visible on small screens)
    } else {
      setDraft(text) // give the answer back so nothing is lost
      setStoppedAt(null)
      setRetrying(Boolean(lastAnswer))
    }
  }

  function retry() {
    if (phase !== 'reviewing' || !current || current.answers.length >= MAX_ATTEMPTS) return
    setSheetOpen(false)
    setRetrying(true)
    setRetryStart({ questionId: current.id, at: Date.now() })
    setStoppedAt(null)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const skip = () => {
    if (phase !== 'answering' || !current || lastAnswer) return
    stopVoice()
    setDraft('')
    interview.skip(current.id)
  }
  const next = () => {
    if (phase !== 'reviewing') return
    setSheetOpen(false)
    interview.next()
  }
  const showFeedback = (answerId: string) => {
    setSelectedId(answerId)
    setSheetOpen(true)
  }

  // Keyboard shortcuts (letters only when not typing).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const typing = event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement
      if (event.key === 'Escape') {
        setShowHelp(false)
        setSheetOpen(false)
        textareaRef.current?.blur()
        return
      }
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === '?') setShowHelp((v) => !v)
      else if (key === 'n') next()
      else if (key === 'r') retry()
      else if (key === 'm') toggleVoice()
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

  const reveal = selected && (
    <ScoreReveal
      question={selected.q}
      answer={selected.a}
      previousOverall={previousScore(selected.q, selected.a)}
      memoryNote={selected.a.id === lastAnswer?.id && selected.a.attempt === 1 ? memoryNote : null}
    />
  )

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      {/* Header: role, progress dots, current question info, timer */}
      <header className="sticky top-[57px] z-10 -mx-4 mb-4 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur md:top-0 md:-mx-10 md:px-10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold">
              {session.role_title}
              {session.focus_topic && (
                <span className="ml-2 text-sm font-normal text-muted">· Focus: {topicLabel(session.focus_topic)}</span>
              )}
            </h1>
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
              {phase !== 'waiting' && (
                <AnswerTimer
                  startedAt={startedAt}
                  limitS={current.time_limit_s}
                  stoppedAt={phase === 'answering' ? null : (stoppedAt ?? startedAt)}
                />
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

      <div className="flex flex-1 gap-8">
        {/* Left: conversation + answer box */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 pb-4">
            {questions.map((q) => (
              <div key={q.id} className="space-y-3">
                <AgentBubble index={q.index} topic={q.topic} qtype={q.qtype} text={q.text} />
                {q.answers.map((a) =>
                  a.skipped ? (
                    <SkippedNote key={a.id} />
                  ) : (
                    <div key={a.id} className="flex flex-col gap-2">
                      <UserBubble text={a.text} />
                      {a.score && (
                        <ScoreChip
                          overall={a.score.overall}
                          attempt={a.attempt}
                          selected={selected?.a.id === a.id}
                          onClick={() => showFeedback(a.id)}
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
              <RoundComplete
                sessionId={session.id}
                text={streaming?.kind === 'summary' ? streaming.text : (session.summary ?? '')}
                average={interview.average ?? averageOf(questions)}
                done={completed}
              />
            )}

            {error && (
              <div className="space-y-2">
                <Alert message={error} onClose={interview.clearError} />
                {!current && session.status === 'analyzed' && (
                  <button type="button" onClick={interview.retryStart} className="text-sm font-medium text-accent hover:underline">
                    Try again
                  </button>
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Bottom bar: answer box, or Retry/Next after scoring */}
          {!completed && current && (
            <div className="sticky bottom-[57px] -mx-4 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur md:bottom-0 md:-mx-10 md:px-10 lg:mx-0 lg:px-0">
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
                  {speech.supported && (
                    <MicButton listening={speech.listening} disabled={phase !== 'answering'} onClick={toggleVoice} />
                  )}
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
                    readOnly={speech.listening}
                    rows={Math.min(8, Math.max(2, draft.split('\n').length))}
                    placeholder={
                      phase !== 'answering'
                        ? 'Please wait…'
                        : speech.supported
                          ? 'Type or speak your answer… (Ctrl+Enter to submit, M for mic)'
                          : 'Type your answer… (Ctrl+Enter to submit)'
                    }
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
              {phase !== 'reviewing' && (speech.listening || speech.error) && (
                <p
                  role="status"
                  className={clsx('mt-2 flex items-center gap-2 text-xs', speech.error ? 'text-red-600 dark:text-red-400' : 'text-muted')}
                >
                  {speech.error ?? (
                    <>
                      <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Listening… speak your answer,
                      then press the stop button (or M). You can edit the text before submitting.
                    </>
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right (desktop only): score breakdown panel */}
        <aside className="hidden w-[380px] shrink-0 lg:block" aria-label="Score breakdown">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-5">
            {phase === 'scoring' ? (
              <div className="flex flex-col items-center gap-3 py-16 text-sm text-muted">
                <Loader2 className="animate-spin text-accent" />
                Grading against the rubric…
              </div>
            ) : (
              (reveal ?? <RubricGuide />)
            )}
          </div>
        </aside>
      </div>

      {/* Small screens: the breakdown slides up as a sheet */}
      <BottomSheet open={sheetOpen && Boolean(reveal)} onClose={() => setSheetOpen(false)} title="Your score">
        {reveal}
      </BottomSheet>

      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
    </div>
  )
}

/** Score of the attempt just before this one, for the "+12 vs previous attempt" badge. */
function previousScore(question: Question, answer: Answer): number | undefined {
  const earlier = question.answers.filter((a) => a.attempt < answer.attempt && a.score)
  return earlier.at(-1)?.score?.overall
}

function averageOf(questions: Question[]) {
  const scores = questions.map((q) => q.answers[0]?.score?.overall).filter((s): s is number => s != null)
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
}
