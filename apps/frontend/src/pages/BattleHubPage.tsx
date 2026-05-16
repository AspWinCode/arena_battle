import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import type { JoinSessionResponse, SkinId } from '@robocode/shared'
import { ALL_SKIN_IDS } from '@robocode/shared'
import { api } from '../api/client'
import { useBattleStore } from '../stores/battleStore'
import { useUserStore } from '../stores/userStore'
import RankBadge from '../components/RankBadge'
import styles from './BattleHubPage.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlayerEntry {
  id: string
  username: string
  displayName: string
  avatar: string
  elo: number
  totalBattles: number
}

interface IncomingChallenge {
  id: string
  fromUser: { id: string; username: string; displayName: string; avatar: string; elo: number }
  message?: string
  createdAt: string
  skin: SkinId
  lang: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Avatar({ src, name, size = 32 }: { src?: string | null; name: string; size?: number }) {
  if (src?.startsWith('/') || src?.startsWith('data:')) {
    return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  }
  return <span style={{ fontSize: size * 0.6, lineHeight: 1, flexShrink: 0 }}>{src ?? '🧑‍💻'}</span>
}

function fmtSecs(s: number) {
  return s >= 60 ? `${Math.floor(s / 60)}м ${s % 60}с` : `${s}с`
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function BattleHubPage() {
  const navigate    = useNavigate()
  const setSession  = useBattleStore(s => s.setSession)
  const { user, token } = useUserStore()

  // ── Matchmaking ──────────────────────────────────────────────────────────
  const [inQueue,   setInQueue]   = useState(false)
  const [queueSecs, setQueueSecs] = useState(0)
  const [queueSize, setQueueSize] = useState(0)
  const [mmError,   setMmError]   = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const handleJoinQueue = async () => {
    if (!user || !token) { setMmError('Войдите в аккаунт'); return }
    setMmError('')
    try {
      await api.post('/matchmaking/queue', {
        name: user.displayName,
        skin: user.preferredSkin ?? 'robot',
        lang: user.preferredLang ?? 'auto',
      }, token)
      setInQueue(true)
      setQueueSecs(0)

      pollRef.current = setInterval(async () => {
        try {
          const st = await api.get<{
            inQueue: boolean; matched: boolean
            sessionId?: string; playerCode?: string
            waitSeconds?: number; queueSize?: number
          }>('/matchmaking/queue/status', token!)

          if (st.matched && st.sessionId && st.playerCode) {
            clearInterval(pollRef.current!)
            setInQueue(false)
            const res = await api.post<JoinSessionResponse>('/session/join', {
              sessionCode: st.playerCode,
              name: user.displayName,
              skin: user.preferredSkin ?? 'robot',
            }, token!)
            setSession(res.sessionId, res.playerSlot, 'code', ALL_SKIN_IDS, res.wsToken, user.displayName, (user.preferredSkin ?? 'robot') as SkinId)
            navigate(`/battle/${res.sessionId}`)
          } else if (st.inQueue) {
            setQueueSecs(st.waitSeconds ?? 0)
            setQueueSize(st.queueSize ?? 0)
          } else {
            clearInterval(pollRef.current!)
            setInQueue(false)
          }
        } catch { /* ignore poll errors */ }
      }, 2000)
    } catch (e) {
      setMmError(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  const handleLeaveQueue = async () => {
    if (pollRef.current) clearInterval(pollRef.current)
    setInQueue(false)
    if (token) api.delete('/matchmaking/queue', token).catch(() => {})
  }

  // ── Player search & challenge ────────────────────────────────────────────
  const [searchQ,       setSearchQ]       = useState('')
  const [searchResults, setSearchResults] = useState<PlayerEntry[]>([])
  const [searching,     setSearching]     = useState(false)
  const [topPlayers,    setTopPlayers]    = useState<PlayerEntry[]>([])
  const [sentChallenge, setSentChallenge] = useState<Record<string, string>>({}) // userId → challengeId
  const [challenging,   setChallenging]   = useState<string | null>(null)
  const [challengeErr,  setChallengeErr]  = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load top players on mount
  useEffect(() => {
    api.get<PlayerEntry[]>('/user/profile/leaderboard')
      .then(data => setTopPlayers((data as PlayerEntry[]).slice(0, 8)))
      .catch(() => {})
  }, [])

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (searchQ.trim().length < 2) { setSearchResults([]); return }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await api.get<PlayerEntry[]>(`/user/profile/search?q=${encodeURIComponent(searchQ.trim())}`)
        setSearchResults(res.filter(p => p.id !== user?.id))
      } catch { setSearchResults([]) }
      finally { setSearching(false) }
    }, 350)
  }, [searchQ, user?.id])

