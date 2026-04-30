import styles from './BracketView.module.css'

interface BracketMatch {
  id: string
  round: number
  position: number
  status: string
  p1: { id: string; playerName: string; seed: number | null } | null
  p2: { id: string; playerName: string; seed: number | null } | null
  winner: { id: string; playerName: string } | null
}

interface Props {
  matches: BracketMatch[]
  totalRounds: number
}

export default function BracketView({ matches, totalRounds }: Props) {
  // Group matches by round
  const byRound: Record<number, BracketMatch[]> = {}
  for (const m of matches) {
    if (!byRound[m.round]) byRound[m.round] = []
    byRound[m.round].push(m)
    byRound[m.round].sort((a, b) => a.position - b.position)
  }

  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1)

  const roundLabel = (r: number) => {
    if (r === totalRounds) return '🏆 Финал'
    if (r === totalRounds - 1) return 'Полуфинал'
    if (r === totalRounds - 2) return 'Четвертьфинал'
    return `Раунд ${r}`
  }

  return (
    <div className={styles.root}>
      <div className={styles.bracket}>
        {rounds.map(r => (
          <div key={r} className={styles.round}>
            <div className={styles.roundLabel}>{roundLabel(r)}</div>
            <div className={styles.matches} style={{ gap: `${Math.pow(2, r - 1) * 16}px` }}>
              {(byRound[r] ?? []).map(m => (
                <MatchCard key={m.id} match={m} isFinal={r === totalRounds} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MatchCard({ match, isFinal }: { match: BracketMatch; isFinal: boolean }) {
  const p1Won = match.winner?.id === match.p1?.id
  const p2Won = match.winner?.id === match.p2?.id

  return (
    <div className={`${styles.match} ${isFinal ? styles.matchFinal : ''}`}>
      <PlayerSlot
        player={match.p1}
        won={p1Won}
        lost={!!match.winner && !p1Won}
        status={match.status}
      />
      <div className={styles.matchDivider} />
      <PlayerSlot
        player={match.p2}
        won={p2Won}
        lost={!!match.winner && !p2Won}
        status={match.status}
      />
      {match.status === 'IN_PROGRESS' && (
        <div className={styles.liveTag}>⚔️ LIVE</div>
      )}
    </div>
  )
}

function PlayerSlot({
  player, won, lost, status,
}: {
  player: BracketMatch['p1']
  won: boolean
  lost: boolean
  status: string
}) {
  return (
    <div className={`${styles.slot} ${won ? styles.slotWon : ''} ${lost ? styles.slotLost : ''} ${!player ? styles.slotEmpty : ''}`}>
      {player ? (
        <>
          {player.seed != null && <span className={styles.seed}>#{player.seed}</span>}
          <span className={styles.playerName}>{player.playerName}</span>
          {won && <span className={styles.winBadge}>🏆</span>}
        </>
      ) : (
        <span className={styles.tbd}>
          {status === 'PENDING' ? 'TBD' : '—'}
        </span>
      )}
    </div>
  )
}
