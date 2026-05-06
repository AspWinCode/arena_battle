import { Link } from 'react-router-dom'
import styles from './BracketView.module.css'

interface BracketMatch {
  id: string
  round: number
  position: number
  status: string
  p1: { id: string; playerName: string; seed: number | null } | null
  p2: { id: string; playerName: string; seed: number | null } | null
  winner: { id: string; playerName: string } | null
  session?: { id: string; code1: string; code2: string } | null
}

interface Props {
  matches: BracketMatch[]
  totalRounds: number
  /** Admin mode: show create-session buttons and codes */
  adminMode?: boolean
  tournamentId?: string
  adminToken?: string
  onSessionCreated?: (matchId: string, sessionId: string, code1: string, code2: string) => void
}

export default function BracketView({ matches, totalRounds, adminMode, tournamentId, adminToken, onSessionCreated }: Props) {
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
                <MatchCard
                  key={m.id}
                  match={m}
                  isFinal={r === totalRounds}
                  adminMode={adminMode}
                  tournamentId={tournamentId}
                  adminToken={adminToken}
                  onSessionCreated={onSessionCreated}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MatchCard({
  match, isFinal, adminMode, tournamentId, adminToken, onSessionCreated,
}: {
  match: BracketMatch
  isFinal: boolean
  adminMode?: boolean
  tournamentId?: string
  adminToken?: string
  onSessionCreated?: (matchId: string, sessionId: string, code1: string, code2: string) => void
}) {
  const p1Won = match.winner?.id === match.p1?.id
  const p2Won = match.winner?.id === match.p2?.id

  const handleCreateSession = async () => {
    if (!tournamentId || !adminToken) return
    try {
      const { api } = await import('../../api/client')
      const res = await api.post<{ sessionId: string; code1: string; code2: string }>(
        `/tournament/${tournamentId}/matches/${match.id}/session`,
        {},
        adminToken,
      )
      onSessionCreated?.(match.id, res.sessionId, res.code1, res.code2)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка создания сессии')
    }
  }

  return (
    <div className={`${styles.match} ${isFinal ? styles.matchFinal : ''}`}>
      <PlayerSlot player={match.p1} won={p1Won} lost={!!match.winner && !p1Won} status={match.status} />
      <div className={styles.matchDivider} />
      <PlayerSlot player={match.p2} won={p2Won} lost={!!match.winner && !p2Won} status={match.status} />

      {match.status === 'IN_PROGRESS' && (
        <div className={styles.liveTag}>⚔️ LIVE</div>
      )}

      {/* Session join links (public view) */}
      {match.session && !adminMode && (
        <div className={styles.sessionLinks}>
          <Link to={`/join?code=${match.session.code1}`} className={styles.joinBtn}>
            🎮 P1 Войти
          </Link>
          <Link to={`/join?code=${match.session.code2}`} className={styles.joinBtn}>
            🎮 P2 Войти
          </Link>
        </div>
      )}

      {/* Admin: session codes or create button */}
      {adminMode && !match.session && match.p1 && match.p2 && !match.winner && (
        <button className={styles.createSessionBtn} onClick={handleCreateSession}>
          ⚡ Создать сессию
        </button>
      )}
      {adminMode && match.session && (
        <div className={styles.sessionCodes}>
          <span>P1: <code>{match.session.code1}</code></span>
          <span>P2: <code>{match.session.code2}</code></span>
          <Link to={`/battle/${match.session.id}`} target="_blank" className={styles.watchBtn}>
            👁 Смотреть
          </Link>
        </div>
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
