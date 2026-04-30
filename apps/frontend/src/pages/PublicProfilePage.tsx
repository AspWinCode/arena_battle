import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import styles from './ProfilePage.module.css'

interface Stats {
  sessionsPlayed: number; sessionsWon: number; winRate: number
  battlesPlayed: number; langsUsed: string[]; tournamentsEntered: number; tournamentsWon: number
  favoriteSkin: string; favoritelang: string
}

interface Achievement {
  id: string; icon: string; title: string; description: string; unlocked: boolean
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
}

const LANG_LABELS: Record<string, string> = { js: 'JavaScript', py: 'Python', cpp: 'C++', java: 'Java' }
const EXP_LABELS: Record<string, string>  = { beginner: 'Начинающий', intermediate: 'Средний', advanced: 'Продвинутый' }
const SKIN_ICONS: Record<string, string>  = { robot: '🤖', gladiator: '⚔️', boxer: '🥊', cosmonaut: '🚀' }

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>()
  const [data, setData]   = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

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

  const { user: u, stats, achievements } = data

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
              {u.programmingYears > 0 && <span className={styles.badge}>{u.programmingYears} лет опыта</span>}
              <span className={styles.badge}>{SKIN_ICONS[u.preferredSkin]} {u.preferredSkin}</span>
              <span className={styles.badge}>с {new Date(u.createdAt).toLocaleDateString('ru', { month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
          <div className={styles.heroActions}>
            <Link to="/join" className="btn btn-ghost" style={{ fontSize: 13 }}>← Главная</Link>
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

      {/* Achievements */}
      <div className={styles.content}>
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
    </div>
  )
}
