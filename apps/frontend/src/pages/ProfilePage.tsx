import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useUserStore } from '../stores/userStore'
import { useDailyStore } from '../stores/dailyStore'
import { useAchievementsStore, ACHIEVEMENTS } from '../stores/achievementsStore'
import { SKIN_ICON, CHARACTER_STATS } from '@robocode/shared'
import type { SkinId } from '@robocode/shared'
import CharacterCard from '../components/CharacterCard/CharacterCard'
import CharacterView from '../animation/CharacterView'
import RankBadge from '../components/RankBadge'
import EloChart from '../components/EloChart'
import styles from './ProfilePage.module.css'

// ── Types ──────────────────────────────────────────────────────────────────
interface Stats {
  sessionsPlayed: number
  sessionsWon: number
  winRate: number
  battlesPlayed: number
  langsUsed: string[]
  tournamentsEntered: number
  tournamentsWon: number
  favoriteSkin: string
  favoritelang: string
}

interface Achievement {
  id: string; icon: string; title: string; description: string; unlocked: boolean
}

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
  stats: Stats
  achievements: Achievement[]
  recentSessions: RecentSession[]
  applications: Application[]
}

// ── Helpers ────────────────────────────────────────────────────────────────
const LANG_LABELS: Record<string, string> = { js: 'JavaScript', py: 'Python', cpp: 'C++', java: 'Java' }
const EXP_LABELS: Record<string, string>  = { beginner: 'Начинающий', intermediate: 'Средний', advanced: 'Продвинутый' }
const STATUS_LABELS: Record<string, string> = { PENDING: 'На рассмотрении', APPROVED: 'Одобрено', REJECTED: 'Отклонено' }
const ALL_SKIN_IDS = Object.keys(CHARACTER_STATS) as SkinId[]
const STATUS_COLORS: Record<string, string> = { PENDING: '#facc15', APPROVED: '#4ade80', REJECTED: '#f87171' }

interface EloPoint {
  elo: number; delta: number; won: boolean; createdAt: string
  opponent?: { displayName: string; username: string } | null
}

type Tab = 'achievements' | 'progress' | 'history' | 'tournaments' | 'rating' | 'settings'
const TABS: { id: Tab; label: string }[] = [
  { id: 'achievements', label: '🏅 Достижения' },
  { id: 'progress',     label: '🔥 Прогресс'   },
  { id: 'history',      label: '⚔️ История'     },
  { id: 'tournaments',  label: '🏆 Турниры'     },
  { id: 'rating',       label: '📈 Рейтинг'     },
  { id: 'settings',     label: '⚙️ Настройки'  },
]

