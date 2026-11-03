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
