import { useRef, useEffect, useCallback } from 'react'
import type { SkinId, ActionName, TurnResult } from '@robocode/shared'
import CharacterView from '../../animation/CharacterView'
import type { CharacterViewHandle } from '../../animation/CharacterView'
import { turnToEvents } from '../../animation/battleReplay'
import VFXCanvas, { type VFXHandle } from './VFXCanvas'
import styles from './ArenaComponent.module.css'

const W = 600
const H = 380
const ROBOT_Y = 340   // SVG y where feet touch the floor

// X positions per spacing tier
const POSITION_X: Record<string, { p1: number; p2: number }> = {
  close: { p1: 230, p2: 370 },
  mid:   { p1: 190, p2: 410 },
  far:   { p1: 140, p2: 460 },
}

const SKIN_COLORS: Record<string, string> = {
  robot:     '#00e5ff',
  gladiator: '#d97706',
  boxer:     '#e6261f',
  cosmonaut: '#f0f9ff',
  ninja:     '#7c3aed',
  mage:      '#c4b5fd',
  paladin:   '#fef08a',
  sniper:    '#86efac',
  tank:      '#d6d3d1',
  vampire:   '#fca5a5',
  samurai:   '#fca5a5',
  phantom:   '#a78bfa',
  engineer:  '#fde68a',
  berserker: '#f87171',
}

interface Props {
  p1Skin:   SkinId
  p2Skin:   SkinId
  p1Name:   string
  p2Name:   string
  p1Hp:     number
  p2Hp:     number
  p1MaxHp:  number
  p2MaxHp:  number
  latestTurn: TurnResult | null
  round:    number
}

// ── HP bar drawn directly in SVG ──────────────────────────────────────────────
function HpBar({ x, y, hp, maxHp, name }: { x: number; y: number; hp: number; maxHp: number; name: string }) {
  const pct   = Math.max(0, Math.min(100, (hp / maxHp) * 100))
  const color = pct > 50 ? '#22c55e' : pct > 25 ? '#fbbf24' : '#ef4444'
  const bx = x - 55
  const by = y - 220
  return (
    <g transform={`translate(${bx},${by})`}>
      {/* Background track */}
      <rect x={0} y={0} width={110} height={10} rx={4} fill="#1a1a35" />
      {/* HP fill */}
      <rect x={0} y={0} width={pct * 1.1} height={10} rx={4} fill={color} />
      {/* HP number above */}
      <text x={55} y={-5} textAnchor="middle" fill={color} fontSize={12} fontWeight={700}>{hp}</text>
      {/* Name below */}
      <text x={55} y={24} textAnchor="middle" fill="#94a3b8" fontSize={12} fontWeight={600}>{name}</text>
    </g>
  )
}

