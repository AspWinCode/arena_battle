import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useUserStore } from '../stores/userStore'
import type { UserProfile } from '../stores/userStore'
import styles from './AuthPage.module.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth  = useUserStore(s => s.setAuth)

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post<{ user: UserProfile; token: string }>('/user/auth/login', { email, password })
      setAuth(res.user, res.token)
      navigate('/profile')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.bg}><div className={styles.glow1}/><div className={styles.glow2}/></div>

      <div className={styles.card}>
        <div className={styles.logo}>
          <span style={{ fontSize: 40 }}>🤖</span>
          <div>
            <h1 className={styles.title}>Вход</h1>
            <p className={styles.sub}>RoboCode Arena</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input className={styles.input} type="email" required autoFocus
              placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Пароль</label>
            <input className={styles.input} type="password" required
              placeholder="••••••"
              value={password} onChange={e => setPassword(e.target.value)} />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ fontSize: 15 }}>
            {loading ? '⏳ Входим...' : '🔑 Войти'}
          </button>
        </form>

        <p className={styles.switch}>
          Нет аккаунта? <Link to="/register">Создать →</Link>
        </p>
        <p className={styles.switch} style={{ marginTop: 6 }}>
          <Link to="/join" style={{ color: 'var(--text-muted)', fontSize: 12 }}>← На главную</Link>
        </p>
      </div>
    </div>
  )
}
