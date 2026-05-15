import { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useUserStore } from '../stores/userStore'
import { useBattleStore } from '../stores/battleStore'
import { useDailyStore } from '../stores/dailyStore'
import { useAchievementsStore, ACHIEVEMENTS } from '../stores/achievementsStore'
import { SKIN_ICON, CHARACTER_STATS, ALL_SKIN_IDS } from '@robocode/shared'
import type { SkinId, JoinSessionResponse } from '@robocode/shared'
import CharacterCard from '../components/CharacterCard/CharacterCard'
import CharacterView from '../animation/CharacterView'
import RankBadge from '../components/RankBadge'
import EloChart from '../components/EloChart'
import styles from './ProfilePage.module.css'

// ── Types ──────────────────────────────────────────────────────────────────
interface Stats {
  sessionsPlayed: number; sessionsWon: number; winRate: number
  battlesPlayed: number; langsUsed: string[]
  tournamentsEntered: number; tournamentsWon: number
  favoriteSkin: string; favoritelang: string
}
interface Achievement { id: string; icon: string; title: string; description: string; unlocked: boolean }
interface RecentSession {
  sessionId: string; sessionName: string; slot: number; lang: string | null
  skin: string; won: boolean; score: [number, number]; playedAt: string
}
interface Application {
  id: string; status: string; note: string | null; createdAt: string
  tournament: { id: string; name: string; status: string; startDate: string }
}
interface FullProfile {
  user: { id: string; email: string; username: string; displayName: string; avatar: string; bio: string | null; preferredLang: string; preferredSkin: string; experienceLevel: string; programmingYears: number; createdAt: string; elo?: number; totalXp?: number; totalBattles?: number; totalWins?: number; currentStreak?: number }
  stats: Stats; achievements: Achievement[]; recentSessions: RecentSession[]; applications: Application[]
}

// ── Helpers ────────────────────────────────────────────────────────────────
const LANG_LABELS: Record<string, string> = { js: 'JavaScript', py: 'Python', cpp: 'C++', java: 'Java' }
const EXP_LABELS: Record<string, string>  = { beginner: 'Начинающий', intermediate: 'Средний', advanced: 'Продвинутый' }
const STATUS_LABELS: Record<string, string> = { PENDING: 'На рассмотрении', APPROVED: 'Одобрено', REJECTED: 'Отклонено' }
const STATUS_COLORS: Record<string, string> = { PENDING: '#facc15', APPROVED: '#4ade80', REJECTED: '#f87171' }
const ALL_SKIN_IDS_TYPED = Object.keys(CHARACTER_STATS) as SkinId[]

interface EloPoint {
  elo: number; delta: number; won: boolean; createdAt: string
  opponent?: { displayName: string; username: string } | null
}

type Tab = 'history' | 'achievements' | 'progress' | 'settings' | 'leaderboard'
const TABS: { id: Tab; label: string }[] = [
  { id: 'history',      label: '⚔️ История'         },
  { id: 'achievements', label: '🏅 Достижения'      },
  { id: 'progress',     label: '🔥 Прогресс'        },
  { id: 'leaderboard',  label: '🏆 Таблица лидеров' },
]

const NAV_ITEMS = [
  { to: '/join',        icon: '⚔️', label: 'В бой',      desc: 'Войти по коду сессии' },
  { to: '/learn',       icon: '🎓', label: 'Обучение',   desc: 'Уроки и практика'     },
  { to: '/sparring',    icon: '🥊', label: 'Отработка навыков', desc: 'Тренировочный бой' },
  { to: '/daily',       icon: '📅', label: 'Задания',    desc: 'Ежедневные задачи'    },
  { to: '/tournaments', icon: '🏟', label: 'Турниры',    desc: 'Соревнования'         },
  { to: '/clans',       icon: '🛡', label: 'Кланы',      desc: 'Найти команду'        },
]

