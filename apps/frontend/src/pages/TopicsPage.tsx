import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../stores/userStore'
import { useProgressStore } from '../stores/progressStore'
import { tasksApi } from '../api/progress'
import { DIVISION_LABELS, DIVISION_ICONS, LANGUAGE_ICONS } from '../api/progress'
import type { TopicProgress } from '../api/progress'
import type { Language } from '@robocode/shared'
import styles from './TopicsPage.module.css'

type LevelFilter = 'all' | 1 | 2 | 3

export default function TopicsPage() {
  const navigate = useNavigate()
  const { user, token } = useUserStore()
  const { topics, division, fetchTopics, fetchDivision } = useProgressStore()
  const [filter, setFilter] = useState<LevelFilter>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    Promise.all([
      fetchTopics(token),
      fetchDivision(token),
    ]).finally(() => setLoading(false))
  }, [token])

  const filtered = filter === 'all' ? topics : topics.filter(t => t.level === filter)

  const unlockedCount = topics.filter(t => t.unlocked).length
  const doneCount = topics.filter(t => t.tasksDone >= t.tasksRequired).length

  const handleTopicClick = async (topic: TopicProgress) => {
    if (!token) return
    try {
      const res = await tasksApi.getTasks(token, topic.id)
      const firstTask = res.tasks.find(t => !t.completed) ?? res.tasks[0]
      if (firstTask) {
        navigate(`/topics/${topic.id}/task/${firstTask.id}`)
      }
    } catch {
      // silent
    }
  }

  if (loading) {
    return (
      <div className={styles.root}>
        <div className={styles.bg}><div className={styles.bgGlow1}/><div className={styles.bgGlow2}/></div>
        <div className={styles.content}>
          <div className={styles.loading}>
            <div className={styles.spinner}/>
            <div>Загружаем карту тем...</div>
          </div>
        </div>
      </div>
    )
  }

  const levelsByGroup: Record<number, TopicProgress[]> = { 1: [], 2: [], 3: [] }
  filtered.forEach(t => levelsByGroup[t.level]?.push(t))

  const levelTitles = ['', 'Уровень 1 — Базовый', 'Уровень 2 — Продвинутый', 'Уровень 3 — Экспертный']

  return (
    <div className={styles.root}>
      <div className={styles.bg}>
        <div className={styles.bgGlow1}/>
        <div className={styles.bgGlow2}/>
      </div>

      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <button className={styles.back} onClick={() => navigate(-1)}>← Назад</button>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>📚 Карта тем</h1>
            <p className={styles.subtitle}>
              {LANGUAGE_ICONS[(user?.language ?? 'PYTHON') as Language]} Язык: {user?.language ?? 'Python'} · Выучи тему — открой новые возможности в бою
            </p>
          </div>
          {division && (
            <div className={styles.divBadge}>
              <span className={styles.divIcon}>{DIVISION_ICONS[division.division]}</span>
              <div>
                <div className={styles.divLabel}>{DIVISION_LABELS[division.division]}</div>
                <div className={styles.divRating}>{division.rating} очков</div>
              </div>
            </div>
          )}
        </div>

        {/* Summary stats */}
        <div className={styles.summaryBar}>
          <div className={styles.summaryStat}>
            <div className={styles.summaryNum}>{unlockedCount}</div>
            <div className={styles.summaryLabel}>тем открыто</div>
          </div>
          <div className={styles.summaryStat}>
            <div className={styles.summaryNum}>{doneCount}</div>
            <div className={styles.summaryLabel}>тем завершено</div>
          </div>
          <div className={styles.summaryStat}>
            <div className={styles.summaryNum}>{27 - unlockedCount}</div>
            <div className={styles.summaryLabel}>тем осталось</div>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          {(['all', 1, 2, 3] as LevelFilter[]).map(f => (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Все темы' : `Уровень ${f}`}
            </button>
          ))}
        </div>

        {/* Topic groups by level */}
        {([1, 2, 3] as const).map(level => {
          const items = levelsByGroup[level]
          if (!items || items.length === 0) return null
          return (
            <div key={level} className={styles.levelSection}>
              <div className={styles.levelTitle}>{levelTitles[level]}</div>
              <div className={styles.grid}>
                {items.map((topic, idx) => {
                  const isDone = topic.tasksDone >= topic.tasksRequired
                  return (
                    <div
                      key={topic.id}
                      className={`${styles.topicCard} ${topic.unlocked ? (isDone ? styles.topicDone : styles.topicUnlocked) : styles.topicLocked}`}
                      onClick={() => handleTopicClick(topic)}
                    >
                      {isDone && (
                        <>
                          <div className={styles.topicDoneStripe}/>
                          <div className={styles.topicDoneCheck}>✓</div>
                        </>
                      )}

                      <div className={styles.topicNum}>#{topics.indexOf(topic) + 1}</div>
                      <div className={styles.topicName}>{topic.label}</div>

                      <div className={styles.tasksBar}>
                        <div className={styles.tasksBarLabel}>
                          <span>Задачи</span>
                          <span>{topic.tasksDone}/{topic.tasksRequired}</span>
                        </div>
                        <div className={styles.tasksBarTrack}>
                          <div
                            className={styles.tasksBarFill}
                            style={{ width: `${Math.min(100, (topic.tasksDone / topic.tasksRequired) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className={styles.topicAction}>
                        {isDone ? '✓ Завершено' : topic.unlocked ? '▶ Решать задачи' : '▶ Практиковать'}
                      </div>
                      {!topic.unlocked && (
                        <div className={styles.topicLockHint}>🔒 Открывается после 5 побед</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
