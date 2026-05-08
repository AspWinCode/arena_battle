import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

interface LobbyPlayer { name: string; skin: string; ready: boolean; lang?: string }
interface TurnResult {
  turn: number
  action1: string; action2: string
  hp1: number;    hp2: number
  event?: string
}

interface BattleState {
  phase: 'connecting' | 'lobby' | 'coding' | 'compiling' | 'battle' | 'done' | 'error'
  p1: LobbyPlayer | null
  p2: LobbyPlayer | null
  score: [number, number]
  round: number
  turns: TurnResult[]
  winner: 0 | 1 | 2
  timer: number
  errorMsg: string
}

const WS_BASE = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001').replace(/\/$/, '')

const SKIN_EMOJI: Record<string, string> = {
  robot: '🤖', gladiator: '⚔️', boxer: '🥊', cosmonaut: '🚀',
  ninja: '🥷', mage: '🧙', paladin: '🛡️', sniper: '🎯',
  tank: '🛡', vampire: '🧛', samurai: '🗡️', phantom: '👻',
  engineer: '🔧', berserker: '💢',
}

export default function SpectatorPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const wsRef = useRef<WebSocket | null>(null)
  const [state, setState] = useState<BattleState>({
    phase: 'connecting', p1: null, p2: null, score: [0, 0],
    round: 0, turns: [], winner: 0, timer: 0, errorMsg: '',
  })

  useEffect(() => {
    if (!sessionId) return
    const url = `${WS_BASE}/ws/spectate/${sessionId}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setState(s => ({ ...s, phase: 'lobby' }))

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        setState(prev => handleMessage(prev, msg))
      } catch { /* ignore */ }
    }

    ws.onerror = () => setState(s => ({ ...s, phase: 'error', errorMsg: 'Ошибка подключения к матчу' }))
    ws.onclose = (e) => {
      if (e.code === 4004) setState(s => ({ ...s, phase: 'error', errorMsg: 'Матч не найден' }))
      else if (e.code === 4010) setState(s => ({ ...s, phase: 'error', errorMsg: 'Матч уже завершён' }))
    }

    return () => { ws.close() }
  }, [sessionId])

  const { phase, p1, p2, score, round, turns, winner, timer, errorMsg } = state

  // ── Error / connecting ─────────────────────────────────────────────────────
  if (phase === 'error') return (
    <div style={CENTER}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📡</div>
      <p style={{ color: '#f87171', marginBottom: 20 }}>{errorMsg || 'Не удалось подключиться'}</p>
      <Link to="/tournaments" className="btn btn-ghost">← Турниры</Link>
    </div>
  )

  if (phase === 'connecting') return (
    <div style={CENTER}>
      <div style={{ fontSize: 48, animation: 'spin 1.5s linear infinite', marginBottom: 12 }}>⚙️</div>
      <p style={{ color: 'var(--text-muted)' }}>Подключаемся к матчу...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ maxWidth: 860, margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/tournaments" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13 }}>← Турниры</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {(phase === 'coding' || phase === 'compiling' || phase === 'battle') && (
            <span style={{ fontSize: 12, background: '#f97316', color: '#000', fontWeight: 800, padding: '3px 10px', borderRadius: 99, letterSpacing: '.06em' }}>
              ⚔️ LIVE
            </span>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Режим зрителя</span>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* Scoreboard */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'center', marginBottom: 28 }}>
          <PlayerCard player={p1} side="left" won={winner === 1} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              {phase === 'lobby'     ? 'Ожидание игроков' :
               phase === 'coding'   ? `⏱ ${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, '0')} Раунд ${round}` :
               phase === 'compiling'? '⚙️ Компилируем...' :
               phase === 'battle'   ? `⚔️ Раунд ${round}` :
               phase === 'done'     ? '🏁 Матч завершён' : ''}
            </div>
            <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: '.05em', color: 'var(--lightning)' }}>
              {score[0]} <span style={{ color: 'var(--text-muted)', fontSize: 24 }}>:</span> {score[1]}
            </div>
          </div>
          <PlayerCard player={p2} side="right" won={winner === 2} />
        </div>

        {/* Battle log */}
        {turns.length > 0 && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px', maxHeight: 340, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 12 }}>
              Ход матча
            </div>
            {turns.map((t, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < turns.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)', minWidth: 36, fontSize: 11 }}>#{t.turn}</span>
                <span style={{ flex: 1, color: '#60a5fa' }}>{t.action1}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '0 12px' }}>vs</span>
                <span style={{ flex: 1, textAlign: 'right', color: '#f472b6' }}>{t.action2}</span>
                <span style={{ minWidth: 100, textAlign: 'right', fontSize: 11, color: 'var(--text-muted)' }}>
                  ❤️ {t.hp1} / {t.hp2}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Done banner */}
        {phase === 'done' && winner !== 0 && (
          <div style={{ marginTop: 24, textAlign: 'center', padding: '28px 20px', background: 'var(--bg-card)', border: '1px solid rgba(250,204,21,.3)', borderRadius: 16 }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>🏆</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>
              Победа {winner === 1 ? p1?.name : p2?.name}!
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              Счёт: {score[0]} : {score[1]}
            </div>
          </div>
        )}

        {/* Lobby waiting */}
        {phase === 'lobby' && (!p1 || !p2) && (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
            <p>Ожидаем подключения игроков...</p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Player card ────────────────────────────────────────────────────────────────

function PlayerCard({ player, side, won }: { player: LobbyPlayer | null; side: 'left' | 'right'; won: boolean }) {
  return (
    <div style={{
      background: won ? 'rgba(250,204,21,.08)' : 'var(--bg-card)',
      border: `1px solid ${won ? 'rgba(250,204,21,.35)' : 'var(--border)'}`,
      borderRadius: 14,
      padding: '16px 20px',
      textAlign: side === 'right' ? 'right' : 'left',
      transition: 'all .3s',
    }}>
      {player ? (
        <>
          <div style={{ fontSize: 36, marginBottom: 6 }}>{SKIN_EMOJI[player.skin] ?? '🤖'}</div>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>{player.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{player.lang?.toUpperCase() ?? '—'}</div>
          {won && <div style={{ fontSize: 13, color: '#facc15', fontWeight: 700, marginTop: 4 }}>🏆 Победитель!</div>}
        </>
      ) : (
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Ожидание игрока...</div>
      )}
    </div>
  )
}

// ── Message handler ────────────────────────────────────────────────────────────

function handleMessage(prev: BattleState, msg: { type: string; payload: any }): BattleState {
  switch (msg.type) {
    case 'lobby_update':
      return { ...prev, phase: prev.phase === 'connecting' ? 'lobby' : prev.phase, p1: msg.payload.p1, p2: msg.payload.p2 }

    case 'coding_start':
      return { ...prev, phase: 'coding', round: msg.payload.round ?? prev.round, timer: msg.payload.timeLimit ?? 600, turns: [], score: msg.payload.score ?? prev.score }

    case 'timer_tick':
      return { ...prev, timer: msg.payload.remaining }

    case 'compile_status':
      return msg.payload.status === 'done' ? prev : { ...prev, phase: 'compiling' }

    case 'battle_start':
      return { ...prev, phase: 'battle', round: msg.payload.round, turns: [] }

    case 'turn_result':
      return { ...prev, turns: [...prev.turns, msg.payload] }

    case 'round_end':
      return { ...prev, score: msg.payload.winner === 1 ? [prev.score[0] + 1, prev.score[1]] : msg.payload.winner === 2 ? [prev.score[0], prev.score[1] + 1] : prev.score }

    case 'match_end':
      return { ...prev, phase: 'done', winner: msg.payload.winner, score: msg.payload.score ?? prev.score }

    case 'error':
      return { ...prev, phase: 'error', errorMsg: msg.payload.message }

    default:
      return prev
  }
}

const CENTER: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg)', textAlign: 'center',
}
