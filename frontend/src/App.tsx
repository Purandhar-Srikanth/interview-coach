import { Loader2 } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import Layout from './components/Layout'
import SetupPage from './pages/SetupPage'

// Other pages are loaded on demand, so the first visit downloads less JavaScript.
const InterviewPage = lazy(() => import('./pages/InterviewPage'))
const SummaryPage = lazy(() => import('./pages/SummaryPage'))
const ProgressPage = lazy(() => import('./pages/ProgressPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

function PageLoading() {
  return (
    <div className="flex justify-center py-20">
      <Loader2 className="animate-spin text-accent" aria-label="Loading" />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<SetupPage />} />
          <Route path="interview/:id" element={<InterviewPage />} />
          <Route path="interview/:id/summary" element={<SummaryPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
