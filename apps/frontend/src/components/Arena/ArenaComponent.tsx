import { useRef, useEffect, useCallback } from 'react'
import type { SkinId, ActionName, TurnResult } from '@robocode/shared'
import RobotSVG from './RobotSVG'
import VFXCanvas, { type VFXHandle } from './VFXCanvas'
import styles from './ArenaComponent.module.css'

const W = 600
const H = 380

// Positions on the SVG canvas
const P1_X = 190
const P2_X = 410
const ROBOT_Y = 308

const SKIN_COLORS: Record<string, string> = {
  robot:     '#00e5ff',
  gladiator: '#d97706',
  boxer:     '#e6261f',
  cosmonaut: '#f0f9ff',
}

interface Props {
  p1Skin: SkinId
  p2Skin: SkinId
  p1Name: string
  p2Name: string
  p1Hp: number
  p2Hp: number
  p1MaxHp: number
  p2MaxHp: number
  latestTurn: TurnResult | null
  round: number
}

export default function ArenaComponent({
  p1Skin, p2Skin, p1Name, p2Name,
  p1Hp, p2Hp, p1MaxHp, p2MaxHp,
  latestTurn, round,
}: Props) {
  const vfxRef = useRef<VFXHandle>(null)
  const prevTurnRef = useRef<TurnResult | null>(null)

  // Convert SVG coords to canvas coords (they're same scale here)
  const svgToCanvas = useCallback((svgX: number, svgY: number) => ({
    x: (svgX / W) * W,
    y: (svgY / H) * H,
  }), [])

  useEffect(() => {
    if (!latestTurn || !vfxRef.current) return
    if (latestTurn === prevTurnRef.current) return
    prevTurnRef.current = latestTurn

    const vfx = vfxRef.current
    const { p1Action, p2Action, p1DmgTaken, p2DmgTaken, p1Heal, p2Heal } = latestTurn

    const p1c = SKIN_COLORS[p1Skin] ?? '#00e5ff'
    const p2c = SKIN_COLORS[p2Skin] ?? '#e6261f'

    // P1 takes damage
    if (p1DmgTaken > 0) {
      vfx.spawnHitSparks(P1_X, ROBOT_Y - 20, p2c)
      vfx.showHitNumber(P1_X, ROBOT_Y - 60, p1DmgTaken)
      vfx.shake(6)
    }

    // P2 takes damage
    if (p2DmgTaken > 0) {
      vfx.spawnHitSparks(P2_X, ROBOT_Y - 20, p1c)
      vfx.showHitNumber(P2_X, ROBOT_Y - 60, p2DmgTaken)
      vfx.shake(6)
    }

    // Laser impacts
    if (p1Action === 'laser' && p2DmgTaken > 0) {
      vfx.spawnLaserImpact(P2_X, ROBOT_Y - 20, p1c)
    }
    if (p2Action === 'laser' && p1DmgTaken > 0) {
      vfx.spawnLaserImpact(P1_X, ROBOT_Y - 20, p2c)
    }

    // Combo sparks
    if (p1Action === 'combo' && p2DmgTaken > 0) vfx.spawnComboSparks(P2_X, ROBOT_Y - 20, p1c)
    if (p2Action === 'combo' && p1DmgTaken > 0) vfx.spawnComboSparks(P1_X, ROBOT_Y - 20, p2c)

    // Dodge trail
    if (p1Action === 'dodge') vfx.spawnDodgeTrail(P1_X, ROBOT_Y - 20, p1c)
    if (p2Action === 'dodge') vfx.spawnDodgeTrail(P2_X, ROBOT_Y - 20, p2c)

    // Repair
    if (p1Heal > 0) { vfx.spawnRepairParticles(P1_X, ROBOT_Y); vfx.showHealNumber(P1_X, ROBOT_Y - 60, p1Heal) }
    if (p2Heal > 0) { vfx.spawnRepairParticles(P2_X, ROBOT_Y); vfx.showHealNumber(P2_X, ROBOT_Y - 60, p2Heal) }

    // Big shake on big hits
    if (p1DmgTaken > 20 || p2DmgTaken > 20) vfx.shake(10)
  }, [latestTurn, p1Skin, p2Skin])

  const p1ShieldActive = latestTurn?.p1Action === 'shield'
  const p2ShieldActive = latestTurn?.p2Action === 'shield'

  return (
    <div className={styles.root}>
      {/* Round badge */}
      <div className={styles.roundBadge}>Раунд {round}</div>

      <div className={styles.stage}>
        {/* SVG layer */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="100%"
          className={styles.svg}
          style={{ display: 'block' }}
        >
          <defs>
            {/* Floor gradient */}
            <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a1a35" />
              <stop offset="100%" stopColor="#0a0a1a" />
            </linearGradient>
            {/* Arena glow */}
            <radialGradient id="arenaGlow" cx="50%" cy="80%" r="50%">
              <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
            </radialGradient>
            {/* Laser gradient */}
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
            <line
              key={i}
              x1={i * 100} y1={0} x2={i * 100} y2={H}
              stroke="#ffffff" strokeOpacity="0.02" strokeWidth={1}
            />
          ))}
          {Array.from({ length: 5 }).map((_, i) => (
            <line
              key={i}
              x1={0} y1={i * 80} x2={W} y2={i * 80}
              stroke="#ffffff" strokeOpacity="0.02" strokeWidth={1}
            />
          ))}

          {/* Floor */}
          <rect x={0} y={H - 40} width={W} height={40} fill="#12122a" />
          <line x1={0} y1={H - 40} x2={W} y2={H - 40} stroke="#00e5ff" strokeOpacity="0.15" strokeWidth={1} />

          {/* Arena center decoration */}
          <circle cx={W / 2} cy={H - 40} r={80}
            fill="none" stroke="#00e5ff" strokeOpacity="0.06" strokeWidth={1} />
          <circle cx={W / 2} cy={H - 40} r={160}
            fill="none" stroke="#00e5ff" strokeOpacity="0.03" strokeWidth={1} />
          <line x1={W / 2} y1={H - 40} x2={W / 2} y2={H - 40 - 20}
            stroke="#00e5ff" strokeOpacity="0.1" strokeWidth={1} />

          {/* Laser beam P1 → P2 */}
          {latestTurn?.p1Action === 'laser' && latestTurn.p2DmgTaken > 0 && (
            <line
              x1={P1_X + 18} y1={ROBOT_Y - 20}
              x2={P2_X - 18} y2={ROBOT_Y - 20}
              stroke="url(#laserGrad1)" strokeWidth={3}
              strokeLinecap="round"
            >
              <animate attributeName="opacity" values="1;0" dur="0.4s" fill="freeze" />
            </line>
          )}
          {/* Laser beam P2 → P1 */}
          {latestTurn?.p2Action === 'laser' && latestTurn.p1DmgTaken > 0 && (
            <line
              x1={P2_X - 18} y1={ROBOT_Y - 20}
              x2={P1_X + 18} y2={ROBOT_Y - 20}
              stroke="url(#laserGrad2)" strokeWidth={3}
              strokeLinecap="round"
            >
              <animate attributeName="opacity" values="1;0" dur="0.4s" fill="freeze" />
            </line>
          )}

          {/* Robots */}
          <RobotSVG
            skinId={p1Skin}
            flip={false}
            action={latestTurn?.p1Action ?? null}
            hp={p1Hp}
            maxHp={p1MaxHp}
            name={p1Name}
            x={P1_X}
            y={ROBOT_Y}
            shieldActive={p1ShieldActive}
          />
          <RobotSVG
            skinId={p2Skin}
            flip={true}
            action={latestTurn?.p2Action ?? null}
            hp={p2Hp}
            maxHp={p2MaxHp}
            name={p2Name}
            x={P2_X}
            y={ROBOT_Y}
            shieldActive={p2ShieldActive}
          />

          {/* Action log */}
          {latestTurn && (
            <text
              x={W / 2} y={H - 10}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize={11}
              fontWeight={600}
            >
              {latestTurn.log}
            </text>
          )}
        </svg>

        {/* VFX canvas on top */}
        <VFXCanvas ref={vfxRef} width={W} height={H} />
      </div>
    </div>
  )
}
