import { useState, type FormEvent } from 'react'
import { api } from '../../api'

export default function Settings() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (next.length < 4) return setMsg({ ok: false, text: 'New password must be at least 4 characters' })
    if (next !== confirmPw) return setMsg({ ok: false, text: 'New passwords do not match' })
    try {
      await api('/me/password', 'PUT', { current, next })
    } catch (err) {
      return setMsg({ ok: false, text: (err as Error).message })
    }
    setCurrent('')
    setNext('')
    setConfirmPw('')
    setMsg({ ok: true, text: 'Password changed' })
  }

  return (
    <form onSubmit={submit} className="card max-w-sm space-y-4">
      <h2 className="text-xl font-extrabold">Change parent password</h2>
      <div>
        <label className="label">Current password</label>
        <input className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div>
        <label className="label">New password</label>
        <input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
      <div>
        <label className="label">Confirm new password</label>
        <input className="input" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
      </div>
      {msg && <p className={`font-bold ${msg.ok ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>}
      <button className="btn-primary">Save</button>
    </form>
  )
}
