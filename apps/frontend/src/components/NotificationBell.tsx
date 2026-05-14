import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useUserStore } from '../stores/userStore'

const TYPE_LABELS: Record<string, { icon: string; text: (p: any) => string }> = {
  challenge_received: { icon: '⚔️', text: p => `${p.fromName ?? 'Кто-то'} бросил тебе вызов!` },
  challenge_accepted: { icon: '✅', text: p => `${p.toName   ?? 'Соперник'} принял твой вызов!` },
  challenge_declined: { icon: '❌', text: p => `${p.toName   ?? 'Соперник'} отклонил твой вызов` },
  match_found:        { icon: '🎮', text: _p => 'Найден соперник! Матч начинается...'           },
  season_end:         { icon: '🏆', text: p => `Сезон «${p.seasonName ?? ''}» завершён. Рейтинг: ${p.newElo}` },
}

interface Notif {
  id: string
  type: string
  payload: any
  read: boolean
  createdAt: string
}

export default function NotificationBell() {
  const { user, token } = useUserStore()
  const [count, setCount]         = useState(0)
  const [open,  setOpen]          = useState(false)
  const [notifs, setNotifs]       = useState<Notif[]>([])
  const [loading, setLoading]     = useState(false)
  const ref                       = useRef<HTMLDivElement>(null)

  // Poll unread count every 30 s
  useEffect(() => {
    if (!token) return
    const poll = () => {
      api.get<{ count: number }>('/notifications/unread-count', token)
        .then(r => setCount(r.count))
        .catch(() => {})
    }
    poll()
    const id = setInterval(poll, 30_000)
    return () => clearInterval(id)
  }, [token])

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleOpen = async () => {
    if (!token) return
    setOpen(o => !o)
    if (!open) {
      setLoading(true)
      try {
        const data = await api.get<Notif[]>('/notifications', token)
        setNotifs(data)
        // Mark all read
        if (data.some(n => !n.read)) {
          await api.patch('/notifications/read-all', {}, token)
          setCount(0)
        }
      } catch {}
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={handleOpen}
        title="Уведомления"
        style={{
          background: 'none',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '5px 10px',
          cursor: 'pointer',
          fontSize: 18,
          color: 'var(--text)',
          position: 'relative',
          lineHeight: 1,
          transition: 'background .15s',
        }}
      >
        🔔
        {count > 0 && (
          <span style={{
            position: 'absolute',
            top: -5, right: -5,
            background: '#f87171',
            color: '#fff',
            fontSize: 10,
            fontWeight: 800,
            borderRadius: 99,
            minWidth: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
            pointerEvents: 'none',
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 'calc(100% + 8px)',
          width: 320,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,.45)',
          zIndex: 999,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            fontWeight: 700,
            fontSize: 13,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            Уведомления
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}
            >
              Все →
            </Link>
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Загружаем...
              </div>
            ) : notifs.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Нет уведомлений
              </div>
            ) : (
              notifs.map(n => {
                const def = TYPE_LABELS[n.type] ?? { icon: '📨', text: () => n.type }
                return (
                  <NotifItem key={n.id} n={n} def={def} onClose={() => setOpen(false)} />
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function NotifItem({ n, def, onClose }: {
  n: Notif
  def: { icon: string; text: (p: any) => string }
  onClose: () => void
}) {
  const isChallenge = n.type === 'challenge_received'
  const challengeId = n.payload?.challengeId

  const content = (
    <div style={{
      padding: '10px 16px',
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      borderBottom: '1px solid var(--border)',
      background: n.read ? 'transparent' : 'rgba(139,92,246,.06)',
      cursor: isChallenge && challengeId ? 'pointer' : 'default',
      transition: 'background .15s',
    }}>
      <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>{def.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, lineHeight: 1.4 }}>{def.text(n.payload)}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
          {new Date(n.createdAt).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )

  if (isChallenge && challengeId) {
    return (
      <Link to={`/challenge/${challengeId}`} onClick={onClose} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
        {content}
      </Link>
    )
  }
  return content
}
