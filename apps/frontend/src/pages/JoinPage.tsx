import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { SkinId, JoinSessionResponse } from '@robocode/shared'
import { ALL_SKIN_IDS, CHARACTER_STATS } from '@robocode/shared'
import { api } from '../api/client'
import { useBattleStore } from '../stores/battleStore'
import { useUserStore } from '../stores/userStore'
import RankBadge from '../components/RankBadge'
import UserMenu from '../components/UserMenu'
import styles from './JoinPage.module.css'

const SKINS = ALL_SKIN_IDS.map(id => ({
  id,
  label: CHARACTER_STATS[id].name,
  icon:  CHARACTER_STATS[id].icon,
  color: CHARACTER_STATS[id].color,
}))

function isSkinId(value: string): value is SkinId {
  return value in CHARACTER_STATS
}

export default function JoinPage() {
  const navigate   = useNavigate()
  const setSession = useBattleStore(s => s.setSession)
  const { user, token } = useUserStore()

  const [name, setName]         = useState('')
  const [code, setCode]         = useState('')
  const [skin, setSkin]         = useState<SkinId>('robot')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  // Matchmaking state
  const [inQueue,    setInQueue]    = useState(false)
  const [queueSecs,  setQueueSecs]  = useState(0)
  const [queueSize,  setQueueSize]  = useState(0)
  const [mmError,    setMmError]    = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Pre-fill from user profile if logged in
  useEffect(() => {
    if (user) {
      if (!name) setName(user.displayName)
      setSkin(isSkinId(user.preferredSkin) ? user.preferredSkin : 'robot')
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const safeSkin: SkinId = isSkinId(skin) ? skin : 'robot'
  const safeSkinMeta = SKINS.find(s => s.id === safeSkin) ?? SKINS[0]
  const safeCharacter = CHARACTER_STATS[safeSkin]

  // Clean up poll on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const handleCodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value.toUpperCase().slice(0, 6))
  }

  const handleJoinQueue = async () => {
    if (!user || !token) { setMmError('Войдите в аккаунт для матчмейкинга'); return }
    if (!name.trim()) { setMmError('Введи имя бойца'); return }

    setMmError('')
    try {
      await api.post('/matchmaking/queue', { name: name.trim(), skin: safeSkin, lang: user.preferredLang ?? 'auto' }, token)
      setInQueue(true)
      setQueueSecs(0)

      pollRef.current = setInterval(async () => {
        try {
          const st = await api.get<{
            inQueue: boolean; matched: boolean
            sessionId?: string; playerCode?: string; opponentName?: string
            waitSeconds?: number; queueSize?: number
          }>('/matchmaking/queue/status', token!)

          if (st.matched && st.sessionId && st.playerCode) {
            clearInterval(pollRef.current!)
            setInQueue(false)
            // Join the session
            const res = await api.post<JoinSessionResponse>('/session/join', {
              sessionCode: st.playerCode,
              name: name.trim(),
              skin: safeSkin,
            }, token!)
            setSession(res.sessionId, res.playerSlot, 'code', ALL_SKIN_IDS, res.wsToken, name.trim(), safeSkin)
            navigate(`/battle/${res.sessionId}`)
          } else if (st.inQueue) {
            setQueueSecs(st.waitSeconds ?? 0)
            setQueueSize(st.queueSize ?? 0)
          } else {
            // Kicked from queue for some reason
            clearInterval(pollRef.current!)
            setInQueue(false)
          }
        } catch { /* ignore poll errors */ }
      }, 2000)
    } catch (e) {
      setMmError(e instanceof Error ? e.message : 'Ошибка матчмейкинга')
    }
  }

  const handleLeaveQueue = async () => {
    if (pollRef.current) clearInterval(pollRef.current)
    setInQueue(false)
    if (token) api.delete('/matchmaking/queue', token).catch(() => {})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || code.length !== 6) return

    setLoading(true)
    setError('')

    try {
      const res = await api.post<JoinSessionResponse>('/session/join', {
        sessionCode: code,
        name: name.trim(),
        skin: safeSkin,
      }, token ?? undefined)

      // 'code' level is a placeholder – real level arrives via WS 'connected' message
      setSession(res.sessionId, res.playerSlot, 'code', ALL_SKIN_IDS, res.wsToken, name.trim(), safeSkin)
      navigate(`/battle/${res.sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка подключения')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.bg}>
        <div className={styles.bgGlow1} />
        <div className={styles.bgGlow2} />
        <div className={styles.grid} />
      </div>

      <div className={styles.container}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🤖</span>
          <div>
            <h1 className={styles.logoTitle}>CodeFighters</h1>
            <p className={styles.logoSub}>Учись программировать в бою</p>
          </div>
        </div>

        <Link to="/" className={styles.homeLink}>
          ← На главную
        </Link>

        <form className={styles.card} onSubmit={handleSubmit}>
          <h2 className={styles.formTitle}>Войти в битву</h2>

          <div className={styles.field}>
            <label className={styles.label}>Твоё имя</label>
            <input
              type="text"
              className={styles.input}
              placeholder="Введи имя бойца..."
              value={name}
              onChange={e => setName(e.target.value.slice(0, 20))}
              maxLength={20}
              required
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Код сессии</label>
            <input
              type="text"
              className={`${styles.input} ${styles.codeInput}`}
              placeholder="XXXXXX"
              value={code}
              onChange={handleCodeInput}
              maxLength={6}
              required
              autoComplete="off"
              spellCheck={false}
            />
            <span className={styles.codeHint}>{code.length}/6</span>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Выбери бойца</label>
            <div className={styles.skins}>
              {SKINS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className={`${styles.skinCard} ${safeSkin === s.id ? styles.skinSelected : ''}`}
                  style={{ '--skin-color': s.color } as React.CSSProperties}
                  onClick={() => setSkin(s.id)}
                >
                  <span className={styles.skinIcon}>{s.icon}</span>
                  <span className={styles.skinLabel}>{s.label}</span>
                </button>
              ))}
            </div>

            {/* Character stats panel */}
            {(() => {
              const ch = safeCharacter
              const skinMeta = safeSkinMeta
              // Normalise bars: HP out of 120, dmg out of 1.35, rage out of 1.5
              const hpPct  = Math.round((ch.maxHp / 120) * 100)
              const dmgPct = Math.round((ch.dmgMult / 1.35) * 100)
              const ragePct = Math.round((ch.rageMult / 1.5) * 100)
              return (
                <div className={styles.charPanel} style={{ borderColor: `${skinMeta.color}44` }}>
                  <div className={styles.charPanelHeader}>
                    <span className={styles.charPanelIcon}>{ch.icon}</span>
                    <div>
                      <div className={styles.charPanelName} style={{ color: skinMeta.color }}>{ch.name}</div>
                      <div className={styles.charPanelTagline}>{ch.tagline}</div>
                    </div>
                  </div>

                  <div className={styles.charStats}>
                    <div className={styles.charStat}>
                      <span className={styles.charStatLabel}>HP</span>
                      <div className={styles.charStatBar}>
                        <div className={styles.charStatFill} style={{ width: `${hpPct}%`, background: '#4ade80' }} />
                      </div>
                      <span className={styles.charStatValue}>{ch.maxHp}</span>
                    </div>
                    <div className={styles.charStat}>
                      <span className={styles.charStatLabel}>Урон</span>
                      <div className={styles.charStatBar}>
                        <div className={styles.charStatFill} style={{ width: `${dmgPct}%`, background: '#f87171' }} />
                      </div>
                      <span className={styles.charStatValue}>×{ch.dmgMult.toFixed(2)}</span>
                    </div>
                    <div className={styles.charStat}>
                      <span className={styles.charStatLabel}>Ярость</span>
                      <div className={styles.charStatBar}>
                        <div className={styles.charStatFill} style={{ width: `${ragePct}%`, background: '#fbbf24' }} />
                      </div>
                      <span className={styles.charStatValue}>×{ch.rageMult.toFixed(1)}</span>
                    </div>
                  </div>

                  <div className={styles.charPassive}>{ch.passive}</div>
                </div>
              )
            })()}
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="submit"
            className={`btn btn-primary ${styles.submitBtn}`}
            disabled={loading || !name.trim() || code.length !== 6}
          >
            {loading ? (
              <><span className="animate-spin" style={{ display: 'inline-block' }}>⚙️</span> Подключение...</>
            ) : (
              '⚔️ ПОДКЛЮЧИТЬСЯ'
            )}
          </button>
        </form>

        {/* ── Matchmaking card ── */}
        {user && (
          <div className={styles.mmCard}>
            {!inQueue ? (
              <>
                <div className={styles.mmTitle}>
                  <span>⚡ Авто-матчмейкинг</span>
                  {user.elo != null && <RankBadge elo={user.elo} size="sm" />}
                </div>
                <p className={styles.mmDesc}>
                  Система подберёт соперника по рейтингу автоматически — без кода сессии.
                </p>
                {mmError && <div className={styles.error}>{mmError}</div>}
                <button
                  type="button"
                  className={`btn btn-primary ${styles.submitBtn}`}
                  style={{ background: 'linear-gradient(135deg, #ffe566 0%, #ff8c00 100%)', color: '#050a07' }}
                  onClick={handleJoinQueue}
                  disabled={!name.trim()}
                >
                  ⚡ НАЙТИ ПРОТИВНИКА
                </button>
              </>
            ) : (
              <div className={styles.queueWait}>
                <div className={styles.queueSpinner}>⚡</div>
                <div className={styles.queueTitle}>Поиск соперника...</div>
                <div className={styles.queueMeta}>
                  {Math.floor(queueSecs / 60) > 0
                    ? `${Math.floor(queueSecs / 60)}м ${queueSecs % 60}с`
                    : `${queueSecs}с`
                  }
                  {queueSize > 1 && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>· {queueSize} в очереди</span>}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 12, marginTop: 8 }}
                  onClick={handleLeaveQueue}
                >
                  Отмена
                </button>
              </div>
            )}
          </div>
        )}

        <div className={styles.bottomLinks}>
          <div className={styles.publicLinks}>
            <a href="/learn" className={styles.learnLink}>🎓 Обучение</a>
            <a href="/sparring" className={styles.learnLink}>🥊 Спарринг</a>
            <a href="/daily" className={styles.learnLink}>📅 Задания</a>
            <a href="/leaderboard" className={styles.learnLink}>🏆 Рейтинг</a>
            <a href="/tournaments" className={styles.tournamentLink}>🏟 Турниры</a>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <UserMenu />
          </div>
          <p className={styles.adminLink}>
            Организатор? <a href="/admin">Панель управления →</a>
          </p>
        </div>
      </div>
    </div>
  )
}
