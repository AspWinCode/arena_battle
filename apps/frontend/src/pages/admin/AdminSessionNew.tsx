import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../../api/client'
import { useAdminStore } from '../../stores/adminStore'
import styles from './AdminSessionNew.module.css'

interface CreatedSession {
  id: string
  code1: string
  code2: string
  name: string
}

export default function AdminSessionNew() {
  const token    = useAdminStore(s => s.accessToken)
  const navigate = useNavigate()

  const [name, setName]           = useState('')
  const [level, setLevel]         = useState<'BLOCKS' | 'CODE' | 'PRO'>('CODE')
  const [lang, setLang]           = useState('js')
  const [format, setFormat]       = useState<'bo1' | 'bo3' | 'bo5'>('bo3')
  const [timeLimit, setTimeLimit] = useState(10)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [created, setCreated]     = useState<CreatedSession | null>(null)
  const [qrModal, setQrModal]     = useState<{ code: string; player: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post<CreatedSession>('/session', {
        name,
        level,
        lang: lang === 'auto' ? undefined : lang,
        format,
        timeLimit,
      }, token ?? undefined)
      setCreated(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания')
    } finally {
      setLoading(false)
    }
  }

  if (created) {
    const joinBase = `${window.location.origin}/join`

    return (
      <div className={styles.root}>
        {/* QR Modal */}
        {qrModal && (
          <div className={styles.qrOverlay} onClick={() => setQrModal(null)}>
            <div className={styles.qrModal} onClick={e => e.stopPropagation()}>
              <div className={styles.qrTitle}>QR — {qrModal.player}</div>
              <div className={styles.qrCode}>
                <QRCodeSVG
                  value={`${joinBase}?code=${qrModal.code}`}
                  size={220}
                  bgColor="#ffffff"
                  fgColor="#0a0a1a"
                  level="M"
                />
              </div>
              <div className={styles.qrCodeText}>{qrModal.code}</div>
              <div className={styles.qrHint}>Наведи камеру телефона для перехода</div>
              <button className="btn btn-ghost" onClick={() => setQrModal(null)}>✕ Закрыть</button>
            </div>
          </div>
        )}

        <div className={styles.successCard}>
          <div className={styles.successIcon}>🎉</div>
          <h2 className={styles.successTitle}>Сессия создана!</h2>
          <p className={styles.successSubtitle}>Раздайте коды игрокам</p>

          <div className={styles.codesGrid}>
            {[{ label: 'Игрок 1', code: created.code1 }, { label: 'Игрок 2', code: created.code2 }].map(({ label, code }) => (
              <div key={code} className={styles.codeBox}>
                <div className={styles.codeLabel}>{label}</div>
                <div className={styles.bigCode}>{code}</div>
                <div className={styles.codeActions}>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12 }}
                    onClick={() => navigator.clipboard.writeText(code)}
                  >
                    📋 Скопировать
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12 }}
                    onClick={() => setQrModal({ code, player: label })}
                  >
                    📱 QR-код
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.successActions}>
            <Link to={`/admin/session/${created.id}`} className="btn btn-primary">
              📊 Наблюдать за сессией
            </Link>
            <button className="btn btn-ghost" onClick={() => setCreated(null)}>
              + Ещё одна
            </button>
            <Link to="/admin" className="btn btn-ghost">← Дашборд</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <div className={styles.container}>
        <div className={styles.header}>
          <Link to="/admin" className={styles.back}>← Дашборд</Link>
          <h1 className={styles.title}>Новая сессия</h1>
        </div>

        <form className={styles.card} onSubmit={handleSubmit}>
          {/* Name */}
          <div className={styles.field}>
            <label className={styles.label}>Название сессии</label>
            <input
              type="text"
              className={styles.input}
              placeholder="Урок 3, 6А класс"
              value={name}
              onChange={e => setName(e.target.value.slice(0, 50))}
              maxLength={50}
              required
              autoFocus
            />
          </div>

          {/* Level */}
          <div className={styles.field}>
            <label className={styles.label}>Уровень сложности</label>
            <div className={styles.levelGrid}>
              {([['BLOCKS', '🧩 Блоки', '1–5 класс', 'Drag & drop редактор'], ['CODE', '💻 Код', '6–11 класс', 'Текстовый редактор'], ['PRO', '⚡ Про', 'Продвинутые', 'Без ограничений']] as const).map(([val, icon, grade, desc]) => (
                <button
                  key={val}
                  type="button"
                  className={`${styles.levelCard} ${level === val ? styles.levelSelected : ''}`}
                  onClick={() => setLevel(val)}
                >
                  <div className={styles.levelIcon}>{icon}</div>
                  <div className={styles.levelGrade}>{grade}</div>
                  <div className={styles.levelDesc}>{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Lang (only for CODE/PRO) */}
          {level !== 'BLOCKS' && (
            <div className={styles.field}>
              <label className={styles.label}>Язык программирования</label>
              <select className={styles.select} value={lang} onChange={e => setLang(e.target.value)}>
                <option value="auto">🔀 Выбор игрока</option>
                <option value="js">JavaScript</option>
                <option value="py">Python</option>
                <option value="cpp">C++</option>
                <option value="java">Java</option>
              </select>
            </div>
          )}

          {/* Format */}
          <div className={styles.field}>
            <label className={styles.label}>Формат матча</label>
            <div className={styles.formatRow}>
              {([['bo1', 'BO1', '1 раунд'], ['bo3', 'BO3', 'До 3 раундов'], ['bo5', 'BO5', 'До 5 раундов']] as const).map(([val, label, desc]) => (
                <button
                  key={val}
                  type="button"
                  className={`${styles.formatBtn} ${format === val ? styles.formatSelected : ''}`}
                  onClick={() => setFormat(val)}
                >
                  <span className={styles.formatLabel}>{label}</span>
                  <span className={styles.formatDesc}>{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Time limit */}
          <div className={styles.field}>
            <label className={styles.label}>Время на написание кода: <strong>{timeLimit} мин</strong></label>
            <input
              type="range"
              min={5} max={30} step={5}
              value={timeLimit}
              onChange={e => setTimeLimit(Number(e.target.value))}
              className={styles.range}
            />
            <div className={styles.rangeLabels}>
              {[5, 10, 15, 20, 25, 30].map(v => (
                <span key={v} className={styles.rangeLabel} style={{ flex: 1, textAlign: 'center' }}>{v}</span>
              ))}
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="submit"
            className={`btn btn-primary ${styles.submitBtn}`}
            disabled={loading || !name.trim()}
          >
            {loading ? '⏳ Создаём...' : '⚔️ Создать сессию'}
          </button>
        </form>
      </div>
    </div>
  )
}
