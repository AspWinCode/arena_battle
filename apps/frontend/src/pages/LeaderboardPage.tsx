import { Link } from 'react-router-dom'
import { useDailyStore } from '../stores/dailyStore'
import styles from './LeaderboardPage.module.css'

// ── Mock global leaderboard (until real backend endpoint exists) ───────────────

interface LeaderEntry {
  rank:     number
  name:     string
  avatar:   string
  xp:       number
  wins:     number
  streak:   number
  winRate:  number
}

const MOCK_LEADERS: LeaderEntry[] = [
  { rank: 1,  name: 'КиберВолк',    avatar: '🐺', xp: 4800, wins: 142, streak: 14, winRate: 78 },
  { rank: 2,  name: 'RoboMaster',   avatar: '🤖', xp: 4200, wins: 118, streak: 7,  winRate: 72 },
  { rank: 3,  name: 'Лазерщик',     avatar: '⚡', xp: 3900, wins: 105, streak: 11, winRate: 69 },
  { rank: 4,  name: 'ПуленепробитыйЩит', avatar: '🛡️', xp: 3500, wins: 98, streak: 5, winRate: 65 },
  { rank: 5,  name: 'CodeNinja',    avatar: '🥷', xp: 3200, wins: 90, streak: 9,  winRate: 62 },
  { rank: 6,  name: 'МеханоБой',    avatar: '⚔️', xp: 2900, wins: 82, streak: 3,  winRate: 58 },
  { rank: 7,  name: 'GhostCoder',   avatar: '👾', xp: 2700, wins: 76, streak: 6,  winRate: 55 },
  { rank: 8,  name: 'AlphaBot',     avatar: '🚀', xp: 2400, wins: 68, streak: 2,  winRate: 52 },
  { rank: 9,  name: 'Берсерк7',     avatar: '🔥', xp: 2200, wins: 61, streak: 4,  winRate: 49 },
  { rank: 10, name: 'ТёмныйПрог',   avatar: '🌑', xp: 2000, wins: 55, streak: 1,  winRate: 46 },
]

const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

// ── Component ─────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const store    = useDailyStore()
  const winRate  = store.totalBattles > 0
    ? Math.round((store.totalWins / store.totalBattles) * 100)
    : 0

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
          <h1 className={styles.title}>🏆 Лидерборд</h1>
          <Link to="/daily" className="btn btn-ghost" style={{ fontSize: 13 }}>
            📅 Мои задания
          </Link>
        </div>
        <p className={styles.subtitle}>Лучшие бойцы арены</p>

        {/* User's own stats card */}
        <div className={styles.myCard}>
          <div className={styles.myCardLeft}>
            <span className={styles.myAvatar}>🧑‍💻</span>
            <div>
              <div className={styles.myName}>Ты</div>
              <div className={styles.myMeta}>
                {store.currentStreak > 0
                  ? `🔥 Серия: ${store.currentStreak}`
                  : '—'}
              </div>
            </div>
          </div>
          <div className={styles.myStats}>
            <div className={styles.myStat}>
              <span className={styles.myStatVal} style={{ color: '#a78bfa' }}>{store.totalXp}</span>
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
            <div className={styles.myStat}>
              <span className={styles.myStatVal}>{store.bestStreak}</span>
              <span className={styles.myStatKey}>Лучшая серия</span>
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
              <span className={styles.colXp}>XP</span>
              <span className={styles.colWins}>Побед</span>
              <span className={styles.colStreak}>Серия</span>
              <span className={styles.colWr}>Винрейт</span>
            </div>

            {MOCK_LEADERS.map(p => (
              <div
                key={p.rank}
                className={`${styles.tableRow} ${p.rank <= 3 ? styles.tableRowTop : ''}`}
              >
                <span className={styles.colRank}>
                  {RANK_MEDAL[p.rank] ?? `#${p.rank}`}
                </span>
                <span className={styles.colName}>
                  <span className={styles.playerAvatar}>{p.avatar}</span>
                  {p.name}
                </span>
                <span className={styles.colXp} style={{ color: '#a78bfa', fontWeight: 800 }}>
                  {p.xp.toLocaleString()}
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
            ))}
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
