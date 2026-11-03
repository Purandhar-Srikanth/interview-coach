import clsx from 'clsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Renders LLM text (questions, sample answers) with code blocks, lists and emphasis. */
export default function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={clsx(
        'prose prose-sm max-w-none text-text dark:prose-invert',
        'prose-p:my-1.5 prose-pre:my-2 prose-pre:bg-slate-900 prose-pre:text-slate-100',
        'prose-code:font-mono prose-code:before:content-none prose-code:after:content-none',
        '[&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-subtle [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}
