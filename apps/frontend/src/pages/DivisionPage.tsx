import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../stores/userStore'
import { useProgressStore } from '../stores/progressStore'
import { DIVISION_LABELS, DIVISION_ICONS, LANGUAGE_LABELS, LANGUAGE_ICONS } from '../api/progress'
import type { Division } from '@robocode/shared'
import styles from './DivisionPage.module.css'

const DIVISION_FEATURES: Record<Division, Array<{ icon: string; name: string; desc: string }>> = {
  DIVISION_2: [
    { icon: '🧱', name: 'Блочный редактор', desc: 'Визуальное программирование без ввода кода' },
    { icon: '⚔️', name: 'Базовые действия', desc: 'attack, dodge, shield' },
    { icon: '🤖', name: 'Боты', desc: 'Тренируйся против ИИ-противников' },
  ],
  DIVISION_1: [
    { icon: '📝', name: 'Текстовый редактор', desc: 'Пишешь настоящий код (до 100 строк)' },
    { icon: '🔥', name: 'Расширенные действия', desc: 'combo, laser, trap, repair' },
    { icon: '📜', name: 'История боёв', desc: 'my_history, enemy_history — после 5 тем' },
    { icon: '📊', name: 'Лог раундов', desc: 'round_log — после 11 тем' },
  ],
  PREMIER_LEAGUE: [
    { icon: '♾️', name: 'Без ограничений кода', desc: '500 строк, все действия' },
    { icon: '🧠', name: 'Объект state', desc: 'Хранилище данных между раундами' },
    { icon: '⚡', name: 'Боевые функции', desc: 'attack(), shield(), combo()...' },
    { icon: '🏆', name: 'Эло-рейтинг', desc: 'Матчмейкинг только среди живых игроков' },
    { icon: '🌙', name: 'Асинхронные бои', desc: 'Отправляй стратегию, бои проходят ночью' },
  ],
}

export default function DivisionPage() {
  const navigate = useNavigate()
  const { token } = useUserStore()
  const { division, fetchDivision } = useProgressStore()

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    fetchDivision(token)
  }, [token])

  if (!division) {
    return (
      <div className={styles.root}>
        <div className={styles.bg}><div className={styles.bgGlow1}/><div className={styles.bgGlow2}/></div>
        <div className={styles.loading}><div className={styles.spinner}/><span>Загружаем дивизион...</span></div>
      </div>
    )
  }

  const d = division
  const p = d.progressToNext
  const features = DIVISION_FEATURES[d.division] ?? []

  return (
    <div className={styles.root}>
      <div className={styles.bg}><div className={styles.bgGlow1}/><div className={styles.bgGlow2}/></div>

      <div className={styles.content}>
        <div className={styles.header}>
          <button className={styles.back} onClick={() => navigate(-1)}>← Назад</button>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>🏅 Мой дивизион</h1>
            <p className={styles.subtitle}>Прогресс, условия перехода и доступные возможности</p>
          </div>
        </div>

        {/* Division hero */}
        <div className={styles.divHero}>
          <div className={styles.divHeroIcon}>{DIVISION_ICONS[d.division]}</div>
          <div className={styles.divHeroInfo}>
            <div className={styles.divHeroName}>{DIVISION_LABELS[d.division]}</div>
            <div className={styles.divHeroStats}>
              <span>{LANGUAGE_ICONS[d.language]} {LANGUAGE_LABELS[d.language]}</span>
              <span>⭐ <strong>{d.rating}</strong> очков</span>
              <span>🏆 <strong>{d.totalWins}</strong> побед</span>
              <span>📚 <strong>{d.topicsUnlocked}</strong> тем открыто</span>
            </div>
          </div>
        </div>

        {/* Progress to next or premier */}
        {d.division === 'PREMIER_LEAGUE' ? (
          <div className={styles.premierCard}>
            <div className={styles.premierIcon}>👑</div>
            <div className={styles.premierTitle}>Ты в Высшей лиге!</div>
            <div className={styles.premierText}>
              Дальше некуда — ты уже среди лучших.<br/>
              Рейтинг сбрасывается раз в 3 месяца, дивизион остаётся.
            </div>
          </div>
        ) : p ? (
          <div className={styles.nextCard}>
            <div className={styles.nextTitle}>
              <span className={styles.nextArrow}>↑</span>
              Прогресс к{' '}
              {d.division === 'DIVISION_2' ? '1-му дивизиону' : 'Высшей лиге'}
            </div>

            <div className={styles.progressRow}>
              <span className={styles.progressLabel}>Рейтинг</span>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${Math.min(100, (p.ratingProgress / p.ratingThreshold) * 100)}%` }}
                />
              </div>
              <span className={styles.progressValue}>{p.ratingProgress} / {p.ratingThreshold}</span>
            </div>

            <div className={styles.progressRow}>
              <span className={styles.progressLabel}>Победы</span>
              <div className={styles.progressTrack}>
                <div
                  className={`${styles.progressFill} ${styles.progressFillOrange}`}
                  style={{ width: `${Math.min(100, (p.winsProgress / p.winsThreshold) * 100)}%` }}
                />
              </div>
              <span className={styles.progressValue}>{p.winsProgress} / {p.winsThreshold}</span>
            </div>

            {p.topicsThreshold != null && p.topicsProgress != null && (
              <div className={styles.progressRow}>
                <span className={styles.progressLabel}>Темы</span>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${Math.min(100, (p.topicsProgress / p.topicsThreshold) * 100)}%`,
                      background: 'linear-gradient(90deg, #a78bfa, #818cf8)',
                    }}
                  />
                </div>
                <span className={styles.progressValue}>{p.topicsProgress} / {p.topicsThreshold}</span>
              </div>
            )}

            <div className={styles.overallPct}>{p.percentComplete}%</div>
            <div className={styles.overallLabel}>до следующего дивизиона</div>
          </div>
        ) : null}

        {/* Quick actions */}
        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={() => navigate('/play')}>
            ⚔️ В бой
          </button>
          <button className={styles.btnSecondary} onClick={() => navigate('/topics')}>
            📚 Карта тем
          </button>
          <button className={styles.btnSecondary} onClick={() => navigate('/leaderboard')}>
            🏆 Рейтинг
          </button>
        </div>

        {/* Features of current division */}
        <div className={styles.featuresCard}>
          <div className={styles.featuresTitle}>⚙️ Возможности текущего дивизиона</div>
          {features.map((f, i) => (
            <div key={i} className={styles.featureRow}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <div>
                <div className={styles.featureName}>{f.name}</div>
                <div className={styles.featureDesc}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
