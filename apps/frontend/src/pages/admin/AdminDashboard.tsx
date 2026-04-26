import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useAdminStore } from '../../stores/adminStore'
import styles from './AdminDashboard.module.css'

interface SessionRow {
  id: string
  name: string
  level: string
  format: string
  status: string
  code1: string
  code2: string
  timeLimit: number
  createdAt: string
  players: unknown[]
  battles: unknown[]
}

const STATUS_MAP: Record<string, { label: string; css: string }> = {
  WAITING: { label: 'Ожидание', css: 'badge-waiting' },
  CODING:  { label: 'Код',     css: 'badge-coding' },
  BATTLE:  { label: 'Бой',     css: 'badge-battle' },
  DONE:    { label: 'Готово',  css: 'badge-done' },
}

const LEVEL_MAP: Record<string, string> = {
  BLOCKS: '🧩 Блоки',
  CODE:   '💻 Код',
  PRO:    '⚡ Про',
}

export default function AdminDashboard() {
  const token    = useAdminStore(s => s.accessToken)
  const setToken = useAdminStore(s => s.setToken)
  const navigate = useNavigate()

  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  const load = async () => {
    try {
      const data = await api.get<SessionRow[]>('/session', token ?? undefined)
      setSessions(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить сессию?')) return
    try {
      await api.delete(`/session/${id}`, token ?? undefined)
      setSessions(prev => prev.filter(s => s.id !== id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  const handleLogout = () => {
    api.post('/auth/logout', {}, token ?? undefined).catch(() => {})
    setToken(null)
    navigate('/admin/login')
  }

  const active  = sessions.filter(s => ['WAITING', 'CODING', 'BATTLE'].includes(s.status)).length
  const done    = sessions.filter(s => s.status === 'DONE').length

  return (
    <div className={styles.root}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>🤖 RoboCode Admin</span>
        </div>
        <div className={styles.headerRight}>
          <Link to="/admin/session/new" className="btn btn-primary" style={{ fontSize: 13 }}>
            + Новая сессия
          </Link>
          <button className="btn btn-ghost" onClick={handleLogout} style={{ fontSize: 13 }}>
            Выйти
          </button>
        </div>
      </header>

      <div className={styles.content}>
        {/* Stats */}
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statNum}>{sessions.length}</div>
            <div className={styles.statLabel}>Всего сессий</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNum} style={{ color: '#fbbf24' }}>{active}</div>
            <div className={styles.statLabel}>Активных</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNum} style={{ color: 'var(--green)' }}>{done}</div>
            <div className={styles.statLabel}>Завершено</div>
          </div>
        </div>

        {/* Sessions table */}
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <h2 className={styles.tableTitle}>Сессии</h2>
            <button className="btn btn-ghost" onClick={load} style={{ fontSize: 12 }}>
              🔄 Обновить
            </button>
          </div>

          {loading && <div className={styles.loading}>Загрузка...</div>}
          {error   && <div className={styles.error}>{error}</div>}

          {!loading && sessions.length === 0 && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📭</div>
              <div>Нет сессий. <Link to="/admin/session/new">Создайте первую!</Link></div>
            </div>
          )}

          {sessions.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Уровень</th>
                    <th>Формат</th>
                    <th>Статус</th>
                    <th>Игроки</th>
                    <th>Коды</th>
                    <th>Создано</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => {
                    const st = STATUS_MAP[s.status] ?? { label: s.status, css: 'badge-waiting' }
                    return (
                      <tr key={s.id} className={styles.row}>
                        <td>
                          <Link to={`/admin/session/${s.id}`} className={styles.sessionLink}>
                            {s.name}
                          </Link>
                        </td>
                        <td>{LEVEL_MAP[s.level] ?? s.level}</td>
                        <td className={styles.mono}>{s.format.toUpperCase()}</td>
                        <td><span className={`badge ${st.css}`}>{st.label}</span></td>
                        <td>{(s.players as unknown[]).length}/2</td>
                        <td>
                          <div className={styles.codes}>
                            <CodeChip code={s.code1} />
                            <CodeChip code={s.code2} />
                          </div>
                        </td>
                        <td className={styles.muted}>{new Date(s.createdAt).toLocaleDateString('ru')}</td>
                        <td>
                          <div className={styles.rowActions}>
                            <Link to={`/admin/session/${s.id}`} className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}>
                              📊
                            </Link>
                            <button
                              className="btn btn-danger"
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              onClick={() => handleDelete(s.id)}
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button className={styles.codeChip} onClick={copy} title="Скопировать">
      <span className={styles.codeText}>{code}</span>
      <span className={styles.copyIcon}>{copied ? '✓' : '📋'}</span>
    </button>
  )
}
