import React from 'react'

export interface RankInfo {
  name: string
  color: string
  icon: string
}

export function getRankInfo(elo: number): RankInfo {
  if (elo < 1000) return { name: 'Новичок',  color: '#888888', icon: '🌱' }
  if (elo < 1200) return { name: 'Боец',     color: '#00e676', icon: '⚔️' }
  if (elo < 1400) return { name: 'Ветеран',  color: '#ffe566', icon: '🛡️' }
  if (elo < 1600) return { name: 'Элита',    color: '#ff8c00', icon: '🔥' }
  return              { name: 'Легенда',  color: '#ff3d3d', icon: '👑' }
}

interface Props {
  elo: number
  showElo?: boolean
  size?: 'sm' | 'md' | 'lg'
  style?: React.CSSProperties
}

export default function RankBadge({ elo, showElo = true, size = 'md', style }: Props) {
  const rank = getRankInfo(elo)
  const fontSize = size === 'sm' ? 10 : size === 'lg' ? 14 : 12
  const padding  = size === 'sm' ? '2px 7px' : size === 'lg' ? '5px 14px' : '3px 10px'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding,
        borderRadius: 99,
        fontSize,
        fontWeight: 700,
        background: `${rank.color}18`,
        border: `1px solid ${rank.color}44`,
        color: rank.color,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span>{rank.icon}</span>
      <span>{rank.name}</span>
      {showElo && <span style={{ opacity: 0.75 }}>{elo}</span>}
    </span>
  )
}
