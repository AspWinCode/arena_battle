import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import { useUserStore } from '../stores/userStore'

const CLAN_AVATARS = ['⚔️','🛡️','🔥','💀','🐉','🦅','🌊','⚡','🦁','🐺','🌑','🗡️','🏹','🧿']

export default function CreateClanPage() {
  const { token, user } = useUserStore()
  const navigate = useNavigate()

  const [form, setForm] = useState({ name: '', tag: '', description: '', avatar: '⚔️' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!user || !token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Нужно войти в аккаунт</p>
          <Link to="/login" className="btn btn-primary" style={{ marginTop: 12, display: 'inline-block' }}>Войти</Link>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const tag = form.tag.trim().toUpperCase()
    if (tag.length < 2 || tag.length > 5 || !/^[A-Z0-9]+$/.test(tag)) {
      setError('Тег: 2–5 символов, только латиница и цифры')
      return
    }

    setSubmitting(true)
    try {
      const clan = await api.post<{ id: string }>('/clans', { ...form, tag }, token)
      navigate(`/clans/${clan.id}`)
    } catch (e: any) {
      setError(e.message)
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        <Link to="/clans" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13, display: 'block', marginBottom: 24 }}>
          ← Все кланы
        </Link>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 32 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 52 }}>{form.avatar}</div>
            <h1 style={{ margin: '10px 0 4px', fontSize: 22, fontWeight: 900 }}>Создать клан</h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Объедини игроков под одним флагом</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Avatar picker */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 8 }}>
                Аватар
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CLAN_AVATARS.map(a => (
                  <button
                    key={a} type="button"
                    onClick={() => setForm(f => ({ ...f, avatar: a }))}
                    style={{
                      width: 44, height: 44, fontSize: 24,
                      border: `2px solid ${form.avatar === a ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 10, background: form.avatar === a ? 'rgba(0,229,255,.1)' : 'var(--bg-mid)',
                      cursor: 'pointer', transition: 'all .15s',
                    }}
                  >{a}</button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                Название *
              </label>
              <input
                className="input"
                required minLength={2} maxLength={40}
                placeholder="Название клана"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Tag */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                Тег [2–5 символов] *
              </label>
              <input
                className="input"
                required minLength={2} maxLength={5}
                placeholder="TAG"
                value={form.tag}
                onChange={e => setForm(f => ({ ...f, tag: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                style={{ textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700 }}
              />
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                Отображается как [{form.tag || 'TAG'}] перед именем в чате
              </p>
            </div>

            {/* Description */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                Описание
              </label>
              <textarea
                className="input"
                maxLength={500} rows={3}
                placeholder="О чём ваш клан? Какой стиль игры?"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                style={{ resize: 'vertical' }}
              />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.3)', borderRadius: 8, fontSize: 13, color: '#f87171' }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ fontSize: 15 }}>
              {submitting ? '⏳ Создаём...' : '⚔️ Создать клан'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
