import { useCallback, useEffect, useState } from 'react'

const TOKEN_KEY = 'tiny-math-token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = getToken()
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check Wi-Fi.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && path !== '/login') window.dispatchEvent(new Event('tiny-math-logout'))
    throw new ApiError(res.status, data.error ?? `Error ${res.status}`)
  }
  return data as T
}

/** GET a resource; `pollMs` keeps it fresh so other devices' changes show up. */
export function useApi<T>(path: string, pollMs?: number) {
  const [data, setData] = useState<T>()
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      setData(await api<T>(path))
      setError('')
    } catch (err) {
      setError((err as Error).message)
    }
  }, [path])

  useEffect(() => {
    void reload()
    if (!pollMs) return
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void reload()
    }, pollMs)
    return () => clearInterval(t)
  }, [reload, pollMs])

  return { data, error, reload }
}
