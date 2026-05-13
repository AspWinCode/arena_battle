import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { CHARACTER_STATS, SKIN_ICON } from '@robocode/shared'
import type { SkinId, Strategy, StrategyContext, TurnResult, RoundResult } from '@robocode/shared'
import { runLocalMatch } from '../engine/battleEngine'
import SpineCharacter from '../components/SpineCharacter/SpineCharacter'
import styles from './DemoBattlePage.module.css'

// ── Per-character preset strategies ───────────────────────────────────────────

function makeStrategy(skin: SkinId): Strategy {
  const fn = (ctx: StrategyContext) => {
    const { myHp, myMaxHp, myRage, myStamina, enemyHp, enemyLastAction, cooldowns } = ctx
    const hpPct = myHp / myMaxHp

    // Special when ready (most characters)
    if (myRage >= 100 && cooldowns.special === 0) return 'special'

    // Low HP behaviour
    if (hpPct < 0.25) {
      if (cooldowns.repair === 0) return 'repair'
      if (cooldowns.dodge === 0) return 'dodge'
    }

    // React to last enemy action
    if (enemyLastAction === 'laser' && cooldowns.dodge === 0) return 'dodge'
    if (enemyLastAction === 'heavy' && cooldowns.shield === 0) return 'shield'

    // Character-specific logic
    switch (skin) {
      case 'gladiator':
      case 'berserker':
      case 'scorpion':
        if (myStamina >= 35 && cooldowns.heavy === 0) return 'heavy'
        return 'attack'

      case 'cosmonaut':
      case 'mage':
      case 'sniper':
      case 'engineer':
        if (cooldowns.laser === 0) return 'laser'
        if (myStamina >= 35 && cooldowns.heavy === 0) return 'heavy'
        return 'attack'

      case 'ninja':
      case 'phantom':
        if (enemyLastAction === 'attack' && cooldowns.dodge === 0) return 'dodge'
        if (myStamina >= 35 && cooldowns.heavy === 0) return 'heavy'
        return 'attack'

      case 'paladin':
      case 'tank':
        if (hpPct < 0.6 && cooldowns.shield === 0) return 'shield'
        if (cooldowns.laser === 0) return 'laser'
        return 'attack'

      case 'vampire':
        if (myStamina >= 35 && cooldowns.heavy === 0) return 'heavy'
        return 'attack'

      case 'samurai':
        if (hpPct < 0.35) return 'heavy' // bushido rage mode
        if (cooldowns.laser === 0) return 'laser'
        return 'attack'

      case 'plague':
        if (enemyHp > 60 && cooldowns.heavy === 0 && myStamina >= 35) return 'heavy'
        if (cooldowns.repair === 0 && hpPct < 0.5) return 'repair'
        return 'attack'

      case 'boxer':
        if (ctx.myLastAction === 'dodge' && cooldowns.attack === 0) return 'attack'
        if (enemyLastAction === 'attack' || enemyLastAction === 'heavy') return 'dodge'
        return 'attack'

      default: // robot
        if (hpPct < 0.4 && cooldowns.repair === 0) return 'repair'
        if (myStamina >= 35 && cooldowns.heavy === 0) return 'heavy'
        return 'attack'
    }
  }

  return {
    primary:   'attack',
    lowHp:     'repair',
    onHit:     'dodge',
    style:     'Balanced',
    position:  'mid',
    character: skin,
    fn,
  }
}

// ── Character roster for picking ──────────────────────────────────────────────

const ROSTER = Object.entries(CHARACTER_STATS).map(([id, ch]) => ({
  id: id as SkinId,
  name: ch.name,
  icon: ch.icon,
  color: ch.color,
  tagline: ch.tagline,
}))

type Phase = 'select' | 'battle' | 'result'

