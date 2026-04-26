import { useBattleStore } from '../../stores/battleStore'
import ArenaComponent from '../Arena/ArenaComponent'
import styles from './BattleScreen.module.css'

const SKIN_ICONS: Record<string, string> = {
  robot: '🤖', gladiator: '⚔️', boxer: '🥊', cosmonaut: '🚀',
}

const ACTION_LABELS: Record<string, string> = {
  attack: '👊 Удар',
  laser:  '⚡ Лазер',
  shield: '🛡 Щит',
  dodge:  '💨 Уклон',
  combo:  '💥 Комбо',
  repair: '💚 Ремонт',
}

export default function BattleScreen() {
  const phase      = useBattleStore(s => s.phase)
  const p1         = useBattleStore(s => s.p1)
  const p2         = useBattleStore(s => s.p2)
  const p1Hp       = useBattleStore(s => s.p1Hp)
  const p2Hp       = useBattleStore(s => s.p2Hp)
  const p1MaxHp    = useBattleStore(s => s.p1MaxHp)
  const p2MaxHp    = useBattleStore(s => s.p2MaxHp)
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
