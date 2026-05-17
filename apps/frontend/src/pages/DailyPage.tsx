import { useEffect } from 'react'
import {
  useDailyStore, TASK_POOL, pickDailyTasks, pickWeeklyTask,
  todayStr, LEAGUES, getLeague, getStreakMultiplier,
} from '../stores/dailyStore'
import styles from './DailyPage.module.css'

// ── Streak flame component ────────────────────────────────────────────────────

function StreakFlame({ streak }: { streak: number }) {
  const size = streak === 0 ? 'cold' : streak < 3 ? 'warm' : streak < 7 ? 'hot' : 'blazing'
  const mult = getStreakMultiplier(streak)
  return (
    <div className={`${styles.flame} ${styles[`flame_${size}`]}`}>
      <div className={styles.flameIcon}>
        {streak === 0 ? '🌑' : streak < 3 ? '🔥' : streak < 7 ? '🔥' : '⚡🔥⚡'}
      </div>
      <div className={styles.flameNum}>{streak}</div>
      <div className={styles.flameLabel}>
        {streak === 0 ? 'Серия прервана' : streak === 1 ? '1 победа' : `${streak} побед подряд`}
      </div>
      {mult > 1 && (
        <div className={styles.multBadge}>×{mult} XP</div>
      )}
    </div>
  )
}

// ── League card ───────────────────────────────────────────────────────────────

