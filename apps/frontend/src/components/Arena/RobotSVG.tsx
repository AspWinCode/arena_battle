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

// Gladiator palette
const H  = '#1c1a1f'
const HM = '#48454f'
const G  = '#b48925'
const GL = '#f1cf68'
const SK = '#e0b07b'
const SD = '#bb8456'
const LB = '#7f4619'
const LD = '#43220a'
const RD = '#92262b'
const RK = '#671015'
const BS = '#b9bec8'
const BE = '#f3f5f8'
const BD = '#6f7584'

/*
  Gladiator matches the supplied side-profile reference.
  Default faces right, and player two is mirrored by the parent group.
*/
function GladiatorBody({ action, shieldActive }: {
  action?: ActionName | null
  shieldActive?: boolean
}) {
  const attacking = action === 'attack' || action === 'combo' || action === 'laser'

  return (
    <g>
      {shieldActive && (
        <ellipse cx={0} cy={-18} rx={44} ry={60} fill="none" stroke={GL} strokeWidth={2.5} strokeDasharray="5 3">
          <animate attributeName="opacity" values="0.72;0.25;0.72" dur="0.85s" repeatCount="indefinite" />
          <animate attributeName="rx" values="44;47;44" dur="0.85s" repeatCount="indefinite" />
        </ellipse>
      )}

      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0,0; 0,-2.4; 0,0"
          dur="2.2s"
          repeatCount="indefinite"
          calcMode="spline"
          keySplines="0.45 0 0.55 1; 0.45 0 0.55 1"
        />
        <animateTransform
          attributeName="transform"
          additive="sum"
          type="rotate"
          values="0 0 8; -1.1 0 8; 0 0 8"
          dur="2.2s"
          repeatCount="indefinite"
          calcMode="spline"
          keySplines="0.45 0 0.55 1; 0.45 0 0.55 1"
        />

        <g opacity={0.82}>
          <path d="M -2 29 C 4 27 9 29 10 38 L 10 52 L 1 52 L 0 39 C -1 35 -1 31 -2 29 Z" fill={SD} />
          <path d="M 0 39 L 11 39 L 13 53 L 0 53 Z" fill={H} stroke={G} strokeWidth={1.1} />
          <line x1={2} y1={43.5} x2={11} y2={43.5} stroke={HM} strokeWidth={1} />
          <line x1={3} y1={47} x2={12} y2={47} stroke={HM} strokeWidth={1} />
          <path d="M -1 52 L 17 52 L 13 59 L 0 58 Z" fill={LD} />
          <path d="M 1 52 L 16 52 L 12 57 L 2 57 Z" fill="#6b4021" />
        </g>

        <path d="M -20 28 C -14 26 -8 27 -7 37 L -8 53 L -21 53 L -20 34 C -20 31 -20 29 -20 28 Z" fill={SK} />
        <path d="M -22 39 L -8 39 L -6 54 L -22 54 Z" fill={H} stroke={GL} strokeWidth={1.4} />
        <line x1={-19} y1={43.5} x2={-8.5} y2={43.5} stroke={HM} strokeWidth={1.2} />
        <line x1={-18.5} y1={47.5} x2={-8} y2={47.5} stroke={HM} strokeWidth={1.2} />
        <path d="M -23 52 L -1 52 L -6 60 L -22 59 Z" fill={LD} />
        <path d="M -21 52 L -2 52 L -8 58 L -19 58 Z" fill="#6b4021" />
        <path d="M -17 52 L -14 58" stroke={BD} strokeWidth={2} strokeLinecap="round" />
        <path d="M -8 52 L -5 58" stroke={BD} strokeWidth={2} strokeLinecap="round" />

        <path d="M -17 18 L 8 18 L 17 22 L 13 28 L -18 28 Z" fill={LD} stroke={LB} strokeWidth={1.1} />
        <path d="M -17 18 L -9 22 L 15 22" fill="none" stroke="#845328" strokeWidth={1.1} />
        {([-13, -7, -1, 5, 11] as number[]).map((bx, i) => (
          <circle key={i} cx={bx} cy={24} r={1.9} fill={GL} />
        ))}

        <path d="M -16 26 C -12 22 -4 22 3 24 C 10 26 13 29 13 34 C 4 41 -6 41 -16 34 C -17 31 -17 28 -16 26 Z" fill={RD} stroke={RK} strokeWidth={1.1} />
        <path d="M -10 29 C -7 27 -4 27 -1 29" fill="none" stroke="#ef8f96" strokeWidth={1.4} opacity={0.45} />
        <path d="M -1 32 C 2 30 6 30 9 32" fill="none" stroke="#ef8f96" strokeWidth={1.3} opacity={0.35} />
        <path d="M 3 33 L 7 45 L 0 40 Z" fill={RD} stroke={RK} strokeWidth={1} />

        <path
          d="M -12 -11 C -7 -16 5 -16 10 -12 C 15 -9 17 -2 15 9 C 13 20 8 22 1 23 C -6 24 -13 21 -16 13 C -19 4 -18 -5 -12 -11 Z"
          fill={SK}
        />
        <path d="M -5 -7 C -1 0 0 8 -2 19" fill="none" stroke={SD} strokeWidth={1.3} opacity={0.35} />
        <path d="M 11 -11 C 14 -4 14 4 12 13" fill="none" stroke="#efc696" strokeWidth={3} opacity={0.25} />
        <path d="M -4 4 C -8 8 -10 12 -11 17" fill="none" stroke="#9f1d21" strokeWidth={1.5} opacity={0.65} />

        <path d="M -1 -11 C 4 -14 11 -12 16 -6 C 18 -3 18 2 14 4 C 10 6 -1 4 -5 -1 C -8 -5 -6 -9 -1 -11 Z" fill={LB} stroke={LD} strokeWidth={1.1} />
        {([-1, 4, 9] as number[]).map((sx, i) => (
          <path key={i} d={`M ${sx} -8 Q ${sx + 5} -3 ${sx + 2} 3`} fill="none" stroke={LD} strokeWidth={0.9} opacity={0.8} />
        ))}

        <path d="M 11 -12 L -10 18" stroke={LD} strokeWidth={7.5} strokeLinecap="round" />
        <path d="M 11 -12 L -10 18" stroke={LB} strokeWidth={4.7} strokeLinecap="round" />
        <path d="M 11 -12 L -10 18" stroke={LD} strokeWidth={1.2} strokeDasharray="2.5 3.5" strokeLinecap="round" />
        <circle cx={3.5} cy={5} r={6.2} fill={G} stroke={LD} strokeWidth={1.2} />
        <circle cx={3.5} cy={5} r={4.2} fill={GL} stroke={G} strokeWidth={0.8} />
        <circle cx={2.2} cy={3.3} r={1.1} fill={BE} opacity={0.7} />

        <path d="M -1 -10 C 5 -14 13 -13 16 -8 L 20 0 L 15 7 L 3 4 L -1 -3 Z" fill={LB} stroke={LD} strokeWidth={1.2} />
        <path d="M 1 -7 C 6 -11 12 -10 16 -7" fill="none" stroke="#2d1206" strokeWidth={1.4} opacity={0.75} />
        <path d="M 15 1 C 18 1 20 2 20 4" fill="none" stroke="#2d1206" strokeWidth={1.2} opacity={0.55} />

        <g opacity={0.75}>
          <path d="M 13 -4 C 17 -4 20 -2 20 3 L 20 14 C 18 17 15 17 12 14 L 12 1 C 12 -1 12 -3 13 -4 Z" fill={SD} />
          <path d="M 12 13 C 16 13 18 15 18 18 L 18 27 C 16 30 13 29 11 26 L 11 17 C 11 15 11 14 12 13 Z" fill={SD} />
        </g>

        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={attacking ? '-22 -7 12; 16 -7 12; -22 -7 12' : '4 -7 12; -4 -7 12; 4 -7 12'}
            dur={attacking ? '0.34s' : '2.4s'}
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
          />

          <path d="M -11 -2 C -5 -1 1 2 5 8 L 9 15 C 8 18 5 19 1 17 L -5 8 C -8 5 -11 3 -11 -2 Z" fill={SK} />
          <path d="M -3 8 L 12 15 L 8 29 L -7 22 Z" fill={BS} stroke={BD} strokeWidth={1.3} />
          <path d="M -1 11 L 11 17 L 8 27 L -4 21 Z" fill={HM} opacity={0.55} />
          <circle cx={3} cy={15} r={3.6} fill={GL} stroke={LD} strokeWidth={0.9} />
          {([0, 7, 12] as number[]).map((cy, i) => (
            <path
              key={i}
              d={`M ${11 + i * 1.5} ${cy + 11} L ${15.5 + i * 1.4} ${cy + 14} L ${10.5 + i * 1.4} ${cy + 17} Z`}
              fill={GL}
              stroke={LD}
              strokeWidth={0.8}
            />
          ))}

          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              values={attacking ? '-16 20 26; 18 20 26; -16 20 26' : '2 20 26; -2 20 26; 2 20 26'}
              dur={attacking ? '0.34s' : '2.8s'}
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
            />

            <path d="M 1 25 L 47 -17" stroke={LD} strokeWidth={6.5} strokeLinecap="round" />
            <path d="M 8 18 L 14 12" stroke={RD} strokeWidth={5.5} strokeLinecap="round" opacity={0.85} />
            <path d="M 1 25 L 47 -17" stroke="#2f1706" strokeWidth={1.2} strokeLinecap="round" opacity={0.45} />
            <path d="M 36 -9 L 47 -17 L 41 -5 Z" fill={BS} stroke={BD} strokeWidth={1.2} />
            <path d="M 40 -12 L 45 -16 L 42 -8 Z" fill={BE} opacity={0.8} />
            <path d="M 44 -19 L 52 -13 L 47 -7 L 39 -11 Z" fill="#b33232" stroke="#7a1616" strokeWidth={0.9} />
            <path
              d="M 46 -17
                 C 60 -28 73 -31 86 -31
                 L 82 -18 L 93 -10 L 79 4 L 86 12
                 C 72 15 59 12 47 6 Z"
              fill={BS}
              stroke={BD}
              strokeWidth={1.5}
            />
            <path d="M 57 -23 C 70 -26 79 -25 85 -24 L 72 -11 L 83 -5 L 70 8 C 60 8 53 6 48 3 Z" fill={BE} opacity={0.72} />
            <path d="M 65 -19 C 67 -12 66 -4 61 2" fill="none" stroke={BD} strokeWidth={3} opacity={0.35} />
            <path d="M 48 6 L 43 15 L 54 14 Z" fill={BS} stroke={BD} strokeWidth={1.2} />
            <path d="M 51 7 L 47 13 L 53 13 Z" fill={BE} opacity={0.8} />
            <path d="M 78 -28 L 73 -16 L 84 -11" fill="none" stroke={BE} strokeWidth={1.8} opacity={0.7} />
          </g>
        </g>

        <path d="M -5 -17 C -2 -19 3 -18 4 -14 C 3 -10 0 -9 -4 -10 C -7 -11 -7 -14 -5 -17 Z" fill={SK} />

        <path
          d="M -8 -76
             C -25 -71 -31 -58 -30 -39
             C -29 -25 -21 -15 -8 -7
             L 8 -7
             C 14 -18 16 -29 14 -41
             C 12 -58 5 -71 -8 -76 Z"
          fill={H}
          stroke="#0d111a"
          strokeWidth={1.8}
        />
        <path d="M -7 -73 C 4 -69 10 -58 11 -43 C 11 -31 9 -23 4 -14" fill="none" stroke={HM} strokeWidth={4.5} opacity={0.3} strokeLinecap="round" />
        <path d="M -15 -66 C -10 -51 -9 -34 -12 -17" fill="none" stroke={G} strokeWidth={5.2} strokeLinecap="round" />
        <path d="M -4 -75 C 1 -61 1 -40 -3 -14" fill="none" stroke={GL} strokeWidth={4.6} strokeLinecap="round" />
        <path d="M 6 -67 C 12 -55 12 -39 8 -18" fill="none" stroke={G} strokeWidth={5} strokeLinecap="round" />
        <path d="M -23 -52 C -30 -46 -32 -35 -30 -24 L -20 -18 L -16 -22 C -19 -30 -19 -42 -15 -50 Z" fill={H} stroke="#0d111a" strokeWidth={1.4} />
        <path d="M -19 -48 C -25 -41 -27 -32 -25 -25" fill="none" stroke={G} strokeWidth={3.5} strokeLinecap="round" />
        <circle cx={7.5} cy={-38} r={7.4} fill={GL} stroke={G} strokeWidth={1.2} />
        <path d="M 7 -42 C 10 -41 11 -39 11 -36 C 11 -33 9 -31 6 -31" fill="none" stroke="#fff4c3" strokeWidth={2} strokeLinecap="round" />

        <path
          d="M -4 -55
             C 5 -58 13 -56 18 -50
             L 18 -22
             L 8 -5
             L -5 -5
             L -6 -24
             C -7 -38 -7 -49 -4 -55 Z"
          fill="#6f727b"
          stroke="#22262f"
          strokeWidth={1.6}
        />
        <path d="M -1 -52 C 7 -54 13 -52 16 -47" fill="none" stroke="#9296a0" strokeWidth={2} strokeLinecap="round" opacity={0.65} />
        <path d="M 5 -48 C 10 -49 15 -48 18 -45" fill="none" stroke="#12161d" strokeWidth={6} strokeLinecap="round" />
        <path d="M 6 -46 C 10 -47 14 -46 16 -44" fill="none" stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" />
        <path d="M 6 -45 C 11 -45 15 -44 18 -43" fill="none" stroke="#3b0f04" strokeWidth={1.8} strokeLinecap="round" opacity={0.85}>
          <animate attributeName="opacity" values="0.85;0.1;0.85" dur="4.2s" keyTimes="0;0.04;0.08" repeatCount="indefinite" />
        </path>

        <path d="M 8 -11 L 16 -11 L 19 -15 L 20 -10 L 15 -3 L 8 -4 Z" fill={SK} stroke={LD} strokeWidth={1.1} />
        <path d="M 12 -7 L 18 -7" stroke={LD} strokeWidth={1.6} strokeLinecap="round" />
        <path d="M 12 -2 L 17 -4 L 15 1" fill="none" stroke={LD} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />

        {action && (
          <text x={34} y={-68} fill={GL} fontSize={10} fontWeight={800} fontFamily="monospace" textAnchor="start">
            {action.toUpperCase()}
          </text>
        )}
      </g>
    </g>
  )
}

/* Generic body for robot, boxer and cosmonaut */
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

/* Main export */
export default function RobotSVG({ skinId, flip, action, hp, maxHp, name, x, y, shieldActive }: Props) {
  const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100))
  const hpColor = hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#fbbf24' : '#ef4444'

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* HP bar is never flipped */}
      <g transform="translate(-40, -95)">
        <rect x={0} y={0} width={80} height={8} rx={4} fill="#1a1a35" />
        <rect x={0} y={0} width={hpPct * 0.8} height={8} rx={4} fill={hpColor} />
        <text x={40} y={20} textAnchor="middle" fill="#94a3b8" fontSize={10} fontWeight={600}>{name}</text>
        <text x={40} y={-4} textAnchor="middle" fill={hpColor} fontSize={10} fontWeight={700}>{hp}</text>
      </g>

      {/* Player 2 is mirrored so both fighters look inward */}
      <g transform={flip ? 'scale(-1,1)' : undefined}>
        {skinId === 'gladiator'
          ? <GladiatorBody action={action} shieldActive={shieldActive} />
          : <GenericBody skinId={skinId} action={action} shieldActive={shieldActive} />}
      </g>
    </g>
  )
}
