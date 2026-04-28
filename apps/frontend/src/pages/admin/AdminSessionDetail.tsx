import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useAdminStore } from '../../stores/adminStore'
import styles from './AdminSessionDetail.module.css'

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
  const sessionRef = useRef<SessionDetail | null>(null)
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

  // Auto-refresh every 5s while session is active
  useEffect(() => {
    const interval = setInterval(() => {
      const s = sessionRef.current
      if (s && ['WAITING', 'CODING', 'BATTLE'].includes(s.status)) load()
    }, 5000)
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
