import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const user = await login(username, password)
      navigate(user.role === 'parent' ? '/parent' : '/kid', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-6xl">🧮</div>
          <h1 className="text-4xl font-extrabold text-violet-700">Tiny Math</h1>
        </div>
        <div>
          <label className="label">Username</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoFocus />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="font-bold text-red-600">{error}</p>}
        <button className="btn-primary w-full text-xl">Let's go!</button>
      </form>
    </div>
  )
}
