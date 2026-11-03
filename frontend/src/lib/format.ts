// Shared display helpers.

export const QTYPE_LABELS: Record<string, string> = {
  sql_python: 'SQL / Python',
  ml_concept: 'ML concept',
  technical: 'Technical',
  project: 'Project deep-dive',
  behavioural: 'Behavioural',
}

/** Colour and label for a 0-100 score. */
export function scoreTone(overall: number) {
  if (overall >= 75) return { label: 'Strong', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' }
  if (overall >= 50) return { label: 'Good', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' }
  return { label: 'Needs work', text: 'text-red-600 dark:text-red-400', bar: 'bg-red-500' }
}
