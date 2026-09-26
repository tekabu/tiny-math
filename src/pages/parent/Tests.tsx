import { useState, type FormEvent } from 'react'
import { api, useApi } from '../../api'
import type { Test, TestType, User } from '../../types'
import { distinctQuestions, TYPE_LABEL } from '../../generate'

type Draft = Omit<Test, 'id' | 'createdAt'> & { id?: number }

const blank: Draft = { name: '', type: 'add', min: 0, max: 5, count: 10, active: true, showCounters: false, kidIds: [] }

export default function Tests() {
  const { data: tests, reload } = useApi<Test[]>('/tests')
  const kids = useApi<User[]>('/kids').data
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState('')

  const kidName = (id: number) => kids?.find((k) => k.id === id)?.displayName ?? '?'

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const { min, max, count } = draft
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0) return setError('Min and max must be whole numbers ≥ 0')
    if (min > max) return setError('Min must be ≤ max')
    if (!Number.isInteger(count) || count < 1 || count > 100) return setError('How many must be 1–100')
    try {
      if (draft.id) await api(`/tests/${draft.id}`, 'PUT', draft)
      else await api('/tests', 'POST', draft)
    } catch (err) {
      return setError((err as Error).message)
    }
    await reload()
    setDraft(null)
    setError('')
  }

  const remove = async (t: Test) => {
    if (!confirm(`Delete "${t.name}" and all its results?`)) return
    await api(`/tests/${t.id}`, 'DELETE')
    await reload()
  }

  const num = (v: string) => (v === '' ? NaN : Number(v))

  const toggleKid = (id: number) => {
    if (!draft) return
    const kidIds = draft.kidIds.includes(id) ? draft.kidIds.filter((k) => k !== id) : [...draft.kidIds, id]
    setDraft({ ...draft, kidIds })
  }

  return (
    <div className="space-y-6">
      {!draft && (
        <button className="btn-primary text-lg" onClick={() => setDraft({ ...blank })}>
          + New test
        </button>
      )}

      {draft && (
        <form onSubmit={save} className="card space-y-4">
          <h2 className="text-xl font-extrabold">{draft.id ? 'Edit test' : 'New test'}</h2>
          <div>
            <label className="label">Name (optional)</label>
            <input
              className="input"
              value={draft.name}
              placeholder={`${TYPE_LABEL[draft.type]} ${draft.min}–${draft.max}`}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Kind of test</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TYPE_LABEL) as TestType[]).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setDraft({ ...draft, type: t })}
                  className={`btn ${draft.type === t ? 'bg-violet-600 text-white' : 'bg-white ring-2 ring-slate-200'}`}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Min number</label>
              <input className="input" type="number" min={0} value={Number.isNaN(draft.min) ? '' : draft.min} onChange={(e) => setDraft({ ...draft, min: num(e.target.value) })} />
            </div>
            <div>
              <label className="label">Max number</label>
              <input className="input" type="number" min={0} value={Number.isNaN(draft.max) ? '' : draft.max} onChange={(e) => setDraft({ ...draft, max: num(e.target.value) })} />
            </div>
            <div>
              <label className="label">How many</label>
              <input className="input" type="number" min={1} max={100} value={Number.isNaN(draft.count) ? '' : draft.count} onChange={(e) => setDraft({ ...draft, count: num(e.target.value) })} />
            </div>
          </div>
          {draft.min <= draft.max && draft.count > distinctQuestions(draft.type, draft.min, draft.max) && (
            <p className="font-bold text-amber-600">
              Numbers {draft.min}–{draft.max} only make {distinctQuestions(draft.type, draft.min, draft.max)} different
              questions, so some will repeat. Widen the range or ask fewer.
            </p>
          )}
          <div>
            <label className="label">Who can take it</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, kidIds: [] })}
                className={`btn ${draft.kidIds.length === 0 ? 'bg-violet-600 text-white' : 'bg-white ring-2 ring-slate-200'}`}
              >
                All kids
              </button>
              {kids?.map((k) => (
                <button
                  type="button"
                  key={k.id}
                  onClick={() => toggleKid(k.id)}
                  className={`btn ${draft.kidIds.includes(k.id) ? 'bg-violet-600 text-white' : 'bg-white ring-2 ring-slate-200'}`}
                >
                  {k.displayName}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-lg font-bold">
            <input
              type="checkbox"
              className="size-5 accent-violet-600"
              checked={draft.showCounters}
              onChange={(e) => setDraft({ ...draft, showCounters: e.target.checked })}
            />
            Show 🍎 apples to help count <span className="font-medium text-slate-500">(numbers up to 10)</span>
          </label>
          <label className="flex items-center gap-2 text-lg font-bold">
            <input type="checkbox" className="size-5 accent-violet-600" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            Active (kids can see it)
          </label>
          {error && <p className="font-bold text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary">Save</button>
            <button type="button" className="btn-ghost" onClick={() => { setDraft(null); setError('') }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-3">
        {tests?.map((t) => (
          <div key={t.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xl font-extrabold">{t.name}</div>
              <div className="text-slate-500">
                {TYPE_LABEL[t.type]} · numbers {t.min}–{t.max} · {t.count} questions ·{t.showCounters && ' 🍎 ·'}{' '}
                {t.kidIds.length === 0 ? 'all kids' : t.kidIds.map(kidName).join(', ')}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className={`btn ${t.active ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600'}`}
                onClick={() => api(`/tests/${t.id}`, 'PUT', { ...t, active: !t.active }).then(reload)}
              >
                {t.active ? '● Active' : '○ Off'}
              </button>
              <button className="btn-ghost" onClick={() => { setDraft({ ...t }); setError('') }}>
                Edit
              </button>
              <button className="btn-danger" onClick={() => remove(t)}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {tests?.length === 0 && !draft && <p className="text-slate-500">No tests yet.</p>}
      </div>
    </div>
  )
}
