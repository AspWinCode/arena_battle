import React from 'react'
import { getRankInfo } from './RankBadge'

interface EloPoint {
  elo: number
  delta: number
  won: boolean
  createdAt: string
  opponent?: { displayName: string; username: string } | null
}

interface Props {
  history: EloPoint[]
  height?: number
}

export default function EloChart({ history, height = 120 }: Props) {
  if (history.length < 2) {
    return (
      <div style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: 13,
        background: 'var(--bg-mid)',
        borderRadius: 8,
        border: '1px solid var(--border)',
      }}>
        Сыграй больше матчей для графика ELO
      </div>
    )
  }

  const W = 600
  const H = height
  const PAD_L = 44
  const PAD_R = 12
  const PAD_T = 12
  const PAD_B = 24

  const elos = history.map(h => h.elo)
  const minElo = Math.min(...elos) - 30
  const maxElo = Math.max(...elos) + 30

  const toX = (i: number) => PAD_L + (i / (history.length - 1)) * (W - PAD_L - PAD_R)
  const toY = (elo: number) => PAD_T + (1 - (elo - minElo) / (maxElo - minElo)) * (H - PAD_T - PAD_B)

  const points = history.map((h, i) => ({ x: toX(i), y: toY(h.elo), ...h }))
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  // Y-axis labels: min, mid, max
  const midElo = Math.round((minElo + maxElo) / 2)
  const yLabels = [
    { elo: Math.round(maxElo), y: PAD_T },
    { elo: midElo, y: toY(midElo) },
    { elo: Math.round(minElo), y: H - PAD_B },
  ]

  const lastElo = history[history.length - 1].elo
  const rank = getRankInfo(lastElo)

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block', background: 'var(--bg-mid)', borderRadius: 8, border: '1px solid var(--border)' }}
      >
        {/* Grid lines */}
        {yLabels.map(({ y }, i) => (
          <line key={i} x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
            stroke="rgba(255,255,255,0.05)" strokeWidth={1} strokeDasharray="4 4" />
        ))}

        {/* Y-axis labels */}
        {yLabels.map(({ elo, y }) => (
          <text key={elo} x={PAD_L - 4} y={y + 4} textAnchor="end"
            fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="monospace">
            {elo}
          </text>
        ))}

        {/* Gradient fill under line */}
        <defs>
          <linearGradient id="eloGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={rank.color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={rank.color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={`${pathD} L ${points[points.length-1].x} ${H-PAD_B} L ${points[0].x} ${H-PAD_B} Z`}
          fill="url(#eloGrad)" />

        {/* Main line */}
        <path d={pathD} fill="none" stroke={rank.color} strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3}
            fill={p.won ? '#4ade80' : '#f87171'}
            stroke="var(--bg-mid)" strokeWidth={1.5}
          />
        ))}

        {/* Current ELO label */}
        <text x={points[points.length-1].x} y={points[points.length-1].y - 8}
          textAnchor="middle" fill={rank.color} fontSize={11} fontWeight={700}>
          {lastElo}
        </text>
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
        <span><span style={{ color: '#4ade80', fontWeight: 700 }}>●</span> Победа</span>
        <span><span style={{ color: '#f87171', fontWeight: 700 }}>●</span> Поражение</span>
        <span style={{ marginLeft: 'auto', color: rank.color, fontWeight: 700 }}>{rank.icon} {rank.name}</span>
      </div>
    </div>
  )
}
