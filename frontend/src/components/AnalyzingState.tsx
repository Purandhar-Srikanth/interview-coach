import { Loader2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'

const STEPS = ['Reading the job description…', 'Matching it with your resume…', 'Choosing interview topics…']

/** Loading card that cycles through what the agent is doing. */
export default function AnalyzingState() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1800)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-6" role="status">
      <Loader2 size={24} className="animate-spin text-accent" />
      <div className="h-5 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-sm font-medium"
          >
            {STEPS[step]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}
