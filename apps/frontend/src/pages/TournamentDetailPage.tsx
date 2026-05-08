import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import BracketView from '../components/tournament/BracketView'
import { useUserStore } from '../stores/userStore'
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
  bracketType: string
  prizeXp: number
  prizeSkin: string | null
  isRecurring: boolean
  recurringInterval: string | null
  applications: Array<{
    id: string; playerName: string; preferredLang: string
    seed: number | null; skillScore: number | null; experienceLevel: string
  }>
  matches: Array<{
    id: string; round: number; position: number; status: string; bracket?: string
    p1: { id: string; playerName: string; seed: number | null } | null
    p2: { id: string; playerName: string; seed: number | null } | null
    winner: { id: string; playerName: string } | null
    session?: { id: string; code1: string; code2: string; status?: string } | null
  }>
}

interface MyMatch {
  status: 'active' | 'waiting'
  matchId?: string
  round?: number
  position?: number
  isP1?: boolean
  opponent?: { id: string; playerName: string; preferredLang: string } | null
  sessionId?: string | null
  joinCode?: string | null
  hasSession?: boolean
  wonLastMatch?: boolean
}

const LEVEL_ICON: Record<string, string> = { BLOCKS: '🧩', CODE: '💻', PRO: '⚡' }
const LANG_ICON:  Record<string, string>  = { js: '🟨', py: '🐍', cpp: '⚙️', java: '☕', auto: '🤖' }
const LANG_LABEL: Record<string, string>  = { js: 'JavaScript', py: 'Python', cpp: 'C++', java: 'Java', auto: 'Авто' }
const EXP_LABEL:  Record<string, string>  = { beginner: 'Начинающий', intermediate: 'Средний', advanced: 'Продвинутый' }

const APPLY_LANGS = ['js', 'py', 'cpp', 'java'] as const

