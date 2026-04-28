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

/* ── Gladiator (chibi warrior with battle-axe) ── */
function GladiatorBody({ action, shieldActive }: { action?: ActionName | null; shieldActive?: boolean }) {
  const attacking = action === 'attack' || action === 'combo' || action === 'laser'

  return (
    <g>
      {/* ── Shield aura ── */}
      {shieldActive && (
        <ellipse cx={2} cy={-18} rx={42} ry={58} fill="none"
          stroke="#fbbf24" strokeWidth={2.5} strokeDasharray="5 3" opacity={0.7}>
          <animate attributeName="opacity" values="0.7;0.2;0.7" dur="0.8s" repeatCount="indefinite" />
          <animate attributeName="rx" values="42;45;42" dur="0.8s" repeatCount="indefinite" />
        </ellipse>
      )}

      {/* ── Idle breathing: whole body bobs ── */}
      <g>
        <animateTransform attributeName="transform" type="translate"
          values="0,0; 0,-2; 0,0" dur="2.2s" repeatCount="indefinite" />

        {/* ── LEGS ── */}
        {/* Left leg */}
        <rect x={-14} y={26} width={11} height={18} rx={3}
          fill="#5c3d1e" stroke="#3a2800" strokeWidth={1} />
        {/* Left greave */}
        <rect x={-15} y={30} width={12} height={14} rx={2}
          fill="#6b7280" stroke="#4b5563" strokeWidth={1} />
        <rect x={-14} y={32} width={10} height={2} rx={1} fill="#9ca3af" />
        <rect x={-14} y={36} width={10} height={2} rx={1} fill="#9ca3af" />
        {/* Left foot/sandal */}
        <rect x={-17} y={42} width={15} height={6} rx={2} fill="#4b3820" />
        <rect x={-16} y={43} width={13} height={2} fill="#6b4c2a" />

        {/* Right leg */}
        <rect x={3} y={26} width={11} height={18} rx={3}
          fill="#5c3d1e" stroke="#3a2800" strokeWidth={1} />
        {/* Right greave */}
        <rect x={3} y={30} width={12} height={14} rx={2}
          fill="#6b7280" stroke="#4b5563" strokeWidth={1} />
        <rect x={4} y={32} width={10} height={2} rx={1} fill="#9ca3af" />
        <rect x={4} y={36} width={10} height={2} rx={1} fill="#9ca3af" />
        {/* Right foot/sandal */}
        <rect x={2} y={42} width={15} height={6} rx={2} fill="#4b3820" />
        <rect x={3} y={43} width={13} height={2} fill="#6b4c2a" />

        {/* ── RED SKIRT (pteruges) ── */}
        {[-14,-9,-4,1,6].map((sx, i) => (
          <rect key={i} x={sx} y={20} width={5} height={12}
            rx={1.5} fill={i % 2 === 0 ? '#b91c1c' : '#dc2626'}
            stroke="#7f1d1d" strokeWidth={0.5} />
        ))}

        {/* ── TORSO ── */}
        {/* Body base — leather brown */}
        <rect x={-17} y={-8} width={34} height={30} rx={5}
          fill="#78350f" stroke="#451a03" strokeWidth={1.5} />
        {/* Chest strap — X pattern */}
        <line x1={-15} y1={-7} x2={15} y2={19} stroke="#451a03" strokeWidth={3} />
        <line x1={15} y1={-7} x2={-15} y2={19} stroke="#451a03" strokeWidth={3} />
        {/* Center medallion */}
        <circle cx={0} cy={6} r={5} fill="#d97706" stroke="#92400e" strokeWidth={1} />
        <circle cx={0} cy={6} r={3} fill="#fbbf24">
          <animate attributeName="opacity" values="1;0.5;1" dur="1.8s" repeatCount="indefinite" />
        </circle>
        {/* Belt */}
        <rect x={-17} y={16} width={34} height={7} rx={2}
          fill="#6b4c2a" stroke="#3a2800" strokeWidth={1} />
        {/* Belt studs */}
        {[-12,-6,0,6,12].map((bx, i) => (
          <circle key={i} cx={bx} cy={19} r={2} fill="#d97706" />
        ))}

        {/* ── LEFT ARM (back / shield arm) ── */}
        <rect x={17} y={-6} width={11} height={20} rx={4}
          fill="#92400e" stroke="#451a03" strokeWidth={1} />
        {/* Bicep wrap */}
        <rect x={17} y={0} width={11} height={3} rx={1} fill="#d97706" opacity={0.6} />
        {/* Fist */}
        <rect x={16} y={13} width={12} height={10} rx={4}
          fill="#b45309" stroke="#78350f" strokeWidth={1} />

        {/* ── RIGHT ARM (weapon arm — swings when attacking) ── */}
        <g transform={attacking ? 'rotate(-35, -22, -4)' : 'rotate(0)'}>
          <animateTransform attributeName="transform" type="rotate"
            values={attacking ? '-35 -22 -4' : '5 -22 -4; -5 -22 -4; 5 -22 -4'}
            dur={attacking ? '0s' : '2.2s'} repeatCount={attacking ? '0' : 'indefinite'} />
          <rect x={-28} y={-6} width={11} height={20} rx={4}
            fill="#92400e" stroke="#451a03" strokeWidth={1} />
          <rect x={-28} y={0} width={11} height={3} rx={1} fill="#d97706" opacity={0.6} />
          {/* Fist gripping axe */}
          <rect x={-29} y={13} width={12} height={10} rx={4}
            fill="#b45309" stroke="#78350f" strokeWidth={1} />
        </g>

        {/* ── BATTLE AXE ── */}
        <g>
          <animateTransform attributeName="transform" type="rotate"
            values={attacking ? '-20 -22 30; 15 -22 30; -20 -22 30' : '3 -22 30; -3 -22 30; 3 -22 30'}
            dur={attacking ? '0.4s' : '2.5s'} repeatCount="indefinite" />

          {/* Handle */}
          <line x1={-22} y1={48} x2={-22} y2={-30}
            stroke="#5c3317" strokeWidth={5} strokeLinecap="round" />
          {/* Handle wrap strips */}
          {[-10, 0, 10, 20].map((hy, i) => (
            <line key={i} x1={-24} y1={hy} x2={-20} y2={hy}
              stroke="#7c4f28" strokeWidth={2} />
          ))}
          {/* Axe main blade */}
          <path d="M -22 -30 L -22 -55 L -48 -40 L -52 -20 L -22 -18 Z"
            fill="#9ca3af" stroke="#6b7280" strokeWidth={1.5} />
          {/* Blade shine */}
          <line x1={-24} y1={-52} x2={-48} y2={-38}
            stroke="#e5e7eb" strokeWidth={1.5} opacity={0.7} />
          <line x1={-24} y1={-46} x2={-44} y2={-32}
            stroke="#e5e7eb" strokeWidth={1} opacity={0.4} />
          {/* Blood/red detail on blade */}
          <path d="M -30 -38 L -44 -32 L -38 -26 Z"
            fill="#dc2626" opacity={0.5} />
          {/* Spear tip on top */}
          <polygon points="-22,-55 -18,-42 -26,-42"
            fill="#d1d5db" stroke="#9ca3af" strokeWidth={1} />
          {/* Metal collar at blade joint */}
          <rect x={-26} y={-32} width={8} height={6} rx={1}
            fill="#6b7280" stroke="#4b5563" strokeWidth={1} />
          {/* Pommel at bottom */}
          <circle cx={-22} cy={50} r={5}
            fill="#6b7280" stroke="#4b5563" strokeWidth={1} />
        </g>

        {/* ── NECK ── */}
        <rect x={-7} y={-16} width={14} height={10} rx={3}
          fill="#92400e" stroke="#451a03" strokeWidth={1} />

        {/* ── HELMET ── */}
        {/* Main bowl — dark with slight sheen */}
        <ellipse cx={0} cy={-36} rx={24} ry={20}
          fill="#1f2937" stroke="#374151" strokeWidth={1.5} />
        {/* Helmet top crest base */}
        <rect x={-4} y={-58} width={8} height={24} rx={2}
          fill="#111827" stroke="#374151" strokeWidth={1} />
        {/* Crest ridge detail */}
        <rect x={-2} y={-56} width={4} height={20} rx={1} fill="#374151" />

        {/* Gold helmet stripes */}
        <line x1={-8} y1={-55} x2={-12} y2={-20}
          stroke="#d97706" strokeWidth={2.5} strokeLinecap="round" />
        <line x1={0} y1={-56} x2={0} y2={-18}
          stroke="#d97706" strokeWidth={2.5} strokeLinecap="round" />
        <line x1={8} y1={-55} x2={12} y2={-20}
          stroke="#d97706" strokeWidth={2.5} strokeLinecap="round" />

        {/* Gold helmet rim */}
        <ellipse cx={0} cy={-19} rx={24} ry={5}
          fill="none" stroke="#d97706" strokeWidth={2} />

        {/* Ear guard left */}
        <ellipse cx={-23} cy={-32} rx={5} ry={8}
          fill="#1f2937" stroke="#d97706" strokeWidth={1.5} />
        {/* Ear guard right */}
        <ellipse cx={23} cy={-32} rx={5} ry={8}
          fill="#1f2937" stroke="#d97706" strokeWidth={1.5} />
        {/* Ear stud gold */}
        <circle cx={-23} cy={-32} r={3} fill="#d97706" />
        <circle cx={23} cy={-32} r={3} fill="#d97706" />

        {/* Face visible area (below visor) — skin tone */}
        <rect x={-14} y={-28} width={28} height={14} rx={4}
          fill="#d4915a" />
        {/* Angry brow line */}
        <line x1={-11} y1={-27} x2={-5} y2={-24}
          stroke="#7c3a1e" strokeWidth={2} strokeLinecap="round" />
        <line x1={11} y1={-27} x2={5} y2={-24}
          stroke="#7c3a1e" strokeWidth={2} strokeLinecap="round" />
        {/* Eyes — narrow angry slits */}
        <rect x={-11} y={-24} width={8} height={4} rx={2} fill="#1c1917">
          <animate attributeName="height" values="4;1;4" dur="4s"
            keyTimes="0;0.05;0.1" repeatCount="indefinite" />
        </rect>
        <rect x={3} y={-24} width={8} height={4} rx={2} fill="#1c1917">
          <animate attributeName="height" values="4;1;4" dur="4s"
            keyTimes="0;0.05;0.1" begin="0.05s" repeatCount="indefinite" />
        </rect>
        {/* Mouth — grimace */}
        <path d="M -6 -15 Q 0 -12 6 -15" fill="none"
          stroke="#7c3a1e" strokeWidth={1.5} strokeLinecap="round" />

        {/* Visor/face guard covering upper face */}
        <rect x={-14} y={-42} width={28} height={16} rx={3}
          fill="#111827" stroke="#d97706" strokeWidth={1} opacity={0.85} />
        {/* Visor eye slit */}
        <rect x={-12} y={-38} width={10} height={4} rx={2} fill="#1e3a5f" opacity={0.6} />
        <rect x={2} y={-38} width={10} height={4} rx={2} fill="#1e3a5f" opacity={0.6} />
        {/* Visor shine */}
        <line x1={-12} y1={-41} x2={12} y2={-41}
          stroke="#4b5563" strokeWidth={0.8} opacity={0.5} />

        {/* Action label */}
        {action && (
          <text x={28} y={-62} textAnchor="start" fill="#d97706"
            fontSize={10} fontWeight={800} fontFamily="monospace">
            {action.toUpperCase()}
          </text>
        )}
      </g>
    </g>
  )
}

