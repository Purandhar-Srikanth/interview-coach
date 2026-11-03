import { lazy } from 'react'
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

export default function App() {
  return (
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
  )
}
