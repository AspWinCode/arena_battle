import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useUserStore } from '../stores/userStore'
import type { UserProfile } from '../stores/userStore'
import styles from './AuthPage.module.css'

const SKINS = [
  { id: 'robot',     icon: '🤖', label: 'Робот'     },
  { id: 'gladiator', icon: '⚔️', label: 'Гладиатор' },
  { id: 'boxer',     icon: '🥊', label: 'Боксёр'    },
  { id: 'cosmonaut', icon: '🚀', label: 'Космонавт' },
]

const AVATARS = ['🤖', '⚔️', '🥊', '🚀', '🦾', '🎮', '👾', '💻', '🧠', '🔥', '⚡', '🌀']

export default function RegisterPage() {
  const navigate  = useNavigate()
  const setAuth   = useUserStore(s => s.setAuth)

  const [step, setStep] = useState<1 | 2>(1)
  const [form, setForm] = useState({
    email: '', username: '', displayName: '', password: '', confirmPassword: '',
    preferredSkin: 'robot', preferredLang: 'js', avatar: '🤖',
    experienceLevel: 'beginner', programmingYears: 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) { setError('Пароли не совпадают'); return }
    if (form.password.length < 6) { setError('Пароль минимум 6 символов'); return }
    setError('')
    setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { confirmPassword: _, ...data } = form
      const res = await api.post<{ user: UserProfile; token: string }>('/user/auth/register', data)
      setAuth(res.user, res.token)
      navigate('/profile')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации')
      setStep(1)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.bg}><div className={styles.glow1}/><div className={styles.glow2}/></div>

      <div className={styles.card}>
        <div className={styles.logo}>
          <span style={{ fontSize: 40 }}>{form.avatar}</span>
          <div>
            <h1 className={styles.title}>Регистрация</h1>
            <p className={styles.sub}>RoboCode Arena</p>
          </div>
        </div>

        <div className={styles.steps}>
          <div className={`${styles.step} ${step >= 1 ? styles.stepActive : ''}`}>1 Аккаунт</div>
          <div className={styles.stepLine}/>
          <div className={`${styles.step} ${step >= 2 ? styles.stepActive : ''}`}>2 Профиль</div>
        </div>

        {step === 1 && (
          <form onSubmit={handleStep1} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Email *</label>
              <input className={styles.input} type="email" required autoFocus
                placeholder="you@example.com"
                value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Username *</label>
              <input className={styles.input} required maxLength={20}
                placeholder="только латиница, цифры, _"
                value={form.username} onChange={e => set('username', e.target.value.toLowerCase())} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Имя на арене *</label>
              <input className={styles.input} required maxLength={30}
                placeholder="Как тебя будут видеть соперники"
                value={form.displayName} onChange={e => set('displayName', e.target.value)} />
            </div>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>Пароль *</label>
                <input className={styles.input} type="password" required minLength={6}
                  placeholder="мин. 6 символов"
                  value={form.password} onChange={e => set('password', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Повтор *</label>
                <input className={styles.input} type="password" required
                  placeholder="ещё раз"
                  value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} />
              </div>
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <button type="submit" className="btn btn-primary" style={{ fontSize: 15 }}>
              Далее →
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Аватар</label>
              <div className={styles.avatarGrid}>
                {AVATARS.map(a => (
                  <button key={a} type="button"
                    className={`${styles.avatarBtn} ${form.avatar === a ? styles.avatarActive : ''}`}
                    onClick={() => set('avatar', a)}>{a}</button>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Боец</label>
              <div className={styles.skinRow}>
                {SKINS.map(s => (
                  <button key={s.id} type="button"
                    className={`${styles.skinBtn} ${form.preferredSkin === s.id ? styles.skinActive : ''}`}
                    onClick={() => set('preferredSkin', s.id)}>
                    <span>{s.icon}</span><span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>Язык программирования</label>
                <select className={styles.select} value={form.preferredLang}
                  onChange={e => set('preferredLang', e.target.value)}>
                  <option value="js">JavaScript</option>
                  <option value="py">Python</option>
                  <option value="cpp">C++</option>
                  <option value="java">Java</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Уровень опыта</label>
                <select className={styles.select} value={form.experienceLevel}
                  onChange={e => set('experienceLevel', e.target.value)}>
                  <option value="beginner">Начинающий</option>
                  <option value="intermediate">Средний</option>
                  <option value="advanced">Продвинутый</option>
                </select>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Лет программирования</label>
              <input className={styles.input} type="number" min={0} max={40}
                value={form.programmingYears}
                onChange={e => set('programmingYears', Number(e.target.value))} />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.formActions}>
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>← Назад</button>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ fontSize: 15 }}>
                {loading ? '⏳ Создаём...' : '🚀 Создать аккаунт'}
              </button>
            </div>
          </form>
        )}

        <p className={styles.switch}>
          Уже есть аккаунт? <Link to="/login">Войти →</Link>
        </p>
      </div>
    </div>
  )
}
