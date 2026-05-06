import type { SkinId, ActionName } from '@robocode/shared'

interface Props {
  skinId: SkinId
  flip?: boolean
  action?: ActionName | null
  hp: number
  maxHp: number
  name: string
  x: number
  y: number
  shieldActive?: boolean
  isDead?: boolean
}

const SKIN_COLORS: Record<SkinId, { primary: string; secondary: string; accent: string }> = {
  robot:     { primary: '#00e5ff', secondary: '#0a3a4a', accent: '#7de8ff' },
  gladiator: { primary: '#d97706', secondary: '#3a2800', accent: '#fbbf24' },
  boxer:     { primary: '#e6261f', secondary: '#3a0a0a', accent: '#f87171' },
  cosmonaut: { primary: '#f0f9ff', secondary: '#1a2a3a', accent: '#bae6fd' },
}

const GL = '#f1cf68'

// ── Gladiator normal sprite ─────────────────────────────────────────────────
const GLADIATOR_SOURCE_WIDTH  = 853
const GLADIATOR_SOURCE_HEIGHT = 900
const GLADIATOR_SPRITE_HREF   = '/skins/gladiator.png?v=6'
const GLADIATOR_HEIGHT        = 200
const GLADIATOR_WIDTH         = Math.round(GLADIATOR_HEIGHT * (GLADIATOR_SOURCE_WIDTH / GLADIATOR_SOURCE_HEIGHT))
const GLADIATOR_X             = -GLADIATOR_WIDTH / 2
const GLADIATOR_Y             = -GLADIATOR_HEIGHT
const GLADIATOR_SCALE         = GLADIATOR_HEIGHT / GLADIATOR_SOURCE_HEIGHT

// ── Gladiator shield sprite ─────────────────────────────────────────────────
const SHIELD_SOURCE_WIDTH  = 921
const SHIELD_SOURCE_HEIGHT = 690
const SHIELD_SPRITE_HREF   = '/skins/gladiator_shield.png?v=1'
const SHIELD_HEIGHT        = 200
const SHIELD_WIDTH         = Math.round(SHIELD_HEIGHT * (SHIELD_SOURCE_WIDTH / SHIELD_SOURCE_HEIGHT))
const SHIELD_X             = -SHIELD_WIDTH / 2
const SHIELD_Y             = -SHIELD_HEIGHT
const SHIELD_SCALE         = SHIELD_HEIGHT / SHIELD_SOURCE_HEIGHT

// ── Gladiator attack sprites (2-frame animation) ────────────────────────────
// Frame 1: wind-up (raising axe) — portrait ~563×860
const ATK1_SOURCE_W = 563
const ATK1_SOURCE_H = 860
const ATK1_HREF     = '/skins/gladiator_attack1.png?v=1'
const ATK1_H        = 210
const ATK1_W        = Math.round(ATK1_H * (ATK1_SOURCE_W / ATK1_SOURCE_H))
const ATK1_X        = -ATK1_W / 2
const ATK1_Y        = -ATK1_H
const ATK1_SCALE    = ATK1_H / ATK1_SOURCE_H

// Frame 2: swing (axe impact) — landscape ~1351×860
const ATK2_SOURCE_W = 1351
const ATK2_SOURCE_H = 860
const ATK2_HREF     = '/skins/gladiator_attack2.png?v=1'
const ATK2_H        = 200
const ATK2_W        = Math.round(ATK2_H * (ATK2_SOURCE_W / ATK2_SOURCE_H))
const ATK2_X        = -ATK2_W / 2
const ATK2_Y        = -ATK2_H
const ATK2_SCALE    = ATK2_H / ATK2_SOURCE_H

const GENERIC_SCALE  = 0.70
const GENERIC_FOOT_Y = 51 * GENERIC_SCALE
const HP_BAR_X = -55
const HP_BAR_Y = -220

// ── Gladiator (PNG sprite) ──────────────────────────────────────────────────

