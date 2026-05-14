import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useDailyStore } from '../stores/dailyStore'
import { useUserStore } from '../stores/userStore'
import RankBadge, { getRankInfo } from '../components/RankBadge'
import styles from './LeaderboardPage.module.css'

// ── Mock global leaderboard (fallback when API unavailable) ───────────────────

interface LeaderEntry {
  rank:     number
  name:     string
  avatar:   string
  elo:      number
  xp:       number
  wins:     number
  streak:   number
  winRate:  number
}

// Shape returned by the real API
interface ApiLeaderEntry {
  rank:          number
  username:      string
  displayName:   string
  avatar:        string
  elo:           number
  totalXp:       number
  wins:          number
  total:         number
  winRate:       number
  bestStreak:    number
  currentStreak: number
}

const MOCK_LEADERS: LeaderEntry[] = [
  { rank: 1,  name: 'КиберВолк',    avatar: '🐺', elo: 1720, xp: 4800, wins: 142, streak: 14, winRate: 78 },
  { rank: 2,  name: 'RoboMaster',   avatar: '🤖', elo: 1640, xp: 4200, wins: 118, streak: 7,  winRate: 72 },
  { rank: 3,  name: 'Лазерщик',     avatar: '⚡', elo: 1580, xp: 3900, wins: 105, streak: 11, winRate: 69 },
  { rank: 4,  name: 'ПуленепробитыйЩит', avatar: '🛡️', elo: 1440, xp: 3500, wins: 98, streak: 5, winRate: 65 },
  { rank: 5,  name: 'CodeNinja',    avatar: '🥷', elo: 1380, xp: 3200, wins: 90, streak: 9,  winRate: 62 },
  { rank: 6,  name: 'МеханоБой',    avatar: '⚔️', elo: 1250, xp: 2900, wins: 82, streak: 3,  winRate: 58 },
  { rank: 7,  name: 'GhostCoder',   avatar: '👾', elo: 1190, xp: 2700, wins: 76, streak: 6,  winRate: 55 },
  { rank: 8,  name: 'AlphaBot',     avatar: '🚀', elo: 1100, xp: 2400, wins: 68, streak: 2,  winRate: 52 },
  { rank: 9,  name: 'Берсерк7',     avatar: '🔥', elo: 1040, xp: 2200, wins: 61, streak: 4,  winRate: 49 },
  { rank: 10, name: 'ТёмныйПрог',   avatar: '🌑', elo: 970,  xp: 2000, wins: 55, streak: 1,  winRate: 46 },
]

const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

