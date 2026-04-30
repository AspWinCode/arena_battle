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

export default function RobotSVG({ skinId, flip, action, hp, maxHp, name, x, y, shieldActive }: Props) {
  const colors = SKIN_COLORS[skinId]
  const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100))
  const hpColor = hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#fbbf24' : '#ef4444'
  const scale = flip ? -1 : 1

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* HP bar */}
      <g transform="translate(-40, -90)">
        <rect x={0} y={0} width={80} height={8} rx={4} fill="#1a1a35" />
        <rect x={0} y={0} width={hpPct * 0.8} height={8} rx={4} fill={hpColor} />
        <text x={40} y={20} textAnchor="middle" fill="#94a3b8" fontSize={10} fontWeight={600}>
          {name}
        </text>
        <text x={40} y={-4} textAnchor="middle" fill={hpColor} fontSize={10} fontWeight={700}>
          {hp}
        </text>
      </g>

      {/* Robot body */}
      <g transform={`scale(${scale}, 1)`}>
        {/* Shield effect */}
        {shieldActive && (
          <ellipse cx={0} cy={-20} rx={40} ry={55}
            fill={`${colors.primary}15`}
            stroke={colors.primary}
            strokeWidth={2}
            strokeDasharray="4 2"
            opacity={0.8}
          >
            <animate attributeName="opacity" values="0.8;0.3;0.8" dur="0.8s" repeatCount="indefinite" />
          </ellipse>
        )}

        {/* Legs */}
        <rect x={-14} y={28} width={10} height={20} rx={4} fill={colors.secondary} stroke={colors.primary} strokeWidth={1.5} />
        <rect x={4}   y={28} width={10} height={20} rx={4} fill={colors.secondary} stroke={colors.primary} strokeWidth={1.5} />
        {/* Feet */}
        <rect x={-17} y={44} width={14} height={7} rx={3} fill={colors.primary} />
        <rect x={3}   y={44} width={14} height={7} rx={3} fill={colors.primary} />

        {/* Torso */}
        <rect x={-18} y={-2} width={36} height={32} rx={6} fill={colors.secondary} stroke={colors.primary} strokeWidth={2} />
        {/* Chest detail */}
        <rect x={-8} y={6} width={16} height={10} rx={3} fill={colors.primary} opacity={0.3} />
        <circle cx={0} cy={11} r={4} fill={colors.accent} opacity={0.8}>
          <animate attributeName="opacity" values="0.8;0.4;0.8" dur="1.5s" repeatCount="indefinite" />
        </circle>

        {/* Arms */}
        <rect x={-28} y={0} width={12} height={22} rx={5} fill={colors.secondary} stroke={colors.primary} strokeWidth={1.5}
          transform={action === 'attack' || action === 'combo' ? 'rotate(-30, -22, 0)' : ''} />
        <rect x={16}  y={0} width={12} height={22} rx={5} fill={colors.secondary} stroke={colors.primary} strokeWidth={1.5} />
        {/* Fists */}
        <circle cx={-22} cy={24} r={6} fill={colors.primary}
          transform={action === 'attack' || action === 'combo' ? 'translate(10, -8)' : ''} />
        <circle cx={22}  cy={24} r={6} fill={colors.primary} />

        {/* Neck */}
        <rect x={-6} y={-10} width={12} height={10} rx={3} fill={colors.secondary} stroke={colors.primary} strokeWidth={1} />

        {/* Head */}
        <rect x={-20} y={-42} width={40} height={34} rx={8} fill={colors.secondary} stroke={colors.primary} strokeWidth={2} />
        {/* Eyes */}
        <rect x={-14} y={-34} width={10} height={8} rx={3} fill={colors.accent}>
          <animate attributeName="opacity" values="1;0.2;1" dur="3s" repeatCount="indefinite" />
        </rect>
        <rect x={4} y={-34} width={10} height={8} rx={3} fill={colors.accent}>
          <animate attributeName="opacity" values="1;0.2;1" dur="3s" begin="0.1s" repeatCount="indefinite" />
        </rect>
        {/* Antenna */}
        <line x1={0} y1={-42} x2={0} y2={-52} stroke={colors.primary} strokeWidth={2} />
        <circle cx={0} cy={-54} r={3} fill={colors.accent}>
          <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite" />
        </circle>

        {/* Action label */}
        {action && (
          <text x={flip ? -20 : 20} y={-65} textAnchor={flip ? 'end' : 'start'} fill={colors.primary} fontSize={11} fontWeight={700}>
            {action.toUpperCase()}
          </text>
        )}
      </g>
    </g>
  )
}
