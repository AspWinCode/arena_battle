import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import { useUserStore } from '../stores/userStore'
import { useBattleStore } from '../stores/battleStore'
import type { SkinId, JoinSessionResponse } from '@robocode/shared'

const ALL_SKIN_IDS: SkinId[] = [
  'robot','gladiator','boxer','cosmonaut','ninja','mage','paladin','sniper',
  'tank','vampire','samurai','phantom','engineer','berserker',
]

interface ChallengeStatus {
  id: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'
  fromUserId: string
  toUserId: string
  sessionId: string | null
  playerCode?: string | null
  skin: string
  lang: string
  message: string | null
  expiresAt: string
  createdAt: string
  fromUser?: { id: string; displayName: string; username: string; avatar: string; elo?: number }
  toUser?:   { id: string; displayName: string; username: string; avatar: string; elo?: number }
}

export default function ChallengePage() {
  const { id }              = useParams<{ id: string }>()
  const navigate            = useNavigate()
  const { user, token }     = useUserStore()
  const setSession          = useBattleStore(s => s.setSession)
  const [status, setStatus] = useState<ChallengeStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [acting, setActing]   = useState(false)
  const pollRef               = useRef<ReturnType<typeof setInterval> | null>(null)
  const joiningRef            = useRef(false)

  const joinAndNavigate = async (data: ChallengeStatus, myPlayerCode: string) => {
    if (joiningRef.current || !token || !user) return
    joiningRef.current = true
    clearInterval(pollRef.current!)
    try {
      const res = await api.post<JoinSessionResponse>('/session/join', {
        sessionCode: myPlayerCode,
        name: user.displayName,
        skin: data.skin as SkinId,
      }, token)
      setSession(res.sessionId, res.playerSlot, 'code', ALL_SKIN_IDS, res.wsToken, user.displayName, data.skin as SkinId)
      navigate(`/battle/${res.sessionId}`)
    } catch (e: any) {
      setError('Ошибка входа в матч: ' + e.message)
      joiningRef.current = false
    }
  }

  const fetchStatus = async () => {
    if (!id || !token) return
    try {
      const data = await api.get<ChallengeStatus>(`/challenges/${id}/status`, token)
      setStatus(data)

      // If accepted and session ready + we have our playerCode — join the battle
      if (data.status === 'ACCEPTED' && data.sessionId && data.playerCode && !joiningRef.current) {
        await joinAndNavigate(data, data.playerCode)
        return
      }

      // Stop polling if terminal state
      if (data.status !== 'PENDING') {
        clearInterval(pollRef.current!)
      }
    } catch (e: any) {
      setError(e.message)
      clearInterval(pollRef.current!)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    fetchStatus()
    pollRef.current = setInterval(fetchStatus, 5_000)
    return () => clearInterval(pollRef.current!)
  }, [id, token])

  const handleAccept = async () => {
    if (!token || !id || !user || !status) return
    setActing(true)
    try {
      const res = await api.post<{ ok: boolean; sessionId: string; playerCode: string }>(
        `/challenges/${id}/accept`, {}, token
      )
      // Join the session with the playerCode we received
      const joined = await api.post<JoinSessionResponse>('/session/join', {
        sessionCode: res.playerCode,
        name: user.displayName,
        skin: status.skin as SkinId,
      }, token)
      setSession(joined.sessionId, joined.playerSlot, 'code', ALL_SKIN_IDS, joined.wsToken, user.displayName, status.skin as SkinId)
      navigate(`/battle/${joined.sessionId}`)
    } catch (e: any) {
      setError(e.message)
      setActing(false)
    }
  }

  const handleDecline = async () => {
    if (!token || !id) return
    setActing(true)
    try {
      await api.post(`/challenges/${id}/decline`, {}, token)
      setStatus(s => s ? { ...s, status: 'DECLINED' } : s)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActing(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 32 }}>⚙️</span>
    </div>
  )

  if (error || !status) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <p style={{ color: '#f87171' }}>{error || 'Вызов не найден'}</p>
      <Link to="/join" className="btn btn-ghost">← Главная</Link>
    </div>
  )

  const isRecipient = user?.id === status.toUserId
  const isSender    = user?.id === status.fromUserId
  const opponent    = isRecipient ? status.fromUser : status.toUser

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '24px 16px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 440,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 32,
        boxShadow: '0 8px 32px rgba(0,0,0,.4)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⚔️</div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
            {status.status === 'PENDING'  && (isRecipient ? 'Тебе бросили вызов!' : 'Ожидание ответа...')}
            {status.status === 'ACCEPTED' && '🎮 Вызов принят!'}
            {status.status === 'DECLINED' && '❌ Вызов отклонён'}
            {status.status === 'EXPIRED'  && '⏰ Вызов истёк'}
          </h2>
        </div>

        {/* Opponent card */}
        {opponent && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: 'var(--bg-mid)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 20,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'var(--bg-card)',
              border: '2px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, overflow: 'hidden', flexShrink: 0,
            }}>
              {opponent.avatar?.startsWith('data:') || opponent.avatar?.startsWith('/')
                ? <img src={opponent.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : opponent.avatar || '🤖'
              }
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{opponent.displayName}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{opponent.username}</div>
              {opponent.elo != null && (
                <div style={{ fontSize: 12, color: 'var(--lightning)', fontWeight: 700, marginTop: 2 }}>
                  {opponent.elo} ELO
                </div>
              )}
            </div>
          </div>
        )}

        {/* Challenge details */}
        {status.message && (
          <div style={{
            background: 'rgba(139,92,246,.08)',
            border: '1px solid rgba(139,92,246,.25)',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 13,
            marginBottom: 16,
            fontStyle: 'italic',
            color: 'var(--text-muted)',
          }}>
            «{status.message}»
          </div>
        )}

        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {status.skin !== 'robot' && <span style={{ background: 'var(--bg-mid)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--border)' }}>🎭 {status.skin}</span>}
          {status.lang !== 'auto'  && <span style={{ background: 'var(--bg-mid)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--border)' }}>💻 {status.lang}</span>}
          <span style={{ background: 'var(--bg-mid)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--border)' }}>
            ⏰ {new Date(status.expiresAt) > new Date()
              ? `Истекает ${new Date(status.expiresAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}`
              : 'Истёк'
            }
          </span>
        </div>

        {/* Actions */}
        {status.status === 'PENDING' && isRecipient && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={handleAccept}
              disabled={acting}
            >
              {acting ? '⏳...' : '✅ Принять вызов'}
            </button>
            <button
              className="btn btn-ghost"
              style={{ flex: 1, color: '#f87171', borderColor: '#f8717144' }}
              onClick={handleDecline}
              disabled={acting}
            >
              ❌ Отклонить
            </button>
          </div>
        )}

        {status.status === 'PENDING' && isSender && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙️</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Ждём ответа соперника...</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              Страница обновляется автоматически каждые 5 секунд
            </p>
          </div>
        )}

        {status.status === 'ACCEPTED' && (
          <div style={{ textAlign: 'center', color: '#4ade80', fontSize: 14, fontWeight: 700 }}>
            ✅ Вызов принят! Переходим в бой...
          </div>
        )}

        {(status.status === 'DECLINED' || status.status === 'EXPIRED') && (
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {opponent && (
              <Link
                to={`/profile/${opponent.username}`}
                className="btn btn-ghost"
                style={{ flex: 1, textAlign: 'center' }}
              >
                👤 Профиль
              </Link>
            )}
            <Link to="/join" className="btn btn-primary" style={{ flex: 1, textAlign: 'center' }}>
              ⚔️ Новый бой
            </Link>
          </div>
        )}

        {error && (
          <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center', marginTop: 12 }}>{error}</p>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
