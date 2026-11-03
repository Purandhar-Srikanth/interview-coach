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

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`, { headers: { 'X-Visitor-Id': getVisitorId() } })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(response.status, body.detail ?? `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export type Health = {
  status: string
  version: string
  demo_mode: boolean
  llm_configured: boolean
}

export const getHealth = () => apiGet<Health>('/health')
