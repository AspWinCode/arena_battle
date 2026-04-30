import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useAdminStore } from '../../stores/adminStore'
import styles from './AdminSessionNew.module.css'   // reuse session new styles

export default function AdminTournamentNew() {
  const token    = useAdminStore(s => s.accessToken)
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '', description: '',
    startDate: '', registrationDeadline: '',
    maxParticipants: 16, format: 'bo3', level: 'CODE',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const t = await api.post<{ id: string }>('/tournament', {
        ...form,
        startDate:            new Date(form.startDate).toISOString(),
        registrationDeadline: new Date(form.registrationDeadline).toISOString(),
      }, token ?? undefined)
      navigate(`/admin/tournaments/${t.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.content}>
        <Link to="/admin/tournaments" className={styles.back}>← Турниры</Link>
        <h1 className={styles.title}>Новый турнир</h1>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Название *</label>
            <input className={styles.input} required maxLength={80}
              placeholder="RoboCode Championship 2026"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Описание</label>
            <textarea className={styles.textarea} rows={3} maxLength={2000}
              placeholder="Краткое описание турнира..."
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Дата старта *</label>
              <input className={styles.input} type="datetime-local" required
                value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Дедлайн регистрации *</label>
              <input className={styles.input} type="datetime-local" required
                value={form.registrationDeadline}
                onChange={e => setForm(f => ({ ...f, registrationDeadline: e.target.value }))} />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Макс. участников</label>
              <select className={styles.select} value={form.maxParticipants}
                onChange={e => setForm(f => ({ ...f, maxParticipants: Number(e.target.value) }))}>
                {[4, 8, 16, 32, 64].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Формат матчей</label>
              <select className={styles.select} value={form.format}
                onChange={e => setForm(f => ({ ...f, format: e.target.value }))}>
                <option value="bo1">Best of 1</option>
                <option value="bo3">Best of 3</option>
                <option value="bo5">Best of 5</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Уровень кода</label>
              <select className={styles.select} value={form.level}
                onChange={e => setForm(f => ({ ...f, level: e.target.value }))}>
                <option value="BLOCKS">🧩 Блоки</option>
                <option value="CODE">💻 Код</option>
                <option value="PRO">⚡ Pro</option>
              </select>
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ fontSize: 14 }}>
            {loading ? '⏳ Создание...' : '🏆 Создать турнир'}
          </button>
        </form>
      </div>
    </div>
  )
}
