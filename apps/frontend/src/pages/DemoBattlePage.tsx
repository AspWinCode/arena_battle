import { useState, useRef, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CHARACTER_STATS, SKIN_ICON } from '@robocode/shared'
import { useCharacterThumbs } from '../hooks/useCharacterThumbs'
import type { SkinId, Strategy, StrategyContext, TurnResult, RoundResult } from '@robocode/shared'
import { runLocalMatch } from '../engine/battleEngine'
import { SPINE_SKIN_CONFIG } from '../components/SpineCharacter/SpineCharacter'
import CharacterView from '../animation/CharacterView'
import type { CharacterViewHandle } from '../animation/CharacterView'
import { AnimationPlayer } from '../animation/AnimationPlayer'
import { turnToEvents } from '../animation/battleReplay'
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
  const thumbs = useCharacterThumbs()
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

  // CharacterView imperative refs
  const p1CharRef = useRef<CharacterViewHandle>(null)
  const p2CharRef = useRef<CharacterViewHandle>(null)

  // AnimationPlayer — stable across renders
  const playerRef = useRef<AnimationPlayer>(new AnimationPlayer())

  // ── Preload Spine assets for selected characters while on select screen ───────
  useEffect(() => {
    if (phase !== 'select') return
    const dirs = new Set([p1Skin, p2Skin].map(skin => {
      const cfg = SPINE_SKIN_CONFIG[skin] ?? SPINE_SKIN_CONFIG['default']
      return cfg.dir
    }))
    dirs.forEach(dir => {
      const base = `/spine/${dir}/`
      fetch(base + 'spineboy.json').catch(() => {})
      fetch(base + 'spineboy.atlas').catch(() => {})
      fetch(base + 'spineboy.png').catch(() => {})
    })
  }, [p1Skin, p2Skin, phase])

  const p1Stats = CHARACTER_STATS[p1Skin]
  const p2Stats = CHARACTER_STATS[p2Skin]

  const p1MaxHp = p1Stats?.maxHp ?? 100
  const p2MaxHp = p2Stats?.maxHp ?? 100

  const p1Hp  = curTurn ? curTurn.p1HpAfter : p1MaxHp
  const p2Hp  = curTurn ? curTurn.p2HpAfter : p2MaxHp
  const turn  = curTurn?.turn ?? 0

  const handleStart = useCallback(() => {
    const player = playerRef.current
    player.pause()

    const result = runLocalMatch(
      makeStrategy(p1Skin),
      makeStrategy(p2Skin),
      'bo3',
    )

    const allTurns: TurnResult[] = []
    for (const r of result.rounds) allTurns.push(...r.turns)

    setRounds(result.rounds)
    setWinner(result.winner)
    setScore(result.score)
    setCurTurn(null)
    setTurnLog([])
    setAction1(null)
    setAction2(null)
    setPhase('battle')

    // Reset CharacterViews
    p1CharRef.current?.reset()
    p2CharRef.current?.reset()

    // Build per-turn event groups (each group = one turn's events)
    const eventGroups = allTurns.map(t => turnToEvents(t))
    player.loadTurns(eventGroups)

    // Wire up callbacks
    player.onTurnStart = (idx) => {
      const t = allTurns[idx]
      if (!t) return
      setCurTurn(t)
      setTurnLog(prev => [...prev, t].slice(-25))
    }

    player.onEvent = (event) => {
      // Update action badges
      if (event.type === 'action') {
        if (event.actor === 'p1') setAction1(event.action)
        else setAction2(event.action)
      }
      // Drive character animations
      if (event.actor === 'p1') p1CharRef.current?.applyEvent(event)
      else p2CharRef.current?.applyEvent(event)
    }

    player.onComplete = () => setPhase('result')

    player.play()
  }, [p1Skin, p2Skin])

  const handleReset = useCallback(() => {
    playerRef.current.pause()
    setPhase('select')
    setCurTurn(null)
    setTurnLog([])
    setAction1(null)
    setAction2(null)
    p1CharRef.current?.reset()
    p2CharRef.current?.reset()
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
                    {thumbs[ch.id]
                      ? <img src={thumbs[ch.id]} className={styles.charThumb} alt={ch.name} />
                      : <span className={styles.charIcon}>{ch.icon}</span>}
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
                  {p1Skin && thumbs[p1Skin]
                    ? <img src={thumbs[p1Skin]} className={styles.vsThumb} alt="" />
                    : <span className={styles.vsIcon}>{p1Stats?.icon}</span>}
                  <span className={styles.vsName}>{p1Stats?.name}</span>
                  <span className={styles.vsTagline}>{p1Stats?.tagline}</span>
                </div>
                <div className={styles.vsDivider} />
                <div className={`${styles.vsPreview} ${styles.vsPreviewRight}`}>
                  {p2Skin && thumbs[p2Skin]
                    ? <img src={thumbs[p2Skin]} className={styles.vsThumb} alt="" />
                    : <span className={styles.vsIcon}>{p2Stats?.icon}</span>}
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
                    {thumbs[ch.id]
                      ? <img src={thumbs[ch.id]} className={styles.charThumb} alt={ch.name} />
                      : <span className={styles.charIcon}>{ch.icon}</span>}
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

          {/* ── Stats header: two HP bars + score in center ── */}
          <div className={styles.statsHeader}>

            {/* P1 */}
            <div className={styles.statsSide}>
              <div className={styles.statsName}>
                {thumbs[p1Skin]
                  ? <img src={thumbs[p1Skin]} className={styles.statsThumb} alt="" />
                  : <span>{p1Stats?.icon}</span>}
                <span>{p1Stats?.name}</span>
              </div>
              <div className={styles.hpRow}>
                <div className={styles.hpTrack}>
                  <div
                    className={styles.hpFillLeft}
                    style={{
                      width: `${Math.max(0, (p1Hp / p1MaxHp) * 100)}%`,
                      background: p1Hp / p1MaxHp > 0.5 ? '#4ade80' : p1Hp / p1MaxHp > 0.25 ? '#facc15' : '#f87171',
                    }}
                  />
                </div>
                <span className={styles.hpNum}>{Math.max(0, p1Hp)}</span>
              </div>
            </div>

            {/* Score center */}
            <div className={styles.statsCenter}>
              <div className={styles.scoreBig}>{score[0]} — {score[1]}</div>
              <div className={styles.turnBadge}>
                {phase === 'battle' ? `Ход ${turn}` : '🏁 Конец'}
              </div>
            </div>

            {/* P2 */}
            <div className={`${styles.statsSide} ${styles.statsSideRight}`}>
              <div className={`${styles.statsName} ${styles.statsNameRight}`}>
                <span>{p2Stats?.name}</span>
                {thumbs[p2Skin]
                  ? <img src={thumbs[p2Skin]} className={styles.statsThumb} alt="" />
                  : <span>{p2Stats?.icon}</span>}
              </div>
              <div className={`${styles.hpRow} ${styles.hpRowRight}`}>
                <span className={styles.hpNum}>{Math.max(0, p2Hp)}</span>
                <div className={styles.hpTrack}>
                  <div
                    className={styles.hpFillRight}
                    style={{
                      width: `${Math.max(0, (p2Hp / p2MaxHp) * 100)}%`,
                      background: p2Hp / p2MaxHp > 0.5 ? '#f87171' : p2Hp / p2MaxHp > 0.25 ? '#facc15' : '#ef4444',
                    }}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* ── Arena stage ── */}
          <div className={styles.arena}>

            {/* P1 fighter */}
            <div className={styles.fighter}>
              <CharacterView
                ref={p1CharRef}
                skinId={p1Skin}
                flipX={false}
                className={styles.spineChar}
              />
              {action1 && (
                <div className={styles.actionTag} data-side="left">
                  {ACTION_ICON[action1]} {ACTION_LABEL[action1]}
                </div>
              )}
            </div>

            {/* VS divider */}
            <div className={styles.vsDiv}>
              <span className={styles.vsText}>VS</span>
            </div>

            {/* P2 fighter */}
            <div className={`${styles.fighter} ${styles.fighterRight}`}>
              <CharacterView
                ref={p2CharRef}
                skinId={p2Skin}
                flipX={true}
                className={styles.spineChar}
              />
              {action2 && (
                <div className={styles.actionTag} data-side="right">
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
