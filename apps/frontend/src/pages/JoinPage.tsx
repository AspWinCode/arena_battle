import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SkinId, JoinSessionResponse } from '@robocode/shared'
import { CHARACTER_STATS } from '@robocode/shared'
import { api } from '../api/client'
import { useBattleStore } from '../stores/battleStore'
import { useUserStore } from '../stores/userStore'
import UserMenu from '../components/UserMenu'
import styles from './JoinPage.module.css'

const ALL_SKIN_IDS: SkinId[] = [
  'robot', 'gladiator', 'boxer', 'cosmonaut',
  'ninja', 'mage', 'paladin', 'sniper',
  'tank', 'vampire', 'samurai', 'phantom',
  'engineer', 'berserker',
]
const SKINS = ALL_SKIN_IDS.map(id => ({
  id,
  label: CHARACTER_STATS[id].name,
  icon:  CHARACTER_STATS[id].icon,
  color: CHARACTER_STATS[id].color,
}))

export default function JoinPage() {
  const navigate   = useNavigate()
  const setSession = useBattleStore(s => s.setSession)
  const { user, token } = useUserStore()

  const [name, setName]         = useState('')
  const [code, setCode]         = useState('')
  const [skin, setSkin]         = useState<SkinId>('robot')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  // Pre-fill from user profile if logged in
  useEffect(() => {
    if (user) {
      if (!name) setName(user.displayName)
      setSkin((user.preferredSkin as SkinId) ?? 'robot')
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

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
      }, token ?? undefined)

      // 'code' level is a placeholder — real level arrives via WS 'connected' message
      setSession(res.sessionId, res.playerSlot, 'code', ALL_SKIN_IDS, res.wsToken, name.trim(), skin)
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

            {/* Character stats panel */}
            {(() => {
              const ch    = CHARACTER_STATS[skin]
              const skinMeta = SKINS.find(s => s.id === skin)!
              // Normalise bars: HP out of 120, dmg out of 1.35, rage out of 1.5
              const hpPct  = Math.round((ch.maxHp / 120) * 100)
              const dmgPct = Math.round((ch.dmgMult / 1.35) * 100)
              const ragePct = Math.round((ch.rageMult / 1.5) * 100)
              return (
                <div className={styles.charPanel} style={{ borderColor: `${skinMeta.color}44` }}>
                  <div className={styles.charPanelHeader}>
                    <span className={styles.charPanelIcon}>{ch.icon}</span>
                    <div>
                      <div className={styles.charPanelName} style={{ color: skinMeta.color }}>{ch.name}</div>
                      <div className={styles.charPanelTagline}>{ch.tagline}</div>
                    </div>
                  </div>

                  <div className={styles.charStats}>
                    <div className={styles.charStat}>
                      <span className={styles.charStatLabel}>HP</span>
                      <div className={styles.charStatBar}>
                        <div className={styles.charStatFill} style={{ width: `${hpPct}%`, background: '#4ade80' }} />
                      </div>
                      <span className={styles.charStatValue}>{ch.maxHp}</span>
                    </div>
                    <div className={styles.charStat}>
                      <span className={styles.charStatLabel}>Урон</span>
                      <div className={styles.charStatBar}>
                        <div className={styles.charStatFill} style={{ width: `${dmgPct}%`, background: '#f87171' }} />
                      </div>
                      <span className={styles.charStatValue}>×{ch.dmgMult.toFixed(2)}</span>
                    </div>
                    <div className={styles.charStat}>
                      <span className={styles.charStatLabel}>Ярость</span>
                      <div className={styles.charStatBar}>
                        <div className={styles.charStatFill} style={{ width: `${ragePct}%`, background: '#fbbf24' }} />
                      </div>
                      <span className={styles.charStatValue}>×{ch.rageMult.toFixed(1)}</span>
                    </div>
                  </div>

                  <div className={styles.charPassive}>{ch.passive}</div>
                </div>
              )
            })()}
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

        <div className={styles.bottomLinks}>
          <div className={styles.publicLinks}>
            <a href="/learn" className={styles.learnLink}>🎓 Обучение</a>
            <a href="/sparring" className={styles.learnLink}>🥊 Спарринг</a>
            <a href="/daily" className={styles.learnLink}>📅 Задания</a>
            <a href="/leaderboard" className={styles.learnLink}>🏆 Рейтинг</a>
            <a href="/tournaments" className={styles.tournamentLink}>🏟 Турниры</a>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <UserMenu />
          </div>
          <p className={styles.adminLink}>
            Организатор? <a href="/admin">Панель управления →</a>
          </p>
        </div>
      </div>
    </div>
  )
}