function LeagueCard({ totalXp }: { totalXp: number }) {
  const { current, next, pct } = getLeague(totalXp)
  return (
    <div className={styles.leagueCard} style={{ borderColor: `${current.color}55` }}>
      <div className={styles.leagueIcon} style={{ background: `${current.color}22` }}>
        {current.icon}
      </div>
      <div className={styles.leagueBody}>
        <div className={styles.leagueName} style={{ color: current.color }}>
          Лига: {current.name}
        </div>
        <div className={styles.leagueXp}>{totalXp} XP всего</div>
        <div className={styles.leagueTrack}>
          <div
            className={styles.leagueFill}
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${current.color}, ${next?.color ?? current.color})` }}
          />
        </div>
        <div className={styles.leagueFootRow}>
          {next ? (
            <span>До {next.icon} {next.name}: {next.minXp - totalXp} XP</span>
          ) : (
            <span style={{ color: current.color }}>🏆 Максимальная лига!</span>
          )}
        </div>
      </div>
      <div className={styles.leagueLadder}>
        {LEAGUES.map(l => (
          <div
            key={l.id}
            className={`${styles.ladderStep} ${totalXp >= l.minXp ? styles.ladderReached : ''}`}
            title={`${l.name} (${l.minXp}+ XP)`}
            style={{ borderColor: totalXp >= l.minXp ? l.color : undefined }}
          >
            <span style={{ fontSize: 18 }}>{l.icon}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Task card ─────────────────────────────────────────────────────────────────

function TaskCard({ taskId, progress, completed, claimed, onClaim, multiplier, pool, accent }: {
  taskId: string
  progress: number
  completed: boolean
  claimed: boolean
  onClaim: () => void
  multiplier: number
  pool: typeof TASK_POOL
  accent?: string
}) {
  const def = pool.find(t => t.id === taskId)
  if (!def) return null

  const pct = Math.min(100, Math.round((progress / def.target) * 100))
  const finalXp = Math.round(def.xp * multiplier)

  return (
    <div
      className={`${styles.taskCard} ${completed ? styles.taskDone : ''} ${claimed ? styles.taskClaimed : ''}`}
      style={accent ? { borderColor: `${accent}55` } : undefined}
    >
      <div className={styles.taskLeft}>
        <div className={styles.taskIcon} style={accent ? { background: `${accent}22` } : undefined}>
          {def.icon}
        </div>
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
        <div className={styles.taskXp}>
          {multiplier > 1 && <span className={styles.taskXpBase}>{def.xp}</span>}
          <span>+{finalXp} XP</span>
        </div>
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
  const store         = useDailyStore()
  const refreshDay    = useDailyStore(s => s.refreshDay)
  const claimTask     = useDailyStore(s => s.claimTask)
  const claimWeekly   = useDailyStore(s => s.claimWeekly)
  const claimDayBonus = useDailyStore(s => s.claimDayBonus)

  useEffect(() => { refreshDay() }, [refreshDay])

  const today       = todayStr()
  const taskDefs    = pickDailyTasks(today)
  const tasks       = store.tasks
  const winRate     = store.totalBattles > 0
    ? Math.round((store.totalWins / store.totalBattles) * 100)
    : 0

  const multiplier  = getStreakMultiplier(store.currentStreak)
  const allClaimed  = tasks.length > 0 && tasks.every(t => t.claimed)
  const totalDayXp  = taskDefs.reduce((s, d) => s + Math.round(d.xp * multiplier), 0)
  const dayBonusXp  = Math.round(taskDefs.reduce((s, d) => s + d.xp, 0) * 0.5)

  const weeklyDef   = pickWeeklyTask(store.week)
  const weeklyProg  = store.weeklyProgress
  const weeklyXp    = Math.round(weeklyDef.xp * multiplier)

  return (
    <div className={styles.root}>
      <div className={styles.bg} />

      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <button className={styles.back} onClick={() => window.history.back()}>← Назад</button>
          <div className={styles.headerRow}>
            <h1 className={styles.title}>📅 Ежедневные задания</h1>
            <div className={styles.todayXp}>
              <span className={styles.todayXpVal}>+{store.todayXp}</span>
              <span className={styles.todayXpLabel}>XP сегодня</span>
            </div>
          </div>
        </div>

        {/* League */}
        <LeagueCard totalXp={store.totalXp} />

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

          {/* Streak multiplier ladder */}
          <div className={styles.multLadder}>
            {[
              { from: 3,  mult: 1.5 },
              { from: 7,  mult: 2   },
              { from: 14, mult: 3   },
            ].map(m => {
              const active = store.currentStreak >= m.from
              return (
                <div
                  key={m.from}
                  className={`${styles.multStep} ${active ? styles.multStepActive : ''}`}
                  title={`Серия ${m.from}+ → ×${m.mult} XP за задания`}
                >
                  <span className={styles.multStepNum}>{m.from}+</span>
                  <span className={styles.multStepVal}>×{m.mult}</span>
                </div>
              )
            })}
          </div>
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
                  multiplier={multiplier}
                  pool={TASK_POOL}
                />
              ))}
            </div>
          )}

          {/* Day-completion bonus row */}
          <div className={`${styles.bonusCard} ${allClaimed ? styles.bonusReady : ''} ${store.dayBonusClaimed ? styles.bonusClaimed : ''}`}>
            <div className={styles.bonusIcon}>🎁</div>
            <div className={styles.bonusBody}>
              <div className={styles.bonusTitle}>Бонус за полный день</div>
              <div className={styles.bonusDesc}>
                Выполни все 3 задания — получи +{dayBonusXp} XP сверху
              </div>
            </div>
            <div className={styles.bonusRight}>
              <div className={styles.taskXp}>+{dayBonusXp} XP</div>
              {!allClaimed && !store.dayBonusClaimed && (
                <div className={styles.taskStatus}>
                  {tasks.filter(t => t.claimed).length} / {tasks.length}
                </div>
              )}
              {allClaimed && !store.dayBonusClaimed && (
                <button className={styles.claimBtn} onClick={claimDayBonus}>
                  Забрать!
                </button>
              )}
              {store.dayBonusClaimed && <div className={styles.taskCheckmark}>✅</div>}
            </div>
          </div>
        </div>

        {/* Weekly task */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>🌟 Задание недели</span>
            <span className={styles.sectionSub}>{store.week}</span>
          </div>

          {weeklyProg && (
            <TaskCard
              {...weeklyProg}
              onClaim={claimWeekly}
              multiplier={multiplier}
              pool={[weeklyDef]}
              accent="#fbbf24"
            />
          )}
          {!weeklyProg && (
            <div className={styles.emptyTasks}>Загрузка задания недели...</div>
          )}
          <div className={styles.weeklyHint}>
            Награда: +{weeklyXp} XP. Прогресс копится за все бои на этой неделе.
          </div>
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
      </div>
    </div>
  )
}