export default function TournamentDetailPage() {
  const { id }     = useParams<{ id: string }>()
  const { user, token } = useUserStore()
  const navigate   = useNavigate()
  const [tournament, setTournament] = useState<TournamentDetail | null>(null)
  const [myMatch,    setMyMatch]    = useState<MyMatch | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [tab, setTab] = useState<'bracket' | 'participants' | 'apply'>('bracket')

  const [form, setForm] = useState({
    playerName:       user?.displayName ?? '',
    playerEmail:      user?.email ?? '',
    experienceLevel:  (user?.experienceLevel ?? 'beginner') as 'beginner' | 'intermediate' | 'advanced',
    programmingYears: user?.programmingYears ?? 0,
    preferredLang:    (user?.preferredLang ?? 'js') as typeof APPLY_LANGS[number],
    about: '',
  })
  const [submitting,   setSubmitting]   = useState(false)
  const [applyResult,  setApplyResult]  = useState<{ ok: boolean; message: string } | null>(null)

  const load = () => {
    if (!id) return
    api.get<TournamentDetail>(`/tournament/${id}`)
      .then(setTournament)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  // Fetch "my match" if user is logged in
  useEffect(() => {
    if (!id || !token) return
    api.get<MyMatch>(`/tournament/${id}/my-match`, token)
      .then(setMyMatch)
      .catch(() => setMyMatch(null)) // not an error — just not a participant
  }, [id, token])

  useEffect(() => { load() }, [id])

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setSubmitting(true)
    setApplyResult(null)
    try {
      const res = await api.post<{ message: string }>(`/tournament/${id}/apply`, form, token ?? undefined)
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

  const roundLabel = (r: number) => {
    if (r === totalRounds) return 'Финал'
    if (r === totalRounds - 1) return 'Полуфинал'
    if (r === totalRounds - 2) return 'Четвертьфинал'
    return `Раунд ${r}`
  }

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
              <span className={styles.format} style={{ background: 'rgba(139,92,246,.15)', color: '#a855f7', borderColor: 'rgba(139,92,246,.3)' }}>
                {tournament.bracketType === 'DOUBLE_ELIMINATION' ? '2x Сетка' :
                 tournament.bracketType === 'ROUND_ROBIN'        ? '🔄 Круговая' : '1x Сетка'}
              </span>
              {tournament.isRecurring && (
                <span className={styles.format} style={{ background: 'rgba(250,204,21,.12)', color: '#facc15', borderColor: 'rgba(250,204,21,.3)' }}>
                  🔁 {tournament.recurringInterval === 'weekly' ? 'Еженедельный' : 'Ежемесячный'}
                </span>
              )}
            </div>
            <h1 className={styles.title}>{tournament.name}</h1>
            {tournament.description && <p className={styles.desc}>{tournament.description}</p>}
            {(tournament.prizeXp > 0 || tournament.prizeSkin) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {tournament.prizeXp > 0 && (
                  <span style={{ fontSize: 13, background: 'rgba(250,204,21,.12)', border: '1px solid rgba(250,204,21,.3)', color: '#facc15', padding: '3px 10px', borderRadius: 99, fontWeight: 700 }}>
                    🏆 +{tournament.prizeXp} XP победителю
                  </span>
                )}
                {tournament.prizeSkin && (
                  <span style={{ fontSize: 13, background: 'rgba(139,92,246,.12)', border: '1px solid rgba(139,92,246,.3)', color: '#a855f7', padding: '3px 10px', borderRadius: 99, fontWeight: 700 }}>
                    🎭 Скин «{tournament.prizeSkin}» победителю
                  </span>
                )}
              </div>
            )}
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

      {/* ── МОЙ МАТЧ ────────────────────────────────────────────────── */}
      {myMatch && (
        <div className={styles.myMatchBanner}>
          {myMatch.status === 'active' && myMatch.opponent && (
            <>
              <div className={styles.myMatchLeft}>
                <div className={styles.myMatchTitle}>⚔️ Твой матч</div>
                <div className={styles.myMatchRound}>{roundLabel(myMatch.round!)}</div>
              </div>

              <div className={styles.myMatchVs}>
                <div className={styles.myMatchPlayer}>
                  <span className={styles.myMatchName}>Ты</span>
                  <span className={styles.myMatchLang}>{LANG_ICON[form.preferredLang]} {LANG_LABEL[form.preferredLang]}</span>
                </div>
                <span className={styles.myMatchVsText}>VS</span>
                <div className={styles.myMatchPlayer} style={{ textAlign: 'right' }}>
                  <span className={styles.myMatchName}>{myMatch.opponent.playerName}</span>
                  <span className={styles.myMatchLang}>{LANG_ICON[myMatch.opponent.preferredLang]} {LANG_LABEL[myMatch.opponent.preferredLang]}</span>
                </div>
              </div>

              <div className={styles.myMatchActions}>
                {myMatch.hasSession && myMatch.joinCode ? (
                  <button
                    className={styles.enterBattleBtn}
                    onClick={() => navigate(`/join?code=${myMatch.joinCode}`)}
                  >
                    🎮 Войти в бой
                  </button>
                ) : (
                  <div className={styles.myMatchWaiting}>
                    ⏳ Сессия ещё не открыта.<br />
                    <span>Организатор запустит бой — страница обновится.</span>
                  </div>
                )}
              </div>
            </>
          )}

          {myMatch.status === 'active' && !myMatch.opponent && (
            <div className={styles.myMatchWaiting}>
              ⏳ Ожидаем соперника — сетка ещё формируется
            </div>
          )}

          {myMatch.status === 'waiting' && (
            <div className={styles.myMatchWaiting} style={{ padding: '20px 24px' }}>
              {myMatch.wonLastMatch
                ? '🏆 Ты победил в последнем матче! Ожидай следующего раунда...'
                : '✅ Ты в турнире. Ожидай начала своего матча...'}
            </div>
          )}
        </div>
      )}

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
        {tab === 'bracket' && (
          tournament.matches.length > 0
            ? <BracketView matches={tournament.matches} totalRounds={totalRounds} bracketType={tournament.bracketType} />
            : <div className={styles.emptyTab}>
                <div style={{ fontSize: 48 }}>📋</div>
                <p>{tournament.status === 'REGISTRATION' || tournament.status === 'CLOSED'
                  ? 'Сетка будет сформирована за 10 дней до старта турнира'
                  : 'Сетка ещё не сформирована'}</p>
              </div>
        )}

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

        {tab === 'apply' && (
          <div className={styles.applyWrap}>
            {!user && (
              <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(0,229,255,.06)', border: '1px solid rgba(0,229,255,.2)', borderRadius: 10, fontSize: 13 }}>
                💡 <Link to="/login">Войди в аккаунт</Link> — тогда твоя заявка будет автоматически привязана к профилю.
              </div>
            )}
            {applyResult?.ok ? (
              <div className={styles.applySuccess}>
                <div style={{ fontSize: 48 }}>✅</div>
                <h3>Заявка принята!</h3>
                <p>{applyResult.message}</p>
                <p className={styles.applySuccessSub}>Организатор рассмотрит заявку и уведомит тебя по email. После одобрения — данные для входа придут автоматически.</p>
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
                      placeholder="для уведомлений и входа" value={form.playerEmail}
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
