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

// ── Gladiator colour palette (matches the chibi reference) ──────────────────
const H  = '#1c1a1f'   // helmet dark
const HM = '#48454f'   // helmet mid
const G  = '#b48925'   // gold base
const GL = '#f1cf68'   // gold light
const SK = '#e0b07b'   // skin
const SD = '#bb8456'   // skin shadow
const LB = '#7f4619'   // leather brown
const LD = '#43220a'   // leather dark
const RD = '#92262b'   // red kilt
const RK = '#671015'   // red kilt dark
const BS = '#b9bec8'   // blade silver
const BE = '#f3f5f8'   // blade edge light
const BD = '#6f7584'   // blade dark

/*
  Gladiator uses a PNG sprite placed in /public/skins/gladiator.png
  The PNG must have a TRANSPARENT background.
  Faces RIGHT; Player 2 is mirrored by the parent scale(-1,1).
*/
function GladiatorBody({ action, shieldActive }: {
  action?: ActionName | null
  shieldActive?: boolean
}) {
  const attacking = action === 'attack' || action === 'combo' || action === 'laser'

  // PNG is 1537x1023 (landscape, ratio 1.503:1).
  // PNG имеет ~12% прозрачного отступа снизу — компенсируем через FOOT_OFFSET.
  const SH = 380
  const SW = 571
  const SX = -SW / 2   // centres sprite
  const FOOT_OFFSET = 38  // визуальные ноги выше нижнего края PNG → смещаем спрайт вниз
  const SY = -SH + FOOT_OFFSET

  return (
    <g>
      {/* Тень под ногами */}
      <ellipse cx={0} cy={2} rx={48} ry={7}
        fill="#000" opacity={0.45} />

      {/* Shield shimmer */}
      {shieldActive && (
        <ellipse cx={0} cy={-SH * 0.45} rx={SW * 0.4} ry={SH * 0.45}
          fill="none" stroke={GL} strokeWidth={2.5} strokeDasharray="5 3">
          <animate attributeName="opacity" values="0.72;0.25;0.72" dur="0.85s" repeatCount="indefinite" />
          <animate attributeName="rx" values={`${SW*0.4};${SW*0.44};${SW*0.4}`} dur="0.85s" repeatCount="indefinite" />
        </ellipse>
      )}

      {/* ── Sprite group: breathe + attack ── */}
      <g>
        {/* Idle breathing */}
        <animateTransform attributeName="transform" type="translate"
          values="0,0; 0,-3; 0,0" dur="2.2s" repeatCount="indefinite"
          calcMode="spline" keySplines="0.45 0 0.55 1; 0.45 0 0.55 1" />

        {/* Attack lunge */}
        <g>
          <animateTransform attributeName="transform" type="rotate"
            values={attacking ? '-12 0 -20; 10 0 -20; -12 0 -20' : '0 0 0; 0 0 0; 0 0 0'}
            dur={attacking ? '0.34s' : '1s'} repeatCount="indefinite"
            calcMode="spline" keySplines="0.4 0 0.6 1; 0.4 0 0.6 1" />

          {/* ── PNG sprite ── */}
          <image
            href="/skins/gladiator.png"
            x={SX}
            y={SY}
            width={SW}
            height={SH}
            preserveAspectRatio="xMidYMax meet"
          />

        </g>{/* /attack lunge */}

        {/* Action label next to sprite */}
        {action && (
          <text x={SW * 0.45} y={SY + SH * 0.4}
            fill={GL} fontSize={10} fontWeight={800} fontFamily="monospace" textAnchor="start">
            {action.toUpperCase()}
          </text>
        )}
      </g>{/* /breathe */}
    </g>
  )
}

/* ── Generic body for robot / boxer / cosmonaut ─────────────────────────────── */
function GenericBody({ skinId, action, shieldActive }: {
  skinId: SkinId
  action?: ActionName | null
  shieldActive?: boolean
}) {
  const c = SKIN_COLORS[skinId]

  return (
    <g>
      {/* Тень под ногами */}
      <ellipse cx={0} cy={52} rx={22} ry={3.5} fill="#000" opacity={0.5} />

      {shieldActive && (
        <ellipse cx={0} cy={-20} rx={40} ry={55} fill={`${c.primary}15`} stroke={c.primary} strokeWidth={2} strokeDasharray="4 2">
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur="0.8s" repeatCount="indefinite" />
        </ellipse>
      )}

      <rect x={-14} y={28} width={10} height={20} rx={4} fill={c.secondary} stroke={c.primary} strokeWidth={1.5} />
      <rect x={4}   y={28} width={10} height={20} rx={4} fill={c.secondary} stroke={c.primary} strokeWidth={1.5} />
      <rect x={-17} y={44} width={14} height={7} rx={3} fill={c.primary} />
      <rect x={3}   y={44} width={14} height={7} rx={3} fill={c.primary} />
      <rect x={-18} y={-2} width={36} height={32} rx={6} fill={c.secondary} stroke={c.primary} strokeWidth={2} />
      <rect x={-8}  y={6}  width={16} height={10} rx={3} fill={c.primary} opacity={0.3} />
      <circle cx={0} cy={11} r={4} fill={c.accent} opacity={0.8}>
        <animate attributeName="opacity" values="0.8;0.4;0.8" dur="1.5s" repeatCount="indefinite" />
      </circle>

      <rect x={-28} y={0} width={12} height={22} rx={5}
        fill={c.secondary} stroke={c.primary} strokeWidth={1.5}
        transform={action === 'attack' || action === 'combo' ? 'rotate(-30, -22, 0)' : ''} />
      <rect x={16} y={0} width={12} height={22} rx={5} fill={c.secondary} stroke={c.primary} strokeWidth={1.5} />
      <circle cx={-22} cy={24} r={6} fill={c.primary}
        transform={action === 'attack' || action === 'combo' ? 'translate(10,-8)' : ''} />
      <circle cx={22}  cy={24} r={6} fill={c.primary} />
      <rect x={-6}  y={-10} width={12} height={10} rx={3} fill={c.secondary} stroke={c.primary} strokeWidth={1} />
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

/* ── Main export ─────────────────────────────────────────────────────────────── */
const ROBOT_SCALE = 2.8

export default function RobotSVG({ skinId, flip, action, hp, maxHp, name, x, y, shieldActive }: Props) {
  const hpPct  = Math.max(0, Math.min(100, (hp / maxHp) * 100))
  const hpColor = hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#fbbf24' : '#ef4444'

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* HP bar – never flipped */}
      <g transform="translate(-55, -285)">
        <rect x={0} y={0} width={110} height={10} rx={4} fill="#1a1a35" />
        <rect x={0} y={0} width={hpPct * 1.1} height={10} rx={4} fill={hpColor} />
        <text x={55} y={24}  textAnchor="middle" fill="#94a3b8" fontSize={12} fontWeight={600}>{name}</text>
        <text x={55} y={-5}  textAnchor="middle" fill={hpColor} fontSize={12} fontWeight={700}>{hp}</text>
      </g>

      {/* Gladiator is intrinsically sized via SW/SH — only mirror for P2.
          Generic skins use ROBOT_SCALE transform. */}
      {skinId === 'gladiator' ? (
        <g transform={flip ? 'scale(-1,1)' : undefined}>
          <GladiatorBody action={action} shieldActive={shieldActive} />
        </g>
      ) : (
        <g transform={flip ? `scale(${-ROBOT_SCALE}, ${ROBOT_SCALE})` : `scale(${ROBOT_SCALE})`}>
          <GenericBody skinId={skinId} action={action} shieldActive={shieldActive} />
        </g>
      )}
    </g>
  )
}
