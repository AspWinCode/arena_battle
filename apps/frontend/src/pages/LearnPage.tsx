import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MISSIONS, SKIN_ICON } from '@robocode/shared'
import { useLearnStore } from '../stores/learnStore'
import { useProgressStore } from '../stores/progressStore'
import { useUserStore } from '../stores/userStore'
import TheorySection from './learn/TheorySection'
import styles from './LearnPage.module.css'

const DIFF_LABEL = ['', 'Легко', 'Легко', 'Средне', 'Сложно', 'Босс']
const DIFF_COLOR = ['', '#4ade80', '#4ade80', '#facc15', '#f97316', '#f43f5e']

// Связка миссий с темами для практики
const MISSION_TOPICS: Record<string, { id: string; label: string }> = {
  'mission-01': { id: 'IF_ELSE_ELIF', label: 'If / Else / Elif' },
  'mission-02': { id: 'LOGIC',        label: 'Логические операции' },
  'mission-03': { id: 'IF_ELSE_ELIF', label: 'If / Else / Elif' },
  'mission-04': { id: 'ARRAYS_1D',    label: 'Одномерные массивы' },
  'mission-05': { id: 'ARITHMETIC',   label: 'Арифметика' },
  'mission-06': { id: 'IF_ELSE_ELIF', label: 'If / Else / Elif' },
  'mission-07': { id: 'FOR_LOOP',     label: 'Цикл for' },
  'mission-08': { id: 'WHILE_LOOP',   label: 'Цикл while' },
  'mission-09': { id: 'DICTS',        label: 'Словари' },
  'mission-10': { id: 'NESTED_LOOPS', label: 'Вложенные циклы' },
}


export default function LearnPage() {
  const navigate = useNavigate()
  const progress = useLearnStore(s => s.progress)
  const { token } = useUserStore()
  const { topics, fetchTopics } = useProgressStore()

  useEffect(() => {
    if (token) fetchTopics(token)
  }, [token, fetchTopics])

  const totalCompleted = MISSIONS.filter(m => progress[m.id]?.completed).length
  const unlockedCount  = topics.filter(t => t.unlocked).length
  const totalTopics    = topics.length || 27

  // Group topics by level for the mini-grid (show first 9 max)
  const topicPreview = topics.slice(0, 9)

  return (
    <div className={styles.root}>
      <div className={styles.bg}>
        <div className={styles.bgGlow1} />
        <div className={styles.bgGlow2} />
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <button className={styles.back} onClick={() => navigate(-1)}>← Назад</button>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>🎓 Режим обучения</h1>
          </div>
          <p className={styles.subtitle}>Изучай теорию, решай задачи, сражайся — открывай новые возможности</p>
        </div>

        {/* ── Теория ────────────────────────────────────────────── */}
        <TheorySection />

        {/* ── Карта тем ─────────────────────────────────────────── */}
        <div className={styles.topicsSection}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>📚 Карта тем</h2>
            <span className={styles.sectionBadge}>{unlockedCount} / {totalTopics} разблокировано</span>
          </div>

          <div className={styles.topicsProgressBar}>
            <div
              className={styles.topicsProgressFill}
              style={{ width: `${totalTopics > 0 ? (unlockedCount / totalTopics) * 100 : 0}%` }}
            />
          </div>

          {topicPreview.length > 0 ? (
            <div className={styles.topicsGrid}>
              {topicPreview.map(t => (
                <Link
                  key={t.id}
                  to={`/topics`}
                  className={`${styles.topicChip} ${t.unlocked ? styles.topicChipUnlocked : styles.topicChipLocked}`}
                >
                  <span className={styles.topicChipDot} />
                  <span className={styles.topicChipLabel}>{t.label}</span>
                  {t.unlocked && t.tasksDone >= t.tasksRequired && (
                    <span className={styles.topicChipDone}>✓</span>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <p className={styles.topicsHint}>Войди в аккаунт чтобы увидеть прогресс по темам</p>
          )}

          <div className={styles.topicsActions}>
            <Link to="/topics" className="btn btn-primary" style={{ fontSize: 13 }}>
              📚 Открыть карту тем →
            </Link>
            <Link to="/division" className="btn btn-ghost" style={{ fontSize: 13 }}>
              🏆 Мой дивизион
            </Link>
          </div>
        </div>

        {/* ── Боевые миссии ─────────────────────────────────────── */}
        <div className={styles.sectionHead} style={{ marginTop: 8 }}>
          <h2 className={styles.sectionTitle}>⚔️ Боевые миссии</h2>
          <span className={styles.sectionBadge}>{totalCompleted} / {MISSIONS.length} пройдено</span>
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

                  {MISSION_TOPICS[m.id] && !locked && (
                    <Link
                      to="/topics"
                      className={styles.missionTopicChip}
                      onClick={e => e.stopPropagation()}
                    >
                      📚 {MISSION_TOPICS[m.id].label}
                    </Link>
                  )}

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
