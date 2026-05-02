import { useState, useRef, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  SPARRING_BOTS, PERKS, mergeEffects,
  MAX_HP, MAX_STAMINA, MAX_RAGE, MISSIONS,
} from '@robocode/shared'
import type { RoundResult, TurnResult } from '@robocode/shared'
import { runLocalMatch } from '../engine/battleEngine'
import { runCodeToStrategy } from '../engine/codeRunner'
import { analyzeMatch, ACTION_COLOR, ACTION_LABEL } from '../engine/matchAnalysis'
import { useLearnStore } from '../stores/learnStore'
import { useDailyStore } from '../stores/dailyStore'
import CodeEditor from '../components/CodeEditor/CodeEditor'
import styles from './SparringPage.module.css'

const SKIN_ICON: Record<string, string> = {
  robot: '🤖', gladiator: '⚔️', boxer: '🥊', cosmonaut: '🚀',
}
const DIFF_STARS = (d: number) => '★'.repeat(d) + '☆'.repeat(5 - d)

const FORMAT_OPTS = [
  { value: 'bo1', label: 'BO1 — 1 раунд' },
  { value: 'bo3', label: 'BO3 — до 2 побед' },
  { value: 'bo5', label: 'BO5 — до 3 побед' },
] as const

type Phase = 'setup' | 'animating' | 'result'

const ACTION_ICON: Record<string, string> = {
  attack: '👊', heavy: '💥', laser: '⚡', shield: '🛡️',
  dodge: '💨', repair: '💊', special: '☄️',
}

// ── Stat bar sub-component ─────────────────────────────────────────────────────