// ── Component ──────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const navigate   = useNavigate()
  const { user, token, updateUser, logout } = useUserStore()
  const setSession = useBattleStore(s => s.setSession)
  const daily      = useDailyStore()
  const unlockedAch = useAchievementsStore(s => s.unlocked)

  const [data, setData]         = useState<FullProfile | null>(null)
  const [tab,  setTab]          = useState<Tab>('history')
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [eloHistory, setEloHistory] = useState<EloPoint[]>([])
  const [eloLoading, setEloLoading] = useState(false)
  const [lbEntries, setLbEntries]   = useState<any[]>([])
  const [lbLoaded,  setLbLoaded]    = useState(false)

  // Matchmaking state
  const [inQueue,   setInQueue]   = useState(false)
  const [queueSecs, setQueueSecs] = useState(0)
  const [queueSize, setQueueSize] = useState(0)
  const [mmError,   setMmError]   = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  // Settings
  const [editBio,    setEditBio]    = useState('')
  const [editDN,     setEditDN]     = useState('')
  const [editLang,   setEditLang]   = useState('')
  const [editSkin,   setEditSkin]   = useState('')
  const [editExp,    setEditExp]    = useState('')
  const [editYears,  setEditYears]  = useState(0)
  const [editAvatar, setEditAvatar] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [saveMsg,    setSaveMsg]    = useState('')

  const AVATARS = ['🤖', '⚔️', '🥊', '🚀', '🦾', '🎮', '👾', '💻', '🧠', '🔥', '⚡', '🌀']

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    api.get<FullProfile>('/user/profile/~me/full', token)
      .then(d => {
        setData(d)
        setEditBio(d.user.bio ?? ''); setEditDN(d.user.displayName)
        setEditLang(d.user.preferredLang); setEditSkin(d.user.preferredSkin)
        setEditExp(d.user.experienceLevel); setEditYears(d.user.programmingYears)
        setEditAvatar(d.user.avatar)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [token, navigate])

  useEffect(() => {
    if (tab !== 'history' || !token || eloHistory.length > 0) return
    setEloLoading(true)
    api.get<EloPoint[]>('/elo-history/~me', token)
      .then(h => setEloHistory(h)).catch(() => {}).finally(() => setEloLoading(false))
  }, [tab, token])

  useEffect(() => {
    if (tab !== 'leaderboard' || lbLoaded) return
    api.get<any[]>('/user/profile/leaderboard')
      .then(d => { setLbEntries(d); setLbLoaded(true) })
      .catch(() => setLbLoaded(true))
  }, [tab, lbLoaded])

  const handleJoinQueue = useCallback(async () => {
    if (!user || !token || !data) return
    setMmError('')
    try {
      await api.post('/matchmaking/queue', {
        name: data.user.displayName, skin: data.user.preferredSkin,
        lang: data.user.preferredLang ?? 'auto'
      }, token)
      setInQueue(true); setQueueSecs(0)
      pollRef.current = setInterval(async () => {
        try {
          const st = await api.get<{
            inQueue: boolean; matched: boolean
            sessionId?: string; playerCode?: string
            waitSeconds?: number; queueSize?: number
          }>('/matchmaking/queue/status', token!)
          if (st.matched && st.sessionId && st.playerCode) {
            clearInterval(pollRef.current!); setInQueue(false)
            const res = await api.post<JoinSessionResponse>('/session/join', {
              sessionCode: st.playerCode, name: data.user.displayName, skin: data.user.preferredSkin,
            }, token!)
            setSession(res.sessionId, res.playerSlot, 'code', ALL_SKIN_IDS, res.wsToken, data.user.displayName, data.user.preferredSkin as SkinId)
            navigate(`/battle/${res.sessionId}`)
          } else if (st.inQueue) {
            setQueueSecs(st.waitSeconds ?? 0); setQueueSize(st.queueSize ?? 0)
          } else {
            clearInterval(pollRef.current!); setInQueue(false)
          }
        } catch { /* ignore poll errors */ }
      }, 2000)
    } catch (e) {
      setMmError(e instanceof Error ? e.message : 'Ошибка матчмейкинга')
    }
  }, [user, token, data, navigate, setSession])

  const handleLeaveQueue = useCallback(async () => {
    if (pollRef.current) clearInterval(pollRef.current)
    setInQueue(false)
    if (token) api.delete('/matchmaking/queue', token).catch(() => {})
  }, [token])

  const processImageFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) { reject(new Error('Только изображения')); return }
      const reader = new FileReader()
      reader.onload = ev => {
        const img = new Image()
        img.onload = () => {
          const SIZE = 120; const canvas = document.createElement('canvas')
          canvas.width = SIZE; canvas.height = SIZE
          const ctx = canvas.getContext('2d')!
          const side = Math.min(img.width, img.height)
          ctx.drawImage(img, (img.width-side)/2, (img.height-side)/2, side, side, 0, 0, SIZE, SIZE)
          resolve(canvas.toDataURL('image/jpeg', 0.82))
        }
        img.onerror = () => reject(new Error('Не удалось загрузить изображение'))
        img.src = ev.target!.result as string
      }
      reader.onerror = () => reject(new Error('Ошибка чтения файла'))
      reader.readAsDataURL(file)
    })

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    try { setEditAvatar(await processImageFile(file)) } catch (err: any) { setSaveMsg('❌ ' + err.message) }
    e.target.value = ''
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); if (!token) return
    setSaving(true); setSaveMsg('')
    try {
      const patch = { displayName: editDN, bio: editBio, preferredLang: editLang, preferredSkin: editSkin, experienceLevel: editExp, programmingYears: editYears, avatar: editAvatar }
      await api.patch('/user/auth/me', patch, token)
      updateUser(patch); setSaveMsg('✅ Сохранено!')
      setData(prev => prev ? { ...prev, user: { ...prev.user, ...patch } } : prev)
    } catch (e: any) { setSaveMsg('❌ ' + e.message) } finally { setSaving(false) }
  }

  const handleLogout = () => { logout(); navigate('/join') }

  if (loading) return (
    <div className={styles.loadingWrap}>
      <span className={styles.spinner}>⚙️</span><p>Загружаем профиль...</p>
    </div>
  )
  if (error || !data) return (
    <div className={styles.loadingWrap}>
      <p style={{ color: '#f87171' }}>{error || 'Ошибка загрузки'}</p>
      <Link to="/" className="btn btn-ghost" style={{ marginTop: 16 }}>← Главная</Link>
    </div>
  )

  const { user: u, stats, achievements, recentSessions, applications } = data
  const yearsLabel = u.programmingYears === 1 ? 'год' : u.programmingYears < 5 ? 'года' : 'лет'
  const ch = CHARACTER_STATS[u.preferredSkin as SkinId] ?? CHARACTER_STATS.robot

  return (
    <div className={styles.root}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>

          {/* Left: identity */}
          <div className={styles.heroLeft}>
            <div className={styles.avatarBig}>
              {u.avatar?.startsWith('data:') || u.avatar?.startsWith('/')
                ? <img src={u.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="avatar" />
                : u.avatar}
            </div>
            <div className={styles.heroInfo}>
              <h1 className={styles.displayName}>{u.displayName}</h1>
              <p className={styles.username}>@{u.username}</p>
              {u.bio && <p className={styles.bio}>{u.bio}</p>}
              {u.elo != null && <div style={{ marginBottom: 8 }}><RankBadge elo={u.elo} size="md" /></div>}
              <div className={styles.heroBadges}>
                <span className={`${styles.badge} ${styles.badgeLang}`}>💻 {LANG_LABELS[u.preferredLang] ?? u.preferredLang}</span>
                <span className={`${styles.badge} ${styles.badgeExp}`}>⚡ {EXP_LABELS[u.experienceLevel] ?? u.experienceLevel}</span>
                {u.programmingYears > 0 && (
                  <span className={`${styles.badge} ${styles.badgeYears}`}>🔥 {u.programmingYears} {yearsLabel} опыта</span>
                )}
              </div>
              <div className={styles.heroActions}>
                <Link to={`/profile/${u.username}`} className="btn btn-ghost" style={{ fontSize: 12 }}>👁 Публичный профиль</Link>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setTab('settings')}>✏️ Редактировать</button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── DASHBOARD BODY ────────────────────────────────────────────────── */}
      <div className={styles.dashboard}>

        {/* ── LEFT COLUMN ───────────────────────────────────────────────── */}
        <div className={styles.dashLeft}>

          {/* Matchmaking */}
          <div className={styles.mmCard}>
            {!inQueue ? (
              <>
                <div className={styles.mmHeader}>
                  <span className={styles.mmTitle}>⚡ Авто-матчмейкинг</span>
                  {u.elo != null && <RankBadge elo={u.elo} size="sm" />}
                </div>
                <p className={styles.mmDesc}>Система подберёт соперника по рейтингу автоматически — без кода сессии.</p>
                {mmError && <div className={styles.mmErr}>{mmError}</div>}
                <button className={styles.mmBtn} onClick={handleJoinQueue}>
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
                    : `${queueSecs}с`}
                  {queueSize > 1 && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>· {queueSize} в очереди</span>}
                </div>
                <button className="btn btn-ghost" style={{ fontSize: 12, marginTop: 8 }} onClick={handleLeaveQueue}>Отмена</button>
              </div>
            )}
          </div>

          {/* Nav grid */}
          <div className={styles.navGrid}>
            {NAV_ITEMS.map(n => (
              <Link key={n.to} to={n.to} className={styles.navCard}>
                <span className={styles.navCardIcon}>{n.icon}</span>
                <div>
                  <div className={styles.navCardLabel}>{n.label}</div>
                  <div className={styles.navCardDesc}>{n.desc}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* Tabs */}
          <div className={styles.tabsWrap}>
            <div className={styles.tabs}>
              {TABS.map(t => (
                <button key={t.id}
                  className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
                  onClick={() => setTab(t.id)}>{t.label}</button>
              ))}
            </div>

            <div className={styles.content}>

              {/* ── Battle history ───────────────────────────────────────── */}
              {tab === 'history' && (
                <div>
                  {/* ELO mini-chart */}
                  {eloLoading
                    ? <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>Загружаем...</div>
                    : eloHistory.length > 0 && <EloChart history={eloHistory} height={140} />
                  }
                  <div className={styles.historyList} style={{ marginTop: eloHistory.length ? 16 : 0 }}>
                    {recentSessions.length === 0 && (
                      <p className={styles.empty}>Ты ещё не сыграл ни одного матча. <Link to="/join">В бой! →</Link></p>
                    )}
                    {recentSessions.map(s => (
                      <div key={s.sessionId} className={`${styles.historyRow} ${s.won ? styles.historyWon : styles.historyLost}`}>
                        <span className={styles.historyResult}>{s.won ? '🏆' : '💀'}</span>
                        <div className={styles.historyInfo}>
                          <span className={styles.historyName}>{s.sessionName}</span>
                          <span className={styles.historyMeta}>
                            {SKIN_ICON[s.skin]} {s.skin} · {s.lang ? LANG_LABELS[s.lang] ?? s.lang : '—'} · {new Date(s.playedAt).toLocaleDateString('ru')}
                          </span>
                        </div>
                        <span className={styles.historyScore} style={{ color: s.won ? 'var(--accent)' : 'var(--text-muted)' }}>
                          {s.score[0]}:{s.score[1]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Achievements ─────────────────────────────────────────── */}
              {tab === 'achievements' && (
                <div>
                  <div className={styles.achSection}>
                    <div className={styles.achSectionLabel}>
                      Достижения матчей
                      <span className={styles.achCount}>{achievements.filter(a => a.unlocked).length}/{achievements.length}</span>
                    </div>
                    <div className={styles.achievementsGrid}>
                      {achievements.map(a => (
                        <div key={a.id} className={`${styles.achCard} ${a.unlocked ? styles.achUnlocked : styles.achLocked}`}>
                          <span className={styles.achIcon}>{a.unlocked ? a.icon : '🔒'}</span>
                          <div><div className={styles.achTitle}>{a.title}</div><div className={styles.achDesc}>{a.description}</div></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={styles.achSection}>
                    <div className={styles.achSectionLabel}>
                      Достижения отработки навыков
                      <span className={styles.achCount}>{unlockedAch.length}/{ACHIEVEMENTS.length}</span>
                    </div>
                    <div className={styles.achievementsGrid}>
                      {ACHIEVEMENTS.map(def => {
                        const unlocked = unlockedAch.some(ua => ua.id === def.id)
                        const isSecret = def.secret && !unlocked
                        return (
                          <div key={def.id} className={`${styles.achCard} ${unlocked ? styles.achUnlocked : styles.achLocked}`} title={isSecret ? '???' : def.desc}>
                            <span className={styles.achIcon}>{unlocked ? def.icon : isSecret ? '❓' : '🔒'}</span>
                            <div style={{ minWidth: 0 }}>
                              <div className={styles.achTitle}>{isSecret ? '???' : def.title}</div>
                              <div className={styles.achDesc}>{isSecret ? 'Секретное достижение' : def.desc}</div>
                              {unlocked && <div style={{ fontSize: 10, color: 'var(--lightning)', marginTop: 2, fontWeight: 700 }}>+{def.xp} XP</div>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {unlockedAch.length === 0 && (
                      <p className={styles.empty}>Попробуй отработку навыков → <Link to="/sparring">Открыть</Link></p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Progress ─────────────────────────────────────────────── */}
              {tab === 'progress' && (() => {
                const dbUser = data?.user as any
                const streak  = Math.max(daily.currentStreak, dbUser?.currentStreak ?? 0)
                const best    = Math.max(daily.bestStreak,    dbUser?.bestStreak ?? 0)
                const wins    = Math.max(daily.totalWins,     dbUser?.totalWins ?? 0)
                const battles = Math.max(daily.totalBattles,  dbUser?.totalBattles ?? 0)
                const xp      = Math.max(daily.totalXp,       dbUser?.totalXp ?? 0)
                return (
                  <div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                      <div className={styles.statBox} style={{ flex: 1, padding: 20, textAlign: 'center' }}>
                        <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 6 }}>{streak === 0 ? '🌑' : streak < 7 ? '🔥' : '⚡🔥⚡'}</div>
                        <div style={{ fontSize: 32, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: streak > 0 ? 'var(--fire2)' : 'var(--text-muted)' }}>{streak}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 4 }}>
                          {streak === 0 ? 'серия прервана' : 'побед подряд'}
                        </div>
                      </div>
                      <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                          { label: 'Лучшая серия', val: best,    color: 'var(--gold)'      },
                          { label: 'Всего побед',  val: wins,    color: 'var(--accent)'    },
                          { label: 'Всего боёв',   val: battles, color: 'var(--text)'      },
                          { label: 'Всего XP',     val: xp,      color: 'var(--lightning)' },
                        ].map(({ label, val, color }) => (
                          <div key={label} style={{ flex: 1, padding: '8px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                            <span style={{ fontSize: 18, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {[3, 7, 14, 30].map(m => {
                        const reached = best >= m
                        return (
                          <div key={m} style={{ padding: '10px 6px', background: reached ? 'rgba(255,229,102,.06)' : 'var(--bg-card)', border: `1px solid ${reached ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 'var(--radius)', textAlign: 'center', opacity: reached ? 1 : 0.5 }}>
                            <div style={{ fontSize: 16 }}>{reached ? '✅' : '🔒'}</div>
                            <div style={{ fontSize: 20, fontWeight: 900 }}>{m}</div>
                            <div style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--text-muted)' }}>побед подряд</div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lightning)', marginTop: 2 }}>
                              {m === 3 ? '+150 XP' : m === 7 ? '+400 XP' : m === 14 ? '+1000 XP' : '🏆 Легенда'}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ marginTop: 14, textAlign: 'center' }}>
                      <Link to="/daily" className="btn btn-primary">📅 Ежедневные задания →</Link>
                    </div>
                  </div>
                )
              })()}

              {/* ── Leaderboard ──────────────────────────────────────────── */}
              {tab === 'leaderboard' && (
                <div>
                  {!lbLoaded ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>Загружаем...</div>
                  ) : lbEntries.length === 0 ? (
                    <p className={styles.empty}>Нет данных</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {/* header */}
                      <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 80px 60px', padding: '6px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                        <span>#</span><span>Боец</span><span style={{ textAlign: 'right' }}>Рейтинг</span><span style={{ textAlign: 'right' }}>Побед</span>
                      </div>
                      {lbEntries.map((p: any, i: number) => {
                        const isMe = p.username === user?.username
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`
                        return (
                          <div key={p.username} style={{
                            display: 'grid', gridTemplateColumns: '36px 1fr 80px 60px',
                            padding: '8px 10px', borderRadius: 8, alignItems: 'center', gap: 4,
                            background: isMe ? 'rgba(0,229,255,.06)' : i % 2 === 0 ? 'var(--bg-mid)' : 'transparent',
                            border: isMe ? '1px solid rgba(0,229,255,.2)' : '1px solid transparent',
                          }}>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{medal}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              <span style={{ fontSize: 20, flexShrink: 0 }}>
                                {p.avatar?.startsWith('data:') || p.avatar?.startsWith('/')
                                  ? <img src={p.avatar} style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', verticalAlign: 'middle' }} alt="" />
                                  : p.avatar}
                              </span>
                              <span style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p.displayName || p.username}
                                {isMe && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>ты</span>}
                              </span>
                            </span>
                            <span style={{ textAlign: 'right', color: 'var(--lightning)', fontWeight: 800, fontSize: 14 }}>{p.elo ?? 1000}</span>
                            <span style={{ textAlign: 'right', color: '#fbbf24', fontWeight: 700 }}>{p.wins}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div style={{ marginTop: 16, textAlign: 'center' }}>
                    <Link to="/leaderboard" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>Открыть полную таблицу →</Link>
                  </div>
                </div>
              )}

              {/* ── Settings ─────────────────────────────────────────────── */}
              {tab === 'settings' && (
                <form onSubmit={handleSave} className={styles.settingsForm}>
                  <div className={styles.settingsSection}>
                    <h3 className={styles.sectionTitle}>Аватар</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-mid)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, overflow: 'hidden', flexShrink: 0 }}>
                        {editAvatar?.startsWith('data:') || editAvatar?.startsWith('/')
                          ? <img src={editAvatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="preview" />
                          : editAvatar}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label className="btn btn-ghost" style={{ fontSize: 12, cursor: 'pointer', display: 'inline-block' }}>
                          📷 Загрузить фото
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarFile} />
                        </label>
                        {(editAvatar?.startsWith('data:') || editAvatar?.startsWith('/')) && (
                          <button type="button" className="btn btn-ghost" style={{ fontSize: 11, color: '#f87171' }} onClick={() => setEditAvatar('🤖')}>× Удалить фото</button>
                        )}
                      </div>
                    </div>
                    <div className={styles.avatarGrid}>
                      {AVATARS.map(a => (
                        <button key={a} type="button"
                          className={`${styles.avatarBtn} ${editAvatar === a ? styles.avatarActive : ''}`}
                          onClick={() => setEditAvatar(a)}>{a}</button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.settingsSection}>
                    <h3 className={styles.sectionTitle}>Профиль</h3>
                    <div className={styles.settingsGrid}>
                      <div className={styles.settingsField}>
                        <label className={styles.settingsLabel}>Имя на арене</label>
                        <input className={styles.settingsInput} value={editDN} onChange={e => setEditDN(e.target.value)} maxLength={30} required />
                      </div>
                      <div className={styles.settingsField}>
                        <label className={styles.settingsLabel}>О себе</label>
                        <textarea className={styles.settingsTextarea} value={editBio} onChange={e => setEditBio(e.target.value)} rows={3} maxLength={300} placeholder="Расскажи о себе..." />
                      </div>
                    </div>
                  </div>

                  <div className={styles.settingsSection}>
                    <h3 className={styles.sectionTitle}>Предпочтения</h3>
                    <div className={styles.settingsRow}>
                      <div className={styles.settingsField}>
                        <label className={styles.settingsLabel}>Язык</label>
                        <select className={styles.settingsSelect} value={editLang} onChange={e => setEditLang(e.target.value)}>
                          <option value="js">JavaScript</option><option value="py">Python</option>
                          <option value="cpp">C++</option><option value="java">Java</option>
                        </select>
                      </div>
                      <div className={styles.settingsField}>
                        <label className={styles.settingsLabel}>Уровень</label>
                        <select className={styles.settingsSelect} value={editExp} onChange={e => setEditExp(e.target.value)}>
                          <option value="beginner">Начинающий</option>
                          <option value="intermediate">Средний</option>
                          <option value="advanced">Продвинутый</option>
                        </select>
                      </div>
                      <div className={styles.settingsField}>
                        <label className={styles.settingsLabel}>Лет опыта</label>
                        <input className={styles.settingsInput} type="number" min={0} max={40} value={editYears} onChange={e => setEditYears(Number(e.target.value))} />
                      </div>
                      <div className={styles.settingsField}>
                        <label className={styles.settingsLabel}>Боец</label>
                        <select className={styles.settingsSelect} value={editSkin} onChange={e => setEditSkin(e.target.value)}>
                          {ALL_SKIN_IDS_TYPED.map(id => (
                            <option key={id} value={id}>{SKIN_ICON[id]} {CHARACTER_STATS[id].name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className={styles.settingsActions}>
                    {saveMsg && <span className={styles.saveMsg}>{saveMsg}</span>}
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? '⏳ Сохраняем...' : '💾 Сохранить'}
                    </button>
                  </div>

                  <div className={`${styles.settingsSection} ${styles.dangerZone}`}>
                    <h3 className={styles.sectionTitle}>Опасная зона</h3>
                    <p className={styles.dangerDesc}>Выход завершит текущую сессию.</p>
                    <button type="button" className="btn btn-danger" style={{ fontSize: 13 }} onClick={handleLogout}>Выйти из аккаунта</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ─────────────────────────────────────────────── */}
        <div className={styles.dashRight}>

          {/* Stats card */}
          <div className={styles.statsCard}>
            <div className={styles.statsCardTitle}>Статистика</div>
            <div className={styles.statsGrid}>
              {u.elo != null && (
                <div className={styles.statItem}>
                  <span className={styles.statItemVal} style={{ color: 'var(--lightning)' }}>{u.elo}</span>
                  <span className={styles.statItemLbl}>Рейтинг</span>
                </div>
              )}
              <div className={styles.statItem}>
                <span className={styles.statItemVal} style={{ color: 'var(--text)' }}>{stats.sessionsPlayed}</span>
                <span className={styles.statItemLbl}>Матчей</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statItemVal} style={{ color: 'var(--accent)' }}>{stats.sessionsWon}</span>
                <span className={styles.statItemLbl}>Побед</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statItemVal} style={{ color: 'var(--gold)' }}>{stats.winRate}%</span>
                <span className={styles.statItemLbl}>Винрейт</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statItemVal} style={{ color: 'var(--text-muted)' }}>{stats.battlesPlayed}</span>
                <span className={styles.statItemLbl}>Раундов</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statItemVal} style={{ color: 'var(--fire2)' }}>{stats.tournamentsEntered}</span>
                <span className={styles.statItemLbl}>Турниров</span>
              </div>
            </div>
          </div>

          {/* Fighter card */}
          <div className={styles.fighterCard}>
            <div className={styles.statsCardTitle}>Мой боец</div>
            <div className={styles.fighterView}>
              <CharacterView skinId={u.preferredSkin} style={{ width: '100%', height: '100%' }} />
            </div>
            <CharacterCard skinId={u.preferredSkin} />
          </div>

          {/* Tournaments shortlist */}
          {applications.length > 0 && (
            <div className={styles.statsCard}>
              <div className={styles.statsCardTitle}>Мои турниры</div>
              {applications.slice(0, 3).map(app => (
                <div key={app.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <Link to={`/tournaments/${app.tournament.id}`} style={{ color: 'var(--text)', textDecoration: 'none', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{app.tournament.name}</Link>
                  <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[app.status], flexShrink: 0, marginLeft: 8 }}>{STATUS_LABELS[app.status] ?? app.status}</span>
                </div>
              ))}
              <Link to="/tournaments" style={{ display: 'block', marginTop: 10, fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>Все турниры →</Link>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
