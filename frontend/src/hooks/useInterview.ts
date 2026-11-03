import { useCallback, useEffect, useRef, useState } from 'react'
import { getSession, streamAgent, type AgentEvent, type SessionDetail } from '../lib/api'

/** Text the agent is typing right now (a question or the round summary). */
export type Streaming =
  | { kind: 'question'; text: string; topic: string; qtype: string; index: number }
  | { kind: 'summary'; text: string }
  | null

export type Busy = null | 'loading' | 'starting' | 'scoring' | 'next'

export type MemoryNote = { topic: string; average: number; attempts: number }

/**
 * All interview state and actions for one session.
 * The server is the source of truth: we load the session, then apply streamed agent events.
 */
export function useInterview(sessionId: string) {
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [streaming, setStreaming] = useState<Streaming>(null)
  const [busy, setBusy] = useState<Busy>('loading')
  const [error, setError] = useState<string | null>(null)
  const [pendingAnswer, setPendingAnswer] = useState<string | null>(null)
  const [memoryNote, setMemoryNote] = useState<MemoryNote | null>(null)
  const [average, setAverage] = useState<number | null>(null)
  // When the current question appeared on screen (starts the answer timer).
  const [questionShownAt, setQuestionShownAt] = useState(0)
  const started = useRef(false)

  const handleEvent = useCallback((event: AgentEvent) => {
    switch (event.type) {
      case 'question_start':
        setMemoryNote(null)
        setStreaming({ kind: 'question', text: '', topic: event.topic, qtype: event.qtype, index: event.index })
        break
      case 'question_delta':
      case 'summary_delta':
        setStreaming((s) => (s ? { ...s, text: s.text + event.text } : s))
        break
      case 'question':
        setStreaming(null)
        setQuestionShownAt(Date.now())
        setSession((s) => s && { ...s, status: 'in_progress', questions: [...s.questions, event.question] })
        break
      case 'score':
        setPendingAnswer(null)
        setSession(
          (s) =>
            s && {
              ...s,
              questions: s.questions.map((q) =>
                q.id === event.question_id
                  ? {
                      ...q,
                      expected_points: event.expected_points,
                      answers: [...q.answers.filter((a) => a.id !== event.answer.id), event.answer],
                    }
                  : q,
              ),
            },
        )
        break
      case 'memory':
        setMemoryNote({ topic: event.topic, average: event.average, attempts: event.attempts })
        break
      case 'summary_start':
        setStreaming({ kind: 'summary', text: '' })
        break
      case 'round_complete':
        setStreaming(null)
        setAverage(event.average)
        setSession((s) => s && { ...s, status: 'completed', summary: event.summary })
        break
      case 'error':
        setError(event.message)
        break
    }
  }, [])

  /** Run one agent action. Returns false if it failed. */
  const run = useCallback(
    async (path: string, body: unknown, kind: Busy): Promise<boolean> => {
      let failed = false
      setError(null)
      setBusy(kind)
      try {
        await streamAgent(`/sessions/${sessionId}${path}`, body, (event) => {
          if (event.type === 'error') failed = true
          handleEvent(event)
        })
      } catch (err) {
        failed = true
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      } finally {
        setBusy(null)
        setStreaming(null)
      }
      return !failed
    },
    [sessionId, handleEvent],
  )

  // Load the session; if it hasn't started yet, ask the agent for the first question.
  useEffect(() => {
    let cancelled = false
    getSession(sessionId)
      .then((data) => {
        if (cancelled) return
        setSession(data)
        setQuestionShownAt(Date.now())
        setBusy(null)
        if (data.status === 'analyzed' && !started.current) {
          started.current = true
          run('/start', {}, 'starting')
        }
      })
      .catch((err) => {
        if (cancelled) return
        setBusy(null)
        setError(err instanceof Error ? err.message : 'Could not load this interview.')
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, run])

  const submitAnswer = async (questionId: string, text: string, timeTaken: number) => {
    setPendingAnswer(text)
    const ok = await run('/answer', { question_id: questionId, text, time_taken_s: timeTaken }, 'scoring')
    if (!ok) setPendingAnswer(null)
    return ok
  }

  return {
    session,
    streaming,
    busy,
    error,
    pendingAnswer,
    memoryNote,
    average,
    questionShownAt,
    clearError: () => setError(null),
    submitAnswer,
    skip: (questionId: string) => {
      // The skip is saved on the server before the next question is generated, so show it now.
      const skipped = { id: `skip-${questionId}`, attempt: 1, text: '', skipped: true, time_taken_s: 0, score: null }
      setSession(
        (s) =>
          s && {
            ...s,
            questions: s.questions.map((q) => (q.id === questionId ? { ...q, answers: [skipped] } : q)),
          },
      )
      return run('/skip', { question_id: questionId }, 'next')
    },
    next: () => run('/next', {}, 'next'),
    retryStart: () => run('/start', {}, 'starting'),
  }
}
