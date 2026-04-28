import { useBattleStore } from '../../stores/battleStore'
import styles from './ResultScreen.module.css'

const SKIN_ICONS: Record<string, string> = {
  robot: '🤖', gladiator: '⚔️', boxer: '🥊', cosmonaut: '🚀',
}

export default function ResultScreen({ onPlayAgain }: { onPlayAgain: () => void }) {
  const p1             = useBattleStore(s => s.p1)
  const p2             = useBattleStore(s => s.p2)
  const matchWinner    = useBattleStore(s => s.matchWinner)
  const score          = useBattleStore(s => s.score)
  const completedRounds = useBattleStore(s => s.completedRounds)
  const slot           = useBattleStore(s => s.slot)

  const isWinner     = matchWinner !== null && matchWinner !== 0 && matchWinner === slot
  const isDraw       = matchWinner === 0
  // Show winner card only when there's a real winner (not draw, not null)
  const winnerPlayer = matchWinner === 1 ? p1 : matchWinner === 2 ? p2 : null

  return (
    <div className={styles.root}>
      <div className={styles.bg} />

      <div className={styles.container}>
        {/* Result header */}
        <div className={`${styles.resultBadge} ${isWinner ? styles.win : isDraw ? styles.draw : styles.loss}`}>
          {isDraw ? '🤝 НИЧЬЯ' : isWinner ? '🏆 ПОБЕДА!' : '💀 ПОРАЖЕНИЕ'}
        </div>

        {!isDraw && winnerPlayer && (
          <div className={styles.winner}>
            <div className={styles.winnerIcon}>{SKIN_ICONS[winnerPlayer.skin ?? 'robot']}</div>
            <div className={styles.winnerName}>{winnerPlayer.name}</div>
            <div className={styles.winnerLabel}>победил в матче</div>
          </div>
        )}

        {/* Score */}
        <div className={styles.scoreRow}>
          <div className={styles.scorePlayer}>
            <span>{SKIN_ICONS[p1?.skin ?? 'robot']}</span>
            <span>{p1?.name ?? 'P1'}</span>
          </div>
          <div className={styles.scoreBig}>
            <span className={matchWinner === 1 ? styles.scoreWin : ''}>{score[0]}</span>
            <span className={styles.scoreDash}>–</span>
            <span className={matchWinner === 2 ? styles.scoreWin : ''}>{score[1]}</span>
          </div>
          <div className={`${styles.scorePlayer} ${styles.scoreRight}`}>
            <span>{p2?.name ?? 'P2'}</span>
            <span>{SKIN_ICONS[p2?.skin ?? 'robot']}</span>
          </div>
        </div>

        {/* Rounds breakdown */}
        <div className={styles.rounds}>
          <div className={styles.roundsTitle}>Раунды</div>
          <div className={styles.roundsList}>
            {completedRounds.map(r => (
              <div key={r.round} className={styles.roundRow}>
                <span className={styles.roundLabel}>Раунд {r.round}</span>
                <div className={styles.roundBars}>
                  <div
                    className={`${styles.roundBar} ${r.winner === 1 ? styles.roundBarWin : ''}`}
                    style={{ width: `${(r.p1Hp / 100) * 100}%` }}
                  />
                </div>
                <span className={`${styles.roundHp} ${r.winner === 1 ? styles.roundWinLabel : ''}`}>
                  {r.p1Hp} HP
                </span>
                <span className={styles.roundVs}>vs</span>
                <span className={`${styles.roundHp} ${r.winner === 2 ? styles.roundWinLabel : ''}`}>
                  {r.p2Hp} HP
                </span>
                <div className={styles.roundBars}>
                  <div
                    className={`${styles.roundBar} ${styles.roundBarRight} ${r.winner === 2 ? styles.roundBarWin : ''}`}
                    style={{ width: `${(r.p2Hp / 100) * 100}%` }}
                  />
                </div>
                <span className={styles.roundWinner}>
                  {r.winner === 0 ? '🤝' : r.winner === 1 ? `🏆 ${p1?.name}` : `🏆 ${p2?.name}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{completedRounds.reduce((a, r) => a + r.turns.length, 0)}</span>
            <span className={styles.statLabel}>Ходов сыграно</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {completedRounds.reduce((a, r) => a + r.turns.reduce((b, t) => b + t.p1DmgTaken + t.p2DmgTaken, 0), 0)}
            </span>
            <span className={styles.statLabel}>Урона нанесено</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{completedRounds.length}</span>
            <span className={styles.statLabel}>Раундов</span>
          </div>
        </div>

        <button className={`btn btn-primary ${styles.btn}`} onClick={onPlayAgain}>
          ⚔️ Сыграть снова
        </button>
      </div>
    </div>
  )
}
