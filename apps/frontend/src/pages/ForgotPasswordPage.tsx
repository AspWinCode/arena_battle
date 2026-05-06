import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import styles from './AuthPage.module.css'

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post<{ ok: boolean; devCode?: string; note?: string }>(
        '/user/auth/forgot-password', { email }
      )
      if (res.devCode) setDevCode(res.devCode)
      setStep('code')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirm) { setError('Пароли не совпадают'); return }
    if (newPassword.length < 6) { setError('Минимум 6 символов'); return }
    setLoading(true)
    setError('')
    try {
      await api.post('/user/auth/reset-password', { email, code, newPassword })
      setSuccess('✅ Пароль изменён! Теперь вы можете войти.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className={styles.root}>
        <div className={styles.bg}><div className={styles.glow1}/><div className={styles.glow2}/></div>
        <div className={styles.card}>
          <div className={styles.logo}>
            <span style={{ fontSize: 40 }}>✅</span>
            <div><h1 className={styles.title}>Готово!</h1><p className={styles.sub}>Пароль обновлён</p></div>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>{success}</p>
          <Link to="/login" className="btn btn-primary" style={{ display: 'block', textAlign: 'center' }}>
            🔑 Войти
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <div className={styles.bg}><div className={styles.glow1}/><div className={styles.glow2}/></div>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span style={{ fontSize: 40 }}>🔐</span>
          <div>
            <h1 className={styles.title}>Сброс пароля</h1>
            <p className={styles.sub}>RoboCode Arena</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className={styles.steps}>
          <div className={`${styles.step} ${step === 'email' ? styles.stepActive : ''}`}>1. Email</div>
          <div className={styles.stepLine} />
          <div className={`${styles.step} ${step === 'code' ? styles.stepActive : ''}`}>2. Код</div>
        </div>

        {step === 'email' && (
          <form onSubmit={handleRequestCode} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Email аккаунта</label>
              <input className={styles.input} type="email" required autoFocus
                placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '⏳ Отправляем...' : '📨 Получить код'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleReset} className={styles.form}>
            {devCode && (
              <div style={{ background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13 }}>
                <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: 4 }}>⚠️ Режим разработки</div>
                <div style={{ color: 'var(--text-muted)' }}>SMTP не настроен. Ваш код: <strong style={{ color: 'var(--text)', fontFamily: 'monospace', fontSize: 18, letterSpacing: 4 }}>{devCode}</strong></div>
              </div>
            )}
            {!devCode && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                Код отправлен на <strong>{email}</strong>. Проверьте почту.
              </p>
            )}
            <div className={styles.field}>
              <label className={styles.label}>Код подтверждения</label>
              <input className={styles.input} type="text" required autoFocus
                placeholder="123456" maxLength={6}
                style={{ fontFamily: 'monospace', fontSize: 22, letterSpacing: 8, textAlign: 'center' }}
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Новый пароль</label>
              <input className={styles.input} type="password" required
                placeholder="Минимум 6 символов"
                value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Повторите пароль</label>
              <input className={styles.input} type="password" required
                placeholder="Повторите пароль"
                value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '⏳ Сохраняем...' : '🔑 Сменить пароль'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => { setStep('email'); setError('') }}>
              ← Другой email
            </button>
          </form>
        )}

        <p className={styles.switch}>
          Вспомнили пароль? <Link to="/login">Войти →</Link>
        </p>
      </div>
    </div>
  )
}
