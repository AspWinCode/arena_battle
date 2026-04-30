import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import BracketView from '../components/tournament/BracketView'
import styles from './TournamentDetailPage.module.css'

interface TournamentDetail {
  id: string
  name: string
  description: string | null
  startDate: string
  registrationDeadline: string
  maxParticipants: number
  status: string
  format: string
  level: string
  applications: Array<{
    id: string; playerName: string; preferredLang: string
    seed: number | null; skillScore: number | null; experienceLevel: string
  }>
  matches: Array<{
    id: string; round: number; position: number; status: string
    p1: { id: string; playerName: string; seed: number | null } | null
    p2: { id: string; playerName: string; seed: number | null } | null
    winner: { id: string; playerName: string } | null
  }>
}

const LEVEL_ICON: Record<string, string> = { BLOCKS: '🧩', CODE: '💻', PRO: '⚡' }
const LANG_ICON: Record<string, string> = { js: '🟨', py: '🐍', cpp: '⚙️', java: '☕', auto: '🤖' }
const EXP_LABEL: Record<string, string> = { beginner: 'Начинающий', intermediate: 'Средний', advanced: 'Продвинутый' }

const APPLY_LANGS = ['js', 'py', 'cpp', 'java'] as const

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [tournament, setTournament] = useState<TournamentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'bracket' | 'participants' | 'apply'>('bracket')

  // Application form state
  const [form, setForm] = useState({
    playerName: '', playerEmail: '', experienceLevel: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    programmingYears: 0, preferredLang: 'js' as typeof APPLY_LANGS[number], about: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [applyResult, setApplyResult] = useState<{ ok: boolean; message: string } | null>(null)

  const load = () => {
    if (!id) return
    api.get<TournamentDetail>(`/tournament/${id}`)
      .then(setTournament)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setSubmitting(true)
    setApplyResult(null)
    try {
      const res = await api.post<{ message: string }>(`/tournament/${id}/apply`, form)
      setApplyResult({ ok: true, message: res.message })
    } catch (err) {
      setApplyResult({ ok: false, message: err instanceof Error ? err.message : 'Ошибка' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className={styles.loading}>⏳ Загрузка...</div>
  if (!tournament) return <div className={styles.loading}>Турнир не найден</div>

  const isRegistrationOpen = tournament.status === 'REGISTRATION' && new Date() < new Date(tournament.registrationDeadline)
  const totalRounds = tournament.matches.length > 0
    ? Math.max(...tournament.matches.map(m => m.round))
    : 0

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Link to="/tournaments" className={styles.back}>← Все турниры</Link>
        <div className={styles.headerContent}>
          <div>
            <div className={styles.headerMeta}>
              <span>{LEVEL_ICON[tournament.level]}</span>
              <span className={`badge ${tournament.status === 'ACTIVE' ? 'badge-battle' : tournament.status === 'REGISTRATION' ? 'badge-coding' : 'badge-waiting'}`}>
                {tournament.status === 'REGISTRATION' ? 'Регистрация' :
                 tournament.status === 'ACTIVE'       ? 'Идёт турнир' :
                 tournament.status === 'DONE'         ? 'Завершён' :
                 tournament.status === 'CLOSED'       ? 'Закрыта' : 'Черновик'}
              </span>
              <span className={styles.format}>{tournament.format.toUpperCase()}</span>
            </div>
            <h1 className={styles.title}>{tournament.name}</h1>
            {tournament.description && <p className={styles.desc}>{tournament.description}</p>}
          </div>
          <div className={styles.dateBlock}>
            <div className={styles.dateItem}>
              <span className={styles.dateLabel}>Старт турнира</span>
              <span className={styles.dateVal}>
                {new Date(tournament.startDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className={styles.dateItem}>
              <span className={styles.dateLabel}>Регистрация до</span>
              <span className={styles.dateVal}>
                {new Date(tournament.registrationDeadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
              </span>
            </div>
            <div className={styles.dateItem}>
              <span className={styles.dateLabel}>Участников</span>
              <span className={styles.dateVal}>{tournament.applications.length} / {tournament.maxParticipants}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {(['bracket', 'participants', ...(isRegistrationOpen ? ['apply'] : [])] as const).map(t => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t as typeof tab)}
          >
            {t === 'bracket'      ? '🏆 Сетка' :
             t === 'participants' ? `👥 Участники (${tournament.applications.length})` :
             '📋 Подать заявку'}
          </button>
        ))}
      </div>

      <div className={styles.body}>
        {/* Bracket */}
        {tab === 'bracket' && (
          tournament.matches.length > 0
            ? <BracketView matches={tournament.matches} totalRounds={totalRounds} />
            : <div className={styles.emptyTab}>
                <div style={{ fontSize: 48 }}>📋</div>
                <p>{tournament.status === 'REGISTRATION' || tournament.status === 'CLOSED'
                  ? 'Сетка будет сформирована за 10 дней до старта турнира'
                  : 'Сетка ещё не сформирована'}</p>
              </div>
        )}

        {/* Participants */}
        {tab === 'participants' && (
          <div className={styles.participantsList}>
            {tournament.applications.length === 0 && (
              <div className={styles.emptyTab}><p>Пока нет участников</p></div>
            )}
            {tournament.applications.map((p, i) => (
              <div key={p.id} className={styles.participantRow}>
                <span className={styles.participantSeed}>#{p.seed ?? i + 1}</span>
                <span className={styles.participantName}>{p.playerName}</span>
                <span className={styles.participantLang}>{LANG_ICON[p.preferredLang] ?? ''} {p.preferredLang.toUpperCase()}</span>
                <span className={styles.participantExp}>{EXP_LABEL[p.experienceLevel] ?? p.experienceLevel}</span>
                {p.skillScore != null && (
                  <span className={styles.participantScore}>{Math.round(p.skillScore)} ⭐</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Application form */}
        {tab === 'apply' && (
          <div className={styles.applyWrap}>
            {applyResult?.ok ? (
              <div className={styles.applySuccess}>
                <div style={{ fontSize: 48 }}>✅</div>
                <h3>Заявка принята!</h3>
                <p>{applyResult.message}</p>
                <p className={styles.applySuccessSub}>Проверяй статус по email. Организатор рассмотрит заявку и уведомит тебя.</p>
              </div>
            ) : (
              <form className={styles.applyForm} onSubmit={handleApply}>
                <h3 className={styles.applyTitle}>Подать заявку на участие</h3>

                <div className={styles.formRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>Имя участника *</label>
                    <input className={styles.input} required maxLength={30}
                      placeholder="Как тебя зовут?" value={form.playerName}
                      onChange={e => setForm(f => ({ ...f, playerName: e.target.value }))} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Email *</label>
                    <input className={styles.input} type="email" required
                      placeholder="для уведомлений" value={form.playerEmail}
                      onChange={e => setForm(f => ({ ...f, playerEmail: e.target.value }))} />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>Уровень опыта *</label>
                    <select className={styles.select} value={form.experienceLevel}
                      onChange={e => setForm(f => ({ ...f, experienceLevel: e.target.value as 'beginner' | 'intermediate' | 'advanced' }))}>
                      <option value="beginner">Начинающий</option>
                      <option value="intermediate">Средний</option>
                      <option value="advanced">Продвинутый</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Лет программирования</label>
                    <input className={styles.input} type="number" min={0} max={40}
                      value={form.programmingYears}
                      onChange={e => setForm(f => ({ ...f, programmingYears: Number(e.target.value) }))} />
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Любимый язык</label>
                  <div className={styles.langPicker}>
                    {APPLY_LANGS.map(l => (
                      <button key={l} type="button"
                        className={`${styles.langBtn} ${form.preferredLang === l ? styles.langBtnActive : ''}`}
                        onClick={() => setForm(f => ({ ...f, preferredLang: l }))}>
                        {LANG_ICON[l]} {l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>О себе <span className={styles.optional}>(необязательно)</span></label>
                  <textarea className={styles.textarea} maxLength={500} rows={3}
                    placeholder="Расскажи о своём опыте программирования..."
                    value={form.about}
                    onChange={e => setForm(f => ({ ...f, about: e.target.value }))} />
                </div>

                {applyResult && !applyResult.ok && (
                  <div className={styles.applyError}>{applyResult.message}</div>
                )}

                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ fontSize: 15 }}>
                  {submitting ? '⏳ Отправка...' : '📋 Отправить заявку'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
