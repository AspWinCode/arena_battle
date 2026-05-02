import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDailyStore, TASK_POOL, pickDailyTasks, todayStr } from '../stores/dailyStore'
import styles from './DailyPage.module.css'

// ── Streak flame component ────────────────────────────────────────────────────

function StreakFlame({ streak }: { streak: number }) {
  const size = streak === 0 ? 'cold' : streak < 3 ? 'warm' : streak < 7 ? 'hot' : 'blazing'
  return (
    <div className={`${styles.flame} ${styles[`flame_${size}`]}`}>
      <div className={styles.flameIcon}>
        {streak === 0 ? '🌑' : streak < 3 ? '🔥' : streak < 7 ? '🔥' : '⚡🔥⚡'}
      </div>
      <div className={styles.flameNum}>{streak}</div>
      <div className={styles.flameLabel}>
        {streak === 0 ? 'Серия прервана' : streak === 1 ? '1 победа' : `${streak} побед подряд`}
      </div>
    </div>
  )
}

// ── Task card ─────────────────────────────────────────────────────────────────

function TaskCard({ taskId, progress, completed, claimed, onClaim }: {
  taskId: string
  progress: number
  completed: boolean
  claimed: boolean
  onClaim: () => void
}) {
  const def = TASK_POOL.find(t => t.id === taskId)
  if (!def) return null

  const pct = Math.min(100, Math.round((progress / def.target) * 100))

  return (
    <div className={`${styles.taskCard} ${completed ? styles.taskDone : ''} ${claimed ? styles.taskClaimed : ''}`}>
      <div className={styles.taskLeft}>
        <div className={styles.taskIcon}>{def.icon}</div>
      </div>

      <div className={styles.taskBody}>
        <div className={styles.taskTitle}>{def.title}</div>
        <div className={styles.taskDesc}>{def.description}</div>

        <div className={styles.taskProgress}>
          <div className={styles.taskTrack}>
            <div
              className={`${styles.taskFill} ${completed ? styles.taskFillDone : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={styles.taskPct}>
            {progress} / {def.target}
          </span>
        </div>
      </div>

      <div className={styles.taskRight}>
        <div className={styles.taskXp}>+{def.xp} XP</div>
        {!completed && (
          <div className={styles.taskStatus}>{pct}%</div>
        )}
        {completed && !claimed && (
          <button className={styles.claimBtn} onClick={onClaim}>
            Забрать!
          </button>
        )}
        {claimed && (
          <div className={styles.taskCheckmark}>✅</div>
        )}
      </div>
    </div>
  )
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ icon, value, label, color }: {
  icon: string; value: number | string; label: string; color?: string
}) {
  return (
    <div className={styles.statPill}>
      <span className={styles.statIcon}>{icon}</span>
      <span className={styles.statVal} style={{ color }}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DailyPage() {
  const store       = useDailyStore()
  const refreshDay  = useDailyStore(s => s.refreshDay)
  const claimTask   = useDailyStore(s => s.claimTask)

  useEffect(() => { refreshDay() }, [refreshDay])

  const today       = todayStr()
  const taskDefs    = pickDailyTasks(today)
  const tasks       = store.tasks
  const winRate     = store.totalBattles > 0
    ? Math.round((store.totalWins / store.totalBattles) * 100)
    : 0

  const allClaimed  = tasks.length > 0 && tasks.every(t => t.claimed)
  const totalDayXp  = taskDefs.reduce((s, d) => s + d.xp, 0)

  // Streak milestone badges
  const milestones = [3, 7, 14, 30]
  const nextMilestone = milestones.find(m => m > store.currentStreak)

  return (
    <div className={styles.root}>
      <div className={styles.bg} />

      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <Link to="/join" className={styles.back}>← На главную</Link>
          <div className={styles.headerRow}>
            <h1 className={styles.title}>📅 Ежедневные задания</h1>
            <div className={styles.todayXp}>
              <span className={styles.todayXpVal}>+{store.todayXp}</span>
              <span className={styles.todayXpLabel}>XP сегодня</span>
            </div>
          </div>
        </div>

        {/* Streak card */}
        <div className={styles.streakCard}>
          <StreakFlame streak={store.currentStreak} />

          <div className={styles.streakStats}>
            <div className={styles.streakStat}>
              <span className={styles.streakStatVal}>{store.bestStreak}</span>
              <span className={styles.streakStatKey}>лучшая серия</span>
            </div>
            <div className={styles.streakDivider} />
            <div className={styles.streakStat}>
              <span className={styles.streakStatVal}>{store.totalWins}</span>
              <span className={styles.streakStatKey}>всего побед</span>
            </div>
            <div className={styles.streakDivider} />
            <div className={styles.streakStat}>
              <span className={styles.streakStatVal}>{store.totalXp}</span>
              <span className={styles.streakStatKey}>всего XP</span>
            </div>
          </div>

          {/* Milestone progress */}
          {nextMilestone && store.currentStreak > 0 && (
            <div className={styles.milestone}>
              <div className={styles.milestoneTrack}>
                <div
                  className={styles.milestoneFill}
                  style={{ width: `${(store.currentStreak / nextMilestone) * 100}%` }}
                />
              </div>
              <span className={styles.milestoneLabel}>
                🎯 До серии {nextMilestone}: {nextMilestone - store.currentStreak} побед
              </span>
            </div>
          )}
          {store.currentStreak >= 30 && (
            <div className={styles.milestoneLabel} style={{ color: '#fbbf24', textAlign: 'center' }}>
              🏆 Ты достиг максимальной серии! Легенда!
            </div>
          )}
        </div>

        {/* Daily tasks */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Задания на сегодня</span>
            <span className={styles.sectionSub}>
              {allClaimed ? '✅ Всё выполнено!' : `До ${totalDayXp} XP`}
            </span>
          </div>

          {tasks.length === 0 ? (
            <div className={styles.emptyTasks}>Загрузка...</div>
          ) : (
            <div className={styles.taskList}>
              {tasks.map(tp => (
                <TaskCard
                  key={tp.taskId}
                  {...tp}
                  onClaim={() => claimTask(tp.taskId)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Global stats */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Твоя статистика</div>
          <div className={styles.statsGrid}>
            <StatPill icon="⚔️" value={store.totalBattles} label="боёв сыграно" />
            <StatPill icon="🏆" value={store.totalWins}    label="побед" color="#fbbf24" />
            <StatPill icon="📈" value={`${winRate}%`}      label="винрейт"   color={winRate >= 50 ? '#4ade80' : '#f87171'} />
            <StatPill icon="✨" value={store.totalXp}      label="XP"        color="#a78bfa" />
          </div>
        </div>

        {/* Navigation to play */}
        <div className={styles.playLinks}>
          <Link to="/sparring" className="btn btn-primary" style={{ flex: 1 }}>
            🥊 Спарринг
          </Link>
          <Link to="/learn" className="btn btn-ghost" style={{ flex: 1 }}>
            🎓 Обучение
          </Link>
        </div>

        {/* Streak milestones reference */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>🎯 Вехи серии побед</div>
          <div className={styles.milestones}>
            {[3, 7, 14, 30].map(m => {
              const reached = store.bestStreak >= m
              return (
                <div key={m} className={`${styles.milestoneCard} ${reached ? styles.milestoneReached : ''}`}>
                  <span className={styles.milestoneIcon}>{reached ? '✅' : '🔒'}</span>
                  <span className={styles.milestoneNum}>{m}</span>
                  <span className={styles.milestoneKey}>побед подряд</span>
                  <span className={styles.milestoneReward}>
                    {m === 3  ? '+150 XP'  :
                     m === 7  ? '+400 XP'  :
                     m === 14 ? '+1000 XP' :
                                '🏆 Легенда'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