// ── Component ─────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const store    = useDailyStore()
  const { user } = useUserStore()
  const winRate  = store.totalBattles > 0
    ? Math.round((store.totalWins / store.totalBattles) * 100)
    : 0

  const [leaders, setLeaders] = useState<LeaderEntry[]>(MOCK_LEADERS)
  const [isLive,  setIsLive]  = useState(false)

  useEffect(() => {
    api.get<ApiLeaderEntry[]>('/user/profile/leaderboard')
      .then(data => {
        if (data.length > 0) {
          setLeaders(data.map(e => ({
            rank:    e.rank,
            name:    e.displayName || e.username,
            avatar:  e.avatar,
            elo:     e.elo ?? 1000,
            xp:      e.totalXp ?? e.wins * 100,
            wins:    e.wins,
            streak:  e.bestStreak ?? 0,
            winRate: e.winRate,
          })))
          setIsLive(true)
        }
      })
      .catch(() => { /* keep mock on error */ })
  }, [])

  return (
    <div className={styles.root}>
      <div className={styles.bg}>
        <div className={styles.bgGlow1} />
        <div className={styles.bgGlow2} />
      </div>

      <div className={styles.content}>
        {/* Header */}
        <Link to="/join" className={styles.back}>← Главная</Link>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>
            🏆 Лидерборд
            {isLive && (
              <span style={{
                marginLeft: 10, fontSize: 12, fontWeight: 700,
                background: '#4ade8033', color: '#4ade80',
                border: '1px solid #4ade8066',
                borderRadius: 6, padding: '2px 8px', verticalAlign: 'middle',
              }}>
                live
              </span>
            )}
          </h1>
          <Link to="/daily" className="btn btn-ghost" style={{ fontSize: 13 }}>
            📅 Мои задания
          </Link>
        </div>
        <p className={styles.subtitle}>Лучшие бойцы арены</p>

        {/* User's own stats card */}
        <div className={styles.myCard}>
          <div className={styles.myCardLeft}>
            <span className={styles.myAvatar}>{user?.avatar ?? '🧑‍💻'}</span>
            <div>
              <div className={styles.myName}>{user?.displayName ?? 'Ты'}</div>
              <div className={styles.myMeta} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {user?.elo != null && <RankBadge elo={user.elo} size="sm" />}
                {store.currentStreak > 0 && <span style={{ color: 'var(--fire2)', fontWeight: 700 }}>🔥 {store.currentStreak}</span>}
              </div>
            </div>
          </div>
          <div className={styles.myStats}>
            <div className={styles.myStat}>
              <span className={styles.myStatVal} style={{ color: 'var(--lightning)' }}>{user?.elo ?? 1000}</span>
              <span className={styles.myStatKey}>Рейтинг</span>
            </div>
            <div className={styles.myStat}>
              <span className={styles.myStatVal} style={{ color: 'var(--accent)' }}>{store.totalXp}</span>
              <span className={styles.myStatKey}>XP</span>
            </div>
            <div className={styles.myStat}>
              <span className={styles.myStatVal} style={{ color: '#fbbf24' }}>{store.totalWins}</span>
              <span className={styles.myStatKey}>Побед</span>
            </div>
            <div className={styles.myStat}>
              <span className={styles.myStatVal} style={{ color: store.totalBattles > 0 ? (winRate >= 50 ? '#4ade80' : '#f87171') : 'var(--text-muted)' }}>
                {store.totalBattles > 0 ? `${winRate}%` : '—'}
              </span>
              <span className={styles.myStatKey}>Винрейт</span>
            </div>
          </div>
        </div>

        {/* Global leaderboard */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Глобальный рейтинг</span>
            <span className={styles.comingSoon}>🔄 Обновляется ежедневно</span>
          </div>

          <div className={styles.table}>
            {/* Head */}
            <div className={styles.tableHead}>
              <span className={styles.colRank}>#</span>
              <span className={styles.colName}>Боец</span>
              <span className={styles.colXp}>Рейтинг</span>
              <span className={styles.colWins}>Побед</span>
              <span className={styles.colStreak}>Серия</span>
              <span className={styles.colWr}>Винрейт</span>
            </div>

            {leaders.map(p => {
              const rank = getRankInfo(p.elo)
              return (
                <div
                  key={p.rank}
                  className={`${styles.tableRow} ${p.rank <= 3 ? styles.tableRowTop : ''}`}
                >
                  <span className={styles.colRank}>
                    {RANK_MEDAL[p.rank] ?? `#${p.rank}`}
                  </span>
                  <span className={styles.colName}>
                    <span className={styles.playerAvatar}>
                      {p.avatar?.startsWith('data:') || p.avatar?.startsWith('/')
                        ? <img src={p.avatar} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', verticalAlign: 'middle' }} alt="" />
                        : p.avatar
                      }
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      <span style={{ fontSize: 10, color: rank.color, fontWeight: 700 }}>{rank.icon} {rank.name}</span>
                    </span>
                  </span>
                  <span className={styles.colXp} style={{ color: 'var(--lightning)', fontWeight: 800 }}>
                    {p.elo}
                  </span>
                  <span className={styles.colWins} style={{ color: '#fbbf24' }}>{p.wins}</span>
                  <span className={styles.colStreak}>
                    {p.streak > 0 ? `🔥 ${p.streak}` : '—'}
                  </span>
                  <span
                    className={styles.colWr}
                    style={{ color: p.winRate >= 60 ? '#4ade80' : p.winRate >= 50 ? '#fbbf24' : '#f87171' }}
                  >
                    {p.winRate}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/sparring" className="btn btn-primary" style={{ flex: 1 }}>
            🥊 Спарринг
          </Link>
          <Link to="/learn" className="btn btn-ghost" style={{ flex: 1 }}>
            🎓 Обучение
          </Link>
        </div>
      </div>
    </div>
  )
}
