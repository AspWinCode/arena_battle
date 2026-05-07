import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useUserStore } from '../stores/userStore'

interface Notif {
  id: string
  type: string
  payload: any
  read: boolean
  createdAt: string
}

const TYPE_META: Record<string, { icon: string; label: string; text: (p: any) => string }> = {
  challenge_received: {
    icon: '⚔️',
    label: 'Вызов',
    text: p => `${p.fromName ?? 'Игрок'} бросил тебе вызов!`,
  },
  challenge_accepted: {
    icon: '✅',
    label: 'Вызов принят',
    text: p => `${p.toName ?? 'Соперник'} принял твой вызов!`,
  },
  challenge_declined: {
    icon: '❌',
    label: 'Вызов отклонён',
    text: p => `${p.toName ?? 'Соперник'} отклонил твой вызов`,
  },
  match_found: {
    icon: '🎮',
    label: 'Матч найден',
    text: _p => 'Найден соперник! Матч начинается...',
  },
  season_end: {
    icon: '🏆',
    label: 'Конец сезона',
    text: p => `Сезон «${p.seasonName ?? ''}» завершён. Итоговый ELO: ${p.finalElo} → ${p.newElo}`,
  },
}

export default function NotificationsPage() {
  const navigate          = useNavigate()
  const { user, token }   = useUserStore()
  const [notifs, setNotifs]   = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    api.get<Notif[]>('/notifications', token)
      .then(data => {
        setNotifs(data)
        // Mark all read
        if (data.some(n => !n.read)) {
          api.patch('/notifications/read-all', {}, token).catch(() => {})
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  const markAllRead = async () => {
    if (!token) return
    setMarking(true)
    try {
      await api.patch('/notifications/read-all', {}, token)
      setNotifs(ns => ns.map(n => ({ ...n, read: true })))
    } catch {}
    setMarking(false)
  }

  if (!user) return null

  return (
    <div style={{
      maxWidth: 600,
      margin: '0 auto',
      padding: '32px 16px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/profile" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 20 }}>←</Link>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>🔔 Уведомления</h1>
        </div>
        {notifs.some(n => !n.read) && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12 }}
            onClick={markAllRead}
            disabled={marking}
          >
            ✓ Прочитать все
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}>Загружаем...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', color: '#f87171', padding: 48 }}>{error}</div>
      ) : notifs.length === 0 ? (
        <div style={{
          textAlign: 'center',
          color: 'var(--text-muted)',
          padding: 48,
          background: 'var(--bg-card)',
          borderRadius: 16,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔕</div>
          <p style={{ margin: 0, fontSize: 14 }}>Уведомлений пока нет</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notifs.map(n => {
            const meta = TYPE_META[n.type] ?? { icon: '📨', label: n.type, text: () => n.type }
            const isChallenge = n.type === 'challenge_received' && n.payload?.challengeId

            const inner = (
              <div style={{
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
                padding: '14px 16px',
                background: n.read ? 'var(--bg-card)' : 'rgba(139,92,246,.08)',
                border: `1px solid ${n.read ? 'var(--border)' : 'rgba(139,92,246,.25)'}`,
                borderRadius: 12,
                transition: 'background .2s',
              }}>
                <span style={{ fontSize: 24, lineHeight: 1, marginTop: 2, flexShrink: 0 }}>{meta.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      {meta.label}
                    </span>
                    {!n.read && (
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: '#818cf8', display: 'inline-block', flexShrink: 0,
                      }} />
                    )}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 4 }}>{meta.text(n.payload)}</div>
                  {n.type === 'season_end' && n.payload?.finalElo && n.payload?.newElo && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {n.payload.finalElo > n.payload.newElo
                        ? `ELO снижен на ${n.payload.finalElo - n.payload.newElo}`
                        : 'ELO сохранён'}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {new Date(n.createdAt).toLocaleString('ru', {
                      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            )

            if (isChallenge) {
              return (
                <Link key={n.id} to={`/challenge/${n.payload.challengeId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {inner}
                </Link>
              )
            }
            return <div key={n.id}>{inner}</div>
          })}
        </div>
      )}
    </div>
  )
}