function GladiatorBody({ action, shieldActive }: {
  action?: ActionName | null
  shieldActive?: boolean
}) {
  const isShield   = action === 'shield' || shieldActive
  // laser stays in idle branch (shows spear overlay on normal sprite)
  const attacking  = action === 'attack' || action === 'heavy' || action === 'special'

  return (
    <g>
      {/* Idle bob */}
      <g>
        <animateTransform
          attributeName="transform" type="translate"
          values="0,0; 0,-2; 0,0" dur="2.2s" repeatCount="indefinite"
          calcMode="spline" keySplines="0.45 0 0.55 1; 0.45 0 0.55 1"
        />

        {isShield ? (
          /* ── Shield stance PNG ── */
          <g>
            <ellipse
              cx={SHIELD_WIDTH * 0.08} cy={-SHIELD_HEIGHT * 0.52}
              rx={SHIELD_WIDTH * 0.32} ry={SHIELD_HEIGHT * 0.36}
              fill={`${GL}18`} stroke={GL} strokeWidth={2}
            >
              <animate attributeName="opacity" values="0.7;0.2;0.7" dur="0.75s" repeatCount="indefinite" />
              <animate attributeName="rx" values={`${SHIELD_WIDTH * 0.32};${SHIELD_WIDTH * 0.36};${SHIELD_WIDTH * 0.32}`} dur="0.75s" repeatCount="indefinite" />
            </ellipse>
            <g transform={`translate(${SHIELD_X}, ${SHIELD_Y}) scale(${SHIELD_SCALE})`}>
              <image x={0} y={0} width={SHIELD_SOURCE_WIDTH} height={SHIELD_SOURCE_HEIGHT}
                href={SHIELD_SPRITE_HREF} preserveAspectRatio="none" />
            </g>
            <text x={SHIELD_WIDTH * 0.1} y={SHIELD_Y + SHIELD_HEIGHT * 0.46}
              fill={GL} fontSize={10} fontWeight={800} fontFamily="monospace" textAnchor="start">
              SHIELD
            </text>
          </g>

        ) : attacking ? (
          /* ── Attack 2-frame animation: wind-up → swing ── */
          <g>
            {/* Frame 1: wind-up (замах) — visible first 45% of cycle */}
            <g transform={`translate(${ATK1_X}, ${ATK1_Y}) scale(${ATK1_SCALE})`}>
              <image x={0} y={0} width={ATK1_SOURCE_W} height={ATK1_SOURCE_H}
                href={ATK1_HREF} preserveAspectRatio="none">
                {/* 0→45%: opacity 1, 45%→50%: fade out, 50→95%: 0, 95%→100%: fade in */}
                <animate attributeName="opacity"
                  values="1;1;0;0;1"
                  keyTimes="0;0.45;0.5;0.95;1"
                  dur="0.42s" repeatCount="indefinite" calcMode="linear" />
              </image>
            </g>

            {/* Frame 2: swing (удар с кровью) — visible 50–95% of cycle */}
            <g transform={`translate(${ATK2_X}, ${ATK2_Y}) scale(${ATK2_SCALE})`}>
              <image x={0} y={0} width={ATK2_SOURCE_W} height={ATK2_SOURCE_H}
                href={ATK2_HREF} preserveAspectRatio="none">
                <animate attributeName="opacity"
                  values="0;0;1;1;0"
                  keyTimes="0;0.45;0.5;0.95;1"
                  dur="0.42s" repeatCount="indefinite" calcMode="linear" />
              </image>
            </g>

            {/* Золотая вспышка в момент удара */}
            <circle cx={ATK2_W * 0.3} cy={-ATK2_H * 0.45} r={18} fill={GL} opacity={0}>
              <animate attributeName="opacity"
                values="0;0;0.55;0;0"
                keyTimes="0;0.45;0.6;0.75;1"
                dur="0.42s" repeatCount="indefinite" calcMode="linear" />
              <animate attributeName="r"
                values="10;10;22;10;10"
                keyTimes="0;0.45;0.6;0.75;1"
                dur="0.42s" repeatCount="indefinite" calcMode="linear" />
            </circle>

            <text x={ATK1_W * 0.1} y={ATK1_Y + ATK1_H * 0.46}
              fill={GL} fontSize={10} fontWeight={800} fontFamily="monospace" textAnchor="start">
              {action?.toUpperCase()}
            </text>
          </g>

        ) : (
          /* ── Idle / laser / repair / dodge ── */
          <g>
            <g transform={`translate(${GLADIATOR_X}, ${GLADIATOR_Y}) scale(${GLADIATOR_SCALE})`}>
              <image x={0} y={0} width={GLADIATOR_SOURCE_WIDTH} height={GLADIATOR_SOURCE_HEIGHT}
                href={GLADIATOR_SPRITE_HREF} preserveAspectRatio="none" />
            </g>

            {/* Laser spear overlay */}
            {action === 'laser' && (
              <line
                x1={GLADIATOR_WIDTH * 0.2} y1={-GLADIATOR_HEIGHT * 0.4}
                x2={GLADIATOR_WIDTH * 0.8} y2={-GLADIATOR_HEIGHT * 0.4}
                stroke={GL} strokeWidth={3} strokeLinecap="round"
              >
                <animate attributeName="opacity" values="0.9;0.3;0.9" dur="0.2s" repeatCount="indefinite" />
              </line>
            )}

            {/* Repair potion bubble */}
            {action === 'repair' && (
              <circle cx={GLADIATOR_WIDTH * 0.1} cy={-GLADIATOR_HEIGHT * 0.7} r={10} fill="#22c55e" opacity={0.7}>
                <animate attributeName="cy" values={`${-GLADIATOR_HEIGHT * 0.7};${-GLADIATOR_HEIGHT * 0.8};${-GLADIATOR_HEIGHT * 0.7}`} dur="0.5s" repeatCount="3" />
                <animate attributeName="opacity" values="0.7;0;0.7" dur="0.5s" repeatCount="3" />
              </circle>
            )}

            {action && (
              <text
                x={GLADIATOR_WIDTH * 0.2} y={GLADIATOR_Y + GLADIATOR_HEIGHT * 0.46}
                fill={GL} fontSize={10} fontWeight={800} fontFamily="monospace" textAnchor="start"
              >
                {action.toUpperCase()}
              </text>
            )}
          </g>
        )}
      </g>
    </g>
  )
}

