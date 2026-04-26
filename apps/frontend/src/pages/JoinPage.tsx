import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SkinId, JoinSessionResponse } from '@robocode/shared'
import { api } from '../api/client'
import { useBattleStore } from '../stores/battleStore'
import styles from './JoinPage.module.css'

const SKINS: { id: SkinId; label: string; icon: string; color: string }[] = [
  { id: 'robot',     label: 'Робот',     icon: '🤖', color: '#00e5ff' },
  { id: 'gladiator', label: 'Гладиатор', icon: '⚔️', color: '#d97706' },
  { id: 'boxer',     label: 'Боксёр',    icon: '🥊', color: '#e6261f' },
  { id: 'cosmonaut', label: 'Космонавт', icon: '🚀', color: '#f0f9ff' },
]

export default function JoinPage() {
  const navigate = useNavigate()
  const setSession = useBattleStore(s => s.setSession)

  const [name, setName]         = useState('')
  const [code, setCode]         = useState('')
  const [skin, setSkin]         = useState<SkinId>('robot')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleCodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value.toUpperCase().slice(0, 6))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || code.length !== 6) return

    setLoading(true)
    setError('')

    try {
      const res = await api.post<JoinSessionResponse>('/session/join', {
        sessionCode: code,
        name: name.trim(),
        skin,
      })

      setSession(res.sessionId, res.playerSlot, 'code', ['robot', 'gladiator', 'boxer', 'cosmonaut'], res.wsToken)
      navigate(`/battle/${res.sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка подключения')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.bg}>
        <div className={styles.bgGlow1} />
        <div className={styles.bgGlow2} />
        <div className={styles.grid} />
      </div>

      <div className={styles.container}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🤖</span>
          <div>
            <h1 className={styles.logoTitle}>RoboCode Arena</h1>
            <p className={styles.logoSub}>Учись программировать в бою</p>
          </div>
        </div>

        <form className={styles.card} onSubmit={handleSubmit}>
          <h2 className={styles.formTitle}>Войти в битву</h2>

          <div className={styles.field}>
            <label className={styles.label}>Твоё имя</label>
            <input
              type="text"
              className={styles.input}
              placeholder="Введи имя бойца..."
              value={name}
              onChange={e => setName(e.target.value.slice(0, 20))}
              maxLength={20}
              required
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Код сессии</label>
            <input
              type="text"
              className={`${styles.input} ${styles.codeInput}`}
              placeholder="XXXXXX"
              value={code}
              onChange={handleCodeInput}
              maxLength={6}
              required
              autoComplete="off"
              spellCheck={false}
            />
            <span className={styles.codeHint}>{code.length}/6</span>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Выбери бойца</label>
            <div className={styles.skins}>
              {SKINS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className={`${styles.skinCard} ${skin === s.id ? styles.skinSelected : ''}`}
                  style={{ '--skin-color': s.color } as React.CSSProperties}
                  onClick={() => setSkin(s.id)}
                >
                  <span className={styles.skinIcon}>{s.icon}</span>
                  <span className={styles.skinLabel}>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="submit"
            className={`btn btn-primary ${styles.submitBtn}`}
            disabled={loading || !name.trim() || code.length !== 6}
          >
            {loading ? (
              <><span className="animate-spin" style={{ display: 'inline-block' }}>⚙️</span> Подключение...</>
            ) : (
              '⚔️ ПОДКЛЮЧИТЬСЯ'
            )}
          </button>
        </form>

        <p className={styles.adminLink}>
          Организатор? <a href="/admin">Панель управления →</a>
        </p>
      </div>
    </div>
  )
}