  const handleChallenge = useCallback(async (targetId: string, targetUsername: string) => {
    if (!token) return
    setChallenging(targetId)
    setChallengeErr('')
    try {
      const res = await api.post<{ challengeId: string }>('/challenges/send', {
        toUserId: targetId,
        skin: user?.preferredSkin ?? 'robot',
        lang: user?.preferredLang ?? 'auto',
      }, token)
      setSentChallenge(prev => ({ ...prev, [targetId]: res.challengeId }))

      // Poll for acceptance
      const cid = res.challengeId
      const intervalId = setInterval(async () => {
        try {
          const st = await api.get<{
            status: string; playerCode?: string; sessionId?: string
          }>(`/challenges/${cid}/status`, token!)

          if (st.status === 'ACCEPTED' && st.sessionId && st.playerCode) {
            clearInterval(intervalId)
            const joinRes = await api.post<JoinSessionResponse>('/session/join', {
              sessionCode: st.playerCode,
              name: user!.displayName,
              skin: user?.preferredSkin ?? 'robot',
            }, token!)
            setSession(joinRes.sessionId, joinRes.playerSlot, 'code', ALL_SKIN_IDS, joinRes.wsToken, user!.displayName, (user?.preferredSkin ?? 'robot') as SkinId)
            navigate(`/battle/${joinRes.sessionId}`)
          } else if (st.status === 'DECLINED' || st.status === 'EXPIRED') {
            clearInterval(intervalId)
            setSentChallenge(prev => { const n = { ...prev }; delete n[targetId]; return n })
            setChallengeErr(`${targetUsername} отклонил вызов`)
          }
        } catch { /* ignore */ }
      }, 3000)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка'
      if (msg.includes('уже отправлен')) {
        setChallengeErr('Вызов уже отправлен этому игроку')
      } else {
        setChallengeErr(msg)
      }
    } finally {
      setChallenging(null)
    }
  }, [token, user, navigate, setSession])

  // ── Incoming challenges ──────────────────────────────────────────────────
  const [incoming,     setIncoming]     = useState<IncomingChallenge[]>([])
  const [accepting,    setAccepting]    = useState<string | null>(null)
  const [decliningId,  setDecliningId]  = useState<string | null>(null)

  const loadIncoming = useCallback(async () => {
    if (!token) return
    try {
      const data = await api.get<IncomingChallenge[]>('/challenges/incoming', token)
      setIncoming(data)
    } catch { /* ignore */ }
  }, [token])

  useEffect(() => {
    loadIncoming()
    const t = setInterval(loadIncoming, 10000)
    return () => clearInterval(t)
  }, [loadIncoming])

  const handleAccept = async (cid: string) => {
    if (!token) return
    setAccepting(cid)
    try {
      const res = await api.post<{ ok: boolean; sessionId: string; playerCode: string }>(`/challenges/${cid}/accept`, {}, token)
      const joinRes = await api.post<JoinSessionResponse>('/session/join', {
        sessionCode: res.playerCode,
        name: user!.displayName,
        skin: user?.preferredSkin ?? 'robot',
      }, token!)
      setSession(joinRes.sessionId, joinRes.playerSlot, 'code', ALL_SKIN_IDS, joinRes.wsToken, user!.displayName, (user?.preferredSkin ?? 'robot') as SkinId)
      navigate(`/battle/${joinRes.sessionId}`)
    } catch { setAccepting(null) }
  }

  const handleDecline = async (cid: string) => {
    if (!token) return
    setDecliningId(cid)
    try {
      await api.post(`/challenges/${cid}/decline`, {}, token)
      setIncoming(prev => prev.filter(c => c.id !== cid))
    } catch { /* ignore */ }
    finally { setDecliningId(null) }
  }

  // ── Session code join ────────────────────────────────────────────────────
  const [code,       setCode]       = useState('')
  const [codeLoading, setCodeLoading] = useState(false)
  const [codeError,  setCodeError]  = useState('')