// ── Generic body (Robot / Boxer / Cosmonaut) ────────────────────────────────

function GenericBody({ skinId, action, shieldActive }: {
  skinId: SkinId
  action?: ActionName | null
  shieldActive?: boolean
}) {
  const c = SKIN_COLORS[skinId]
  const isAttacking = action === 'attack' || action === 'heavy' || action === 'special'
  const isLaser     = action === 'laser'
  const isDodging   = action === 'dodge'
  const isRepair    = action === 'repair'
  const isShield    = action === 'shield'

  // Arm X offset: boxer punches further
  const armExtend = skinId === 'boxer' && isAttacking ? 14 : 0
  const armGlowR  = skinId === 'boxer' && isAttacking ? 10 : 6

  return (
    <g>
      {/* Idle bob */}
      <animateTransform
        attributeName="transform" type="translate"
        values="0,0; 0,-3; 0,0" dur="2.2s" repeatCount="indefinite"
        calcMode="spline" keySplines="0.45 0 0.55 1; 0.45 0 0.55 1"
      />

      {/* ── Shield overlays ── */}
      {(shieldActive || isShield) && skinId === 'robot' && (
        // Robot: rectangular energy grid
        <g opacity={0.7}>
          <rect x={-44} y={-60} width={88} height={90} rx={4} fill="none" stroke={c.primary} strokeWidth={1.5} strokeDasharray="6 3">
            <animate attributeName="opacity" values="0.8;0.3;0.8" dur="0.7s" repeatCount="indefinite" />
          </rect>
          <rect x={-44} y={-60} width={88} height={90} rx={4} fill={`${c.primary}08`} />
        </g>
      )}
      {(shieldActive || isShield) && skinId === 'boxer' && (
        // Boxer: arms-up guard cross
        <g>
          <ellipse cx={0} cy={-10} rx={38} ry={52} fill={`${c.primary}12`} stroke={c.primary} strokeWidth={2}>
            <animate attributeName="opacity" values="0.8;0.3;0.8" dur="0.7s" repeatCount="indefinite" />
          </ellipse>
          <line x1={-20} y1={-40} x2={20} y2={0} stroke={c.primary} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
          <line x1={20} y1={-40} x2={-20} y2={0} stroke={c.primary} strokeWidth={4} strokeLinecap="round" opacity={0.6} />
        </g>
      )}
      {(shieldActive || isShield) && skinId === 'cosmonaut' && (
        // Cosmonaut: spherical bubble
        <ellipse cx={0} cy={-20} rx={50} ry={65} fill={`${c.primary}10`} stroke={c.primary} strokeWidth={2}>
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur="0.9s" repeatCount="indefinite" />
          <animate attributeName="ry" values="65;70;65" dur="0.9s" repeatCount="indefinite" />
        </ellipse>
      )}

      {/* ── Legs ── */}
      <rect x={-14} y={28} width={10} height={20} rx={4} fill={c.secondary} stroke={c.primary} strokeWidth={1.5} />
      <rect x={4}   y={28} width={10} height={20} rx={4} fill={c.secondary} stroke={c.primary} strokeWidth={1.5} />
      <rect x={-17} y={44} width={14} height={7} rx={3} fill={c.primary} />
      <rect x={3}   y={44} width={14} height={7} rx={3} fill={c.primary} />

      {/* Cosmonaut dodge: jet flames at feet */}
      {skinId === 'cosmonaut' && isDodging && (
        <>
          <ellipse cx={-10} cy={50} rx={5} ry={9} fill="#f97316" opacity={0.75}>
            <animate attributeName="ry" values="9;14;9" dur="0.12s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.75;0.4;0.75" dur="0.12s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx={10} cy={50} rx={5} ry={9} fill="#fbbf24" opacity={0.75}>
            <animate attributeName="ry" values="9;14;9" dur="0.12s" repeatCount="indefinite" begin="0.06s" />
            <animate attributeName="opacity" values="0.75;0.4;0.75" dur="0.12s" repeatCount="indefinite" begin="0.06s" />
          </ellipse>
        </>
      )}

      {/* ── Torso ── */}
      <rect x={-18} y={-2} width={36} height={32} rx={6} fill={c.secondary} stroke={c.primary} strokeWidth={2} />
      <rect x={-8} y={6} width={16} height={10} rx={3} fill={c.primary} opacity={0.3} />

      {/* Robot: laser chest reactor glow */}
      {skinId === 'robot' && isLaser && (
        <circle cx={0} cy={11} r={12} fill={c.primary} opacity={0}>
          <animate attributeName="opacity" values="0;0.5;0" dur="0.3s" repeatCount="indefinite" />
          <animate attributeName="r" values="12;20;12" dur="0.3s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Cosmonaut: helmet laser glow */}
      {skinId === 'cosmonaut' && isLaser && (
        <circle cx={0} cy={-28} r={18} fill={c.accent} opacity={0}>
          <animate attributeName="opacity" values="0;0.6;0" dur="0.25s" repeatCount="indefinite" />
        </circle>
      )}

      <circle cx={0} cy={11} r={4} fill={c.accent} opacity={0.8}>
        <animate attributeName="opacity" values="0.8;0.4;0.8" dur="1.5s" repeatCount="indefinite" />
      </circle>

      {/* ── Left arm (active/attacking arm) ── */}
      <rect
        x={-28 - armExtend} y={0}
        width={12 + (armExtend > 0 ? 6 : 0)} height={22} rx={5}
        fill={c.secondary} stroke={c.primary} strokeWidth={1.5}
        transform={isAttacking ? 'rotate(-30, -22, 0)' : isDodging ? 'rotate(15, -22, 11)' : ''}
      />
      {/* Fist */}
      <circle
        cx={-22 - armExtend} cy={24} r={armGlowR}
        fill={c.primary}
        transform={isAttacking ? 'translate(10,-8)' : ''}
      />
      {/* Boxer attack: extra glove glow */}
      {skinId === 'boxer' && isAttacking && (
        <circle cx={-22 - armExtend + 10} cy={16} r={14} fill={c.primary} opacity={0.35}>
          <animate attributeName="r" values="14;18;14" dur="0.2s" repeatCount="indefinite" />
        </circle>
      )}
      {/* Boxer laser: glove energy blast */}
      {skinId === 'boxer' && isLaser && (
        <rect x={-50} y={4} width={30} height={8} rx={4} fill={c.primary} opacity={0.8}>
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur="0.2s" repeatCount="indefinite" />
          <animate attributeName="width" values="30;50;30" dur="0.2s" repeatCount="indefinite" />
        </rect>
      )}

      {/* ── Right arm ── */}
      <rect x={16} y={0} width={12} height={22} rx={5} fill={c.secondary} stroke={c.primary} strokeWidth={1.5} />
      <circle cx={22} cy={24} r={6} fill={c.primary} />

      {/* ── Head ── */}
      <rect x={-6} y={-10} width={12} height={10} rx={3} fill={c.secondary} stroke={c.primary} strokeWidth={1} />
      <rect x={-20} y={-42} width={40} height={34} rx={8} fill={c.secondary} stroke={c.primary} strokeWidth={2} />
      {/* Eye panels */}
      <rect x={-14} y={-34} width={10} height={8} rx={3} fill={c.accent}>
        <animate attributeName="opacity" values="1;0.2;1" dur="3s" repeatCount="indefinite" />
      </rect>
      <rect x={4} y={-34} width={10} height={8} rx={3} fill={c.accent}>
        <animate attributeName="opacity" values="1;0.2;1" dur="3s" begin="0.1s" repeatCount="indefinite" />
      </rect>

      {/* Cosmonaut: helmet visor */}
      {skinId === 'cosmonaut' && (
        <rect x={-16} y={-38} width={32} height={20} rx={8} fill={c.accent} opacity={0.15} />
      )}

      <line x1={0} y1={-42} x2={0} y2={-52} stroke={c.primary} strokeWidth={2} />
      <circle cx={0} cy={-54} r={3} fill={c.accent}>
        <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite" />
      </circle>

      {/* ── Repair overlays ── */}
      {isRepair && skinId === 'robot' && (
        // Robot: wrench tool
        <g transform="translate(22, -30)">
          <line x1={0} y1={0} x2={14} y2={-14} stroke={c.primary} strokeWidth={3} strokeLinecap="round">
            <animate attributeName="y2" values="-14;-18;-14" dur="0.4s" repeatCount="3" />
          </line>
          <circle cx={14} cy={-14} r={5} fill="none" stroke={c.primary} strokeWidth={2} />
        </g>
      )}
      {isRepair && skinId === 'boxer' && (
        // Boxer: bandage X cross
        <g transform="translate(0, -30)">
          <line x1={-8} y1={-8} x2={8} y2={8} stroke="#22c55e" strokeWidth={4} strokeLinecap="round">
            <animate attributeName="opacity" values="1;0.3;1" dur="0.3s" repeatCount="indefinite" />
          </line>
          <line x1={8} y1={-8} x2={-8} y2={8} stroke="#22c55e" strokeWidth={4} strokeLinecap="round">
            <animate attributeName="opacity" values="1;0.3;1" dur="0.3s" repeatCount="indefinite" />
          </line>
        </g>
      )}
      {isRepair && skinId === 'cosmonaut' && (
        // Cosmonaut: medkit + cross
        <g transform="translate(24, -20)">
          <rect x={-8} y={-8} width={16} height={16} rx={3} fill="#22c55e" opacity={0.9} />
          <rect x={-2} y={-8} width={4} height={16} fill="#fff" />
          <rect x={-8} y={-2} width={16} height={4} fill="#fff" />
        </g>
      )}

      {/* General floating + on repair */}
      {isRepair && (
        <text x={28} y={-55} fill="#22c55e" fontSize={18} fontWeight={900} textAnchor="middle" opacity={0.9}>
          <animate attributeName="y" values="-50;-70;-50" dur="0.6s" repeatCount="3" />
          <animate attributeName="opacity" values="0.9;0;0.9" dur="0.6s" repeatCount="3" />
          +
        </text>
      )}

      {/* Action label */}
      {action && (
        <text x={20} y={-65} textAnchor="start" fill={c.primary} fontSize={11} fontWeight={700}>
          {action.toUpperCase()}
        </text>
      )}
    </g>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function RobotSVG({ skinId, flip, action, hp, maxHp, name, x, y, shieldActive, isDead }: Props) {
  const hpPct   = Math.max(0, Math.min(100, (hp / maxHp) * 100))
  const hpColor = hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#fbbf24' : '#ef4444'

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* HP bar (always visible, even when dead) */}
      <g transform={`translate(${HP_BAR_X}, ${HP_BAR_Y})`}>
        <rect x={0} y={0} width={110} height={10} rx={4} fill="#1a1a35" />
        <rect x={0} y={0} width={hpPct * 1.1} height={10} rx={4} fill={hpColor} />
        <text x={55} y={24} textAnchor="middle" fill="#94a3b8" fontSize={12} fontWeight={600}>{name}</text>
        <text x={55} y={-5} textAnchor="middle" fill={hpColor} fontSize={12} fontWeight={700}>{hp}</text>
      </g>

      {/* Ground shadow */}
      <ellipse cx={0} cy={0} rx={22} ry={4} fill="#020617" opacity={0.32} />

      {/* Robot body — fades out on death */}
      <g
        style={{
          opacity: isDead ? 0 : 1,
          transform: isDead ? 'scale(1.15)' : 'scale(1)',
          transition: isDead ? 'opacity 0.65s 0.1s, transform 0.4s' : 'none',
          transformBox: 'fill-box',
          transformOrigin: 'center',
        }}
      >
        {skinId === 'gladiator' ? (
          <g transform={flip ? 'scale(-1,1)' : undefined}>
            <GladiatorBody action={action} shieldActive={shieldActive} />
          </g>
        ) : (
          <g transform={`translate(0, ${-GENERIC_FOOT_Y})`}>
            <g transform={flip ? `scale(${-GENERIC_SCALE}, ${GENERIC_SCALE})` : `scale(${GENERIC_SCALE})`}>
              <GenericBody skinId={skinId} action={action} shieldActive={shieldActive} />
            </g>
          </g>
        )}
      </g>
    </g>
  )
}