/* ── Generic robot (used for robot / boxer / cosmonaut) ── */
function GenericBody({ skinId, action, shieldActive }: {
  skinId: SkinId; action?: ActionName | null; shieldActive?: boolean
}) {
  const colors = SKIN_COLORS[skinId]
  return (
    <g>
      {shieldActive && (
        <ellipse cx={0} cy={-20} rx={40} ry={55}
          fill={`${colors.primary}15`}
          stroke={colors.primary} strokeWidth={2} strokeDasharray="4 2" opacity={0.8}>
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur="0.8s" repeatCount="indefinite" />
        </ellipse>
      )}
      <rect x={-14} y={28} width={10} height={20} rx={4} fill={colors.secondary} stroke={colors.primary} strokeWidth={1.5} />
      <rect x={4}   y={28} width={10} height={20} rx={4} fill={colors.secondary} stroke={colors.primary} strokeWidth={1.5} />
      <rect x={-17} y={44} width={14} height={7} rx={3} fill={colors.primary} />
      <rect x={3}   y={44} width={14} height={7} rx={3} fill={colors.primary} />
      <rect x={-18} y={-2} width={36} height={32} rx={6} fill={colors.secondary} stroke={colors.primary} strokeWidth={2} />
      <rect x={-8} y={6} width={16} height={10} rx={3} fill={colors.primary} opacity={0.3} />
      <circle cx={0} cy={11} r={4} fill={colors.accent} opacity={0.8}>
        <animate attributeName="opacity" values="0.8;0.4;0.8" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <rect x={-28} y={0} width={12} height={22} rx={5} fill={colors.secondary} stroke={colors.primary} strokeWidth={1.5}
        transform={action === 'attack' || action === 'combo' ? 'rotate(-30, -22, 0)' : ''} />
      <rect x={16}  y={0} width={12} height={22} rx={5} fill={colors.secondary} stroke={colors.primary} strokeWidth={1.5} />
      <circle cx={-22} cy={24} r={6} fill={colors.primary}
        transform={action === 'attack' || action === 'combo' ? 'translate(10, -8)' : ''} />
      <circle cx={22}  cy={24} r={6} fill={colors.primary} />
      <rect x={-6} y={-10} width={12} height={10} rx={3} fill={colors.secondary} stroke={colors.primary} strokeWidth={1} />
      <rect x={-20} y={-42} width={40} height={34} rx={8} fill={colors.secondary} stroke={colors.primary} strokeWidth={2} />
      <rect x={-14} y={-34} width={10} height={8} rx={3} fill={colors.accent}>
        <animate attributeName="opacity" values="1;0.2;1" dur="3s" repeatCount="indefinite" />
      </rect>
      <rect x={4} y={-34} width={10} height={8} rx={3} fill={colors.accent}>
        <animate attributeName="opacity" values="1;0.2;1" dur="3s" begin="0.1s" repeatCount="indefinite" />
      </rect>
      <line x1={0} y1={-42} x2={0} y2={-52} stroke={colors.primary} strokeWidth={2} />
      <circle cx={0} cy={-54} r={3} fill={colors.accent}>
        <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite" />
      </circle>
      {action && (
        <text x={20} y={-65} textAnchor="start" fill={colors.primary} fontSize={11} fontWeight={700}>
          {action.toUpperCase()}
        </text>
      )}
    </g>
  )
}

export default function RobotSVG({ skinId, flip, action, hp, maxHp, name, x, y, shieldActive }: Props) {
  const colors = SKIN_COLORS[skinId]
  const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100))
  const hpColor = hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#fbbf24' : '#ef4444'
  const scale = flip ? -1 : 1

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* HP bar — always faces right (not flipped) */}
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

      {/* Character body — flipped for player 2 */}
      <g transform={`scale(${scale}, 1)`}>
        {skinId === 'gladiator'
          ? <GladiatorBody action={action} shieldActive={shieldActive} />
          : <GenericBody skinId={skinId} action={action} shieldActive={shieldActive} />
        }
      </g>
    </g>
  )
}
