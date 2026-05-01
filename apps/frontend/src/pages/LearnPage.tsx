import { Link } from 'react-router-dom'
import { MISSIONS } from '@robocode/shared'
import { useLearnStore } from '../stores/learnStore'
import styles from './LearnPage.module.css'

const SKIN_ICON: Record<string, string> = {
  robot: '🤖', gladiator: '⚔️', boxer: '🥊', cosmonaut: '🚀',
}

const DIFF_LABEL = ['', 'Легко', 'Легко', 'Средне', 'Сложно', 'Босс']
const DIFF_COLOR = ['', '#4ade80', '#4ade80', '#facc15', '#f97316', '#f43f5e']

export default function LearnPage() {
  const progress = useLearnStore(s => s.progress)

  const totalCompleted = MISSIONS.filter(m => progress[m.id]?.completed).length

  return (
    <div className={styles.root}>
      <div className={styles.bg}>
        <div className={styles.bgGlow1} />
        <div className={styles.bgGlow2} />
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <Link to="/join" className={styles.back}>← Назад</Link>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>🎓 Режим обучения</h1>
            <span className={styles.progress}>{totalCompleted} / {MISSIONS.length} миссий</span>
          </div>
          <p className={styles.subtitle}>Пройди 10 миссий и стань мастером программирования!</p>
          <div className={styles.sparringLink}>
            <Link to="/sparring" className="btn btn-ghost" style={{ fontSize: 13 }}>
              🥊 Спарринг с ботами →
            </Link>
          </div>
        </div>

        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${(totalCompleted / MISSIONS.length) * 100}%` }}
          />
        </div>

        <div className={styles.grid}>
          {MISSIONS.map((m, i) => {
            const p = progress[m.id]
            const prevDone = i === 0 || progress[MISSIONS[i - 1].id]?.completed
            const locked = !prevDone && !p?.completed

            return (
              <div key={m.id} className={`${styles.card} ${locked ? styles.cardLocked : ''} ${p?.completed ? styles.cardDone : ''}`}>
                <div className={styles.cardNum}>#{m.order}</div>

                <div className={styles.cardOpponent}>
                  <span className={styles.opponentIcon}>{SKIN_ICON[m.opponentSkin]}</span>
                </div>

                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{m.title}</h3>
                  <p className={styles.cardDesc}>{m.description}</p>

                  <div className={styles.cardMeta}>
                    <span
                      className={styles.diffBadge}
                      style={{ color: DIFF_COLOR[m.difficulty], borderColor: DIFF_COLOR[m.difficulty] }}
                    >
                      {DIFF_LABEL[m.difficulty]}
                    </span>
                    <span className={styles.diffDots}>
                      {Array.from({ length: 5 }, (_, j) => (
                        <span
                          key={j}
                          className={styles.dot}
                          style={{ background: j < m.difficulty ? DIFF_COLOR[m.difficulty] : 'var(--border)' }}
                        />
                      ))}
                    </span>
                  </div>

                  {p?.completed && (
                    <div className={styles.stars}>
                      {Array.from({ length: 3 }, (_, j) => (
                        <span key={j} style={{ opacity: j < (p.stars ?? 0) ? 1 : 0.2 }}>⭐</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.cardFooter}>
                  {locked ? (
                    <span className={styles.lockMsg}>🔒 Пройди предыдущую</span>
                  ) : (
                    <Link to={`/learn/${m.id}`} className="btn btn-primary" style={{ fontSize: 13 }}>
                      {p?.completed ? '🔄 Переиграть' : '▶ Начать'}
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
