import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { ServerMessage, TurnResult } from '@robocode/shared'
import { api } from '../../api/client'
import { useAdminStore } from '../../stores/adminStore'
import styles from './AdminSessionDetail.module.css'

const WS_BASE = import.meta.env.VITE_WS_URL
  ?? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`

interface LiveState {
  connected: boolean
  compileStatus: 'idle' | 'compiling' | 'done'
  p1Done: boolean
  p2Done: boolean
  p1Hp: number
  p2Hp: number
  phase: 'lobby' | 'coding' | 'compiling' | 'battle' | 'done'
  recentTurns: TurnResult[]
  currentRound: number
}

interface SessionDetail {
  id: string
  name: string
  level: string
  lang: string
  format: string
  status: string
  code1: string
  code2: string
  timeLimit: number
  createdAt: string
  players: Array<{
    id: string
    slot: number
    name: string
    skin: string
    lang: string
    code: string | null
    strategy: unknown
  }>
  battles: Array<{
    id: string
    round: number
    winner: number
    hp1Final: number
    hp2Final: number
    log: unknown[]
  }>
}

const SKIN_ICONS: Record<string, string> = {
  robot: '🤖', gladiator: '⚔️', boxer: '🥊', cosmonaut: '🚀',
}

const STATUS_MAP: Record<string, { label: string; css: string }> = {
  WAITING: { label: 'Ожидание', css: 'badge-waiting' },
  CODING:  { label: 'Написание кода', css: 'badge-coding' },
  BATTLE:  { label: 'Идёт бой!', css: 'badge-battle' },
  DONE:    { label: 'Завершено', css: 'badge-done' },
}

export default function AdminSessionDetail() {
  const { id } = useParams<{ id: string }>()
  const token  = useAdminStore(s => s.accessToken)

  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [live, setLive]       = useState<LiveState>({
    connected: false, compileStatus: 'idle', p1Done: false, p2Done: false,
    p1Hp: 100, p2Hp: 100, phase: 'lobby', recentTurns: [], currentRound: 1,
  })
  const sessionRef  = useRef<SessionDetail | null>(null)
  const wsRef       = useRef<WebSocket | null>(null)
  sessionRef.current = session

  const load = useCallback(async () => {
    try {
      const data = await api.get<SessionDetail>(`/session/${id}`, token ?? undefined)
      setSession(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [id, token])

  useEffect(() => {
    load()
  }, [load])

  // ── WS observer for real-time monitoring ──────────────────────────────────
  useEffect(() => {
    if (!id || !token) return

    const url = `${WS_BASE}/ws/observe/${id}?token=${encodeURIComponent(token)}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setLive(l => ({ ...l, connected: true }))
    ws.onclose = () => setLive(l => ({ ...l, connected: false }))
    ws.onerror = () => setLive(l => ({ ...l, connected: false }))

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as ServerMessage
        setLive(l => {
          switch (msg.type) {
            case 'lobby_update':
              return { ...l, phase: 'lobby' }
            case 'coding_start':
              return { ...l, phase: 'coding' }
            case 'compile_status':
              if (msg.payload.status === 'compiling') {
                return {
                  ...l,
                  phase: 'compiling',
                  compileStatus: 'compiling',
                  p1Done: msg.payload.p1Done ?? l.p1Done,
                  p2Done: msg.payload.p2Done ?? l.p2Done,
                }
              }
              return { ...l, compileStatus: 'done', p1Done: true, p2Done: true }
            case 'battle_start':
              return {
                ...l,
                phase: 'battle',
                currentRound: msg.payload.round,
                p1Hp: msg.payload.p1.hp,
                p2Hp: msg.payload.p2.hp,
                recentTurns: [],
              }
            case 'turn_result':
              return {
                ...l,
                p1Hp: msg.payload.p1HpAfter,
                p2Hp: msg.payload.p2HpAfter,
                recentTurns: [msg.payload, ...l.recentTurns].slice(0, 5),
              }
            case 'match_end':
              return { ...l, phase: 'done' }
            default:
              return l
          }
        })
        // Reload session data on match end
        if (msg.type === 'match_end') {
          setTimeout(load, 1000)
        }
      } catch { /* ignore */ }
    }

    return () => { ws.close() }
  }, [id, token, load])

  // Fallback polling while battle is active (reduces REST load vs 5s)
  useEffect(() => {
    const interval = setInterval(() => {
      const s = sessionRef.current
      if (s && ['WAITING', 'CODING'].includes(s.status)) load()
    }, 8000)
    return () => clearInterval(interval)
  }, [load])

  const handleExport = async () => {
    try {
      const res = await fetch(`/api/v1/session/${id}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `battle-${id}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Ошибка экспорта')
    }
  }

  if (loading) return <div className={styles.loading}>⏳ Загрузка...</div>
  if (error)   return <div className={styles.error}>{error}</div>
  if (!session) return null

  const st = STATUS_MAP[session.status] ?? { label: session.status, css: 'badge-waiting' }
  const p1 = session.players.find(p => p.slot === 1)
  const p2 = session.players.find(p => p.slot === 2)

  const wins = [0, 0]
  for (const b of session.battles) {
    if (b.winner === 1) wins[0]++
    else if (b.winner === 2) wins[1]++
  }

  return (
    <div className={styles.root}>
      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <Link to="/admin" className={styles.back}>← Дашборд</Link>
          <div className={styles.headerRow}>
            <div>
              <h1 className={styles.title}>{session.name}</h1>
              <div className={styles.meta}>
                <span className={`badge ${st.css}`}>{st.label}</span>
                <span className={styles.metaItem}>
                  {session.level === 'BLOCKS' ? '🧩' : session.level === 'CODE' ? '💻' : '⚡'}
                  {session.level}
                </span>
                <span className={styles.metaItem}>{session.format.toUpperCase()}</span>
                <span className={styles.metaItem}>⏱ {session.timeLimit} мин</span>
              </div>
            </div>
            <div className={styles.headerActions}>
              <button className="btn btn-ghost" onClick={load} style={{ fontSize: 13 }}>🔄</button>
              <button className="btn btn-ghost" onClick={handleExport} style={{ fontSize: 13 }}>📥 CSV</button>
            </div>
          </div>
        </div>

        {/* Codes */}
        <div className={styles.codesRow}>
          <CodeBox label="Код игрока 1" code={session.code1} />
          <CodeBox label="Код игрока 2" code={session.code2} />
        </div>

        {/* Players */}
        <div className={styles.playersGrid}>
          <PlayerCard player={p1} slot={1} wins={wins[0]} />
          <div className={styles.vsDiv}>
            <div className={styles.score}>
              <span className={wins[0] > wins[1] ? styles.scoreWin : ''}>{wins[0]}</span>
              <span className={styles.scoreSep}>–</span>
              <span className={wins[1] > wins[0] ? styles.scoreWin : ''}>{wins[1]}</span>
            </div>
          </div>
          <PlayerCard player={p2} slot={2} wins={wins[1]} />
        </div>

        {/* Live monitoring panel */}
        <div className={styles.section}>
          <div className={styles.liveHeader}>
            <h3 className={styles.sectionTitle} style={{ margin: 0 }}>📡 Live-мониторинг</h3>
            <span className={live.connected ? styles.liveOn : styles.liveOff}>
              {live.connected ? '🟢 подключено' : '⚫ нет соединения'}
            </span>
          </div>

          {/* Phase badge */}
          <div className={styles.livePhaseRow}>
            <span className={styles.livePhaseLabel}>Фаза:</span>
            <span className={`badge ${
              live.phase === 'battle'    ? 'badge-battle' :
              live.phase === 'coding'   ? 'badge-coding' :
              live.phase === 'compiling'? 'badge-coding' :
              live.phase === 'done'     ? 'badge-done'   : 'badge-waiting'
            }`}>
              {live.phase === 'lobby'     ? 'Лобби' :
               live.phase === 'coding'   ? 'Написание кода' :
               live.phase === 'compiling'? 'Компиляция' :
               live.phase === 'battle'   ? 'Бой' : 'Завершено'}
            </span>
            {live.phase === 'battle' && (
              <span className={styles.liveRound}>Раунд {live.currentRound}</span>
            )}
          </div>

          {/* Compile progress */}
          {live.phase === 'compiling' && (
            <div className={styles.compileRow}>
              <div className={styles.compileBar}>
                <span className={styles.compileLabel}>P1</span>
                <div className={styles.barTrack}>
                  <div className={`${styles.barFill} ${live.p1Done ? styles.barDone : styles.barActive}`} />
                </div>
                <span className={styles.compileStatus}>{live.p1Done ? '✓' : '⏳'}</span>
              </div>
              <div className={styles.compileBar}>
                <span className={styles.compileLabel}>P2</span>
                <div className={styles.barTrack}>
                  <div className={`${styles.barFill} ${live.p2Done ? styles.barDone : styles.barActive}`} />
                </div>
                <span className={styles.compileStatus}>{live.p2Done ? '✓' : '⏳'}</span>
              </div>
            </div>
          )}

          {/* Live HP bars */}
          {(live.phase === 'battle' || live.phase === 'done') && (
            <div className={styles.hpSection}>
              <HpBar label="P1" hp={live.p1Hp} />
              <HpBar label="P2" hp={live.p2Hp} />
            </div>
          )}

          {/* Recent turns */}
          {live.recentTurns.length > 0 && (
            <div className={styles.turnLog}>
              <div className={styles.turnLogTitle}>Последние ходы</div>
              {live.recentTurns.map(t => (
                <div key={t.turn} className={styles.turnRow}>
                  <span className={styles.turnNum}>#{t.turn}</span>
                  <span className={styles.turnAction}>{t.p1Action}</span>
                  <span className={styles.turnDmg}>
                    {t.p2DmgTaken > 0 && <span className={styles.dmgRed}>-{t.p2DmgTaken}</span>}
                    {t.p1Heal > 0 && <span className={styles.dmgGreen}>+{t.p1Heal}</span>}
                  </span>
                  <span className={styles.turnVs}>|</span>
                  <span className={styles.turnAction}>{t.p2Action}</span>
                  <span className={styles.turnDmg}>
                    {t.p1DmgTaken > 0 && <span className={styles.dmgRed}>-{t.p1DmgTaken}</span>}
                    {t.p2Heal > 0 && <span className={styles.dmgGreen}>+{t.p2Heal}</span>}
                  </span>
                  <span className={styles.turnHp}>{t.p1HpAfter} vs {t.p2HpAfter} HP</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Battle log */}
        {session.battles.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>📋 Результаты раундов</h3>
            <div className={styles.roundsList}>
              {session.battles.map(b => (
                <div key={b.id} className={styles.roundRow}>
                  <span className={styles.roundLabel}>Раунд {b.round}</span>
                  <div className={styles.roundResult}>
                    <span className={b.winner === 1 ? styles.roundWin : ''}>P1: {b.hp1Final} HP</span>
                    <span className={styles.roundVs}>vs</span>
                    <span className={b.winner === 2 ? styles.roundWin : ''}>P2: {b.hp2Final} HP</span>
                    <span className={`badge ${b.winner === 1 ? 'badge-battle' : b.winner === 2 ? 'badge-coding' : 'badge-waiting'}`}>
                      {b.winner === 0 ? 'Ничья' : `Победа P${b.winner}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CodeBox({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className={styles.codeBox}>
      <span className={styles.codeLabel}>{label}</span>
      <span className={styles.codeVal}>{code}</span>
      <button
        className="btn btn-ghost"
        style={{ fontSize: 11, padding: '4px 10px' }}
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      >
        {copied ? '✓ Скопировано' : '📋 Копировать'}
      </button>
    </div>
  )
}

function HpBar({ label, hp }: { label: string; hp: number }) {
  const pct = Math.max(0, Math.min(100, hp))
  const color = pct > 50 ? '#4ade80' : pct > 25 ? '#facc15' : '#f87171'
  return (
    <div className={styles.hpBarRow}>
      <span className={styles.hpLabel}>{label}</span>
      <div className={styles.hpTrack}>
        <div className={styles.hpFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={styles.hpValue}>{hp} HP</span>
    </div>
  )
}

function PlayerCard({
  player,
  slot,
  wins,
}: {
  player: SessionDetail['players'][0] | undefined
  slot: number
  wins: number
}) {
  return (
    <div className={styles.playerCard}>
      <div className={styles.playerSlot}>Игрок {slot}</div>
      {player ? (
        <>
          <div className={styles.playerIcon}>{SKIN_ICONS[player.skin] ?? '🤖'}</div>
          <div className={styles.playerName}>{player.name}</div>
          {player.lang && <div className={styles.playerLang}>{player.lang.toUpperCase()}</div>}
          <div className={styles.playerWins}>{wins} побед</div>
          {player.code && (
            <div className={styles.codeSnippet}>
              <pre>{player.code.slice(0, 120)}{player.code.length > 120 ? '...' : ''}</pre>
            </div>
          )}
        </>
      ) : (
        <div className={styles.playerEmpty}>
          <div style={{ fontSize: 32 }}>❓</div>
          <div className={styles.playerEmptyLabel}>Ожидает...</div>
        </div>
      )}
    </div>
  )
}
