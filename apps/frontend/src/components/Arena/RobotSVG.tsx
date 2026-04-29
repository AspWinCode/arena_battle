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
  Redrawn to match the supplied chibi-gladiator reference:
  • Huge dome helmet (~42% of total height) with bold gold stripes & ear-disc
  • Visible angry face: heavy brow, fierce eye, clenched jaw with teeth
  • Short barrel chest in brown leather
  • Red kilt (pteruges) with strip lines
  • Stubby chibi legs with grey greaves and brown sandals
  • Large battle-axe: long dark handle, spike tip, red accent, serrated silver head
  • Metal gauntlet on weapon hand
  Faces RIGHT by default; Player 2 is mirrored via scale(-1,1).
*/
function GladiatorBody({ action, shieldActive }: {
  action?: ActionName | null
  shieldActive?: boolean
}) {
  const attacking = action === 'attack' || action === 'combo' || action === 'laser'

  return (
    <g>
      {/* Shield shimmer */}
      {shieldActive && (
        <ellipse cx={0} cy={-22} rx={50} ry={72} fill="none" stroke={GL} strokeWidth={2.5} strokeDasharray="5 3">
          <animate attributeName="opacity" values="0.72;0.25;0.72" dur="0.85s" repeatCount="indefinite" />
          <animate attributeName="rx" values="50;54;50" dur="0.85s" repeatCount="indefinite" />
        </ellipse>
      )}

      {/* ── All body parts breathe together ── */}
      <g>
        <animateTransform attributeName="transform" type="translate"
          values="0,0; 0,-2; 0,0" dur="2.2s" repeatCount="indefinite"
          calcMode="spline" keySplines="0.45 0 0.55 1; 0.45 0 0.55 1" />
        <animateTransform attributeName="transform" additive="sum" type="rotate"
          values="0 0 0; -0.8 0 0; 0 0 0" dur="2.2s" repeatCount="indefinite"
          calcMode="spline" keySplines="0.45 0 0.55 1; 0.45 0 0.55 1" />

        {/* ══════════════════════════════════════════
            SANDALS / FEET  (y 46–56)
        ══════════════════════════════════════════ */}
        {/* Left sandal */}
        <path d="M -18 46 L -24 52 L -24 56 L -4 56 L -4 52 L -8 46 Z" fill={LD} />
        <path d="M -23 52 L -3 52" stroke="#6b4021" strokeWidth={1.5} />
        {/* Right sandal */}
        <path d="M 2 46 L -4 52 L -4 56 L 20 56 L 20 52 L 14 46 Z" fill={LD} />
        <path d="M -3 52 L 19 52" stroke="#6b4021" strokeWidth={1.5} />

        {/* ══════════════════════════════════════════
            GREAVES  (y 35–46)
        ══════════════════════════════════════════ */}
        <rect x={-22} y={35} width={18} height={13} rx={3} fill={H} stroke={HM} strokeWidth={1.2} />
        <line x1={-20} y1={39} x2={-6}  y2={39} stroke={G} strokeWidth={1}   opacity={0.6} />
        <line x1={-20} y1={43} x2={-6}  y2={43} stroke={G} strokeWidth={0.8} opacity={0.4} />
        <rect x={-2}  y={35} width={20} height={13} rx={3} fill={H} stroke={HM} strokeWidth={1.2} />
        <line x1={0}  y1={39} x2={17} y2={39} stroke={G} strokeWidth={1}   opacity={0.6} />
        <line x1={0}  y1={43} x2={17} y2={43} stroke={G} strokeWidth={0.8} opacity={0.4} />

        {/* ══════════════════════════════════════════
            LEGS – short chibi stubs  (y 22–35)
        ══════════════════════════════════════════ */}
        <path d="M -18 22 C -20 28 -22 33 -22 35 L -4 35 C -4 33 -4 28 -4 22 Z"  fill={SK} />
        <path d="M  2  22 C  0  28 -2  33 -2  35 L 18 35 C 18 33 18 28 18 22 Z"  fill={SK} />

        {/* ══════════════════════════════════════════
            RED KILT / PTERUGES  (y 2–22)
        ══════════════════════════════════════════ */}
        <path d="M -20 2 L 26 2 L 30 22 L -20 22 Z" fill={RD} stroke={RK} strokeWidth={1.2} />
        {([-14,-8,-2,4,10,16,22] as number[]).map((kx,i) => (
          <line key={i} x1={kx} y1={2} x2={kx+1} y2={21} stroke={RK} strokeWidth={0.9} opacity={0.5} />
        ))}

        {/* ══════════════════════════════════════════
            BELT  (y -5 – 3)
        ══════════════════════════════════════════ */}
        <rect x={-20} y={-5} width={48} height={9} rx={2} fill={LD} stroke={LB} strokeWidth={1.2} />
        {([-14,-8,-2,4,10,16,22] as number[]).map((bx,i) => (
          <circle key={i} cx={bx} cy={-1} r={2} fill={GL} />
        ))}

        {/* ══════════════════════════════════════════
            CHEST – barrel leather armour  (y -5 – -40)
        ══════════════════════════════════════════ */}
        <path d="M -20 -5 C -22 -14 -20 -30 -14 -40 L 16 -40 C 22 -30 24 -16 24 -5 Z"
          fill={LB} stroke={LD} strokeWidth={1.3} />
        {([-9,-15,-21,-27,-33] as number[]).map((ry,i) => (
          <path key={i}
            d={`M ${-18+i*0.6} ${ry} C 2 ${ry-1} 18 ${ry+1} ${22-i*0.6} ${ry}`}
            fill="none" stroke={LD} strokeWidth={1.3} opacity={0.65} />
        ))}
        <path d="M -12 -8 C -2 -12 8 -12 16 -8" fill="none" stroke="#9a5a1e" strokeWidth={2} opacity={0.45} />

        {/* ══════════════════════════════════════════
            LEFT ARM STUB (back arm, partially visible)
        ══════════════════════════════════════════ */}
        <path d="M -14 -34 C -20 -30 -26 -20 -24 -10 L -14 -8 Z" fill={SK} stroke={SD} strokeWidth={0.8} />

        {/* ══════════════════════════════════════════
            SHOULDER PLATE
        ══════════════════════════════════════════ */}
        <path d="M -14 -40 C -8 -46 -2 -46 4 -44 L 2 -36 C -4 -35 -10 -38 -14 -40 Z"
          fill={H} stroke={HM} strokeWidth={1} />

        {/* ══════════════════════════════════════════
            NECK
        ══════════════════════════════════════════ */}
        <path d="M -6 -40 L -6 -34 L 6 -34 L 6 -40 C 6 -44 -6 -44 -6 -40 Z" fill={SK} />

        {/* ══════════════════════════════════════════
            RIGHT ARM + FOREARM (weapon arm)
        ══════════════════════════════════════════ */}
        <path d="M 16 -36 C 22 -32 28 -22 26 -10 L 16 -10 Z" fill={SK} stroke={SD} strokeWidth={0.8} />
        <path d="M 18 -10 C 24 -4 28 6 24 16 L 16 14 C 16 4 16 -4 18 -10 Z" fill={SK} stroke={SD} strokeWidth={0.8} />

        {/* ══════════════════════════════════════════
            METAL GAUNTLET on weapon hand
        ══════════════════════════════════════════ */}
        <path d="M 16 12 C 20 10 28 12 28 18 L 28 28 C 26 30 22 30 16 28 L 16 12 Z"
          fill={HM} stroke={H} strokeWidth={1.3} />
        <circle cx={22} cy={20} r={5}   fill={G}  stroke={LD} strokeWidth={1} />
        <circle cx={22} cy={20} r={3.5} fill={GL} stroke={G}  strokeWidth={0.8} />
        <circle cx={21} cy={19} r={1.2} fill={BE} opacity={0.65} />
        <line x1={16} y1={16} x2={28} y2={16} stroke={H} strokeWidth={1.1} opacity={0.5} />
        <line x1={16} y1={22} x2={28} y2={22} stroke={H} strokeWidth={1.1} opacity={0.5} />

        {/* ══════════════════════════════════════════
            AXE  (animated weapon-arm group)
        ══════════════════════════════════════════ */}
        <g>
          <animateTransform attributeName="transform" type="rotate"
            values={attacking ? '-20 22 20; 18 22 20; -20 22 20' : '4 22 20; -4 22 20; 4 22 20'}
            dur={attacking ? '0.34s' : '2.8s'} repeatCount="indefinite"
            calcMode="spline" keySplines="0.4 0 0.6 1; 0.4 0 0.6 1" />

          {/* Handle (long, dark, diagonal) */}
          <path d="M 20 30 L 80 -26" stroke={LD}    strokeWidth={7.5} strokeLinecap="round" />
          <path d="M 20 30 L 80 -26" stroke="#3d1c06" strokeWidth={5}   strokeLinecap="round" />
          {/* Red wrap accent near blade */}
          <path d="M 62 -12 L 72 -22" stroke={RD} strokeWidth={6} strokeLinecap="round" opacity={0.9} />
          {/* Handle grain */}
          <path d="M 20 30 L 80 -26" stroke="#6b3312" strokeWidth={1.2} strokeDasharray="3 4" opacity={0.5} />

          {/* ── Axe head (large, serrated silver) ── */}
          <path d="M 76 -22
                   C 90 -34 102 -40 114 -38
                   L 110 -22 L 120 -10 L 106 4 L 112 14
                   C 100 16 88 12 76 -2 Z"
            fill={BS} stroke={BD} strokeWidth={1.8} />
          {/* Inner blade highlight */}
          <path d="M 84 -28 C 96 -36 108 -36 112 -30 L 100 -16 L 108 -6 C 102 -2 94 -2 86 -6 Z"
            fill={BE} opacity={0.65} />
          <path d="M 88 -28 C 98 -36 110 -34 114 -28" fill="none" stroke={BE} strokeWidth={2}   opacity={0.55} />
          <path d="M 78 -22 C 92 -12 98 0 96 10"      fill="none" stroke={BD} strokeWidth={3}   opacity={0.25} />
          {/* Top spike */}
          <path d="M 82 -28 L 76 -40 L 88 -40 Z" fill={BS} stroke={BD} strokeWidth={1.3} />
          <path d="M 83 -30 L 78 -39 L 87 -38 Z" fill={BE} opacity={0.8} />
          {/* Red diamond accent */}
          <path d="M 78 -22 L 72 -28 L 78 -36 L 82 -28 Z" fill="#b33232" stroke="#7a1616" strokeWidth={1} />
        </g>

        {/* ══════════════════════════════════════════
            HELMET – large chibi dome  (y -40 – -102)
        ══════════════════════════════════════════ */}
        {/* Main dark dome */}
        <path d="M -2 -102
                 C -28 -98 -42 -80 -40 -60
                 C -38 -46 -28 -40 -16 -40
                 L 16 -40
                 C 24 -40 28 -48 28 -62
                 C 28 -84 16 -102 -2 -102 Z"
          fill={H} stroke="#0a0c14" strokeWidth={2} />
        {/* Dome inner sheen */}
        <path d="M -2 -98 C 12 -94 20 -80 22 -64"
          fill="none" stroke={HM} strokeWidth={5} opacity={0.22} strokeLinecap="round" />

        {/* ── Three bold gold stripes (back-top → front-bottom) ── */}
        <path d="M -24 -94 C  -8 -92  8 -86 18 -78" fill="none" stroke={G}  strokeWidth={6}   strokeLinecap="round" />
        <path d="M -26 -82 C -10 -80  6 -76 16 -68" fill="none" stroke={GL} strokeWidth={5.5} strokeLinecap="round" />
        <path d="M -26 -70 C -12 -68  2 -64 12 -56" fill="none" stroke={G}  strokeWidth={5}   strokeLinecap="round" />

        {/* ── Gold ear disc (back/left of helmet) ── */}
        <circle cx={-30} cy={-64} r={10}  fill={G}  stroke={LD} strokeWidth={1.2} />
        <circle cx={-30} cy={-64} r={7}   fill={GL} stroke={G}  strokeWidth={0.9} />
        <circle cx={-28} cy={-66} r={2.2} fill={BE} opacity={0.7} />

        {/* ── Cheek plates (front & back) ── */}
        <path d="M 18 -40 C 24 -48 28 -56 26 -66 L 20 -62 C 20 -54 20 -48 16 -40 Z"
          fill={H} stroke="#0a0c14" strokeWidth={1.4} />
        <path d="M -16 -40 C -20 -48 -18 -58 -12 -62 L -10 -54 C -12 -50 -14 -46 -14 -40 Z"
          fill={H} stroke="#0a0c14" strokeWidth={1.2} />

        {/* ══════════════════════════════════════════
            FACE (visible through open visor)
        ══════════════════════════════════════════ */}
        {/* Skin area */}
        <path d="M -8 -92
                 C  4 -96 16 -94 22 -86
                 L 26 -62
                 C 26 -50 20 -44 12 -42
                 L  0 -42
                 C -4 -48 -8 -60 -8 -76
                 C -10 -86 -10 -92 -8 -92 Z"
          fill={SK} />
        {/* Face contour shadow */}
        <path d="M -6 -90 C 4 -94 14 -92 20 -86 L 24 -68 C 22 -56 18 -48 12 -44"
          fill="none" stroke={SD} strokeWidth={2.5} opacity={0.22} />

        {/* Heavy angry brow ridge */}
        <path d="M 2 -84 C 10 -88 18 -86 24 -80" stroke="#1a0a00" strokeWidth={7}   strokeLinecap="round" />
        <path d="M 2 -84 C 10 -88 18 -86 24 -80" stroke="#3d1a06" strokeWidth={3.5} strokeLinecap="round" opacity={0.7} />

        {/* Fierce, narrowed eye */}
        <ellipse cx={18} cy={-76} rx={5.5} ry={3.5} fill="#160c00" />
        <ellipse cx={20} cy={-77} rx={2.2} ry={1.5} fill="white" opacity={0.5} />
        <circle  cx={20.5} cy={-78} r={1}  fill="white" opacity={0.8} />

        {/* Nose */}
        <path d="M 22 -70 C 24 -68 24 -64 22 -62"
          fill="none" stroke={SD} strokeWidth={2.2} strokeLinecap="round" opacity={0.6} />

        {/* Grimacing mouth with teeth */}
        <path d="M 6 -54 C 12 -58 20 -58 24 -54" stroke="#1a0800" strokeWidth={3.5} strokeLinecap="round" />
        <path d="M  8 -56 L  8 -52" stroke="white" strokeWidth={2} strokeLinecap="round" opacity={0.55} />
        <path d="M 13 -57 L 13 -53" stroke="white" strokeWidth={2} strokeLinecap="round" opacity={0.55} />
        <path d="M 18 -57 L 18 -53" stroke="white" strokeWidth={2} strokeLinecap="round" opacity={0.5}  />
        <path d="M 23 -55 L 23 -52" stroke="white" strokeWidth={2} strokeLinecap="round" opacity={0.45} />

        {/* Chin / jaw line */}
        <path d="M 4 -54 C 0 -52 -2 -48 0 -44"
          fill="none" stroke={SD} strokeWidth={2} opacity={0.5} strokeLinecap="round" />

        {/* Visor edge shadow */}
        <path d="M -8 -94 C -12 -86 -12 -76 -10 -64 L -8 -52 C -6 -48 -2 -44 2 -42"
          fill="none" stroke="#0d0800" strokeWidth={4.5} opacity={0.45} strokeLinecap="round" />

        {/* ══════════════════════════════════════════
            ACTION TEXT
        ══════════════════════════════════════════ */}
        {action && (
          <text x={30} y={-62} fill={GL} fontSize={10} fontWeight={800} fontFamily="monospace" textAnchor="start">
            {action.toUpperCase()}
          </text>
        )}
      </g>
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
export default function RobotSVG({ skinId, flip, action, hp, maxHp, name, x, y, shieldActive }: Props) {
  const hpPct  = Math.max(0, Math.min(100, (hp / maxHp) * 100))
  const hpColor = hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#fbbf24' : '#ef4444'

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* HP bar – never flipped */}
      <g transform="translate(-40, -95)">
        <rect x={0} y={0} width={80} height={8} rx={4} fill="#1a1a35" />
        <rect x={0} y={0} width={hpPct * 0.8} height={8} rx={4} fill={hpColor} />
        <text x={40} y={20}  textAnchor="middle" fill="#94a3b8" fontSize={10} fontWeight={600}>{name}</text>
        <text x={40} y={-4}  textAnchor="middle" fill={hpColor} fontSize={10} fontWeight={700}>{hp}</text>
      </g>

      {/* Player 2 faces left via mirror */}
      <g transform={flip ? 'scale(-1,1)' : undefined}>
        {skinId === 'gladiator'
          ? <GladiatorBody action={action} shieldActive={shieldActive} />
          : <GenericBody   skinId={skinId} action={action} shieldActive={shieldActive} />}
      </g>
    </g>
  )
}
