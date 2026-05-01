import { useState, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { MISSIONS, MAX_HP, MAX_STAMINA, MAX_RAGE } from '@robocode/shared'
import type { RoundResult, TurnResult } from '@robocode/shared'
import { runLocalMatch } from '../engine/battleEngine'
import { runCodeToStrategy } from '../engine/codeRunner'
import { useLearnStore } from '../stores/learnStore'
import CodeEditor from '../components/CodeEditor/CodeEditor'
import TutorialOverlay from '../components/tutorial/TutorialOverlay'
import styles from './LearningBattlePage.module.css'

const SKIN_ICON: Record<string, string> = {
  robot: '🤖', gladiator: '⚔️', boxer: '🥊', cosmonaut: '🚀',
}

const ACTION_ICON: Record<string, string> = {
  attack: '👊', heavy: '💥', laser: '⚡', shield: '🛡️',
  dodge: '💨', repair: '💊', special: '☄️',
}

type Phase = 'coding' | 'animating' | 'result'

export default function LearningBattlePage() {
  const { missionId } = useParams<{ missionId: string }>()
  const navigate = useNavigate()
  const { completesMission, incrementAttempt } = useLearnStore()

  const mission = MISSIONS.find(m => m.id === missionId)

  const [code, setCode] = useState(mission?.starterCode ?? '')
  const [phase, setPhase] = useState<Phase>('coding')
  const [codeError, setCodeError] = useState('')
  const [rounds, setRounds] = useState<RoundResult[]>([])
  const [winner, setWinner] = useState<0 | 1 | 2>(0)
  const [score, setScore] = useState<[number, number]>([0, 0])
  const [displayRound, setDisplayRound] = useState<RoundResult | null>(null)
  const [displayTurn, setDisplayTurn] = useState<TurnResult | null>(null)
  const [tutorialDone, setTutorialDone] = useState(false)
  const [showTutorial, setShowTutorial] = useState(true)

  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleRun = useCallback(() => {
    if (!mission) return
    setCodeError('')

    const { strategy: playerStrategy, error } = runCodeToStrategy(code)
    if (error) {
      setCodeError(`Ошибка в коде: ${error}`)
      return
    }

    incrementAttempt(mission.id)

    const result = runLocalMatch(playerStrategy, mission.opponentStrategy, 'bo1')
    setRounds(result.rounds)
    setWinner(result.winner as 0 | 1 | 2)
    setScore(result.score)
    setPhase('animating')

    // Animate through rounds and turns
    let delay = 0
    for (const round of result.rounds) {
      const r = round
      setTimeout(() => setDisplayRound(r), delay)
      delay += 400

      for (const t of round.turns) {
        const turn = t
        setTimeout(() => setDisplayTurn(turn), delay)
        delay += 350
      }

      delay += 600
    }

    animTimer.current = setTimeout(() => {
      setPhase('result')
      if (result.winner === 1) {
        const stars = result.score[0] > 0 && result.rounds[0]?.p2Hp === 0 ? 3 :
                      result.score[0] > 0 ? 2 : 1
        completesMission(mission.id, stars)
      }
    }, delay)
  }, [code, mission, incrementAttempt, completesMission])

  const handleReset = () => {
    if (animTimer.current) clearTimeout(animTimer.current)
    setPhase('coding')
    setDisplayRound(null)
    setDisplayTurn(null)
    setCodeError('')
  }

  if (!mission) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>Миссия не найдена</p>
        <Link to="/learn">← К миссиям</Link>
      </div>
    )
  }

  const nextMission = MISSIONS.find(m => m.order === mission.order + 1)

  return (
    <div className={styles.root}>
      {/* Tutorial overlay */}
      {showTutorial && !tutorialDone && (
        <TutorialOverlay
          steps={mission.tutorial}
          onDone={() => { setTutorialDone(true); setShowTutorial(false) }}
          onSkip={() => setShowTutorial(false)}
        />
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to="/learn" className={styles.back}>← Миссии</Link>
          <div className={styles.missionInfo}>
            <span className={styles.missionNum}>Миссия {mission.order}</span>
            <h2 className={styles.missionTitle}>{mission.title}</h2>
          </div>
        </div>
        <div className={styles.headerRight}>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12 }}
            onClick={() => setShowTutorial(true)}
          >
            💡 Подсказка
          </button>
          <div className={styles.vs}>
            <span>🧑‍💻 Ты</span>
            <span className={styles.vsLabel}>VS</span>
            <span>{SKIN_ICON[mission.opponentSkin]} {mission.opponentName}</span>
          </div>
        </div>
      </div>

      <div className={styles.body}>
        {/* Left — editor */}
        <div className={styles.editorPane}>
          <div className={styles.storyBox}>
            <p className={styles.storyText}>{mission.story}</p>
          </div>

          <div className={styles.editorWrap}>
            <CodeEditor
              value={code}
              language="javascript"
              onChange={v => setCode(v ?? '')}
              readOnly={phase === 'animating'}
            />
          </div>

          {codeError && <div className={styles.codeError}>{codeError}</div>}

          <div className={styles.editorActions}>
            {phase === 'coding' && (
              <button className="btn btn-primary" onClick={handleRun} style={{ fontSize: 14 }}>
                ▶ Запустить бой
              </button>
            )}
            {phase === 'animating' && (
              <button className="btn btn-ghost" onClick={handleReset} style={{ fontSize: 13 }}>
                ⏹ Остановить
              </button>
            )}
            {phase === 'result' && (
              <div className={styles.resultActions}>
                <button className="btn btn-ghost" onClick={handleReset}>
                  🔄 Попробовать снова
                </button>
                {winner === 1 && nextMission && (
                  <button className="btn btn-primary" onClick={() => navigate(`/learn/${nextMission.id}`)}>
                    Следующая миссия →
                  </button>
                )}
                {winner === 1 && !nextMission && (
                  <button className="btn btn-primary" onClick={() => navigate('/learn')}>
                    🏆 Все миссии пройдены!
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right — battle log / result */}
        <div className={styles.rightPane}>
          {phase === 'coding' && (
            <div className={styles.idlePanel}>
              <div className={styles.idleIcon}>{SKIN_ICON[mission.opponentSkin]}</div>
              <p className={styles.idleText}>Напиши код и нажми «Запустить бой»</p>
              <div className={styles.apiHints}>
                <div className={styles.apiTitle}>Функция стратегии:</div>
                <code className={styles.apiBlock}>{'function strategy(ctx) { return "attack"; }'}</code>
                <div className={styles.apiTitle} style={{ marginTop: 8 }}>Контекст ctx:</div>
                {[
                  'ctx.myHp', 'ctx.myStamina', 'ctx.myRage',
                  'ctx.enemyHp', 'ctx.enemyStamina',
                  'ctx.myLastAction', 'ctx.enemyLastAction',
                  'ctx.cooldowns.laser', 'ctx.myRepeatCount',
                ].map(p => (
                  <code key={p} className={styles.apiChip}>{p}</code>
                ))}
                <div className={styles.apiTitle} style={{ marginTop: 8 }}>Действия:</div>
                {(['attack', 'heavy', 'laser', 'shield', 'dodge', 'repair', 'special'] as const).map(fn => (
                  <code key={fn} className={styles.apiChip}>
                    {ACTION_ICON[fn]} {fn}
                  </code>
                ))}
              </div>
            </div>
          )}

          {(phase === 'animating' || phase === 'result') && (
            <div className={styles.battlePane}>
              {/* Stats bars — HP, Stamina, Rage */}
              <div className={styles.statsSection}>
                <div className={styles.statsCol}>
                  <div className={styles.statsLabel}>🧑‍💻 Ты</div>
                  <StatBar
                    value={displayTurn?.p1HpAfter ?? MAX_HP}
                    max={MAX_HP}
                    color="#4ade80"
                    lowColor="#f87171"
                    label={`${displayTurn?.p1HpAfter ?? MAX_HP} HP`}
                  />
                  <StatBar
                    value={displayTurn?.p1Stamina ?? MAX_STAMINA}
                    max={MAX_STAMINA}
                    color="#60a5fa"
                    label={`${displayTurn?.p1Stamina ?? MAX_STAMINA} STA`}
                  />
                  <RageBar
                    value={displayTurn?.p1Rage ?? 0}
                    max={MAX_RAGE}
                  />
                </div>

                <div className={styles.statsMid}>
                  <span className={styles.scoreNum}>{score[0]}</span>
                  <span className={styles.scoreDash}>–</span>
                  <span className={styles.scoreNum}>{score[1]}</span>
                </div>

                <div className={styles.statsCol} style={{ alignItems: 'flex-end' }}>
                  <div className={styles.statsLabel}>{SKIN_ICON[mission.opponentSkin]} {mission.opponentName}</div>
                  <StatBar
                    value={displayTurn?.p2HpAfter ?? MAX_HP}
                    max={MAX_HP}
                    color="#4ade80"
                    lowColor="#f87171"
                    label={`${displayTurn?.p2HpAfter ?? MAX_HP} HP`}
                    flip
                  />
                  <StatBar
                    value={displayTurn?.p2Stamina ?? MAX_STAMINA}
                    max={MAX_STAMINA}
                    color="#60a5fa"
                    label={`${displayTurn?.p2Stamina ?? MAX_STAMINA} STA`}
                    flip
                  />
                  <RageBar
                    value={displayTurn?.p2Rage ?? 0}
                    max={MAX_RAGE}
                    flip
                  />
                </div>
              </div>

              {/* Current turn */}
              {displayTurn && phase === 'animating' && (
                <div className={styles.turnDisplay}>
                  <TurnCard
                    label="Ты"
                    action={displayTurn.p1Action}
                    dmg={displayTurn.p1DmgTaken}
                    heal={displayTurn.p1Heal}
                  />
                  <span className={styles.turnVs}>⚡</span>
                  <TurnCard
                    label={mission.opponentName}
                    action={displayTurn.p2Action}
                    dmg={displayTurn.p2DmgTaken}
                    heal={displayTurn.p2Heal}
                  />
                </div>
              )}

              {/* Turn log */}
              <div className={styles.turnLog}>
                {rounds.flatMap(r => r.turns).slice(-10).reverse().map(t => (
                  <div key={`${t.turn}`} className={styles.logRow}>
                    <span className={styles.logTurn}>#{t.turn}</span>
                    <span className={styles.logAction}>
                      {ACTION_ICON[t.p1Action] ?? '?'} {t.p1Action}
                    </span>
                    {t.p2DmgTaken > 0 && <span className={styles.logDmg}>-{t.p2DmgTaken}</span>}
                    {t.p2DmgTaken === 0 && t.p1Action !== 'shield' && t.p1Action !== 'dodge' && t.p1Action !== 'repair' && (
                      <span className={styles.logMiss}>MISS</span>
                    )}
                    <span className={styles.logVs}>|</span>
                    <span className={styles.logAction}>
                      {ACTION_ICON[t.p2Action] ?? '?'} {t.p2Action}
                    </span>
                    {t.p1DmgTaken > 0 && <span className={styles.logDmg}>-{t.p1DmgTaken}</span>}
                    {t.p1DmgTaken === 0 && t.p2Action !== 'shield' && t.p2Action !== 'dodge' && t.p2Action !== 'repair' && (
                      <span className={styles.logMiss}>MISS</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Result banner */}
              {phase === 'result' && (
                <div className={`${styles.resultBanner} ${winner === 1 ? styles.bannerWin : winner === 2 ? styles.bannerLose : styles.bannerDraw}`}>
                  {winner === 1 ? '🏆 ПОБЕДА!' : winner === 2 ? '💀 ПОРАЖЕНИЕ' : '🤝 НИЧЬЯ'}
                  <div className={styles.resultSub}>
                    {winner === 1
                      ? 'Отличная стратегия! Можешь улучшить код и попробовать снова.'
                      : 'Измени стратегию и попробуй ещё раз!'}
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

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBar({
  value, max, color, lowColor, label, flip,
}: {
  value: number; max: number; color: string; lowColor?: string; label: string; flip?: boolean
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const fill = lowColor ? (pct > 50 ? color : pct > 25 ? '#facc15' : lowColor) : color
  return (
    <div className={styles.statRow} style={{ flexDirection: flip ? 'row-reverse' : 'row' }}>
      <span className={styles.statLabel}>{label}</span>
      <div className={styles.statTrack}>
        <div
          className={styles.statFill}
          style={{
            width: `${pct}%`,
            background: fill,
            marginLeft: flip ? 'auto' : undefined,
          }}
        />
      </div>
    </div>
  )
}

function RageBar({ value, max, flip }: { value: number; max: number; flip?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const ready = pct >= 100
  return (
    <div className={styles.statRow} style={{ flexDirection: flip ? 'row-reverse' : 'row' }}>
      <span className={styles.statLabel} style={{ color: ready ? '#f97316' : undefined }}>
        {ready ? '☄️ RAGE!' : `${Math.round(value)} RAGE`}
      </span>
      <div className={styles.statTrack}>
        <div
          className={styles.statFill}
          style={{
            width: `${pct}%`,
            background: ready ? '#f97316' : '#a855f7',
            marginLeft: flip ? 'auto' : undefined,
            boxShadow: ready ? '0 0 8px #f97316' : undefined,
          }}
        />
      </div>
    </div>
  )
}

function TurnCard({ label, action, dmg, heal }: { label: string; action: string; dmg: number; heal: number }) {
  return (
    <div className={styles.turnCard}>
      <div className={styles.turnLabel}>{label}</div>
      <div className={styles.turnIcon}>{ACTION_ICON[action] ?? '❓'}</div>
      <div className={styles.turnAction}>{action}</div>
      {dmg > 0 && <div className={styles.turnDmg}>-{dmg} HP</div>}
      {heal > 0 && <div className={styles.turnHeal}>+{heal} HP</div>}
    </div>
  )
}
