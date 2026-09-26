import { Navigate, Route, Routes } from 'react-router-dom'
import { useApi } from './api'
import { useAuth } from './auth'
import Login from './pages/Login'
import Setup from './pages/Setup'
import KidHome from './pages/kid/KidHome'
import Quiz from './pages/kid/Quiz'
import Dashboard from './pages/parent/Dashboard'
import Kids from './pages/parent/Kids'
import ParentLayout from './pages/parent/ParentLayout'
import Settings from './pages/parent/Settings'
import Tests from './pages/parent/Tests'

function Loading() {
  return <div className="grid min-h-dvh place-items-center text-2xl text-slate-400">Loading…</div>
}

export default function App() {
  const { user, loading } = useAuth()
  const status = useApi<{ hasParent: boolean }>('/status')

  if (status.error) return <div className="grid min-h-dvh place-items-center p-4 text-center text-2xl text-red-500">{status.error}</div>
  if (loading || !status.data) return <Loading />
  if (!status.data.hasParent && !user) return <Setup />
  if (!user) return <Login />

  if (user.role === 'parent') {
    return (
      <Routes>
        <Route path="/parent" element={<ParentLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="tests" element={<Tests />} />
          <Route path="kids" element={<Kids />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/parent" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/kid" element={<KidHome />} />
      <Route path="/kid/attempt/:attemptId" element={<Quiz />} />
      <Route path="*" element={<Navigate to="/kid" replace />} />
    </Routes>
  )
}
