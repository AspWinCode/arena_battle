import { CHARACTER_STATS } from '@robocode/shared'
import type { SkinId } from '@robocode/shared'
import styles from './CharacterCard.module.css'

interface Props {
  skinId: string
}

export default function CharacterCard({ skinId }: Props) {
  const ch = CHARACTER_STATS[skinId as SkinId] ?? CHARACTER_STATS.robot

  const hpPct  = Math.round((ch.maxHp  / 140) * 100)
  const atkPct = Math.round((ch.dmgMult / 1.5) * 100)

  // Суммарная «защита»: flatDmgReduction, shieldBonus, repairBonus дают очки
  const defScore =
    ch.flatDmgReduction * 12 +
    ch.shieldBonus      * 120 +
    ch.repairBonus      * 3 +
    ch.shieldHealAmount * 4 +
    ch.lifestealRate    * 60
  const defPct = Math.min(100, Math.round(defScore))

  return (
    <div className={styles.card} style={{ '--char-color': ch.color } as React.CSSProperties}>
      <div className={styles.header}>
        <span className={styles.icon}>{ch.icon}</span>
        <div className={styles.headerInfo}>
          <div className={styles.name}>{ch.name}</div>
          <div className={styles.tagline}>{ch.tagline}</div>
        </div>
      </div>

      <div className={styles.stats}>
        <StatRow label="HP"      value={ch.maxHp}  suffix={` / 140`} pct={hpPct}  color="#4ade80" />
        <StatRow label="Атака"   value={`×${ch.dmgMult.toFixed(2)}`} pct={atkPct} color="#f97316" />
        <StatRow label="Защита"  value={defPct > 0 ? `${defPct}%` : '—'} pct={defPct} color="#60a5fa" />
      </div>

      <div className={styles.passive}>{ch.passive}</div>

      <div className={styles.swGrid}>
        <div className={styles.swCol}>
          <div className={styles.swTitle}>💪 Сильные стороны</div>
          {ch.strengths.map(s => (
            <div key={s} className={styles.swItem}>
              <span className={styles.swDot} style={{ color: '#4ade80' }}>▸</span>{s}
            </div>
          ))}
        </div>
        <div className={styles.swCol}>
          <div className={styles.swTitle}>⚠️ Слабые стороны</div>
          {ch.weaknesses.map(w => (
            <div key={w} className={styles.swItem}>
              <span className={styles.swDot} style={{ color: '#f87171' }}>▸</span>{w}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatRow({
  label,
  value,
  pct,
  color,
  suffix,
}: {
  label: string
  value: string | number
  pct: number
  color: string
  suffix?: string
}) {
  return (
    <div className={styles.statRow}>
      <span className={styles.statLabel}>{label}</span>
      <div className={styles.statTrack}>
        <div className={styles.statFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={styles.statVal}>{value}{suffix ?? ''}</span>
    </div>
  )
}
