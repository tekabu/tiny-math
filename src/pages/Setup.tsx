import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth'

export default function Setup() {
  const { setup } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('parent')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 4) return setError('Password must be at least 4 characters')
    if (password !== confirm) return setError('Passwords do not match')
    try {
      await setup(displayName || 'Parent', username, password)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-5xl">🧮</div>
          <h1 className="text-3xl font-extrabold text-violet-700">Welcome to Tiny Math</h1>
          <p className="text-slate-500">First, create the parent account.</p>
        </div>
        <div>
          <label className="label">Your name</label>
          <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Mom, Dad…" />
        </div>
        <div>
          <label className="label">Username</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label className="label">Confirm password</label>
          <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && <p className="font-bold text-red-600">{error}</p>}
        <button className="btn-primary w-full text-lg">Create parent account</button>
      </form>
    </div>
  )
}
