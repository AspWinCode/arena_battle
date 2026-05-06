import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { SKIN_ICON } from '@robocode/shared'
import CharacterCard from '../components/CharacterCard/CharacterCard'
import styles from './ProfilePage.module.css'

interface Stats {
  sessionsPlayed: number; sessionsWon: number; winRate: number
  battlesPlayed: number; langsUsed: string[]; tournamentsEntered: number; tournamentsWon: number
  favoriteSkin: string; favoritelang: string
}

interface Achievement {
  id: string; icon: string; title: string; description: string; unlocked: boolean
}

interface RecentSession {
  sessionId: string
  sessionName: string
  slot: number
  lang: string | null
  skin: string
  won: boolean
  score: [number, number]
  playedAt: string
}

interface PublicProfile {
  user: {
    id: string; username: string; displayName: string; avatar: string; bio: string | null
    preferredLang: string; preferredSkin: string; experienceLevel: string
    programmingYears: number; createdAt: string
    _count: { players: number; applications: number }
  }
  stats: Stats
  achievements: Achievement[]
  recentSessions?: RecentSession[]
}

const LANG_LABELS: Record<string, string> = { js: 'JavaScript', py: 'Python', cpp: 'C++', java: 'Java' }
const EXP_LABELS:  Record<string, string>  = { beginner: 'Начинающий', intermediate: 'Средний', advanced: 'Продвинутый' }

/** Renders avatar: <img> for data-URL/path, emoji text otherwise */
function AvatarDisplay({ avatar, size = 72 }: { avatar: string; size?: number }) {
  const isImage = avatar?.startsWith('data:') || avatar?.startsWith('/')
  if (isImage) {
    return (
      <img
        src={avatar}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
        alt="avatar"
      />
    )
  }
  return <>{avatar || '🤖'}</>
}

