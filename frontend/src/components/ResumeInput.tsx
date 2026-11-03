import clsx from 'clsx'
import { CheckCircle2, FileUp, Loader2, Pencil, RefreshCw } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { parseResume } from '../lib/api'

type Props = {
  text: string
  fileName: string
  onChange: (text: string, fileName: string) => void
}

type Mode = 'upload' | 'edit'

/** Drag-and-drop (or click) a PDF/DOCX; the server returns its text. Or paste text directly. */
export default function ResumeInput({ text, fileName, onChange }: Props) {
  const [mode, setMode] = useState<Mode>('upload')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const parsed = await parseResume(file)
      onChange(parsed.text, parsed.filename)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = '' // allow re-picking the same file
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    handleFile(event.dataTransfer.files[0])
  }

  if (mode === 'edit') {
    return (
      <div className="flex flex-1 flex-col">
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value, fileName || 'Pasted text')}
          placeholder="Paste your resume text here…"
          aria-label="Resume text"
          className="min-h-56 flex-1 resize-y rounded-xl border border-line bg-bg p-3 text-sm outline-none transition-colors focus:border-accent"
        />
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <button type="button" onClick={() => setMode('upload')} className="font-medium text-accent hover:underline">
            Upload a file instead
          </button>
          <span>{text.length.toLocaleString()} characters</span>
        </div>
      </div>
    )
  }

  const hasResume = text.trim().length > 0

  return (
    <div className="flex flex-1 flex-col">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        disabled={uploading}
        className={clsx(
          'flex min-h-56 flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors',
          dragging ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent/60 hover:bg-subtle',
        )}
      >
        {uploading ? (
          <>
            <Loader2 size={28} className="animate-spin text-accent" />
            <span className="text-sm text-muted">Reading your resume…</span>
          </>
        ) : hasResume ? (
          <>
            <CheckCircle2 size={28} className="text-emerald-500" />
            <span className="text-sm font-medium">{fileName || 'Resume added'}</span>
            <span className="text-xs text-muted">
              {text.length.toLocaleString()} characters · drop another file to replace
            </span>
          </>
        ) : (
          <>
            <FileUp size={28} className={dragging ? 'text-accent' : 'text-muted'} />
            <span className="text-sm font-medium">
              {dragging ? 'Drop to upload' : 'Drag & drop your resume'}
            </span>
            <span className="text-xs text-muted">PDF or DOCX, up to 5 MB · or click to browse</span>
          </>
        )}
      </button>
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>}
      <div className="mt-2 flex items-center gap-4 text-xs">
        <button type="button" onClick={() => setMode('edit')} className="flex items-center gap-1 font-medium text-accent hover:underline">
          <Pencil size={12} /> {hasResume ? 'View / edit text' : 'Paste text instead'}
        </button>
        {hasResume && (
          <button type="button" onClick={() => onChange('', '')} className="flex items-center gap-1 text-muted hover:text-text">
            <RefreshCw size={12} /> Clear
          </button>
        )}
      </div>
    </div>
  )
}
