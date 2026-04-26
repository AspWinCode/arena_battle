import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useAdminStore } from '../../stores/adminStore'
import styles from './AdminLoginPage.module.css'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const setToken = useAdminStore(s => s.setToken)

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post<{ accessToken: string }>('/auth/login', { email, password })
      setToken(res.accessToken)
      navigate('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка авторизации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.root}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <div className={styles.logo}>
          <span>🤖</span>
          <span>RoboCode Admin</span>
        </div>

        <h2 className={styles.title}>Вход в панель</h2>

        <div className={styles.field}>
          <label className={styles.label}>Email</label>
          <input
            type="email"
            className={styles.input}
            placeholder="admin@school.ru"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Пароль</label>
          <input
            type="password"
            className={styles.input}
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button type="submit" className={`btn btn-primary ${styles.btn}`} disabled={loading}>
          {loading ? '⏳ Входим...' : '🔐 Войти'}
        </button>

        <p className={styles.hint}>
          Нет аккаунта? Создайте через API: <code>POST /api/v1/auth/seed-admin</code>
        </p>
      </form>
    </div>
  )
}
