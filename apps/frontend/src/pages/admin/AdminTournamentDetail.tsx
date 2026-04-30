import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useAdminStore } from '../../stores/adminStore'
import BracketView from '../../components/tournament/BracketView'
import styles from './AdminTournamentDetail.module.css'

interface Application {
  id: string; playerName: string; playerEmail: string
  experienceLevel: string; programmingYears: number; preferredLang: string
  about: string | null; status: string; skillScore: number | null; adminNote: string | null; seed: number | null
  createdAt: string
}

interface TournamentDetail {
  id: string; name: string; status: string; format: string
  startDate: string; registrationDeadline: string; maxParticipants: number
  bracketGeneratedAt: string | null
  applications: Array<{ id: string; playerName: string; seed: number | null; skillScore: number | null }>
  matches: Array<{
    id: string; round: number; position: number; status: string
    p1: { id: string; playerName: string; seed: number | null } | null
    p2: { id: string; playerName: string; seed: number | null } | null
    winner: { id: string; playerName: string } | null
  }>
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#6b7280', APPROVED: '#4ade80', REJECTED: '#f87171',
}

const EXP_LABEL: Record<string, string> = {
  beginner: 'Начинающий', intermediate: 'Средний', advanced: 'Продвинутый',
}

export default function AdminTournamentDetail() {
  const { id }  = useParams<{ id: string }>()
  const token   = useAdminStore(s => s.accessToken)
  const [tournament, setTournament] = useState<TournamentDetail | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [tab, setTab]       = useState<'apps' | 'bracket'>('apps')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [noteEdit, setNoteEdit] = useState<{ id: string; note: string } | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const [t, apps] = await Promise.all([
        api.get<TournamentDetail>(`/tournament/${id}`, token ?? undefined),
        api.get<Application[]>(`/tournament/${id}/applications`, token ?? undefined),
      ])
      setTournament(t)
      setApplications(apps)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [id, token])

  useEffect(() => { load() }, [load])

  const reviewApp = async (appId: string, status: 'APPROVED' | 'REJECTED' | 'PENDING', adminNote?: string) => {
    await api.patch(`/tournament/${id}/applications/${appId}`, { status, adminNote }, token ?? undefined)
    await load()
    setNoteEdit(null)
  }

  const generateBracket = async () => {
    if (!id) return
    setGenerating(true)
    try {
      await api.post(`/tournament/${id}/generate-bracket`, {}, token ?? undefined)
      await load()
      setTab('bracket')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка генерации')
    } finally { setGenerating(false) }
  }

  if (loading) return <div className={styles.loading}>⏳ Загрузка...</div>
  if (!tournament) return <div className={styles.loading}>Турнир не найден</div>

  const approved  = applications.filter(a => a.status === 'APPROVED').length
  const pending   = applications.filter(a => a.status === 'PENDING').length
  const totalRounds = tournament.matches.length > 0
    ? Math.max(...tournament.matches.map(m => m.round)) : 0

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Link to="/admin/tournaments" className={styles.back}>← Турниры</Link>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>{tournament.name}</h1>
            <div className={styles.headerMeta}>
              <span className={`badge ${tournament.status === 'ACTIVE' ? 'badge-battle' : tournament.status === 'REGISTRATION' ? 'badge-coding' : 'badge-waiting'}`}>
                {tournament.status}
              </span>
              <span className={styles.metaChip}>{tournament.format.toUpperCase()}</span>
              <span className={styles.metaChip}>
                Старт: {new Date(tournament.startDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              </span>
              <span className={styles.metaChip}>{approved}/{tournament.maxParticipants} одобрено</span>
              {pending > 0 && <span className={styles.pendingChip}>⏳ {pending} на рассмотрении</span>}
            </div>
          </div>
          <div className={styles.headerActions}>
            {(tournament.status === 'CLOSED' || tournament.status === 'REGISTRATION') && approved >= 2 && (
              <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={generateBracket} disabled={generating}>
                {generating ? '⏳ Генерация...' : '⚡ Сгенерировать сетку'}
              </button>
            )}
            {tournament.bracketGeneratedAt && (
              <span className={styles.generatedAt}>
                Сетка создана: {new Date(tournament.bracketGeneratedAt).toLocaleDateString('ru-RU')}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.tabs}>
        {[
          { key: 'apps',    label: `📋 Заявки (${applications.length})` },
          { key: 'bracket', label: '🏆 Сетка' },
        ].map(t => (
          <button key={t.key}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            onClick={() => setTab(t.key as 'apps' | 'bracket')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Applications tab */}
      {tab === 'apps' && (
        <div className={styles.appsPane}>
          {applications.length === 0 && (
            <div className={styles.empty}><p>Заявок пока нет</p></div>
          )}
          {applications.map(app => (
            <div key={app.id} className={styles.appCard}>
              <div className={styles.appTop}>
                <div>
                  <span className={styles.appName}>{app.playerName}</span>
                  <span className={styles.appEmail}>{app.playerEmail}</span>
                </div>
                <div className={styles.appBadge} style={{ color: STATUS_COLOR[app.status], borderColor: STATUS_COLOR[app.status] }}>
                  {app.status === 'PENDING' ? '⏳ Ожидает' : app.status === 'APPROVED' ? '✅ Одобрен' : '❌ Отклонён'}
                </div>
              </div>

              <div className={styles.appMeta}>
                <span>{EXP_LABEL[app.experienceLevel]}</span>
                <span>{app.programmingYears} лет опыта</span>
                <span>{app.preferredLang.toUpperCase()}</span>
                {app.skillScore != null && <span>Рейтинг: <strong>{Math.round(app.skillScore)}</strong></span>}
                <span className={styles.appDate}>{new Date(app.createdAt).toLocaleDateString('ru-RU')}</span>
              </div>

              {app.about && <p className={styles.appAbout}>«{app.about}»</p>}

              {app.adminNote && <p className={styles.appNote}>📝 {app.adminNote}</p>}

              {app.status === 'PENDING' && (
                <div className={styles.appActions}>
                  {noteEdit?.id === app.id ? (
                    <div className={styles.noteRow}>
                      <input className={styles.noteInput} placeholder="Причина отклонения (необязательно)"
                        value={noteEdit.note} onChange={e => setNoteEdit({ id: app.id, note: e.target.value })} />
                      <button className="btn btn-ghost" style={{ fontSize: 12, color: '#f87171' }}
                        onClick={() => reviewApp(app.id, 'REJECTED', noteEdit.note)}>Отклонить</button>
                      <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setNoteEdit(null)}>Отмена</button>
                    </div>
                  ) : (
                    <>
                      <button className="btn btn-primary" style={{ fontSize: 12 }}
                        onClick={() => reviewApp(app.id, 'APPROVED')}>✅ Одобрить</button>
                      <button className="btn btn-ghost" style={{ fontSize: 12, color: '#f87171' }}
                        onClick={() => setNoteEdit({ id: app.id, note: '' })}>❌ Отклонить</button>
                    </>
                  )}
                </div>
              )}

              {app.status !== 'PENDING' && (
                <div className={styles.appActions}>
                  <button className="btn btn-ghost" style={{ fontSize: 11 }}
                    onClick={() => reviewApp(app.id, 'PENDING')}>↩ Вернуть в ожидание</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bracket tab */}
      {tab === 'bracket' && (
        tournament.matches.length > 0
          ? <BracketView matches={tournament.matches} totalRounds={totalRounds} />
          : <div className={styles.empty}>
              <p>Сетка не создана. Одобри участников и нажми «Сгенерировать сетку».</p>
              {approved >= 2 && (
                <button className="btn btn-primary" style={{ fontSize: 13, marginTop: 16 }}
                  onClick={generateBracket} disabled={generating}>
                  {generating ? '⏳ Генерация...' : '⚡ Сгенерировать сетку'}
                </button>
              )}
            </div>
      )}
    </div>
  )
}
