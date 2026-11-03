// Shared display helpers.

export const QTYPE_LABELS: Record<string, string> = {
  sql_python: 'SQL / Python',
  ml_concept: 'ML concept',
  technical: 'Technical',
  project: 'Project deep-dive',
  behavioural: 'Behavioural',
}

export const DIMENSIONS = [
  { key: 'correctness', label: 'Correctness', hint: 'Is it right, with the right terms?' },
  { key: 'depth', label: 'Depth', hint: 'Does it explain why, with examples and trade-offs?' },
  { key: 'clarity', label: 'Clarity', hint: 'Is it concise and well structured?' },
  { key: 'relevance', label: 'JD relevance', hint: 'Does it connect to this job?' },
] as const

export type DimensionKey = (typeof DIMENSIONS)[number]['key']

/** Behavioural questions are judged on STAR structure instead of correctness. */
export const dimensionLabel = (key: DimensionKey, qtype: string) =>
  key === 'correctness' && qtype === 'behavioural'
    ? 'STAR structure'
    : DIMENSIONS.find((d) => d.key === key)!.label

export const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/** Colour and label for a 0-100 score. */
export function scoreTone(overall: number) {
  if (overall >= 75)
    return { label: 'Strong', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500', soft: 'bg-emerald-50 dark:bg-emerald-950/40' }
  if (overall >= 50)
    return { label: 'Good', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500', soft: 'bg-amber-50 dark:bg-amber-950/40' }
  return { label: 'Needs work', text: 'text-red-600 dark:text-red-400', bar: 'bg-red-500', soft: 'bg-red-50 dark:bg-red-950/40' }
}
