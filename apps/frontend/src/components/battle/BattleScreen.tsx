import { useBattleStore } from '../../stores/battleStore'
import { MAX_HP, MAX_STAMINA, MAX_RAGE } from '@robocode/shared'
import ArenaComponent from '../Arena/ArenaComponent'
import styles from './BattleScreen.module.css'

const SKIN_ICONS: Record<string, string> = {
  robot: '🤖', gladiator: '⚔️', boxer: '🥊', cosmonaut: '🚀',
}

const ACTION_LABELS: Record<string, string> = {
  attack:  '👊 Удар',
  heavy:   '💥 Тяжёлый',
  laser:   '⚡ Лазер',
  shield:  '🛡 Щит',
  dodge:   '💨 Уклон',
  repair:  '💚 Ремонт',
  special: '☄️ СПЕШЛ',
}

export default function BattleScreen() {
  const phase      = useBattleStore(s => s.phase)
  const p1         = useBattleStore(s => s.p1)
  const p2         = useBattleStore(s => s.p2)
  const p1Hp       = useBattleStore(s => s.p1Hp)
  const p2Hp       = useBattleStore(s => s.p2Hp)
  const p1MaxHp    = useBattleStore(s => s.p1MaxHp)
  const p2MaxHp    = useBattleStore(s => s.p2MaxHp)
  const p1Stamina  = useBattleStore(s => s.p1Stamina)
  const p2Stamina  = useBattleStore(s => s.p2Stamina)
  const p1Rage     = useBattleStore(s => s.p1Rage)
  const p2Rage     = useBattleStore(s => s.p2Rage)
  const round      = useBattleStore(s => s.currentRound)
  const turns      = useBattleStore(s => s.turns)
  const latestTurn = useBattleStore(s => s.latestTurn)
  const score      = useBattleStore(s => s.score)
  const slot       = useBattleStore(s => s.slot)

  const isCompiling = phase === 'compiling'

  const p1Skin = (p1?.skin ?? 'robot') as any
  const p2Skin = (p2?.skin ?? 'robot') as any

  return (
    <div className={styles.root}>
      {/* Compiling overlay */}
      {isCompiling && (
        <div className={styles.compilingOverlay}>
          <div className={styles.compilingBox}>
            <div className={styles.compilingSpinner}>⚙️</div>
            <div className={styles.compilingTitle}>Компиляция кода...</div>
            <div className={styles.compilingSubtitle}>Запускаем Sandbox, анализируем стратегию</div>
          </div>
        </div>
      )}

      {/* Score bar */}
      <div className={styles.scorebar}>
        <div className={styles.scorePlayer}>
          <span>{SKIN_ICONS[p1?.skin ?? 'robot']}</span>
          <span>{p1?.name ?? 'P1'}</span>
          {slot === 1 && <span className={styles.youBadge}>ты</span>}
        </div>
        <div className={styles.scoreCenter}>
          <span className={styles.scoreNum}>{score[0]}</span>
          <span className={styles.scoreSep}>–</span>
          <span className={styles.scoreNum}>{score[1]}</span>
        </div>
        <div className={`${styles.scorePlayer} ${styles.scorePlayerRight}`}>
          {slot === 2 && <span className={styles.youBadge}>ты</span>}
          <span>{p2?.name ?? 'P2'}</span>
          <span>{SKIN_ICONS[p2?.skin ?? 'robot']}</span>
        </div>
      </div>

      {/* Stats bars */}
      <div className={styles.statsBar}>
        {/* P1 stats */}
        <div className={styles.playerStats}>
          <StatRow
            label={`${p1Hp} HP`}
            pct={(p1Hp / (p1MaxHp || MAX_HP)) * 100}
            color={p1Hp / (p1MaxHp || MAX_HP) > 0.5 ? '#4ade80' : p1Hp / (p1MaxHp || MAX_HP) > 0.25 ? '#facc15' : '#f87171'}
          />
          <StatRow
            label={`${p1Stamina} STA`}
            pct={(p1Stamina / MAX_STAMINA) * 100}
            color="#60a5fa"
          />
          <RageRow value={p1Rage} max={MAX_RAGE} />
        </div>

        <div className={styles.statsDivider} />

        {/* P2 stats (mirrored) */}
        <div className={styles.playerStats} style={{ alignItems: 'flex-end' }}>
          <StatRow
            label={`${p2Hp} HP`}
            pct={(p2Hp / (p2MaxHp || MAX_HP)) * 100}
            color={p2Hp / (p2MaxHp || MAX_HP) > 0.5 ? '#4ade80' : p2Hp / (p2MaxHp || MAX_HP) > 0.25 ? '#facc15' : '#f87171'}
            flip
          />
          <StatRow
            label={`${p2Stamina} STA`}
            pct={(p2Stamina / MAX_STAMINA) * 100}
            color="#60a5fa"
            flip
          />
          <RageRow value={p2Rage} max={MAX_RAGE} flip />
        </div>
      </div>

      {/* Arena */}
      <div className={styles.arenaWrap}>
        <ArenaComponent
          p1Skin={p1Skin}
          p2Skin={p2Skin}
          p1Name={p1?.name ?? 'P1'}
          p2Name={p2?.name ?? 'P2'}
          p1Hp={p1Hp}
          p2Hp={p2Hp}
          p1MaxHp={p1MaxHp}
          p2MaxHp={p2MaxHp}
          latestTurn={latestTurn}
          round={round}
        />
      </div>

      {/* Turn log */}
      <div className={styles.log}>
        <div className={styles.logTitle}>📋 Лог боя</div>
        <div className={styles.logList}>
          {[...turns].reverse().slice(0, 8).map((t, i) => (
            <div key={t.turn} className={`${styles.logRow} ${i === 0 ? styles.logRowLatest : ''}`}>
              <span className={styles.logTurn}>Ход {t.turn}</span>
              <span className={styles.logAction}>{ACTION_LABELS[t.p1Action] ?? t.p1Action}</span>
              <span className={styles.logVs}>vs</span>
              <span className={styles.logAction}>{ACTION_LABELS[t.p2Action] ?? t.p2Action}</span>
              <span className={styles.logResult}>{t.log}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatRow({ label, pct, color, flip }: { label: string; pct: number; color: string; flip?: boolean }) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div className={styles.statRow} style={{ flexDirection: flip ? 'row-reverse' : 'row' }}>
      <span className={styles.statLabel}>{label}</span>
      <div className={styles.statTrack}>
        <div
          className={styles.statFill}
          style={{ width: `${clamped}%`, background: color, marginLeft: flip ? 'auto' : undefined }}
        />
      </div>
    </div>
  )
}

function RageRow({ value, max, flip }: { value: number; max: number; flip?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const ready = pct >= 100
  return (
    <div className={styles.statRow} style={{ flexDirection: flip ? 'row-reverse' : 'row' }}>
      <span className={styles.statLabel} style={{ color: ready ? '#f97316' : undefined }}>
        {ready ? '☄️ RAGE!' : `${Math.round(value)} RAGE`}
      </span>
      <div className={styles.statTrack}>
        <div
          className={styles.statFill}
          style={{
            width: `${pct}%`,
            background: ready ? '#f97316' : '#a855f7',
            marginLeft: flip ? 'auto' : undefined,
            boxShadow: ready ? '0 0 8px #f97316' : undefined,
          }}
        />
      </div>
    </div>
  )
}
