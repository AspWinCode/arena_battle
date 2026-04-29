const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1'

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let data: any
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(`Server error ${res.status}: unexpected response`)
  }
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data as T
}

export const api = {
  get:    <T>(path: string, token?: string) => request<T>('GET',    path, undefined, token),
  post:   <T>(path: string, body: unknown, token?: string) => request<T>('POST',   path, body, token),
  delete: <T>(path: string, token?: string) => request<T>('DELETE', path, undefined, token),
}