// ── Component ──────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, token, updateUser, logout } = useUserStore()
  const daily = useDailyStore()
  const unlockedAch = useAchievementsStore(s => s.unlocked)
  const [data, setData]           = useState<FullProfile | null>(null)
  const [tab,  setTab]            = useState<Tab>('achievements')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [eloHistory, setEloHistory] = useState<EloPoint[]>([])
  const [eloLoading, setEloLoading] = useState(false)

  // Settings edit state
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

  const processImageFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) { reject(new Error('Только изображения')); return }
      const reader = new FileReader()
      reader.onload = ev => {
        const img = new Image()
        img.onload = () => {
          const SIZE = 120
          const canvas = document.createElement('canvas')
          canvas.width = SIZE; canvas.height = SIZE
          const ctx = canvas.getContext('2d')!
          const side = Math.min(img.width, img.height)
          const sx = (img.width - side) / 2
          const sy = (img.height - side) / 2
          ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE)
          resolve(canvas.toDataURL('image/jpeg', 0.82))
        }
        img.onerror = () => reject(new Error('Не удалось загрузить изображение'))
        img.src = ev.target!.result as string
      }
      reader.onerror = () => reject(new Error('Ошибка чтения файла'))
      reader.readAsDataURL(file)
    })

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await processImageFile(file)
      setEditAvatar(dataUrl)
    } catch (err: any) {
      setSaveMsg('❌ ' + err.message)
    }
    e.target.value = ''
  }

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    api.get<FullProfile>('/user/profile/~me/full', token)
      .then(d => {
        setData(d)
        setEditBio(d.user.bio ?? '')
        setEditDN(d.user.displayName)
        setEditLang(d.user.preferredLang)
        setEditSkin(d.user.preferredSkin)
        setEditExp(d.user.experienceLevel)
        setEditYears(d.user.programmingYears)
        setEditAvatar(d.user.avatar)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [token, navigate])

  useEffect(() => {
    if (tab !== 'rating' || !token || eloHistory.length > 0) return
    setEloLoading(true)
    api.get<EloPoint[]>('/elo-history/~me', token)
      .then(h => setEloHistory(h))
      .catch(() => {})
      .finally(() => setEloLoading(false))
  }, [tab, token])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSaving(true)
    setSaveMsg('')
    try {
      const patch = { displayName: editDN, bio: editBio, preferredLang: editLang, preferredSkin: editSkin, experienceLevel: editExp, programmingYears: editYears, avatar: editAvatar }
      await api.patch('/user/auth/me', patch, token)
      updateUser(patch)
      setSaveMsg('✅ Сохранено!')
      setData(prev => prev ? { ...prev, user: { ...prev.user, ...patch } } : prev)
    } catch (e: any) {
      setSaveMsg('❌ ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // Fix #3: logout moved to settings — only called from there
  const handleLogout = () => {
    logout()
    navigate('/join')
  }

  if (loading) return (
    <div className={styles.loadingWrap}>
      <span className={styles.spinner}>⚙️</span>
      <p>Загружаем профиль...</p>
    </div>
  )

  if (error || !data) return (
    <div className={styles.loadingWrap}>
      <p style={{ color: '#f87171' }}>{error || 'Ошибка загрузки'}</p>
      <Link to="/join" className="btn btn-ghost" style={{ marginTop: 16 }}>← Главная</Link>
    </div>
  )

  const { user: u, stats, achievements, recentSessions, applications } = data
  const yearsLabel = u.programmingYears === 1 ? 'год' : u.programmingYears < 5 ? 'года' : 'лет'

  return (
    <div className={styles.root}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>

          {/* Fix #5: avatar with fixed container */}
          <div className={styles.avatarBig}>
            {u.avatar?.startsWith('data:') || u.avatar?.startsWith('/')
              ? <img src={u.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="avatar" />
              : u.avatar
            }
          </div>

          <div className={styles.heroInfo}>
            {/* Fix #2: displayName now uses grad-text */}
            <h1 className={styles.displayName}>{u.displayName}</h1>
            <p className={styles.username}>@{u.username}</p>
            {u.bio && <p className={styles.bio}>{u.bio}</p>}

            {/* ELO rank badge */}
            {u.elo != null && (
              <div style={{ marginBottom: 8 }}>
                <RankBadge elo={u.elo} size="md" />
              </div>
            )}

            {/* Fix #9: colour-coded badges */}
            <div className={styles.heroBadges}>
              <span className={`${styles.badge} ${styles.badgeLang}`}>
                💻 {LANG_LABELS[u.preferredLang] ?? u.preferredLang}
              </span>
              <span className={`${styles.badge} ${styles.badgeExp}`}>
                ⚡ {EXP_LABELS[u.experienceLevel] ?? u.experienceLevel}
              </span>
              {u.programmingYears > 0 && (
                <span className={`${styles.badge} ${styles.badgeYears}`}>
                  🔥 {u.programmingYears} {yearsLabel} опыта
                </span>
              )}
              <span className={`${styles.badge} ${styles.badgeSkin}`}>
                {SKIN_ICON[u.preferredSkin]} {u.preferredSkin}
              </span>
            </div>
          </div>

          {/* Fix #3: hero shows only safe navigation — no logout here */}
          <div className={styles.heroActions}>
            <Link to={`/profile/${u.username}`} className="btn btn-ghost" style={{ fontSize: 13 }}>
              👁 Публичный профиль
            </Link>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 13 }}
              onClick={() => setTab('settings')}
            >
              ✏️ Редактировать
            </button>
          </div>

          {/* Character animation preview */}
          <div className={styles.heroChar}>
            <CharacterView skinId={u.preferredSkin} className={styles.heroCharView} />
          </div>
        </div>
      </div>

      {/* ── Quick stats ───────────────────────────────────────────────────── */}
      {/* Fix #8: semantic colours — wins=green, winrate=gold, rounds=muted, tournaments=fire */}
      <div className={styles.quickStats}>
        {u.elo != null && (
          <div className={styles.statBox}>
            <span className={`${styles.statVal}`} style={{ color: 'var(--lightning)' }}>{u.elo}</span>
            <span className={styles.statLbl}>ELO</span>
          </div>
        )}
        <div className={styles.statBox}>
          <span className={`${styles.statVal} ${styles.statValMuted}`}>{stats.sessionsPlayed}</span>
          <span className={styles.statLbl}>Матчей</span>
        </div>
        <div className={styles.statBox}>
          <span className={`${styles.statVal} ${styles.statValGreen}`}>{stats.sessionsWon}</span>
          <span className={styles.statLbl}>Побед</span>
        </div>
        <div className={styles.statBox}>
          <span className={`${styles.statVal} ${styles.statValGold}`}>{stats.winRate}%</span>
          <span className={styles.statLbl}>Винрейт</span>
        </div>
        <div className={styles.statBox}>
          <span className={`${styles.statVal} ${styles.statValMuted}`}>{stats.battlesPlayed}</span>
          <span className={styles.statLbl}>Раундов</span>
        </div>
        <div className={styles.statBox}>
          <span className={`${styles.statVal} ${styles.statValFire}`}>{stats.tournamentsEntered}</span>
          <span className={styles.statLbl}>Турниров</span>
        </div>
      </div>

      {/* ── Fix #7: 5 tabs instead of 6 ──────────────────────────────────── */}
      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>

        {/* ── Fix #1: Достижения — merged DB + local into one tab ────────── */}
        {tab === 'achievements' && (
          <div>
            {/* Server achievements */}
            <div className={styles.achSection}>
              <div className={styles.achSectionLabel}>
                Достижения матчей
                <span className={styles.achCount}>
                  {achievements.filter(a => a.unlocked).length}/{achievements.length}
                </span>
              </div>
              <div className={styles.achievementsGrid}>
                {achievements.map(a => (
                  <div key={a.id} className={`${styles.achCard} ${a.unlocked ? styles.achUnlocked : styles.achLocked}`}>
                    <span className={styles.achIcon}>{a.unlocked ? a.icon : '🔒'}</span>
                    <div>
                      <div className={styles.achTitle}>{a.title}</div>
                      <div className={styles.achDesc}>{a.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Local (sparring) achievements */}
            <div className={styles.achSection}>
              <div className={styles.achSectionLabel}>
                Достижения спарринга
                <span className={styles.achCount}>
                  {unlockedAch.length}/{ACHIEVEMENTS.length}
                </span>
              </div>
              <div className={styles.achievementsGrid}>
                {ACHIEVEMENTS.map(def => {
                  const unlocked = unlockedAch.some(u => u.id === def.id)
                  const isSecret = def.secret && !unlocked
                  return (
                    <div
                      key={def.id}
                      className={`${styles.achCard} ${unlocked ? styles.achUnlocked : styles.achLocked}`}
                      title={isSecret ? '???' : def.desc}
                    >
                      <span className={styles.achIcon}>
                        {unlocked ? def.icon : isSecret ? '❓' : '🔒'}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className={styles.achTitle}>{isSecret ? '???' : def.title}</div>
                        <div className={styles.achDesc}>{isSecret ? 'Секретное достижение' : def.desc}</div>
                        {unlocked && (
                          <div style={{ fontSize: 10, color: 'var(--lightning)', marginTop: 2, fontWeight: 700 }}>
                            +{def.xp} XP
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              {unlockedAch.length === 0 && (
                <p className={styles.empty}>
                  Сыграй в Спарринге, чтобы разблокировать достижения →{' '}
                  <Link to="/sparring">Открыть спарринг</Link>
                </p>
              )}
            </div>

            {/* My fighter section */}
            <div style={{ marginTop: 8 }}>
              <div className={styles.achSectionLabel}>Мой боец</div>
              <div className={styles.myFighter}>
                <div className={styles.myFighterChar}>
                  <CharacterView skinId={u.preferredSkin} className={styles.myFighterView} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <CharacterCard skinId={u.preferredSkin} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Progress tab ───────────────────────────────────────────────── */}
        {tab === 'progress' && (() => {
          const dbUser = data?.user as any
          const streak  = Math.max(daily.currentStreak, dbUser?.currentStreak  ?? 0)
          const best    = Math.max(daily.bestStreak,    dbUser?.bestStreak     ?? 0)
          const wins    = Math.max(daily.totalWins,     dbUser?.totalWins      ?? 0)
          const battles = Math.max(daily.totalBattles,  dbUser?.totalBattles   ?? 0)
          const xp      = Math.max(daily.totalXp,       dbUser?.totalXp        ?? 0)
          const synced  = !!(dbUser?.currentStreak !== undefined)
          return (
            <div>
              {synced && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                  <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 700, padding: '2px 8px', background: 'rgba(74,222,128,.1)', borderRadius: 99, border: '1px solid rgba(74,222,128,.3)' }}>
                    ☁️ синхронизировано с сервером
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div className={styles.statBox} style={{ flex: 1, padding: 20, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', textAlign: 'center', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 8 }}>
                    {streak === 0 ? '🌑' : streak < 3 ? '🔥' : streak < 7 ? '🔥' : '⚡🔥⚡'}
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: streak > 0 ? 'var(--fire2)' : 'var(--text-muted)' }}>{streak}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 4 }}>
                    {streak === 0 ? 'серия прервана' : `${streak} побед подряд`}
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Лучшая серия', val: best,    color: 'var(--gold)'      },
                    { label: 'Всего побед',  val: wins,    color: 'var(--accent)'    },
                    { label: 'Всего боёв',   val: battles, color: 'var(--text)'      },
                    /* Fix #6: XP uses --lightning instead of hardcoded purple */
                    { label: 'Всего XP',     val: xp,      color: 'var(--lightning)' },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ flex: 1, padding: '8px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[3, 7, 14, 30].map(m => {
                  const reached = best >= m
                  return (
                    <div key={m} style={{ padding: '12px 8px', background: reached ? 'rgba(255,229,102,.06)' : 'var(--bg-card)', border: `1px solid ${reached ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 'var(--radius)', textAlign: 'center', opacity: reached ? 1 : 0.5, transition: 'all .2s' }}>
                      <div style={{ fontSize: 18 }}>{reached ? '✅' : '🔒'}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{m}</div>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)' }}>побед подряд</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lightning)', marginTop: 2 }}>
                        {m === 3 ? '+150 XP' : m === 7 ? '+400 XP' : m === 14 ? '+1000 XP' : '🏆 Легенда'}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <Link to="/daily" className="btn btn-primary">📅 Ежедневные задания →</Link>
              </div>
            </div>
          )
        })()}

        {/* ── Battle history ──────────────────────────────────────────────── */}
        {tab === 'history' && (
          <div className={styles.historyList}>
            {recentSessions.length === 0 && (
              <p className={styles.empty}>
                Ты ещё не сыграл ни одного матча.{' '}
                <Link to="/join">Вперёд в бой! →</Link>
              </p>
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
        )}

        {/* ── Tournaments ─────────────────────────────────────────────────── */}
        {tab === 'tournaments' && (
          <div className={styles.historyList}>
            {applications.length === 0 && (
              <p className={styles.empty}>
                Ты ещё не подавал заявки на турниры.{' '}
                <Link to="/tournaments">Посмотреть турниры →</Link>
              </p>
            )}
            {applications.map(app => (
              <div key={app.id} className={styles.appRow}>
                <div className={styles.appInfo}>
                  <Link to={`/tournaments/${app.tournament.id}`} className={styles.appTournName}>
                    {app.tournament.name}
                  </Link>
                  <span className={styles.appMeta}>
                    {new Date(app.tournament.startDate).toLocaleDateString('ru')} · Подана {new Date(app.createdAt).toLocaleDateString('ru')}
                  </span>
                  {app.note && <span className={styles.appNote}>Примечание: {app.note}</span>}
                </div>
                <span className={styles.appStatus} style={{ color: STATUS_COLORS[app.status] }}>
                  {STATUS_LABELS[app.status] ?? app.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Rating / ELO History ───────────────────────────────────────── */}
        {tab === 'rating' && (
          <div>
            {u.elo != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <RankBadge elo={u.elo} size="lg" />
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  Текущий рейтинг ELO
                </div>
              </div>
            )}
            {eloLoading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Загружаем...</div>
            ) : (
              <EloChart history={eloHistory} height={180} />
            )}
            {eloHistory.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Последние изменения ELO
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[...eloHistory].reverse().slice(0, 10).map((h, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '8px 12px',
                    }}>
                      <span style={{ fontSize: 16 }}>{h.won ? '✅' : '❌'}</span>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{h.elo} ELO</span>
                        {h.opponent && (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                            vs {h.opponent.displayName}
                          </span>
                        )}
                      </div>
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        color: h.delta >= 0 ? '#4ade80' : '#f87171',
                      }}>
                        {h.delta >= 0 ? '+' : ''}{h.delta}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 60, textAlign: 'right' }}>
                        {new Date(h.createdAt).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Settings ──────────────────────────────────────────────────────── */}
        {tab === 'settings' && (
          <form onSubmit={handleSave} className={styles.settingsForm}>

            {/* Avatar */}
            <div className={styles.settingsSection}>
              <h3 className={styles.sectionTitle}>Аватар</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--bg-mid)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, overflow: 'hidden', flexShrink: 0 }}>
                  {editAvatar?.startsWith('data:') || editAvatar?.startsWith('/')
                    ? <img src={editAvatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="preview" />
                    : editAvatar
                  }
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label className="btn btn-ghost" style={{ fontSize: 12, cursor: 'pointer', display: 'inline-block' }}>
                    📷 Загрузить фото
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarFile} />
                  </label>
                  {(editAvatar?.startsWith('data:') || editAvatar?.startsWith('/')) && (
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 11, color: '#f87171' }} onClick={() => setEditAvatar('🤖')}>
                      × Удалить фото
                    </button>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Или выберите эмодзи:
              </div>
              <div className={styles.avatarGrid}>
                {AVATARS.map(a => (
                  <button key={a} type="button"
                    className={`${styles.avatarBtn} ${editAvatar === a ? styles.avatarActive : ''}`}
                    onClick={() => setEditAvatar(a)}>{a}</button>
                ))}
              </div>
            </div>

            {/* Profile info */}
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

            {/* Preferences */}
            <div className={styles.settingsSection}>
              <h3 className={styles.sectionTitle}>Предпочтения</h3>
              <div className={styles.settingsRow}>
                <div className={styles.settingsField}>
                  <label className={styles.settingsLabel}>Язык программирования</label>
                  <select className={styles.settingsSelect} value={editLang} onChange={e => setEditLang(e.target.value)}>
                    <option value="js">JavaScript</option>
                    <option value="py">Python</option>
                    <option value="cpp">C++</option>
                    <option value="java">Java</option>
                  </select>
                </div>
                <div className={styles.settingsField}>
                  <label className={styles.settingsLabel}>Уровень опыта</label>
                  <select className={styles.settingsSelect} value={editExp} onChange={e => setEditExp(e.target.value)}>
                    <option value="beginner">Начинающий</option>
                    <option value="intermediate">Средний</option>
                    <option value="advanced">Продвинутый</option>
                  </select>
                </div>
                <div className={styles.settingsField}>
                  <label className={styles.settingsLabel}>Лет программирования</label>
                  <input className={styles.settingsInput} type="number" min={0} max={40} value={editYears} onChange={e => setEditYears(Number(e.target.value))} />
                </div>
                <div className={styles.settingsField}>
                  <label className={styles.settingsLabel}>Любимый боец</label>
                  <select className={styles.settingsSelect} value={editSkin} onChange={e => setEditSkin(e.target.value)}>
                    {ALL_SKIN_IDS.map(id => (
                      <option key={id} value={id}>{SKIN_ICON[id]} {CHARACTER_STATS[id].name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Save */}
            <div className={styles.settingsActions}>
              {saveMsg && <span className={styles.saveMsg}>{saveMsg}</span>}
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? '⏳ Сохраняем...' : '💾 Сохранить изменения'}
              </button>
            </div>

            {/* Fix #3: Logout moved to settings — danger zone */}
            <div className={`${styles.settingsSection} ${styles.dangerZone}`}>
              <h3 className={styles.sectionTitle}>Опасная зона</h3>
              <p className={styles.dangerDesc}>
                Выход завершит текущую сессию. Несохранённый прогресс будет потерян.
              </p>
              <button
                type="button"
                className="btn btn-danger"
                style={{ fontSize: 13 }}
                onClick={handleLogout}
              >
                Выйти из аккаунта
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
