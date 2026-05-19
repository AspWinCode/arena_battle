import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUserStore } from '../stores/userStore'
import { tasksApi } from '../api/progress'
import type { Task, TaskRunResult } from '../api/progress'
import styles from './TaskPage.module.css'

const DIFF_LABELS = ['', 'Легко', 'Средне', 'Сложно']

const CODE_TEMPLATES: Record<string, string> = {
  PYTHON: '# Напиши своё решение здесь\n\n',
  JAVASCRIPT: '// Напиши своё решение здесь\n\n',
  JAVA: '// Напиши своё решение здесь\n\n',
  CPP: '// Напиши своё решение здесь\n\n',
}

export default function TaskPage() {
  const { topicId, taskId } = useParams<{ topicId: string; taskId: string }>()
  const navigate = useNavigate()
  const { user, token } = useUserStore()

  const [task, setTask] = useState<Task | null>(null)
  const [topicTasks, setTopicTasks] = useState<Task[]>([])
  const [code, setCode] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<TaskRunResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [showHint, setShowHint] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    loadTask()
  }, [token, taskId])

  async function loadTask() {
    if (!token || !topicId || !taskId) return
    setLoading(true)
    setResult(null)
    try {
      const [taskRes, topicRes] = await Promise.all([
        tasksApi.getTask(taskId, token),
        tasksApi.getTasks(token, topicId),
      ])
      setTask(taskRes)
      setTopicTasks(topicRes.tasks)
      const lang = user?.language ?? 'PYTHON'
      setCode(CODE_TEMPLATES[lang] ?? '')
    } catch {
      navigate(`/topics`)
    } finally {
      setLoading(false)
    }
  }

  async function handleRun() {
    if (!token || !task || !code.trim()) return
    setRunning(true)
    setResult(null)
    try {
      const res = await tasksApi.submitTask(task.id, code, token)
      setResult(res)
    } catch (err) {
      setResult({
        passed: false,
        results: [],
        error: err instanceof Error ? err.message : 'Ошибка выполнения',
      })
    } finally {
      setRunning(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Tab → 4 spaces
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = textareaRef.current!
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const spaces = '    '
      const newCode = code.substring(0, start) + spaces + code.substring(end)
      setCode(newCode)
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + spaces.length
      })
    }
  }

  const currentIdx = topicTasks.findIndex(t => t.id === taskId)
  const prevTask = currentIdx > 0 ? topicTasks[currentIdx - 1] : null
  const nextTask = currentIdx >= 0 && currentIdx < topicTasks.length - 1 ? topicTasks[currentIdx + 1] : null

  if (loading) {
    return (
      <div className={styles.root}>
        <div className={styles.bg}><div className={styles.bgGlow1}/><div className={styles.bgGlow2}/></div>
        <div className={styles.loading}>
          <div className={styles.spinner}/>
          <span>Загружаем задачу...</span>
        </div>
      </div>
    )
  }

  if (!task) return null

  return (
    <div className={styles.root}>
      <div className={styles.bg}><div className={styles.bgGlow1}/><div className={styles.bgGlow2}/></div>

      <div className={styles.content}>
        {/* Nav */}
        <div className={styles.nav}>
          <button className={styles.back} onClick={() => navigate('/topics')}>← Карта тем</button>
          <span className={styles.breadcrumb}>
            {topicId} · <span>Задача {currentIdx + 1} из {topicTasks.length}</span>
          </span>
        </div>

        {/* Task header */}
        <div className={styles.taskHeader}>
          <div>
            <h1 className={styles.taskTitle}>{task.title}</h1>
            <div className={styles.taskMeta}>
              <span className={styles.badge + ' ' + styles.badgeTopic}>{task.topic}</span>
              <span className={styles.badge + ' ' + (styles as any)[`badgeDiff${task.difficulty}`]}>
                {DIFF_LABELS[task.difficulty] ?? 'Средне'}
              </span>
              {task.completed && <span className={styles.badge + ' ' + styles.badgeTopic}>✓ Решено</span>}
            </div>
          </div>
          {/* Task navigation */}
          <div className={styles.taskCounter}>
            <button
              className={styles.counterBtn}
              disabled={!prevTask}
              onClick={() => prevTask && navigate(`/topics/${topicId}/task/${prevTask.id}`)}
            >← Пред</button>
            <span className={styles.counterLabel}>{currentIdx + 1}/{topicTasks.length}</span>
            <button
              className={styles.counterBtn}
              disabled={!nextTask}
              onClick={() => nextTask && navigate(`/topics/${topicId}/task/${nextTask.id}`)}
            >След →</button>
          </div>
        </div>

        {/* Main layout */}
        <div className={styles.layout}>
          {/* Left: description */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              📋 Условие задачи
              {task.hint && (
                <button
                  className={styles.back}
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => setShowHint(s => !s)}
                >
                  💡 {showHint ? 'Скрыть подсказку' : 'Подсказка'}
                </button>
              )}
            </div>
            <div className={styles.panelBody}>
              <div className={styles.description}>{task.description}</div>
              {showHint && task.hint && (
                <div className={styles.hint}>
                  <div className={styles.hintLabel}>💡 Подсказка:</div>
                  {task.hint}
                </div>
              )}
            </div>
          </div>

          {/* Right: editor + results */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              ✏️ Редактор кода
            </div>
            <div className={styles.editorWrap}>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                value={code}
                onChange={e => setCode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="# Напиши свой код здесь..."
                spellCheck={false}
              />
            </div>
            <div className={styles.runBar}>
              <button
                className={styles.runBtn}
                onClick={handleRun}
                disabled={running || !code.trim()}
              >
                {running ? '⏳ Запуск...' : '▶ Запустить'}
              </button>
              {result && !result.passed && (
                <span className={styles.runStatus}>
                  {result.results.filter(r => r.passed).length}/{result.results.length} тестов прошло
                </span>
              )}
            </div>

            {/* Results */}
            {result && (
              <div className={styles.panelBody} style={{ borderTop: '1px solid var(--border)' }}>
                {result.passed ? (
                  <div className={styles.successBanner}>
                    <div className={styles.successTitle}>✅ Все тесты пройдены!</div>
                    {result.topicUnlocked && (
                      <div className={styles.topicUnlockedBadge}>
                        🎉 Тема «{result.topicUnlocked}» открыта! Новые возможности в бою.
                      </div>
                    )}
                    <div className={styles.successActions}>
                      {nextTask && (
                        <button
                          className={styles.btnNext}
                          onClick={() => navigate(`/topics/${topicId}/task/${nextTask.id}`)}
                        >
                          Следующая задача →
                        </button>
                      )}
                      <button
                        className={styles.btnBack}
                        onClick={() => navigate('/topics')}
                      >
                        К карте тем
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.results}>
                    {result.error && (
                      <div className={styles.resultItem + ' ' + styles.resultFail}>
                        <div className={styles.resultError}>Ошибка: {result.error}</div>
                      </div>
                    )}
                    {result.results.map((r, i) => (
                      <div
                        key={i}
                        className={styles.resultItem + ' ' + (r.passed ? styles.resultPass : styles.resultFail)}
                      >
                        <div className={styles.resultRow}>
                          <span className={styles.resultIcon}>{r.passed ? '✅' : '❌'}</span>
                          <span className={styles.resultLabel}>Тест {i + 1}:</span>
                          <span className={styles.resultValue}>{r.passed ? 'Пройден' : 'Не пройден'}</span>
                        </div>
                        {!r.passed && (
                          <>
                            <div className={styles.resultRow} style={{ marginTop: 6 }}>
                              <span className={styles.resultIcon}/>
                              <span className={styles.resultLabel}>Ожидалось:</span>
                              <span className={styles.resultExpected}>{JSON.stringify(r.expected)}</span>
                            </div>
                            <div className={styles.resultRow}>
                              <span className={styles.resultIcon}/>
                              <span className={styles.resultLabel}>Получено:</span>
                              <span className={styles.resultActual}>{JSON.stringify(r.actual)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
