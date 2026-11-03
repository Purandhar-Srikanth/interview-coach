import { Route, Routes } from 'react-router'
import Layout from './components/Layout'
import HistoryPage from './pages/HistoryPage'
import NotFoundPage from './pages/NotFoundPage'
import ProgressPage from './pages/ProgressPage'
import SettingsPage from './pages/SettingsPage'
import SetupPage from './pages/SetupPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<SetupPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
