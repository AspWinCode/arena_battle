import { Link } from 'react-router-dom'
import styles from './BracketView.module.css'

interface BracketMatch {
  id: string
  round: number
  position: number
  status: string
  bracket?: string   // 'W' | 'L' | 'GF'
  p1: { id: string; playerName: string; seed: number | null } | null
  p2: { id: string; playerName: string; seed: number | null } | null
  winner: { id: string; playerName: string } | null
  session?: { id: string; code1: string; code2: string; status?: string } | null
}

interface Props {
  matches: BracketMatch[]
  totalRounds: number
  bracketType?: string   // 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN'
  /** Admin mode: show create-session buttons and codes */
  adminMode?: boolean
  tournamentId?: string
  adminToken?: string
  onSessionCreated?: (matchId: string, sessionId: string, code1: string, code2: string) => void
}

export default function BracketView({ matches, totalRounds, bracketType = 'SINGLE_ELIMINATION', adminMode, tournamentId, adminToken, onSessionCreated }: Props) {

  // ── Round-robin: standings table ─────────────────────────────────────────────
  if (bracketType === 'ROUND_ROBIN') {
    return <RoundRobinView matches={matches} adminMode={adminMode} tournamentId={tournamentId} adminToken={adminToken} onSessionCreated={onSessionCreated} />
  }

  // ── Double elimination: split into W / L / GF sections ──────────────────────
  if (bracketType === 'DOUBLE_ELIMINATION') {
    const wMatches = matches.filter(m => m.bracket === 'W' || !m.bracket)
    const lMatches = matches.filter(m => m.bracket === 'L')
    const gfMatches = matches.filter(m => m.bracket === 'GF')
    const wRounds = wMatches.length > 0 ? Math.max(...wMatches.map(m => m.round)) : 0
    const lRounds = lMatches.length > 0 ? Math.max(...lMatches.map(m => m.round)) : 0

    const props = { adminMode, tournamentId, adminToken, onSessionCreated }
    return (
      <div className={styles.root}>
        {wRounds > 0 && (
          <>
            <div className={styles.sectionLabel}>🏆 Сетка победителей</div>
            <BracketSection matches={wMatches} totalRounds={wRounds} {...props} />
          </>
        )}
        {lRounds > 0 && (
          <>
            <div className={styles.sectionLabel} style={{ color: '#f87171', marginTop: 32 }}>💀 Сетка проигравших</div>
            <BracketSection matches={lMatches} totalRounds={lRounds} {...props} />
          </>
        )}
        {gfMatches.length > 0 && (
          <>
            <div className={styles.sectionLabel} style={{ color: '#facc15', marginTop: 32 }}>⚡ Гранд-финал</div>
            <div className={styles.bracket} style={{ justifyContent: 'center' }}>
              <div className={styles.round}>
                <div className={styles.matches}>
                  {gfMatches.map(m => (
                    <MatchCard key={m.id} match={m} isFinal {...props} />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Single elimination (default) ─────────────────────────────────────────────
  return (
    <div className={styles.root}>
      <BracketSection matches={matches} totalRounds={totalRounds} adminMode={adminMode} tournamentId={tournamentId} adminToken={adminToken} onSessionCreated={onSessionCreated} />
    </div>
  )
}

// ── Single-bracket section (reused in both modes) ────────────────────────────

function BracketSection({ matches, totalRounds, adminMode, tournamentId, adminToken, onSessionCreated }: {
  matches: BracketMatch[]
  totalRounds: number
  adminMode?: boolean
  tournamentId?: string
  adminToken?: string
  onSessionCreated?: Props['onSessionCreated']
}) {
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
  )
}

// ── Round-robin standings ─────────────────────────────────────────────────────

function RoundRobinView({ matches, adminMode, tournamentId, adminToken, onSessionCreated }: {
  matches: BracketMatch[]
  adminMode?: boolean
  tournamentId?: string
  adminToken?: string
  onSessionCreated?: Props['onSessionCreated']
}) {
  // Build player win map
  const playerNames = new Map<string, string>()
  const wins = new Map<string, number>()
  const losses = new Map<string, number>()

  for (const m of matches) {
    if (m.p1) { playerNames.set(m.p1.id, m.p1.playerName); if (!wins.has(m.p1.id)) { wins.set(m.p1.id, 0); losses.set(m.p1.id, 0) } }
    if (m.p2) { playerNames.set(m.p2.id, m.p2.playerName); if (!wins.has(m.p2.id)) { wins.set(m.p2.id, 0); losses.set(m.p2.id, 0) } }
    if (m.winner) {
      wins.set(m.winner.id, (wins.get(m.winner.id) ?? 0) + 1)
      const loserId = m.p1?.id === m.winner.id ? m.p2?.id : m.p1?.id
      if (loserId) losses.set(loserId, (losses.get(loserId) ?? 0) + 1)
    }
  }

  const standings = [...playerNames.entries()]
    .map(([id, name]) => ({ id, name, w: wins.get(id) ?? 0, l: losses.get(id) ?? 0 }))
    .sort((a, b) => b.w - a.w || a.l - b.l)

  return (
    <div className={styles.root}>
      {standings.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className={styles.sectionLabel}>📊 Таблица очков</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px' }}>#</th>
                <th style={{ padding: '8px 12px' }}>Игрок</th>
                <th style={{ padding: '8px 12px', textAlign: 'center' }}>В</th>
                <th style={{ padding: '8px 12px', textAlign: 'center' }}>П</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{i + 1}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s.name}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', color: '#4ade80', fontWeight: 700 }}>{s.w}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', color: '#f87171' }}>{s.l}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.sectionLabel}>🗂 Матчи</div>
      <div className={styles.bracket} style={{ flexWrap: 'wrap' }}>
        {matches.map(m => (
          <MatchCard key={m.id} match={m} isFinal={false} adminMode={adminMode} tournamentId={tournamentId} adminToken={adminToken} onSessionCreated={onSessionCreated} />
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
  const isLive = match.session && (match.session.status === 'CODING' || match.session.status === 'BATTLE')

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

      {isLive && <div className={styles.liveTag}>⚔️ LIVE</div>}

      {/* Session join links + spectate (public view) */}
      {match.session && !adminMode && (
        <div className={styles.sessionLinks}>
          {!match.winner && (
            <>
              <Link to={`/join?code=${match.session.code1}`} className={styles.joinBtn}>🎮 P1</Link>
              <Link to={`/join?code=${match.session.code2}`} className={styles.joinBtn}>🎮 P2</Link>
            </>
          )}
          {isLive && (
            <Link to={`/spectate/${match.session.id}`} className={styles.watchBtn}>👁 Смотреть</Link>
          )}
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
          <Link to={`/spectate/${match.session.id}`} target="_blank" className={styles.watchBtn}>
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
