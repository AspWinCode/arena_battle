import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useUserStore } from '../stores/userStore'
import { useDailyStore } from '../stores/dailyStore'
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
  user: { id: string; email: string; username: string; displayName: string; avatar: string; bio: string | null; preferredLang: string; preferredSkin: string; experienceLevel: string; programmingYears: number; createdAt: string }
  stats: Stats
  achievements: Achievement[]
  recentSessions: RecentSession[]
  applications: Application[]
}

// ── Helpers ────────────────────────────────────────────────────────────────
const LANG_LABELS: Record<string, string> = { js: 'JavaScript', py: 'Python', cpp: 'C++', java: 'Java' }
const EXP_LABELS: Record<string, string> = { beginner: 'Начинающий', intermediate: 'Средний', advanced: 'Продвинутый' }
const SKIN_ICONS: Record<string, string> = { robot: '🤖', gladiator: '⚔️', boxer: '🥊', cosmonaut: '🚀' }
const STATUS_LABELS: Record<string, string> = { PENDING: 'На рассмотрении', APPROVED: 'Одобрено', REJECTED: 'Отклонено' }
const STATUS_COLORS: Record<string, string> = { PENDING: '#facc15', APPROVED: '#4ade80', REJECTED: '#f87171' }

// ── Component ──────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, token, updateUser, logout } = useUserStore()
  const daily = useDailyStore()
  const [data, setData]       = useState<FullProfile | null>(null)
  const [tab,  setTab]        = useState<'stats' | 'progress' | 'history' | 'tournaments' | 'settings'>('stats')
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  // Settings edit state
  const [editBio,   setEditBio]   = useState('')
  const [editDN,    setEditDN]    = useState('')
  const [editLang,  setEditLang]  = useState('')
  const [editSkin,  setEditSkin]  = useState('')
  const [editExp,   setEditExp]   = useState('')
  const [editYears, setEditYears] = useState(0)
  const [editAvatar,setEditAvatar]= useState('')
  const [saving, setSaving]       = useState(false)
  const [saveMsg, setSaveMsg]     = useState('')

  const AVATARS = ['🤖', '⚔️', '🥊', '🚀', '🦾', '🎮', '👾', '💻', '🧠', '🔥', '⚡', '🌀']

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

  return (
    <div className={styles.root}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.avatarBig}>{u.avatar}</div>
          <div className={styles.heroInfo}>
            <h1 className={styles.displayName}>{u.displayName}</h1>
            <p className={styles.username}>@{u.username}</p>
            {u.bio && <p className={styles.bio}>{u.bio}</p>}
            <div className={styles.heroBadges}>
              <span className={styles.badge}>{LANG_LABELS[u.preferredLang] ?? u.preferredLang}</span>
              <span className={styles.badge}>{EXP_LABELS[u.experienceLevel] ?? u.experienceLevel}</span>
              {u.programmingYears > 0 && <span className={styles.badge}>{u.programmingYears} {u.programmingYears === 1 ? 'год' : u.programmingYears < 5 ? 'года' : 'лет'} опыта</span>}
              <span className={styles.badge}>{SKIN_ICONS[u.preferredSkin]} {u.preferredSkin}</span>
            </div>
          </div>
          <div className={styles.heroActions}>
            <Link to={`/profile/${u.username}`} className="btn btn-ghost" style={{ fontSize: 13 }}>👁 Публичный профиль</Link>
            <button className="btn btn-ghost" style={{ fontSize: 13, color: '#f87171', borderColor: 'rgba(248,113,113,.3)' }} onClick={handleLogout}>Выйти</button>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className={styles.quickStats}>
        <div className={styles.statBox}><span className={styles.statVal}>{stats.sessionsPlayed}</span><span className={styles.statLbl}>Матчей</span></div>
        <div className={styles.statBox}><span className={styles.statVal}>{stats.sessionsWon}</span><span className={styles.statLbl}>Побед</span></div>
        <div className={styles.statBox}><span className={styles.statVal}>{stats.winRate}%</span><span className={styles.statLbl}>Винрейт</span></div>
        <div className={styles.statBox}><span className={styles.statVal}>{stats.battlesPlayed}</span><span className={styles.statLbl}>Раундов</span></div>
        <div className={styles.statBox}><span className={styles.statVal}>{stats.tournamentsEntered}</span><span className={styles.statLbl}>Турниров</span></div>
        <div className={styles.statBox}><span className={styles.statVal}>{stats.tournamentsWon}</span><span className={styles.statLbl}>🏆 Выиграно</span></div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {(['stats', 'progress', 'history', 'tournaments', 'settings'] as const).map(t => (
          <button key={t} className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`} onClick={() => setTab(t)}>
            {{ stats: '📊 Статистика', progress: '🔥 Прогресс', history: '⚔️ История', tournaments: '🏆 Турниры', settings: '⚙️ Настройки' }[t]}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {/* ── Stats / Achievements tab ── */}
        {tab === 'stats' && (
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
        )}

        {/* ── Local Progress tab ── */}
        {tab === 'progress' && (
          <div>
            {/* Streak */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div className={styles.statBox} style={{ flex: 1, padding: 20, background: 'var(--bg-mid)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 8 }}>
                  {daily.currentStreak === 0 ? '🌑' : daily.currentStreak < 3 ? '🔥' : daily.currentStreak < 7 ? '🔥' : '⚡🔥⚡'}
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{daily.currentStreak}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  {daily.currentStreak === 0 ? 'серия прервана' : `${daily.currentStreak} побед подряд`}
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Лучшая серия',  val: daily.bestStreak,   color: '#fbbf24' },
                  { label: 'Всего побед',   val: daily.totalWins,    color: '#4ade80' },
                  { label: 'Всего боёв',    val: daily.totalBattles, color: 'var(--text)' },
                  { label: 'Всего XP',      val: daily.totalXp,      color: '#a78bfa' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ flex: 1, padding: '8px 14px', background: 'var(--bg-mid)', borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Milestone badges */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[3, 7, 14, 30].map(m => {
                const reached = daily.bestStreak >= m
                return (
                  <div key={m} style={{ padding: '12px 8px', background: reached ? 'rgba(251,191,36,.06)' : 'var(--bg-mid)', border: `1px solid ${reached ? '#fbbf24' : 'var(--border)'}`, borderRadius: 'var(--radius)', textAlign: 'center', opacity: reached ? 1 : 0.5, transition: 'all .2s' }}>
                    <div style={{ fontSize: 18 }}>{reached ? '✅' : '🔒'}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{m}</div>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)' }}>побед подряд</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', marginTop: 2 }}>
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
        )}

        {/* ── Battle history tab ── */}
        {tab === 'history' && (
          <div className={styles.historyList}>
            {recentSessions.length === 0 && (
              <p className={styles.empty}>Ты ещё не сыграл ни одного матча. <Link to="/join">Вперёд в бой! →</Link></p>
            )}
            {recentSessions.map(s => (
              <div key={s.sessionId} className={`${styles.historyRow} ${s.won ? styles.historyWon : styles.historyLost}`}>
                <span className={styles.historyResult}>{s.won ? '🏆' : '💀'}</span>
                <div className={styles.historyInfo}>
                  <span className={styles.historyName}>{s.sessionName}</span>
                  <span className={styles.historyMeta}>{SKIN_ICONS[s.skin]} {s.skin} · {s.lang ? LANG_LABELS[s.lang] ?? s.lang : '—'} · {new Date(s.playedAt).toLocaleDateString('ru')}</span>
                </div>
                <span className={styles.historyScore}>{s.score[0]}:{s.score[1]}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Tournaments tab ── */}
        {tab === 'tournaments' && (
          <div className={styles.historyList}>
            {applications.length === 0 && (
              <p className={styles.empty}>Ты ещё не подавал заявки на турниры. <Link to="/tournaments">Посмотреть турниры →</Link></p>
            )}
            {applications.map(app => (
              <div key={app.id} className={styles.appRow}>
                <div className={styles.appInfo}>
                  <Link to={`/tournaments/${app.tournament.id}`} className={styles.appTournName}>{app.tournament.name}</Link>
                  <span className={styles.appMeta}>{new Date(app.tournament.startDate).toLocaleDateString('ru')} · Подана {new Date(app.createdAt).toLocaleDateString('ru')}</span>
                  {app.note && <span className={styles.appNote}>Примечание: {app.note}</span>}
                </div>
                <span className={styles.appStatus} style={{ color: STATUS_COLORS[app.status] }}>
                  {STATUS_LABELS[app.status] ?? app.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Settings tab ── */}
        {tab === 'settings' && (
          <form onSubmit={handleSave} className={styles.settingsForm}>
            <div className={styles.settingsSection}>
              <h3 className={styles.sectionTitle}>Аватар</h3>
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
                    <option value="robot">🤖 Робот</option>
                    <option value="gladiator">⚔️ Гладиатор</option>
                    <option value="boxer">🥊 Боксёр</option>
                    <option value="cosmonaut">🚀 Космонавт</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.settingsActions}>
              {saveMsg && <span className={styles.saveMsg}>{saveMsg}</span>}
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? '⏳ Сохраняем...' : '💾 Сохранить изменения'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
