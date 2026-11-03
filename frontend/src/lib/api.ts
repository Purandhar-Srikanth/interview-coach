// Small fetch wrapper. Every request carries the anonymous visitor ID as a header
// (not a cookie, because Hugging Face shows the app inside an iframe where cookies may be blocked).

const VISITOR_KEY = 'visitor-id'
let memoryVisitorId: string | null = null

export function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    // Storage blocked (private mode etc.): keep an ID for this tab only.
    memoryVisitorId ??= crypto.randomUUID()
    return memoryVisitorId
  }
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { 'X-Visitor-Id': getVisitorId(), ...init.headers },
    })
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.")
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(response.status, errorMessage(body.detail, response.status))
  }
  return response.json() as Promise<T>
}

// FastAPI sends either a string or a list of validation errors in `detail`.
function errorMessage(detail: unknown, status: number): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail[0]?.msg) return `Invalid input: ${detail[0].msg}`
  if (status === 502 || status === 504) {
    return "The server isn't responding. It may be waking up, so please try again in a moment."
  }
  return `Something went wrong (error ${status}).`
}

const postJson = <T>(path: string, body: unknown) =>
  request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

// --- Types (mirror backend/app/schemas.py) ---

export type Difficulty = 'easy' | 'medium' | 'hard'

export type Health = {
  status: string
  version: string
  demo_mode: boolean
  llm_mode: 'openai' | 'mock'
  llm_configured: boolean
}

export type ResumeProject = { name: string; summary: string; technologies: string[] }

export type ProfileAnalysis = {
  role_title: string
  seniority: 'intern' | 'entry' | 'mid' | 'senior'
  jd_key_skills: string[]
  jd_topics: string[]
  resume_skills: string[]
  resume_projects: ResumeProject[]
  skill_gaps: string[]
}

export type Session = {
  id: string
  status: string
  role_title: string
  difficulty: Difficulty
  profile: ProfileAnalysis | null
  cost_usd: number
}

export type ParsedResume = { filename: string; text: string; chars: number }

// --- Endpoints ---

export const getHealth = () => request<Health>('/health')

export const createSession = (body: {
  jd_text: string
  resume_text: string
  difficulty: Difficulty
}) => postJson<Session>('/sessions', body)

export function parseResume(file: File) {
  const form = new FormData()
  form.append('file', file)
  return request<ParsedResume>('/resume/parse', { method: 'POST', body: form })
}

// --- Interview (M2) ---

export type Score = {
  correctness: number
  depth: number
  clarity: number
  relevance: number
  overall: number
  justifications: Record<string, string>
  strengths: string[]
  improvements: string[]
  sample_answer: string
}

export type Answer = {
  id: string
  attempt: number
  text: string
  skipped: boolean
  time_taken_s: number
  score: Score | null
}

export type Question = {
  id: string
  index: number
  qtype: string
  topic: string
  difficulty: Difficulty
  text: string
  time_limit_s: number
  expected_points: string[] | null
  answers: Answer[]
}

export type SessionDetail = Session & {
  num_questions: number
  focus_topic: string | null
  created_at: string
  finished_at: string | null
  questions: Question[]
  summary: string | null
}

export const getSession = (id: string) => request<SessionDetail>(`/sessions/${id}`)

/** New round from an earlier session's JD + resume (no new analysis), optionally on one topic. */
export const practiceAgain = (id: string, focusTopic: string | null = null) =>
  postJson<SessionDetail>(`/sessions/${id}/practice`, { focus_topic: focusTopic })

/** Events streamed by the agent (see backend/app/agent/nodes.py). */
export type AgentEvent =
  | { type: 'plan'; topics: { topic: string; label: string }[] }
  | { type: 'question_start'; index: number; topic: string; qtype: string }
  | { type: 'question_delta'; text: string }
  | { type: 'question'; question: Question }
  | { type: 'scoring' }
  | { type: 'score'; question_id: string; expected_points: string[]; answer: Answer }
  | { type: 'memory'; topic: string; average: number; attempts: number }
  | { type: 'summary_start' }
  | { type: 'summary_delta'; text: string }
  | { type: 'round_complete'; summary: string; average: number | null }
  | { type: 'error'; message: string }
  | { type: 'done' }

/**
 * POST to an agent endpoint and call onEvent for each Server-Sent Event as it arrives.
 * (The browser's EventSource only supports GET, so we read the stream with fetch.)
 */
export async function streamAgent(
  path: string,
  body: unknown,
  onEvent: (event: AgentEvent) => void,
): Promise<void> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'X-Visitor-Id': getVisitorId(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.")
  }
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}))
    throw new ApiError(response.status, errorMessage(data.detail, response.status))
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    // Events are separated by a blank line; keep any incomplete event in the buffer.
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''
    for (const chunk of chunks) {
      if (chunk.startsWith('data: ')) onEvent(JSON.parse(chunk.slice(6)) as AgentEvent)
    }
  }
}