function StatBar({ value, max, color, lowColor, label, flip }: {
  value: number; max: number; color: string; lowColor?: string; label: string; flip?: boolean
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const fill = lowColor ? (pct > 50 ? color : pct > 25 ? '#facc15' : lowColor) : color
  return (
    <div className={styles.statRow} style={{ flexDirection: flip ? 'row-reverse' : 'row' }}>
      <span className={styles.statLabel}>{label}</span>
      <div className={styles.statTrack}>
        <div className={styles.statFill} style={{ width: `${pct}%`, background: fill, marginLeft: flip ? 'auto' : undefined }} />
      </div>
    </div>
  )
}

function RageBar({ value, max, flip }: { value: number; max: number; flip?: boolean }) {
  const pct  = Math.max(0, Math.min(100, (value / max) * 100))
  const ready = pct >= 100
  return (
    <div className={styles.statRow} style={{ flexDirection: flip ? 'row-reverse' : 'row' }}>
      <span className={styles.statLabel} style={{ color: ready ? '#f97316' : undefined }}>
        {ready ? '☄️ RAGE!' : `${Math.round(value)} RAGE`}
      </span>
      <div className={styles.statTrack}>
        <div className={styles.statFill} style={{
          width: `${pct}%`,
          background: ready ? '#f97316' : `linear-gradient(90deg, #7c3aed, #a855f7)`,
          boxShadow: ready ? '0 0 8px rgba(249,115,22,.6)' : undefined,
        }} />
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SparringPage() {
  const progress      = useLearnStore(s => s.progress)
  const recordBattle  = useDailyStore(s => s.recordBattle)
  const completedCount = useMemo(
    () => MISSIONS.filter(m => progress[m.id]?.completed).length,
    [progress],
  )

  // Setup state
  const [selectedBotId, setSelectedBotId]   = useState(SPARRING_BOTS[0].id)
  const [selectedPerkIds, setSelectedPerkIds] = useState<string[]>([])
  const [format, setFormat]                  = useState<'bo1' | 'bo3' | 'bo5'>('bo1')
  const [code, setCode]                      = useState(DEFAULT_CODE)
  const [codeError, setCodeError]            = useState('')

  // Battle state
  const [phase, setPhase]           = useState<Phase>('setup')
  const [rounds, setRounds]         = useState<RoundResult[]>([])
  const [winner, setWinner]         = useState<0 | 1 | 2>(0)
  const [score, setScore]           = useState<[number, number]>([0, 0])
  const [displayTurn, setDisplayTurn] = useState<TurnResult | null>(null)
  const [turnLog, setTurnLog]       = useState<TurnResult[]>([])

  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedBot  = SPARRING_BOTS.find(b => b.id === selectedBotId)!
  const activePerks  = PERKS.filter(p => selectedPerkIds.includes(p.id))
  const mergedEffect = mergeEffects(activePerks)

  const matchAnalysis = useMemo(
    () => (rounds.length > 0 ? analyzeMatch(rounds) : null),
    [rounds],
  )

  // Toggle perk selection (max 2)
  const togglePerk = (perkId: string) => {
    setSelectedPerkIds(prev => {
      if (prev.includes(perkId)) return prev.filter(id => id !== perkId)
      if (prev.length >= 2) return prev
      return [...prev, perkId]
    })
  }

  const handleReset = useCallback(() => {
    if (animTimer.current) clearTimeout(animTimer.current)
    setPhase('setup')
    setRounds([])
    setWinner(0)
    setScore([0, 0])
    setDisplayTurn(null)
    setTurnLog([])
    setCodeError('')
  }, [])

  const handleRun = useCallback(() => {
    const { strategy: playerStrategy, error } = runCodeToStrategy(code)
    if (error) { setCodeError(`Ошибка: ${error}`); return }
    setCodeError('')

    const result = runLocalMatch(
      playerStrategy,
      selectedBot.strategy,
      format,
      mergedEffect,
    )
    setRounds(result.rounds)
    setWinner(result.winner)
    setScore(result.score)
    setPhase('animating')

    // Animate turns
    const allTurns: TurnResult[] = []
    for (const r of result.rounds) allTurns.push(...r.turns)

    let idx = 0
    const step = () => {
      if (idx >= allTurns.length) {
        setPhase('result')
        // Record battle for daily tasks & streak
        const allT = allTurns
        const won  = result.winner === 1
        const lastTurn = allT[allT.length - 1]
        const isKo = won && !!lastTurn && lastTurn.p2HpAfter === 0
        recordBattle({
          won,
          isKo,
          damageDealt:  allT.reduce((s, t) => s + t.p2DmgTaken, 0),
          turnsPlayed:  allT.length,
          healing:      allT.reduce((s, t) => s + (t.p1Heal ?? 0), 0),
          specialUsed:  allT.filter(t => t.p1Action === 'special').length,
          heavyUsed:    allT.filter(t => t.p1Action === 'heavy').length,
          laserUsed:    allT.filter(t => t.p1Action === 'laser').length,
          dodgeUsed:    allT.filter(t => t.p1Action === 'dodge').length,
          usedRepair:   allT.some(t => t.p1Action === 'repair'),
        })
        return
      }
      const t = allTurns[idx++]
      setDisplayTurn(t)
      setTurnLog(prev => [...prev, t].slice(-30))
      animTimer.current = setTimeout(step, 300)
    }
    setTurnLog([])
    step()
  }, [code, selectedBot, format, mergedEffect])

  const unlockedPerkIds = new Set(PERKS.filter(p => p.unlockAt <= completedCount).map(p => p.id))

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <Link to="/learn" className={styles.back}>← Обучение</Link>
        <h1 className={styles.title}>🥊 Спарринг</h1>
        <span className={styles.subtitle}>Тренируйся против ботов без ограничений</span>
      </div>

      <div className={styles.layout}>
        {/* ── LEFT: Code editor ─────────────────────────────────── */}
        <div className={styles.leftPane}>
          <div className={styles.paneTitle}>💻 Твой код</div>

          {codeError && <div className={styles.codeError}>{codeError}</div>}

          <div className={styles.editorWrap}>
            <CodeEditor
              value={code}
              language="javascript"
              onChange={v => setCode(v ?? '')}
              readOnly={phase === 'animating'}
            />
          </div>

          <div className={styles.editorFooter}>
            {phase === 'setup' || phase === 'result' ? (
              <button className="btn btn-primary" onClick={handleRun}>
                ▶ Запустить бой
              </button>
            ) : (
              <button className="btn btn-ghost" onClick={handleReset}>
                ⏹ Стоп
              </button>
            )}
            {phase === 'result' && (
              <button className="btn btn-ghost" onClick={handleReset}>
                🔄 Сброс
              </button>
            )}
          </div>
        </div>

        {/* ── RIGHT: setup / battle ──────────────────────────────── */}
        <div className={styles.rightPane}>
          {/* Setup panel */}
          {phase === 'setup' && (
            <>
              {/* Bot selector */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>🤖 Выбор противника</div>
                <div className={styles.botGrid}>
                  {SPARRING_BOTS.map(bot => (
                    <button
                      key={bot.id}
                      className={`${styles.botCard} ${selectedBotId === bot.id ? styles.botCardActive : ''}`}
                      onClick={() => setSelectedBotId(bot.id)}
                    >
                      <span className={styles.botIcon}>{SKIN_ICON[bot.skin]}</span>
                      <span className={styles.botName}>{bot.name}</span>
                      <span className={styles.botDiff} style={{ color: DIFF_COLORS[bot.difficulty] }}>
                        {DIFF_STARS(bot.difficulty)}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Selected bot info */}
                <div className={styles.botInfo}>
                  <span className={styles.botInfoIcon}>{SKIN_ICON[selectedBot.skin]}</span>
                  <div>
                    <div className={styles.botInfoName}>{selectedBot.name}</div>
                    <div className={styles.botInfoDesc}>{selectedBot.description}</div>
                    <div className={styles.botTags}>
                      {selectedBot.tags.map(t => (
                        <span key={t} className={styles.botTag}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Format selector */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>🎯 Формат</div>
                <div className={styles.formatRow}>
                  {FORMAT_OPTS.map(f => (
                    <button
                      key={f.value}
                      className={`${styles.formatBtn} ${format === f.value ? styles.formatBtnActive : ''}`}
                      onClick={() => setFormat(f.value)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Perk selector */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  ✨ Перки
                  <span className={styles.sectionSub}>
                    {selectedPerkIds.length}/2 выбрано · {completedCount}/{MISSIONS.length} миссий пройдено
                  </span>
                </div>
                <div className={styles.perkGrid}>
                  {PERKS.map(perk => {
                    const unlocked = unlockedPerkIds.has(perk.id)
                    const selected = selectedPerkIds.includes(perk.id)
                    const disabled = !unlocked || (!selected && selectedPerkIds.length >= 2)
                    return (
                      <button
                        key={perk.id}
                        className={`${styles.perkCard} ${selected ? styles.perkCardActive : ''} ${!unlocked ? styles.perkCardLocked : ''}`}
                        onClick={() => !disabled && togglePerk(perk.id)}
                        disabled={disabled}
                        title={!unlocked ? `Пройди ${perk.unlockAt} миссий для разблокировки` : perk.description}
                      >
                        <span className={styles.perkIcon}>{unlocked ? perk.icon : '🔒'}</span>
                        <span className={styles.perkName}>{perk.name}</span>
                        {!unlocked && (
                          <span className={styles.perkLockLabel}>{perk.unlockAt} мис.</span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Active perk effects summary */}
                {activePerks.length > 0 && (
                  <div className={styles.perkEffects}>
                    {activePerks.map(p => (
                      <div key={p.id} className={styles.perkEffect}>
                        {p.icon} <strong>{p.name}</strong>: {p.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Battle panel */}
          {(phase === 'animating' || phase === 'result') && (
            <div className={styles.battlePane}>
              {/* Stats */}
              <div className={styles.statsSection}>
                <div className={styles.statsCol}>
                  <div className={styles.statsLabel}>🧑‍💻 Ты</div>
                  <StatBar value={displayTurn?.p1HpAfter ?? MAX_HP} max={MAX_HP}
                    color="#4ade80" lowColor="#f87171" label={`${displayTurn?.p1HpAfter ?? MAX_HP} HP`} />
                  <StatBar value={displayTurn?.p1Stamina ?? MAX_STAMINA} max={MAX_STAMINA}
                    color="#60a5fa" label={`${displayTurn?.p1Stamina ?? MAX_STAMINA} STA`} />
                  <RageBar value={displayTurn?.p1Rage ?? 0} max={MAX_RAGE} />
                </div>
                <div className={styles.statsMid}>
                  {displayTurn
                    ? <><div className={styles.actionBadge}>{ACTION_ICON[displayTurn.p1Action]} vs {ACTION_ICON[displayTurn.p2Action]}</div>
                        <div className={styles.turnNum}>Ход {displayTurn.turn}</div></>
                    : <div className={styles.vsLabel}>VS</div>
                  }
                </div>
                <div className={styles.statsCol}>
                  <div className={styles.statsLabel} style={{ textAlign: 'right' }}>
                    {SKIN_ICON[selectedBot.skin]} {selectedBot.name}
                  </div>
                  <StatBar value={displayTurn?.p2HpAfter ?? MAX_HP} max={MAX_HP}
                    color="#f87171" lowColor="#6b7280" label={`${displayTurn?.p2HpAfter ?? MAX_HP} HP`} flip />
                  <StatBar value={displayTurn?.p2Stamina ?? MAX_STAMINA} max={MAX_STAMINA}
                    color="#f97316" label={`${displayTurn?.p2Stamina ?? MAX_STAMINA} STA`} flip />
                  <RageBar value={displayTurn?.p2Rage ?? 0} max={MAX_RAGE} flip />
                </div>
              </div>

              {/* Turn log */}
              <div className={styles.logWrap}>
                {[...turnLog].reverse().map((t, i) => (
                  <div key={i} className={`${styles.logRow} ${i === 0 ? styles.logRowLatest : ''}`}>
                    <span className={styles.logTurn}>#{t.turn}</span>
                    <span className={styles.logAction}>{ACTION_ICON[t.p1Action]} {t.p1Action}</span>
                    <span className={styles.logVs}>vs</span>
                    <span className={styles.logAction}>{ACTION_ICON[t.p2Action]} {t.p2Action}</span>
                    <span className={styles.logDmg}>{t.log}</span>
                  </div>
                ))}
              </div>

              {/* Result banner */}
              {phase === 'result' && (
                <div className={`${styles.resultBanner}
                  ${winner === 1 ? styles.bannerWin : winner === 2 ? styles.bannerLose : styles.bannerDraw}`}>
                  <div className={styles.resultTitle}>
                    {winner === 1 ? '🏆 ПОБЕДА!' : winner === 2 ? '💀 ПОРАЖЕНИЕ' : '🤝 НИЧЬЯ'}
                  </div>
                  <div className={styles.resultScore}>{score[0]} – {score[1]}</div>
                </div>
              )}

              {/* Mini analysis */}
              {phase === 'result' && matchAnalysis && (
                <div className={styles.miniAnalysis}>
                  <div className={styles.miniTitle}>🔬 Анализ</div>
                  <div className={styles.miniRow}>
                    <div className={styles.miniStat}>
                      <span className={styles.miniVal} style={{ color: '#00e5ff' }}>
                        {matchAnalysis.p1.efficiencyScore}
                      </span>
                      <span className={styles.miniKey}>эффективность</span>
                    </div>
                    <div className={styles.miniStat}>
                      <span className={styles.miniVal} style={{ color: '#f87171' }}>
                        {matchAnalysis.p1.damageDealt}
                      </span>
                      <span className={styles.miniKey}>урона нанесено</span>
                    </div>
                    <div className={styles.miniStat}>
                      <span className={styles.miniVal} style={{ color: '#4ade80' }}>
                        {matchAnalysis.p1.healingDone}
                      </span>
                      <span className={styles.miniKey}>HP восстановлено</span>
                    </div>
                  </div>
                  <div className={styles.miniStyle}>{matchAnalysis.p1.detectedStyle}</div>

                  <div className={styles.miniActions}>
                    {matchAnalysis.p1.actions.slice(0, 5).map(a => (
                      <div key={a.action} className={styles.miniActionRow}>
                        <span className={styles.miniActionLabel} style={{ color: ACTION_COLOR[a.action] }}>
                          {ACTION_LABEL[a.action]}
                        </span>
                        <div className={styles.miniTrack}>
                          <div className={styles.miniFill}
                            style={{ width: `${a.pct}%`, background: ACTION_COLOR[a.action] }} />
                        </div>
                        <span className={styles.miniPct}>{a.pct}%</span>
                      </div>
                    ))}
                  </div>

                  <div className={styles.miniRecs}>
                    {matchAnalysis.p1.recommendations.map((r, i) => (
                      <div key={i} className={styles.miniRec}>{r}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DIFF_COLORS: Record<number, string> = {
  1: '#4ade80', 2: '#86efac', 3: '#facc15', 4: '#f97316', 5: '#f43f5e',
}

const DEFAULT_CODE = `// Спарринг — пиши и тестируй стратегию!
// ctx: { myHp, myStamina, myRage, enemyHp, enemyStamina, enemyRage,
//        myLastAction, enemyLastAction, cooldowns, myPosition,
//        enemyPosition, distanceModifier, myRepeatCount, turn }

function strategy(ctx) {
  if (ctx.myRage >= 100) return 'special';
  if (ctx.myHp < 30) return 'repair';
  if (ctx.enemyLastAction === 'laser') return 'dodge';
  if (ctx.enemyHp < 25) return 'heavy';
  if (ctx.cooldowns.heavy === 0 && ctx.myStamina >= 35) return 'heavy';
  return 'attack';
}`
