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
}

const SKIN_COLORS: Record<SkinId, { primary: string; secondary: string; accent: string }> = {
  robot:     { primary: '#00e5ff', secondary: '#0a3a4a', accent: '#7de8ff' },
  gladiator: { primary: '#d97706', secondary: '#3a2800', accent: '#fbbf24' },
  boxer:     { primary: '#e6261f', secondary: '#3a0a0a', accent: '#f87171' },
  cosmonaut: { primary: '#f0f9ff', secondary: '#1a2a3a', accent: '#bae6fd' },
}

const GL = '#f1cf68'
const GLADIATOR_SOURCE_WIDTH = 738
const GLADIATOR_SOURCE_HEIGHT = 763
const PNG_RATIO = GLADIATOR_SOURCE_WIDTH / GLADIATOR_SOURCE_HEIGHT
const GLADIATOR_SPRITE_HREF = '/skins/gladiator.png?v=4'
const GLADIATOR_HEIGHT = 100
const GLADIATOR_WIDTH = Math.round(GLADIATOR_HEIGHT * PNG_RATIO)
const GLADIATOR_X = -GLADIATOR_WIDTH / 2
const GLADIATOR_Y = -GLADIATOR_HEIGHT
const GLADIATOR_SCALE = GLADIATOR_HEIGHT / GLADIATOR_SOURCE_HEIGHT
const GENERIC_SCALE = 0.70
const GENERIC_FOOT_Y = 51 * GENERIC_SCALE
const HP_BAR_X = -55
const HP_BAR_Y = -125

function GladiatorBody({ action, shieldActive }: {
  action?: ActionName | null
  shieldActive?: boolean
}) {
  const attacking = action === 'attack' || action === 'combo' || action === 'laser'

  return (
    <g>
      {shieldActive && (
        <ellipse
          cx={0}
          cy={-GLADIATOR_HEIGHT * 0.52}
          rx={GLADIATOR_WIDTH * 0.36}
          ry={GLADIATOR_HEIGHT * 0.38}
          fill="none"
          stroke={GL}
          strokeWidth={2.5}
          strokeDasharray="5 3"
        >
          <animate attributeName="opacity" values="0.72;0.25;0.72" dur="0.85s" repeatCount="indefinite" />
          <animate attributeName="rx" values={`${GLADIATOR_WIDTH * 0.36};${GLADIATOR_WIDTH * 0.39};${GLADIATOR_WIDTH * 0.36}`} dur="0.85s" repeatCount="indefinite" />
        </ellipse>
      )}

      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
            values="0,0; 0,-2; 0,0"
          dur="2.2s"
          repeatCount="indefinite"
          calcMode="spline"
          keySplines="0.45 0 0.55 1; 0.45 0 0.55 1"
        />

        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={attacking ? '-7 0 -20; 5 0 -20; -7 0 -20' : '0 0 0; 0 0 0; 0 0 0'}
            dur={attacking ? '0.34s' : '1s'}
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
          />

          <g transform={`translate(${GLADIATOR_X}, ${GLADIATOR_Y}) scale(${GLADIATOR_SCALE})`}>
            <image
              x={0}
              y={0}
              width={GLADIATOR_SOURCE_WIDTH}
              height={GLADIATOR_SOURCE_HEIGHT}
              href={GLADIATOR_SPRITE_HREF}
              preserveAspectRatio="none"
            />
          </g>
        </g>

        {action && (
          <text
            x={GLADIATOR_WIDTH * 0.2}
            y={GLADIATOR_Y + GLADIATOR_HEIGHT * 0.46}
            fill={GL}
            fontSize={10}
            fontWeight={800}
            fontFamily="monospace"
            textAnchor="start"
          >
            {action.toUpperCase()}
          </text>
        )}
      </g>
    </g>
  )
}

