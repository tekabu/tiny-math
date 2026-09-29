import { useState } from 'react'
import { api, useApi } from '../../api'
import type { Attempt, Test, User } from '../../types'
import { SYMBOL, TYPE_LABEL } from '../../generate'

function pct(a: Attempt) {
  return Math.round((a.score / a.questions.length) * 100)
}

function scoreColor(p: number) {
  if (p === 100) return 'bg-blue-600 text-white'
  if (p >= 70) return 'bg-blue-100 text-blue-800'
  return 'bg-red-100 text-red-700'
}

function AttemptDetail({ attempt }: { attempt: Attempt }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attempt.questions.map((q, i) => {
        const answered = q.given !== undefined
        const style = !answered ? 'bg-slate-100 text-slate-400' : q.correct ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-700'
        // the attempt's own kind: the test may have been edited since it was taken
        const op = attempt.type === 'compare' ? (q.given ?? '?') : SYMBOL[attempt.type]
        const [left, right] = q.given?.split(',') ?? ['?', '?']
        const text =
          attempt.type === 'place'
            ? `${left} ${q.answer} ${right}`
            : attempt.type === 'compare'
              ? `${q.a} ${op} ${q.b}`
              : `${q.a} ${op} ${q.b} = ${q.given ?? '?'}`
        const fix = attempt.type === 'place' ? `${q.a} ${q.answer} ${q.b}` : q.answer
        return (
          <div key={i} className={`rounded-xl px-3 py-1 font-bold ${style}`}>
            {text}
            {answered && !q.correct && <span className="ml-1 text-slate-500">(→ {fix})</span>}
            {answered && (q.correct ? ' ✔' : ' ✘')}
          </div>
        )
      })}
    </div>
  )
}

export default function Dashboard() {
  // poll so results from kids' devices show up live
  const tests = useApi<Test[]>('/tests', 5000).data
  const kids = useApi<User[]>('/kids', 5000).data
  const { data: attempts, reload } = useApi<Attempt[]>('/attempts', 5000)
  const [open, setOpen] = useState<number | null>(null)

  const restart = async (kid: User, test: Test, inProgress: boolean) => {
    const msg = inProgress
      ? `Restart "${test.name}" for ${kid.displayName}? Their current progress is thrown away and they start again from question 1.`
      : `Give ${kid.displayName} a new try at "${test.name}"?`
    if (!confirm(msg)) return
    try {
      await api(`/kids/${kid.id}/tests/${test.id}/restart`, 'POST', {})
      await reload()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  if (!tests || !kids || !attempts) return null
  if (tests.length === 0) return <p className="text-slate-500">No tests yet. Create one in the Tests tab.</p>

  return (
    <div className="space-y-4">
      {tests.map((test) => {
        const testAttempts = attempts.filter((a) => a.testId === test.id)
        const byKid = kids
          .map((kid) => ({ kid, list: testAttempts.filter((a) => a.kidId === kid.id) }))
          .filter((k) => k.list.length > 0)
        return (
          <div key={test.id} className="card">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-extrabold">{test.name}</h2>
              <span className="text-slate-500">
                {TYPE_LABEL[test.type]} · {test.min}–{test.max} · {test.count} q · {test.active ? 'active' : 'off'}
              </span>
            </div>
            {byKid.length === 0 && <p className="text-slate-400">No one has taken this test yet.</p>}
            {byKid.map(({ kid, list }) => {
              const done = list.filter((a) => a.finishedAt)
              const best = done.length ? Math.max(...done.map(pct)) : null
              const inProgress = list.some((a) => !a.finishedAt)
              const answered = list.find((a) => !a.finishedAt)?.questions.some((q) => q.given !== undefined)
              return (
                <div key={kid.id} className="border-t border-slate-100 py-3">
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    <span className="text-lg font-extrabold">🧒 {kid.displayName}</span>
                    <span className="text-slate-500">
                      {done.length} done{best !== null && ` · best ${best}%`}
                    </span>
                    {(!inProgress || answered) && (
                      <button className="btn-ghost ml-auto px-3 py-1 text-sm" onClick={() => restart(kid, test, inProgress)}>
                        {inProgress ? '⏮ Restart from start' : '🔁 Retest'}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {list.map((a) => (
                      <div key={a.id}>
                        <button
                          className="flex w-full flex-wrap items-center gap-3 rounded-xl px-2 py-1 text-left hover:bg-slate-50"
                          onClick={() => setOpen(open === a.id ? null : a.id)}
                        >
                          <span className="text-slate-500">{new Date(a.startedAt).toLocaleString()}</span>
                          {a.finishedAt ? (
                            <span className={`rounded-full px-3 font-bold ${scoreColor(pct(a))}`}>
                              {a.score}/{a.questions.length} · {pct(a)}%
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-3 font-bold text-amber-700">
                              in progress {a.questions.filter((q) => q.given !== undefined).length}/{a.questions.length}
                            </span>
                          )}
                          <span className="text-slate-400">{open === a.id ? '▲' : '▼'}</span>
                        </button>
                        {open === a.id && <AttemptDetail attempt={a} />}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
