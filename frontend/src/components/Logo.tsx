import { Link } from 'react-router'

export default function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-1">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className="text-base font-semibold tracking-tight">Interview Coach</span>
    </Link>
  )
}
