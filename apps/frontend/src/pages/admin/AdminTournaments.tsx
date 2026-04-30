import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useAdminStore } from '../../stores/adminStore'
import styles from './AdminTournaments.module.css'

interface Tournament {
  id: string; name: string; startDate: string; registrationDeadline: string
  maxParticipants: number; status: string; format: string; level: string
  _count: { applications: number }
}

const STATUS_MAP: Record<string, { label: string; css: string }> = {
  DRAFT:        { label: 'Черновик',    css: 'badge-waiting' },
  REGISTRATION: { label: 'Регистрация', css: 'badge-coding'  },
  CLOSED:       { label: 'Закрыта',     css: 'badge-waiting' },
  ACTIVE:       { label: 'Активен',     css: 'badge-battle'  },
  DONE:         { label: 'Завершён',    css: 'badge-done'    },
}

const NEXT_STATUS: Record<string, string> = {
  DRAFT: 'REGISTRATION', REGISTRATION: 'CLOSED', CLOSED: 'ACTIVE', ACTIVE: 'DONE',
}
const NEXT_LABEL: Record<string, string> = {
  DRAFT: '▶ Открыть регистрацию', REGISTRATION: '🔒 Закрыть регистрацию',
  CLOSED: '⚡ Активировать', ACTIVE: '🏁 Завершить',
}

export default function AdminTournaments() {
  const token = useAdminStore(s => s.accessToken)
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading]         = useState(true)
  const [advancing, setAdvancing]     = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      // Admin sees all including DRAFT — use admin endpoint with token
      const data = await api.get<Tournament[]>('/tournament', token ?? undefined)
      setTournaments(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { load() }, [load])

  const advanceStatus = async (id: string, current: string) => {
    const next = NEXT_STATUS[current]
    if (!next) return
    setAdvancing(id)
    try {
      await api.post(`/tournament/${id}/status`, { status: next }, token ?? undefined)
      await load()
    } finally { setAdvancing(null) }
  }

  const deleteTournament = async (id: string) => {
    if (!confirm('Удалить турнир и все заявки?')) return
    await api.delete(`/tournament/${id}`, token ?? undefined)
    await load()
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <Link to="/admin" className={styles.back}>← Дашборд</Link>
          <h1 className={styles.title}>🏆 Турниры</h1>
        </div>
        <Link to="/admin/tournaments/new" className="btn btn-primary" style={{ fontSize: 13 }}>
          + Создать турнир
        </Link>
      </div>

      {loading && <div className={styles.loading}>⏳ Загрузка...</div>}

      {!loading && tournaments.length === 0 && (
        <div className={styles.empty}>
          <p>Пока нет турниров. Создай первый!</p>
        </div>
      )}

      <div className={styles.list}>
        {tournaments.map(t => {
          const st = STATUS_MAP[t.status] ?? STATUS_MAP['DRAFT']
          return (
            <div key={t.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={`badge ${st.css}`}>{st.label}</span>
                <span className={styles.rowName}>{t.name}</span>
                <span className={styles.rowMeta}>
                  {t.format.toUpperCase()} · {t._count.applications}/{t.maxParticipants} участников
                </span>
                <span className={styles.rowDate}>
                  Старт: {new Date(t.startDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className={styles.rowActions}>
                <Link to={`/admin/tournaments/${t.id}`} className="btn btn-ghost" style={{ fontSize: 12 }}>
                  Управление
                </Link>
                {NEXT_STATUS[t.status] && (
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12 }}
                    disabled={advancing === t.id}
                    onClick={() => advanceStatus(t.id, t.status)}
                  >
                    {advancing === t.id ? '...' : NEXT_LABEL[t.status]}
                  </button>
                )}
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12, color: '#f87171' }}
                  onClick={() => deleteTournament(t.id)}
                >
                  🗑
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