function GenericBody({ skinId, action, shieldActive }: {
  skinId: SkinId
  action?: ActionName | null
  shieldActive?: boolean
}) {
  const c = SKIN_COLORS[skinId]

  return (
    <g>
      {shieldActive && (
        <ellipse cx={0} cy={-20} rx={40} ry={55} fill={`${c.primary}15`} stroke={c.primary} strokeWidth={2} strokeDasharray="4 2">
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur="0.8s" repeatCount="indefinite" />
        </ellipse>
      )}

      <rect x={-14} y={28} width={10} height={20} rx={4} fill={c.secondary} stroke={c.primary} strokeWidth={1.5} />
      <rect x={4} y={28} width={10} height={20} rx={4} fill={c.secondary} stroke={c.primary} strokeWidth={1.5} />
      <rect x={-17} y={44} width={14} height={7} rx={3} fill={c.primary} />
      <rect x={3} y={44} width={14} height={7} rx={3} fill={c.primary} />
      <rect x={-18} y={-2} width={36} height={32} rx={6} fill={c.secondary} stroke={c.primary} strokeWidth={2} />
      <rect x={-8} y={6} width={16} height={10} rx={3} fill={c.primary} opacity={0.3} />
      <circle cx={0} cy={11} r={4} fill={c.accent} opacity={0.8}>
        <animate attributeName="opacity" values="0.8;0.4;0.8" dur="1.5s" repeatCount="indefinite" />
      </circle>

      <rect
        x={-28}
        y={0}
        width={12}
        height={22}
        rx={5}
        fill={c.secondary}
        stroke={c.primary}
        strokeWidth={1.5}
        transform={action === 'attack' || action === 'combo' ? 'rotate(-30, -22, 0)' : ''}
      />
      <rect x={16} y={0} width={12} height={22} rx={5} fill={c.secondary} stroke={c.primary} strokeWidth={1.5} />
      <circle cx={-22} cy={24} r={6} fill={c.primary} transform={action === 'attack' || action === 'combo' ? 'translate(10,-8)' : ''} />
      <circle cx={22} cy={24} r={6} fill={c.primary} />
      <rect x={-6} y={-10} width={12} height={10} rx={3} fill={c.secondary} stroke={c.primary} strokeWidth={1} />
      <rect x={-20} y={-42} width={40} height={34} rx={8} fill={c.secondary} stroke={c.primary} strokeWidth={2} />
      <rect x={-14} y={-34} width={10} height={8} rx={3} fill={c.accent}>
        <animate attributeName="opacity" values="1;0.2;1" dur="3s" repeatCount="indefinite" />
      </rect>
      <rect x={4} y={-34} width={10} height={8} rx={3} fill={c.accent}>
        <animate attributeName="opacity" values="1;0.2;1" dur="3s" begin="0.1s" repeatCount="indefinite" />
      </rect>
      <line x1={0} y1={-42} x2={0} y2={-52} stroke={c.primary} strokeWidth={2} />
      <circle cx={0} cy={-54} r={3} fill={c.accent}>
        <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite" />
      </circle>

      {action && (
        <text x={20} y={-65} textAnchor="start" fill={c.primary} fontSize={11} fontWeight={700}>
          {action.toUpperCase()}
        </text>
      )}
    </g>
  )
}

export default function RobotSVG({ skinId, flip, action, hp, maxHp, name, x, y, shieldActive }: Props) {
  const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100))
  const hpColor = hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#fbbf24' : '#ef4444'

  return (
    <g transform={`translate(${x}, ${y})`}>
      <g transform={`translate(${HP_BAR_X}, ${HP_BAR_Y})`}>
        <rect x={0} y={0} width={110} height={10} rx={4} fill="#1a1a35" />
        <rect x={0} y={0} width={hpPct * 1.1} height={10} rx={4} fill={hpColor} />
        <text x={55} y={24} textAnchor="middle" fill="#94a3b8" fontSize={12} fontWeight={600}>{name}</text>
        <text x={55} y={-5} textAnchor="middle" fill={hpColor} fontSize={12} fontWeight={700}>{hp}</text>
      </g>

      <ellipse cx={0} cy={0} rx={22} ry={4} fill="#020617" opacity={0.32} />

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
  )
}
