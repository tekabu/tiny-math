import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../auth'

const tabs = [
  { to: 'dashboard', label: '📊 Results' },
  { to: 'tests', label: '📝 Tests' },
  { to: 'kids', label: '🧒 Kids' },
  { to: 'settings', label: '⚙️ Settings' },
]

export default function ParentLayout() {
  const { user, logout } = useAuth()
  return (
    <div className="mx-auto max-w-4xl p-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-violet-700">🧮 Tiny Math · {user?.displayName}</h1>
        <button className="btn-ghost" onClick={logout}>Log out</button>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `btn ${isActive ? 'bg-violet-600 text-white' : 'bg-white text-slate-700 ring-2 ring-slate-200'}`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
