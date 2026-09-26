import { useState, type FormEvent } from 'react'
import { api, useApi } from '../../api'
import type { User } from '../../types'

export default function Kids() {
  const { data: kids, reload } = useApi<User[]>('/kids')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPw] = useState('')
  const [error, setError] = useState('')

  const add = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await api('/kids', 'POST', { displayName, username, password })
      await reload()
      setDisplayName('')
      setUsername('')
      setPw('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const resetPassword = async (kid: User) => {
    const pw = prompt(`New password for ${kid.displayName}:`)
    if (pw) await api(`/kids/${kid.id}/password`, 'PUT', { password: pw }).catch((err) => alert(err.message))
  }

  const remove = async (kid: User) => {
    if (!confirm(`Delete ${kid.displayName} and all their results?`)) return
    await api(`/kids/${kid.id}`, 'DELETE')
    await reload()
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="card grid gap-3 sm:grid-cols-4 sm:items-end">
        <div>
          <label className="label">Kid's name</label>
          <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <label className="label">Username</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" value={password} onChange={(e) => setPw(e.target.value)} />
        </div>
        <button className="btn-primary">+ Add kid</button>
        {error && <p className="font-bold text-red-600 sm:col-span-4">{error}</p>}
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        {kids?.map((kid) => (
          <div key={kid.id} className="card flex items-center justify-between gap-3">
            <div>
              <div className="text-xl font-extrabold">🧒 {kid.displayName}</div>
              <div className="text-slate-500">@{kid.username}</div>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => resetPassword(kid)}>Password</button>
              <button className="btn-danger" onClick={() => remove(kid)}>Delete</button>
            </div>
          </div>
        ))}
        {kids?.length === 0 && <p className="text-slate-500">No kids yet. Add one above.</p>}
      </div>
    </div>
  )
}
