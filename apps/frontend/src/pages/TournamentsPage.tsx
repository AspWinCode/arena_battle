import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import styles from './TournamentsPage.module.css'

interface Tournament {
  id: string
  name: string
  description: string | null
  startDate: string
  registrationDeadline: string
  maxParticipants: number
  status: string
  format: string
  level: string
  _count: { applications: number }
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  DRAFT:        { label: 'Черновик',      color: '#6b7280' },
  REGISTRATION: { label: 'Регистрация',   color: '#4ade80' },
  CLOSED:       { label: 'Закрыта',       color: '#facc15' },
  ACTIVE:       { label: 'Идёт турнир',   color: '#f97316' },
  DONE:         { label: 'Завершён',       color: '#6b7280' },
}

const FORMAT_LABEL: Record<string, string> = { bo1: 'BO1', bo3: 'BO3', bo5: 'BO5' }
const LEVEL_ICON: Record<string, string>   = { BLOCKS: '🧩', CODE: '💻', PRO: '⚡' }

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<Tournament[]>('/tournament')
      .then(setTournaments)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className={styles.root}>
      <div className={styles.bg}>
        <div className={styles.bgGlow1} />
        <div className={styles.bgGlow2} />
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <Link to="/join" className={styles.back}>← Главная</Link>
          <h1 className={styles.title}>🏆 Турниры</h1>
          <p className={styles.subtitle}>Соревнуйся с лучшими программистами арены</p>
        </div>

        {loading && <div className={styles.loading}>⏳ Загрузка...</div>}

        {!loading && tournaments.length === 0 && (
          <div className={styles.empty}>
            <div style={{ fontSize: 48 }}>🏟️</div>
            <p>Пока нет активных турниров</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Следи за обновлениями!</p>
          </div>
        )}

        <div className={styles.grid}>
          {tournaments.map(t => {
            const st  = STATUS_LABEL[t.status] ?? STATUS_LABEL['DRAFT']
            const now = new Date()
            const daysToStart = Math.ceil((new Date(t.startDate).getTime() - now.getTime()) / 86400000)
            const daysToDeadline = Math.ceil((new Date(t.registrationDeadline).getTime() - now.getTime()) / 86400000)
            const spotsLeft = t.maxParticipants - t._count.applications
            const pct = (t._count.applications / t.maxParticipants) * 100

            return (
              <div key={t.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.levelIcon}>{LEVEL_ICON[t.level] ?? '💻'}</span>
                  <span className={styles.statusBadge} style={{ color: st.color, borderColor: st.color }}>
                    {st.label}
                  </span>
                </div>

                <h2 className={styles.cardTitle}>{t.name}</h2>
                {t.description && <p className={styles.cardDesc}>{t.description}</p>}

                <div className={styles.cardMeta}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Формат</span>
                    <span className={styles.metaVal}>{FORMAT_LABEL[t.format]}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Старт</span>
                    <span className={styles.metaVal}>
                      {new Date(t.startDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      {daysToStart > 0 && <span className={styles.daysLeft}> · через {daysToStart} д.</span>}
                    </span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Мест</span>
                    <span className={styles.metaVal}>{spotsLeft > 0 ? `${spotsLeft} свободно` : 'Мест нет'}</span>
                  </div>
                </div>

                <div className={styles.fillBar}>
                  <div className={styles.fillTrack}>
                    <div className={styles.fillFill} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={styles.fillLabel}>{t._count.applications} / {t.maxParticipants}</span>
                </div>

                {t.status === 'REGISTRATION' && daysToDeadline > 0 && (
                  <p className={styles.deadline}>
                    ⏰ Регистрация закрывается через {daysToDeadline} дн.
                  </p>
                )}

                <Link to={`/tournaments/${t.id}`} className={`btn ${t.status === 'REGISTRATION' ? 'btn-primary' : 'btn-ghost'}`} style={{ marginTop: 'auto', fontSize: 14 }}>
                  {t.status === 'REGISTRATION' ? '📋 Подать заявку' :
                   t.status === 'ACTIVE'       ? '👁 Смотреть сетку' :
                   t.status === 'DONE'         ? '🏆 Итоги' : 'Подробнее'}
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