type Tab = 'overview' | 'achievements' | 'history'

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>()
  const [data,    setData]    = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [tab,     setTab]     = useState<Tab>('overview')

  useEffect(() => {
    if (!username) return
    api.get<PublicProfile>(`/user/profile/${username}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [username])

  if (loading) return (
    <div className={styles.loadingWrap}><span className={styles.spinner}>⚙️</span><p>Загружаем профиль...</p></div>
  )

  if (error || !data) return (
    <div className={styles.loadingWrap}>
      <p style={{ color: '#f87171' }}>{error || 'Пользователь не найден'}</p>
      <Link to="/join" className="btn btn-ghost" style={{ marginTop: 16 }}>← Главная</Link>
    </div>
  )

  const { user: u, stats, achievements, recentSessions = [] } = data
  const unlockedCount = achievements.filter(a => a.unlocked).length

  return (
    <div className={styles.root}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.avatarBig}>
            <AvatarDisplay avatar={u.avatar || '🤖'} size={80} />
          </div>
          <div className={styles.heroInfo}>
            <h1 className={styles.displayName}>{u.displayName}</h1>
            <p className={styles.username}>@{u.username}</p>
            {u.bio && <p className={styles.bio}>{u.bio}</p>}
            <div className={styles.heroBadges}>
              <span className={styles.badge}>{LANG_LABELS[u.preferredLang] ?? u.preferredLang}</span>
              <span className={styles.badge}>{EXP_LABELS[u.experienceLevel] ?? u.experienceLevel}</span>
              {u.programmingYears > 0 && <span className={styles.badge}>{u.programmingYears} {u.programmingYears === 1 ? 'год' : u.programmingYears < 5 ? 'года' : 'лет'} опыта</span>}
              <span className={styles.badge}>{SKIN_ICON[u.preferredSkin]} {u.preferredSkin}</span>
              <span className={styles.badge}>с {new Date(u.createdAt).toLocaleDateString('ru', { month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
          <div className={styles.heroActions}>
            <Link to="/join" className="btn btn-ghost" style={{ fontSize: 13 }}>← Главная</Link>
          </div>
        </div>
      </div>

      {/* Character card */}
      <div className={styles.content} style={{ paddingTop: 24, paddingBottom: 0 }}>
        <div className={styles.sectionTitle}>🎭 Персонаж</div>
        <CharacterCard skinId={u.preferredSkin} />
      </div>

      {/* Quick stats */}
      <div className={styles.quickStats}>
        <div className={styles.statBox}>
          <span className={styles.statVal} style={{ color: '#a78bfa' }}>{stats.sessionsPlayed}</span>
          <span className={styles.statLbl}>Матчей</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statVal} style={{ color: '#4ade80' }}>{stats.sessionsWon}</span>
          <span className={styles.statLbl}>Побед</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statVal} style={{ color: stats.winRate >= 50 ? '#4ade80' : '#f87171' }}>
            {stats.winRate}%
          </span>
          <span className={styles.statLbl}>Винрейт</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statVal}>{stats.battlesPlayed}</span>
          <span className={styles.statLbl}>Раундов</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statVal} style={{ color: '#fbbf24' }}>{unlockedCount}</span>
          <span className={styles.statLbl}>🏅 Ачивок</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statVal} style={{ color: '#fbbf24' }}>{stats.tournamentsWon}</span>
          <span className={styles.statLbl}>🏆 Побед</span>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.content}>
        <div className={styles.tabs}>
          {([
            ['overview',      '📊 Обзор'],
            ['achievements',  '🏅 Ачивки'],
            ['history',       '📋 История'],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
              onClick={() => setTab(t)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div className={styles.tabContent}>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Игровая статистика</h3>
              <div className={styles.statsGrid}>
                <div className={styles.statRow}>
                  <span className={styles.statRowLabel}>Любимый язык</span>
                  <span className={styles.statRowValue}>{LANG_LABELS[stats.favoritelang] ?? stats.favoritelang}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statRowLabel}>Любимый персонаж</span>
                  <span className={styles.statRowValue}>{SKIN_ICON[stats.favoriteSkin]} {stats.favoriteSkin}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statRowLabel}>Языков использовано</span>
                  <span className={styles.statRowValue}>{stats.langsUsed.length}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statRowLabel}>Раундов сыграно</span>
                  <span className={styles.statRowValue}>{stats.battlesPlayed}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statRowLabel}>Турниров сыграно</span>
                  <span className={styles.statRowValue}>{stats.tournamentsEntered}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statRowLabel}>Турниров выиграно</span>
                  <span className={styles.statRowValue} style={{ color: '#fbbf24' }}>{stats.tournamentsWon}</span>
                </div>
              </div>
            </div>

            {/* Winrate bar */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Соотношение побед</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  flex: 1, height: 10, borderRadius: 5,
                  background: 'var(--surface-2)', overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${stats.winRate}%`, height: '100%', borderRadius: 5,
                    background: stats.winRate >= 50 ? '#4ade80' : '#f87171',
                    transition: 'width 0.6s ease',
                  }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, minWidth: 40, textAlign: 'right' }}>
                  {stats.winRate}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                <span>✅ {stats.sessionsWon} побед</span>
                <span>❌ {stats.sessionsPlayed - stats.sessionsWon} поражений</span>
              </div>
            </div>

            {/* Languages used */}
            {stats.langsUsed.length > 0 && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Используемые языки</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {stats.langsUsed.map(lang => (
                    <span key={lang} className={styles.badge} style={{ fontSize: 13 }}>
                      {LANG_LABELS[lang] ?? lang}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Achievements */}
        {tab === 'achievements' && (
          <div className={styles.tabContent}>
            <div style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: 13 }}>
              {unlockedCount} из {achievements.length} достижений
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
        )}

        {/* History */}
        {tab === 'history' && (
          <div className={styles.tabContent}>
            {recentSessions.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                Ещё нет сыгранных матчей
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentSessions.map(s => (
                  <div key={s.sessionId} style={{
                    background: 'var(--surface-1)',
                    borderRadius: 10,
                    padding: '12px 16px',
                    border: `1px solid ${s.won ? '#4ade8033' : '#f8717133'}`,
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <span style={{ fontSize: 22 }}>{s.won ? '✅' : '❌'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {s.sessionName || `Матч #${s.sessionId.slice(0, 6)}`}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {LANG_LABELS[s.lang ?? ''] ?? s.lang ?? '—'} · {SKIN_ICON[s.skin]} {s.skin}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontWeight: 800, fontSize: 16,
                        color: s.won ? '#4ade80' : '#f87171',
                      }}>
                        {s.score[0]} : {s.score[1]}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(s.playedAt).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