  const handleCodeJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || code.length !== 6) return
    setCodeLoading(true)
    setCodeError('')
    try {
      const res = await api.post<JoinSessionResponse>('/session/join', {
        sessionCode: code,
        name: user.displayName,
        skin: user.preferredSkin ?? 'robot',
      }, token ?? undefined)
      setSession(res.sessionId, res.playerSlot, 'code', ALL_SKIN_IDS, res.wsToken, user.displayName, (user.preferredSkin ?? 'robot') as SkinId)
      navigate(`/battle/${res.sessionId}`)
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : 'Ошибка подключения')
    } finally {
      setCodeLoading(false)
    }
  }

  // ── Players display list ─────────────────────────────────────────────────
  const displayPlayers = searchQ.trim().length >= 2
    ? searchResults
    : topPlayers.filter(p => p.id !== user?.id)

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={styles.root}>
      <div className={styles.bg}>
        <div className={styles.bgGlow1} />
        <div className={styles.bgGlow2} />
      </div>

      <div className={styles.content}>
        <Link to="/profile" className={styles.back}>← Профиль</Link>
        <h1 className={styles.title}>⚔️ В бой</h1>

        {/* ── Incoming challenges ────────────────────────── */}
        {incoming.length > 0 && (
          <div className={styles.incomingSection}>
            <div className={styles.sectionLabel}>📨 Входящие вызовы</div>
            {incoming.map(ch => (
              <div key={ch.id} className={styles.incomingCard}>
                <div className={styles.incomingLeft}>
                  <Avatar src={ch.fromUser.avatar} name={ch.fromUser.displayName} size={40} />
                  <div>
                    <div className={styles.incomingName}>{ch.fromUser.displayName}</div>
                    <div className={styles.incomingMeta}>
                      <RankBadge elo={ch.fromUser.elo} size="sm" />
                      {ch.message && <span className={styles.incomingMsg}>«{ch.message}»</span>}
                    </div>
                  </div>
                </div>
                <div className={styles.incomingActions}>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 13, padding: '6px 14px' }}
                    onClick={() => handleAccept(ch.id)}
                    disabled={accepting === ch.id}
                  >
                    {accepting === ch.id ? '...' : '⚔️ Принять'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 13, padding: '6px 10px' }}
                    onClick={() => handleDecline(ch.id)}
                    disabled={decliningId === ch.id}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.grid}>
          {/* ── Matchmaking ─────────────────────────── */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>⚡</span>
              <div>
                <div className={styles.cardTitle}>Авто-матчмейкинг</div>
                <div className={styles.cardDesc}>Система найдёт противника по рейтингу</div>
              </div>
              {user?.elo != null && <RankBadge elo={user.elo} size="sm" />}
            </div>

            {mmError && <div className={styles.errMsg}>{mmError}</div>}

            {!inQueue ? (
              <button
                className={`btn btn-primary ${styles.bigBtn}`}
                onClick={handleJoinQueue}
                disabled={!user}
              >
                ⚡ НАЙТИ ПРОТИВНИКА
              </button>
            ) : (
              <div className={styles.queueState}>
                <div className={styles.queueSpinner}>⚡</div>
                <div className={styles.queueTitle}>Поиск соперника…</div>
                <div className={styles.queueMeta}>
                  {fmtSecs(queueSecs)}
                  {queueSize > 1 && <span> · {queueSize} в очереди</span>}
                </div>
                <button className="btn btn-ghost" style={{ fontSize: 13, marginTop: 8 }} onClick={handleLeaveQueue}>
                  Отмена
                </button>
              </div>
            )}
          </div>

          {/* ── Challenge player ─────────────────────── */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>🎯</span>
              <div>
                <div className={styles.cardTitle}>Вызвать игрока</div>
                <div className={styles.cardDesc}>Найди по нику или выбери из рейтинга</div>
              </div>
            </div>

            <input
              className={styles.searchInput}
              placeholder="Поиск по нику…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />

            {challengeErr && <div className={styles.errMsg}>{challengeErr}</div>}

            <div className={styles.playerList}>
              {searching && <div className={styles.hint}>Поиск…</div>}
              {!searching && searchQ.length >= 2 && displayPlayers.length === 0 && (
                <div className={styles.hint}>Игроки не найдены</div>
              )}
              {displayPlayers.map(p => {
                const isSent = !!sentChallenge[p.id]
                return (
                  <div key={p.id} className={styles.playerRow}>
                    <Avatar src={p.avatar} name={p.displayName} size={32} />
                    <div className={styles.playerInfo}>
                      <span className={styles.playerName}>{p.displayName}</span>
                      <span className={styles.playerElo}>
                        <RankBadge elo={p.elo} size="sm" />
                      </span>
                    </div>
                    <button
                      className={`btn ${isSent ? 'btn-ghost' : 'btn-primary'}`}
                      style={{ fontSize: 12, padding: '5px 12px', flexShrink: 0 }}
                      onClick={() => !isSent && handleChallenge(p.id, p.displayName)}
                      disabled={isSent || challenging === p.id || !token}
                      title={isSent ? 'Вызов отправлен, ожидаем ответа…' : undefined}
                    >
                      {challenging === p.id ? '…' : isSent ? '⏳ Ожидание' : '⚔️ Вызвать'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Session code (secondary) ───────────────── */}
        <details className={styles.codeSection}>
          <summary className={styles.codeSummary}>🔑 Войти по коду сессии</summary>
          <form className={styles.codeForm} onSubmit={handleCodeJoin}>
            <input
              className={`${styles.searchInput} ${styles.codeInput}`}
              placeholder="XXXXXX"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))}
              maxLength={6}
              spellCheck={false}
              autoComplete="off"
            />
            <button
              type="submit"
              className="btn btn-ghost"
              disabled={codeLoading || code.length !== 6 || !user}
            >
              {codeLoading ? '…' : 'Войти'}
            </button>
          </form>
          {codeError && <div className={styles.errMsg}>{codeError}</div>}
        </details>
      </div>
    </div>
  )
}