const ACTION_ICON: Record<string, string> = {
  attack: '👊', heavy: '💥', laser: '⚡',
  shield: '🛡', dodge: '💨', repair: '💊', special: '☄️',
}
const ACTION_LABEL: Record<string, string> = {
  attack: 'Удар', heavy: 'Тяжёлый', laser: 'Лазер',
  shield: 'Щит', dodge: 'Уклон', repair: 'Ремонт', special: 'СПЕШЛ',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DemoBattlePage() {
  const [phase,      setPhase]      = useState<Phase>('select')
  const [p1Skin,     setP1Skin]     = useState<SkinId>('robot')
  const [p2Skin,     setP2Skin]     = useState<SkinId>('gladiator')

  const [rounds,     setRounds]     = useState<RoundResult[]>([])
  const [winner,     setWinner]     = useState<0|1|2>(0)
  const [score,      setScore]      = useState<[number,number]>([0,0])
  const [curTurn,    setCurTurn]    = useState<TurnResult | null>(null)
  const [turnLog,    setTurnLog]    = useState<TurnResult[]>([])
  const [action1,    setAction1]    = useState<string | null>(null)
  const [action2,    setAction2]    = useState<string | null>(null)

  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const p1Stats = CHARACTER_STATS[p1Skin]
  const p2Stats = CHARACTER_STATS[p2Skin]

  const p1MaxHp = p1Stats?.maxHp ?? 100
  const p2MaxHp = p2Stats?.maxHp ?? 100

  const p1Hp  = curTurn ? curTurn.p1HpAfter : p1MaxHp
  const p2Hp  = curTurn ? curTurn.p2HpAfter : p2MaxHp
  const turn  = curTurn?.turn ?? 0

  const handleStart = useCallback(() => {
    if (animRef.current) clearTimeout(animRef.current)

    const result = runLocalMatch(
      makeStrategy(p1Skin),
      makeStrategy(p2Skin),
      'bo3',
    )
    setRounds(result.rounds)
    setWinner(result.winner)
    setScore(result.score)
    setCurTurn(null)
    setTurnLog([])
    setAction1(null)
    setAction2(null)
    setPhase('battle')

    const allTurns: TurnResult[] = []
    for (const r of result.rounds) allTurns.push(...r.turns)

    let idx = 0
    const step = () => {
      if (idx >= allTurns.length) {
        setPhase('result')
        return
      }
      const t = allTurns[idx++]
      setCurTurn(t)
      setAction1(t.p1Action)
      setAction2(t.p2Action)
      setTurnLog(prev => [...prev, t].slice(-25))
      animRef.current = setTimeout(step, 350)
    }
    step()
  }, [p1Skin, p2Skin])

  const handleReset = useCallback(() => {
    if (animRef.current) clearTimeout(animRef.current)
    setPhase('select')
    setCurTurn(null)
    setTurnLog([])
    setAction1(null)
    setAction2(null)
  }, [])

  return (
    <div className={styles.page}>

      {/* ── Top bar ────────────────────────────────────────────── */}
      <div className={styles.topBar}>
        <Link to="/" className={styles.backLink}>← Главная</Link>
        <div className={styles.topTitle}>
          <span className={styles.demoBadge}>ДЕМО</span>
          Быстрый бой — без регистрации
        </div>
        <Link to="/register" className={`${styles.registerBtn}`}>Создать аккаунт →</Link>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SELECT PHASE
      ══════════════════════════════════════════════════════════ */}
      {phase === 'select' && (
        <div className={styles.selectWrap}>
          <h1 className={styles.selectTitle}>Выбери бойцов</h1>
          <p className={styles.selectSub}>Выбери своего персонажа и противника — и жми в бой!</p>

          <div className={styles.pickers}>
            {/* Left picker */}
            <div className={styles.pickerCol}>
              <div className={styles.pickerLabel}>
                <span className={styles.pickerDot} style={{ background: '#4ade80' }} />
                Твой боец
              </div>
              <div className={styles.charGrid}>
                {ROSTER.map(ch => (
                  <button
                    key={ch.id}
                    className={`${styles.charCard} ${p1Skin === ch.id ? styles.charCardP1 : ''}`}
                    style={{ '--cc': ch.color } as React.CSSProperties}
                    onClick={() => setP1Skin(ch.id)}
                  >
                    <span className={styles.charIcon}>{ch.icon}</span>
                    <span className={styles.charName}>{ch.name}</span>
                    <span className={styles.charTag}>{ch.tagline}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* VS divider */}
            <div className={styles.vsCol}>
              <div className={styles.vsCircle}>VS</div>
              <div className={styles.vsFighters}>
                <div className={styles.vsPreview}>
                  <span className={styles.vsIcon}>{p1Stats?.icon}</span>
                  <span className={styles.vsName}>{p1Stats?.name}</span>
                  <span className={styles.vsTagline}>{p1Stats?.tagline}</span>
                </div>
                <div className={styles.vsDivider} />
                <div className={`${styles.vsPreview} ${styles.vsPreviewRight}`}>
                  <span className={styles.vsIcon}>{p2Stats?.icon}</span>
                  <span className={styles.vsName}>{p2Stats?.name}</span>
                  <span className={styles.vsTagline}>{p2Stats?.tagline}</span>
                </div>
              </div>
              <button className={styles.fightBtn} onClick={handleStart}>
                ⚔️ Начать бой!
              </button>
            </div>

            {/* Right picker */}
            <div className={styles.pickerCol}>
              <div className={styles.pickerLabel}>
                <span className={styles.pickerDot} style={{ background: '#f87171' }} />
                Противник
              </div>
              <div className={styles.charGrid}>
                {ROSTER.map(ch => (
                  <button
                    key={ch.id}
                    className={`${styles.charCard} ${p2Skin === ch.id ? styles.charCardP2 : ''}`}
                    style={{ '--cc': ch.color } as React.CSSProperties}
                    onClick={() => setP2Skin(ch.id)}
                  >
                    <span className={styles.charIcon}>{ch.icon}</span>
                    <span className={styles.charName}>{ch.name}</span>
                    <span className={styles.charTag}>{ch.tagline}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          BATTLE PHASE
      ══════════════════════════════════════════════════════════ */}
      {(phase === 'battle' || phase === 'result') && (
        <div className={styles.battleWrap}>

          {/* Score strip */}
          <div className={styles.scoreStrip}>
            <span className={styles.scorePlayer}>
              {SKIN_ICON[p1Skin]} {p1Stats?.name}
            </span>
            <span className={styles.scorePill}>
              {score[0]} — {score[1]}
            </span>
            <span className={styles.scorePlayer}>
              {SKIN_ICON[p2Skin]} {p2Stats?.name}
            </span>
          </div>

          {/* Arena */}
          <div className={styles.arena}>

            {/* P1 side */}
            <div className={styles.fighterSide}>
              <div className={styles.hpBlock}>
                <div className={styles.hpLabel}>{Math.max(0, p1Hp)} HP</div>
                <div className={styles.hpTrack}>
                  <div
                    className={styles.hpFill}
                    style={{
                      width: `${Math.max(0, (p1Hp / p1MaxHp) * 100)}%`,
                      background: p1Hp / p1MaxHp > 0.5 ? '#4ade80' : p1Hp / p1MaxHp > 0.25 ? '#facc15' : '#f87171',
                    }}
                  />
                </div>
              </div>
              <div className={styles.spineWrap}>
                <SpineCharacter
                  skinId={p1Skin}
                  action={action1 as any}
                  turnKey={curTurn?.turn}
                  flipX={false}
                  isDead={p1Hp <= 0}
                  style={{ width: 160, height: 240 }}
                />
              </div>
              {action1 && (
                <div className={styles.actionBubble} style={{ background: 'rgba(74,222,128,.12)', borderColor: 'rgba(74,222,128,.3)' }}>
                  {ACTION_ICON[action1]} {ACTION_LABEL[action1]}
                </div>
              )}
            </div>

            {/* Center */}
            <div className={styles.centerCol}>
              <div className={styles.turnChip}>
                {phase === 'battle' ? `Ход ${turn}` : '🏁 Конец'}
              </div>
              <div className={styles.vsCenter}>VS</div>
            </div>

            {/* P2 side */}
            <div className={`${styles.fighterSide} ${styles.fighterSideRight}`}>
              <div className={styles.hpBlock}>
                <div className={styles.hpLabel}>{Math.max(0, p2Hp)} HP</div>
                <div className={styles.hpTrack}>
                  <div
                    className={styles.hpFill}
                    style={{
                      width: `${Math.max(0, (p2Hp / p2MaxHp) * 100)}%`,
                      background: p2Hp / p2MaxHp > 0.5 ? '#f87171' : p2Hp / p2MaxHp > 0.25 ? '#facc15' : '#ef4444',
                    }}
                  />
                </div>
              </div>
              <div className={styles.spineWrap}>
                <SpineCharacter
                  skinId={p2Skin}
                  action={action2 as any}
                  turnKey={curTurn?.turn}
                  flipX={true}
                  isDead={p2Hp <= 0}
                  style={{ width: 160, height: 240 }}
                />
              </div>
              {action2 && (
                <div className={styles.actionBubble} style={{ background: 'rgba(248,113,113,.12)', borderColor: 'rgba(248,113,113,.3)' }}>
                  {ACTION_ICON[action2]} {ACTION_LABEL[action2]}
                </div>
              )}
            </div>
          </div>

          {/* Turn log */}
          <div className={styles.logWrap}>
            {[...turnLog].reverse().slice(0, 6).map((t, i) => (
              <div key={`${t.turn}-${i}`} className={`${styles.logRow} ${i === 0 ? styles.logRowLatest : ''}`}>
                <span className={styles.logTurn}>#{t.turn}</span>
                <span className={styles.logP1}>
                  {ACTION_ICON[t.p1Action]} {t.p1Action}
                </span>
                <span className={styles.logVs}>vs</span>
                <span className={styles.logP2}>
                  {ACTION_ICON[t.p2Action]} {t.p2Action}
                </span>
                <span className={styles.logNote}>{t.log}</span>
              </div>
            ))}
          </div>

          {/* Result overlay */}
          {phase === 'result' && (
            <div className={styles.resultOverlay}>
              <div className={styles.resultCard}>
                <div className={styles.resultEmoji}>
                  {winner === 1 ? '🏆' : winner === 2 ? '💀' : '🤝'}
                </div>
                <div className={`${styles.resultTitle}
                  ${winner === 1 ? styles.resultWin : winner === 2 ? styles.resultLose : styles.resultDraw}`}>
                  {winner === 1
                    ? `${p1Stats?.name} победил!`
                    : winner === 2
                    ? `${p2Stats?.name} победил!`
                    : 'Ничья!'}
                </div>
                <div className={styles.resultScore}>{score[0]} – {score[1]}</div>

                <div className={styles.resultSummary}>
                  {rounds.map((r, i) => (
                    <span key={i} className={`${styles.roundPip}
                      ${r.winner === 1 ? styles.pipP1 : r.winner === 2 ? styles.pipP2 : styles.pipDraw}`}>
                      R{r.round}
                    </span>
                  ))}
                </div>

                <div className={styles.resultActions}>
                  <button className={styles.replayBtn} onClick={handleStart}>
                    🔄 Снова!
                  </button>
                  <button className={styles.changeBtn} onClick={handleReset}>
                    ↩ Поменять бойцов
                  </button>
                </div>

                <div className={styles.resultCta}>
                  <div className={styles.ctaText}>
                    Хочешь писать стратегии сам — и управлять каждым ходом?
                  </div>
                  <Link to="/register" className={styles.ctaBtn}>
                    🚀 Создать аккаунт бесплатно
                  </Link>
                  <Link to="/login" className={styles.ctaLogin}>
                    Уже есть аккаунт? Войти →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