export default function ArenaComponent({
  p1Skin, p2Skin, p1Name, p2Name,
  p1Hp, p2Hp, p1MaxHp, p2MaxHp,
  latestTurn, round,
}: Props) {
  const vfxRef      = useRef<VFXHandle>(null)
  const p1CharRef   = useRef<CharacterViewHandle>(null)
  const p2CharRef   = useRef<CharacterViewHandle>(null)
  const prevTurnRef = useRef<TurnResult | null>(null)
  const prevP1Hp    = useRef(p1MaxHp)
  const prevP2Hp    = useRef(p2MaxHp)
  const prevP1Pos   = useRef<string>('mid')
  const prevP2Pos   = useRef<string>('mid')

  // Effective position tier
  const p1Pos = latestTurn?.p1Position ?? 'mid'
  const p2Pos = latestTurn?.p2Position ?? 'mid'
  const effectivePos = (p1Pos === 'close' || p2Pos === 'close') ? 'close'
    : (p1Pos === 'far'   || p2Pos === 'far')   ? 'far' : 'mid'
  const P1_X = POSITION_X[effectivePos].p1
  const P2_X = POSITION_X[effectivePos].p2

  // ── VFX trigger ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!latestTurn || !vfxRef.current) return
    if (latestTurn === prevTurnRef.current) return
    prevTurnRef.current = latestTurn

    const vfx = vfxRef.current
    const { p1Action, p2Action, p1DmgTaken, p2DmgTaken, p1Heal, p2Heal } = latestTurn

    const p1c = SKIN_COLORS[p1Skin] ?? '#00e5ff'
    const p2c = SKIN_COLORS[p2Skin] ?? '#e6261f'

    const pos = effectivePos
    const cx1 = POSITION_X[pos].p1
    const cx2 = POSITION_X[pos].p2

    // Death
    if (prevP1Hp.current > 0 && p1Hp === 0) { vfx.spawnDeathExplosion(cx1, ROBOT_Y - 60, p1c); vfx.shake(14) }
    if (prevP2Hp.current > 0 && p2Hp === 0) { vfx.spawnDeathExplosion(cx2, ROBOT_Y - 60, p2c); vfx.shake(14) }
    prevP1Hp.current = p1Hp
    prevP2Hp.current = p2Hp

    // Movement trail
    const p1CurPos = latestTurn.p1Position ?? 'mid'
    const p2CurPos = latestTurn.p2Position ?? 'mid'
    if (p1CurPos !== prevP1Pos.current) {
      const dir = p1CurPos === 'close' || (p1CurPos === 'mid' && prevP1Pos.current === 'far') ? 'forward' : 'backward'
      vfx.spawnMoveTrail(cx1, ROBOT_Y - 20, p1c, dir)
    }
    if (p2CurPos !== prevP2Pos.current) {
      const dir = p2CurPos === 'close' || (p2CurPos === 'mid' && prevP2Pos.current === 'far') ? 'forward' : 'backward'
      vfx.spawnMoveTrail(cx2, ROBOT_Y - 20, p2c, dir)
    }
    prevP1Pos.current = p1CurPos
    prevP2Pos.current = p2CurPos

    // Damage
    if (p1DmgTaken > 0) { vfx.spawnHitSparks(cx1, ROBOT_Y - 20, p2c); vfx.showHitNumber(cx1, ROBOT_Y - 60, p1DmgTaken); vfx.shake(6) }
    if (p2DmgTaken > 0) { vfx.spawnHitSparks(cx2, ROBOT_Y - 20, p1c); vfx.showHitNumber(cx2, ROBOT_Y - 60, p2DmgTaken); vfx.shake(6) }

    // Shield blocks
    const atkActions: (ActionName | undefined)[] = ['attack', 'laser', 'heavy', 'special']
    if (atkActions.includes(p1Action) && p2Action === 'shield' && p2DmgTaken === 0) vfx.spawnShieldBlock(cx2, ROBOT_Y - 30, p2c)
    if (atkActions.includes(p2Action) && p1Action === 'shield' && p1DmgTaken === 0) vfx.spawnShieldBlock(cx1, ROBOT_Y - 30, p1c)

    // Laser impacts
    if (p1Action === 'laser' && p2DmgTaken > 0) vfx.spawnLaserImpact(cx2, ROBOT_Y - 20, p1c)
    if (p2Action === 'laser' && p1DmgTaken > 0) vfx.spawnLaserImpact(cx1, ROBOT_Y - 20, p2c)

    // Heavy/special
    if (p1Action === 'heavy'   && p2DmgTaken > 0) vfx.spawnComboSparks(cx2, ROBOT_Y - 20, p1c)
    if (p2Action === 'heavy'   && p1DmgTaken > 0) vfx.spawnComboSparks(cx1, ROBOT_Y - 20, p2c)
    if (p1Action === 'special' && p2DmgTaken > 0) vfx.spawnComboSparks(cx2, ROBOT_Y - 20, p1c)
    if (p2Action === 'special' && p1DmgTaken > 0) vfx.spawnComboSparks(cx1, ROBOT_Y - 20, p2c)

    // Dodge
    if (p1Action === 'dodge') { vfx.spawnDodgeTrail(cx1, ROBOT_Y - 20, p1c); if (p1DmgTaken === 0) vfx.showLabel(cx1, ROBOT_Y - 50, 'DODGE', '#818cf8') }
    if (p2Action === 'dodge') { vfx.spawnDodgeTrail(cx2, ROBOT_Y - 20, p2c); if (p2DmgTaken === 0) vfx.showLabel(cx2, ROBOT_Y - 50, 'DODGE', '#818cf8') }

    // Miss
    if (atkActions.includes(p1Action) && p2DmgTaken === 0 && p2Action !== 'shield' && p2Action !== 'dodge') vfx.showLabel(cx2, ROBOT_Y - 50, 'MISS', '#6b7280')
    if (atkActions.includes(p2Action) && p1DmgTaken === 0 && p1Action !== 'shield' && p1Action !== 'dodge') vfx.showLabel(cx1, ROBOT_Y - 50, 'MISS', '#6b7280')

    // Repair
    if (p1Heal > 0) { vfx.spawnRepairParticles(cx1, ROBOT_Y); vfx.showHealNumber(cx1, ROBOT_Y - 60, p1Heal) }
    if (p2Heal > 0) { vfx.spawnRepairParticles(cx2, ROBOT_Y); vfx.showHealNumber(cx2, ROBOT_Y - 60, p2Heal) }

    if (p1DmgTaken > 20 || p2DmgTaken > 20) vfx.shake(10)
  }, [latestTurn, p1Skin, p2Skin, p1Hp, p2Hp, effectivePos])

  // ── Drive CharacterView via BattleEvents when a new turn arrives ─────────────
  useEffect(() => {
    if (!latestTurn) return
    const events = turnToEvents(latestTurn)
    for (const ev of events) {
      if (ev.actor === 'p1') p1CharRef.current?.applyEvent(ev)
      else p2CharRef.current?.applyEvent(ev)
    }
  }, [latestTurn])

  // ── CSS positioning helpers ────────────────────────────────────────────────
  // Convert SVG-space X to CSS percentage of stage width, centered on character
  const toCssLeft  = (svgX: number) => `${(svgX / W) * 100}%`
  // CSS bottom from SVG ROBOT_Y (feet position)
  const charBottom = `${((H - ROBOT_Y) / H) * 100}%`
  // Character slot: 28% wide, 72% tall (relative to stage)
  const charW = '28%'
  const charH = '72%'

  const p1Action = latestTurn?.p1Action ?? null
  const p2Action = latestTurn?.p2Action ?? null
  const p1Dead = p1Hp <= 0
  const p2Dead = p2Hp <= 0

  const POS_LABEL: Record<string, string> = { close: 'CLOSE', mid: 'MID', far: 'FAR' }
  const POS_COLOR: Record<string, string> = { close: '#ef4444', mid: '#fbbf24', far: '#22c55e' }

  return (
    <div className={styles.root}>
      {/* Round badge */}
      <div className={styles.roundBadge}>Раунд {round}</div>

      <div className={styles.stage}>
        {/* ── SVG: arena background + UI overlays ─────────────────────── */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%" height="100%"
          className={styles.svg}
        >
          <defs>
            <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a1a35" />
              <stop offset="100%" stopColor="#0a0a1a" />
            </linearGradient>
            <radialGradient id="arenaGlow" cx="50%" cy="80%" r="50%">
              <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="laserGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="laserGrad2" x1="100%" y1="0%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#e6261f" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#e6261f" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Background */}
          <rect width={W} height={H} fill="url(#floorGrad)" />
          <rect width={W} height={H} fill="url(#arenaGlow)" />

          {/* Grid lines */}
          {Array.from({ length: 7 }).map((_, i) => (
            <line key={i} x1={i*100} y1={0} x2={i*100} y2={H} stroke="#fff" strokeOpacity="0.02" strokeWidth={1} />
          ))}
          {Array.from({ length: 5 }).map((_, i) => (
            <line key={i} x1={0} y1={i*80} x2={W} y2={i*80} stroke="#fff" strokeOpacity="0.02" strokeWidth={1} />
          ))}

          {/* Floor */}
          <rect x={0} y={H-40} width={W} height={40} fill="#12122a" />
          <line x1={0} y1={H-40} x2={W} y2={H-40} stroke="#00e5ff" strokeOpacity="0.15" strokeWidth={1} />

          {/* Zone bands */}
          <rect x={0}   y={H-40} width={165} height={5} fill="#22c55e" opacity={0.25} />
          <rect x={435} y={H-40} width={165} height={5} fill="#22c55e" opacity={0.25} />
          <rect x={165} y={H-40} width={90}  height={5} fill="#fbbf24" opacity={0.28} />
          <rect x={345} y={H-40} width={90}  height={5} fill="#fbbf24" opacity={0.28} />
          <rect x={255} y={H-40} width={90}  height={5} fill="#ef4444" opacity={0.30} />

          {/* Zone boundary ticks */}
          <line x1={165} y1={H-47} x2={165} y2={H-40} stroke="#fbbf24" strokeOpacity="0.45" strokeWidth={1} />
          <line x1={435} y1={H-47} x2={435} y2={H-40} stroke="#fbbf24" strokeOpacity="0.45" strokeWidth={1} />
          <line x1={255} y1={H-47} x2={255} y2={H-40} stroke="#ef4444" strokeOpacity="0.45" strokeWidth={1} />
          <line x1={345} y1={H-47} x2={345} y2={H-40} stroke="#ef4444" strokeOpacity="0.45" strokeWidth={1} />

          {/* Zone labels */}
          <text x={82}  y={H-49} textAnchor="middle" fill="#22c55e" fontSize={7} fontWeight={700} opacity={0.55} letterSpacing="0.06em">FAR</text>
          <text x={518} y={H-49} textAnchor="middle" fill="#22c55e" fontSize={7} fontWeight={700} opacity={0.55} letterSpacing="0.06em">FAR</text>
          <text x={210} y={H-49} textAnchor="middle" fill="#fbbf24" fontSize={7} fontWeight={700} opacity={0.55} letterSpacing="0.06em">MID</text>
          <text x={390} y={H-49} textAnchor="middle" fill="#fbbf24" fontSize={7} fontWeight={700} opacity={0.55} letterSpacing="0.06em">MID</text>
          <text x={300} y={H-49} textAnchor="middle" fill="#ef4444" fontSize={7} fontWeight={700} opacity={0.55} letterSpacing="0.06em">CLOSE</text>

          {/* Center decoration */}
          <circle cx={W/2} cy={H-40} r={80}  fill="none" stroke="#00e5ff" strokeOpacity="0.06" strokeWidth={1} />
          <circle cx={W/2} cy={H-40} r={160} fill="none" stroke="#00e5ff" strokeOpacity="0.03" strokeWidth={1} />
          <line x1={W/2} y1={H-40} x2={W/2} y2={H-60} stroke="#00e5ff" strokeOpacity="0.1" strokeWidth={1} />

          {/* Laser beams */}
          {latestTurn?.p1Action === 'laser' && latestTurn.p2DmgTaken > 0 && (
            <line x1={P1_X+18} y1={ROBOT_Y-20} x2={P2_X-18} y2={ROBOT_Y-20}
              stroke="url(#laserGrad1)" strokeWidth={3} strokeLinecap="round">
              <animate attributeName="opacity" values="1;0" dur="0.4s" fill="freeze" />
            </line>
          )}
          {latestTurn?.p2Action === 'laser' && latestTurn.p1DmgTaken > 0 && (
            <line x1={P2_X-18} y1={ROBOT_Y-20} x2={P1_X+18} y2={ROBOT_Y-20}
              stroke="url(#laserGrad2)" strokeWidth={3} strokeLinecap="round">
              <animate attributeName="opacity" values="1;0" dur="0.4s" fill="freeze" />
            </line>
          )}

          {/* ── HP bars ── */}
          <HpBar x={P1_X} y={ROBOT_Y} hp={p1Hp} maxHp={p1MaxHp} name={p1Name} />
          <HpBar x={P2_X} y={ROBOT_Y} hp={p2Hp} maxHp={p2MaxHp} name={p2Name} />

          {/* Ground shadows under characters */}
          <ellipse cx={P1_X} cy={ROBOT_Y} rx={24} ry={5} fill="#000" opacity={0.4} />
          <ellipse cx={P2_X} cy={ROBOT_Y} rx={24} ry={5} fill="#000" opacity={0.4} />

          {/* Position badges */}
          <text x={P1_X} y={ROBOT_Y+18} textAnchor="middle" fill={POS_COLOR[p1Pos]} fontSize={9} fontWeight={700} letterSpacing="0.08em" opacity={0.85}>
            {POS_LABEL[p1Pos]}
          </text>
          <text x={P2_X} y={ROBOT_Y+18} textAnchor="middle" fill={POS_COLOR[p2Pos]} fontSize={9} fontWeight={700} letterSpacing="0.08em" opacity={0.85}>
            {POS_LABEL[p2Pos]}
          </text>

          {/* Action log */}
          {latestTurn && (
            <text x={W/2} y={H-10} textAnchor="middle" fill="#94a3b8" fontSize={11} fontWeight={600}>
              {latestTurn.log}
            </text>
          )}
        </svg>

        {/* ── Character P1 (left) ─────────────────────────────────────── */}
        <CharacterView
          ref={p1CharRef}
          skinId={p1Skin}
          flipX={false}
          style={{
            position: 'absolute',
            left:     toCssLeft(P1_X),
            bottom:   charBottom,
            width:    charW,
            height:   charH,
            transform: 'translateX(-50%)',
            transition: 'left 0.35s cubic-bezier(.4,0,.2,1)',
          }}
        />

        {/* ── Character P2 (right, mirrored) ──────────────────────────── */}
        <CharacterView
          ref={p2CharRef}
          skinId={p2Skin}
          flipX={true}
          style={{
            position: 'absolute',
            left:     toCssLeft(P2_X),
            bottom:   charBottom,
            width:    charW,
            height:   charH,
            transform: 'translateX(-50%)',
            transition: 'left 0.35s cubic-bezier(.4,0,.2,1)',
          }}
        />

        {/* ── VFX canvas (always on top) ──────────────────────────────── */}
        <VFXCanvas ref={vfxRef} width={W} height={H} />
      </div>
    </div>
  )
}
