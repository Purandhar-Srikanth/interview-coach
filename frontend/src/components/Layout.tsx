import clsx from 'clsx'
import { History, Loader2, MessageSquarePlus, Settings, TrendingUp } from 'lucide-react'
import { motion } from 'motion/react'
import { Suspense } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import ApiStatus from './ApiStatus'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'

const NAV_ITEMS = [
  { to: '/', label: 'New interview', short: 'Interview', icon: MessageSquarePlus },
  { to: '/progress', label: 'Progress', short: 'Progress', icon: TrendingUp },
  { to: '/history', label: 'History', short: 'History', icon: History },
  { to: '/settings', label: 'Settings', short: 'Settings', icon: Settings },
]

/** App frame: sidebar on desktop, top bar + bottom tab bar on mobile. Pages render in <Outlet />. */
export default function Layout() {
  const location = useLocation()
  // The interview page is wider: chat on the left, score panel on the right.
  const isInterview = /^\/interview\/[^/]+$/.test(location.pathname)

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface p-4 md:flex">
        <Logo />
        <nav className="mt-8 flex flex-col gap-1" aria-label="Main">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'text-muted hover:bg-subtle hover:text-text',
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <ThemeToggle showLabel />
          <ApiStatus />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur md:hidden">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="flex-1 px-4 pt-6 pb-24 md:px-10 md:py-10">
        {/* Re-keying on the path makes each page fade in when you navigate. */}
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className={clsx('mx-auto', isInterview ? 'max-w-7xl' : 'max-w-5xl')}
        >
          {/* Pages load on demand; show a spinner in the page area (sidebar stays). */}
          <Suspense
            fallback={
              <div className="flex justify-center py-20">
                <Loader2 className="animate-spin text-accent" aria-label="Loading" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </motion.div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-line bg-surface md:hidden"
        aria-label="Main"
      >
        {NAV_ITEMS.map(({ to, short, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center gap-1 py-2 text-[11px] font-medium',
                isActive ? 'text-accent' : 'text-muted',
              )
            }
          >
            <Icon size={20} />
            {short}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
