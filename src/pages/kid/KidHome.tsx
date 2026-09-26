import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth'
import { api, useApi } from '../../api'
import { SYMBOL } from '../../generate'
import type { Attempt, Test } from '../../types'

const COLORS = ['bg-pink-400', 'bg-sky-400', 'bg-amber-400', 'bg-emerald-400', 'bg-violet-400', 'bg-orange-400']

export default function KidHome() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  // poll so a test the parent just turned on appears without reloading
  const { data, error } = useApi<{ tests: Test[]; attempts: Attempt[] }>('/kid/home', 5000)
  const tests = data?.tests
  const attempts = data?.attempts

  const start = async (test: Test) => {
    try {
      const { id } = await api<{ id: number }>(`/kid/tests/${test.id}/start`, 'POST', {})
      navigate(`/kid/attempt/${id}`)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-violet-700">Hi {user?.displayName}! 👋</h1>
        <button className="btn-ghost" onClick={logout}>Bye</button>
      </header>

      {error && <div className="card mb-4 text-center text-xl text-red-500">{error}</div>}
      {/* latest attempt decides: unfinished → keep going, 100% → done, missed → try again */}
      {(() => {
        const latest = (test: Test) =>
          attempts?.filter((a) => a.testId === test.id).reduce<Attempt | undefined>((m, a) => (!m || a.id > m.id ? a : m), undefined)
        const isDone = (a?: Attempt) => Boolean(a?.finishedAt && a.score === a.questions.length)
        const open = tests?.filter((t) => !isDone(latest(t))) ?? []
        const done = tests?.filter((t) => isDone(latest(t))) ?? []
        return (
          <>
            {tests && open.length === 0 && (
              <div className="card mb-6 text-center text-2xl text-slate-500">
                {done.length ? 'All done! Great job! 🎉' : 'No tests right now. Ask a grown-up! 🙂'}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {open.map((test, i) => {
                const last = latest(test)
                const label = !last ? '▶ Start' : !last.finishedAt ? '▶ Keep going' : '🔁 Try again'
                const symbol = test.type === 'compare' ? '< = >' : SYMBOL[test.type]
                return (
                  <div key={test.id} className={`${COLORS[i % COLORS.length]} rounded-3xl p-5 text-white shadow-[0_6px_0_rgba(0,0,0,0.15)]`}>
                    <div className="text-6xl font-extrabold drop-shadow">{symbol}</div>
                    <div className="mt-1 text-2xl font-extrabold">{test.name}</div>
                    <div className="text-lg opacity-90">
                      {test.count} questions
                      {last?.finishedAt && ` · last time ${last.score}/${last.questions.length}`}
                    </div>
                    <button
                      onClick={() => start(test)}
                      className="btn mt-4 w-full bg-white py-4 text-3xl text-slate-800 shadow-[0_5px_0_rgba(0,0,0,0.2)]"
                    >
                      {label}
                    </button>
                  </div>
                )
              })}
            </div>

            {done.length > 0 && (
              <>
                <h2 className="mt-8 mb-3 text-2xl font-extrabold text-slate-500">Finished ⭐</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {done.map((test) => (
                    <div key={test.id} className="card flex items-center gap-3 opacity-80">
                      <span className="text-4xl">⭐</span>
                      <div>
                        <div className="text-xl font-extrabold">{test.name}</div>
                        <div className="text-slate-500">100% — all done!</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )
      })()}
    </div>
  )
}
