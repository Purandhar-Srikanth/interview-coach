import clsx from 'clsx'
import { AlertTriangle, Briefcase, FolderGit2, Sparkles, Target } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import type { ProfileAnalysis } from '../lib/api'
import { topicLabel } from '../lib/topics'

type ChipTone = 'neutral' | 'accent' | 'warn'

function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: ChipTone }) {
  return (
    <span
      className={clsx(
        'rounded-full px-2.5 py-1 text-xs font-medium',
        tone === 'neutral' && 'bg-subtle text-text',
        tone === 'accent' && 'bg-accent-soft text-accent',
        tone === 'warn' && 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
      )}
    >
      {children}
    </span>
  )
}

function Section({ icon, title, index, children }: { icon: ReactNode; title: string; index: number; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 * index }}
    >
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
        {icon}
        {title}
      </h3>
      {children}
    </motion.div>
  )
}

const SENIORITY: Record<ProfileAnalysis['seniority'], string> = {
  intern: 'Internship',
  entry: 'Entry level',
  mid: 'Mid level',
  senior: 'Senior',
}

/** What the agent understood from the JD and resume. */
export default function ProfileCard({ profile }: { profile: ProfileAnalysis }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Briefcase size={20} className="text-accent" />
        <h2 className="text-lg font-semibold">{profile.role_title}</h2>
        <Chip tone="accent">{SENIORITY[profile.seniority]}</Chip>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Section index={0} icon={<Target size={14} />} title="Interview topics">
          <div className="flex flex-wrap gap-2">
            {profile.jd_topics.map((topic) => (
              <Chip key={topic} tone="accent">{topicLabel(topic)}</Chip>
            ))}
          </div>
        </Section>

        <Section index={1} icon={<Sparkles size={14} />} title="Key skills in the job">
          <div className="flex flex-wrap gap-2">
            {profile.jd_key_skills.map((skill) => (
              <Chip key={skill}>{skill}</Chip>
            ))}
          </div>
        </Section>

        <Section index={2} icon={<FolderGit2 size={14} />} title="Projects to deep-dive">
          <ul className="space-y-2">
            {profile.resume_projects.map((project) => (
              <li key={project.name} className="text-sm">
                <span className="font-medium">{project.name}</span>
                <span className="text-muted"> — {project.summary}</span>
              </li>
            ))}
            {profile.resume_projects.length === 0 && (
              <li className="text-sm text-muted">No projects found in the resume.</li>
            )}
          </ul>
        </Section>

        <Section index={3} icon={<AlertTriangle size={14} />} title="Possible gaps to prepare">
          <div className="flex flex-wrap gap-2">
            {profile.skill_gaps.map((gap) => (
              <Chip key={gap} tone="warn">{gap}</Chip>
            ))}
            {profile.skill_gaps.length === 0 && <span className="text-sm text-muted">None spotted.</span>}
          </div>
        </Section>
      </div>
    </div>
  )
}
