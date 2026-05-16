import { useState, useEffect } from 'react'
import { THEORY_LESSONS, type TheoryLesson, type LessonBlock } from './theory'
import { useLearnStore } from '../../stores/learnStore'
import styles from './TheorySection.module.css'

export default function TheorySection() {
  const theoryProgress = useLearnStore(s => s.theoryProgress)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const completedCount = THEORY_LESSONS.filter(l => theoryProgress[l.id]).length

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>📚 Теория</h2>
        <span className={styles.sectionProgress}>
          {completedCount} / {THEORY_LESSONS.length} уроков пройдено
        </span>
      </div>

      <div className={styles.grid}>
        {THEORY_LESSONS.map((lesson, i) => {
          const done = !!theoryProgress[lesson.id]
          return (
            <button
              key={lesson.id}
              className={`${styles.card} ${done ? styles.cardDone : ''}`}
              onClick={() => setActiveIdx(i)}
            >
              <div className={styles.cardHead}>
                <span className={styles.cardIcon}>{lesson.icon}</span>
                <h3 className={styles.cardTitle}>{lesson.title}</h3>
                {done && <span className={styles.cardCheck}>✓</span>}
              </div>
              <p className={styles.cardSubtitle}>{lesson.subtitle}</p>
              <span className={styles.cardCta}>
                {done ? 'Открыть снова →' : 'Изучить →'}
              </span>
            </button>
          )
        })}
      </div>

      {activeIdx !== null && (
        <LessonModal
          lesson={THEORY_LESSONS[activeIdx]}
          stepIdx={activeIdx}
          totalSteps={THEORY_LESSONS.length}
          onClose={() => setActiveIdx(null)}
          onPrev={activeIdx > 0 ? () => setActiveIdx(activeIdx - 1) : undefined}
          onNext={activeIdx < THEORY_LESSONS.length - 1 ? () => setActiveIdx(activeIdx + 1) : undefined}
        />
      )}
    </section>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────────

interface ModalProps {
  lesson: TheoryLesson
  stepIdx: number
  totalSteps: number
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}

function LessonModal({ lesson, stepIdx, totalSteps, onClose, onPrev, onNext }: ModalProps) {
  const markTheoryRead = useLearnStore(s => s.markTheoryRead)
  const done = useLearnStore(s => !!s.theoryProgress[lesson.id])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && onPrev) onPrev()
      else if (e.key === 'ArrowRight' && onNext) onNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, onPrev, onNext])

  const handleUnderstood = () => {
    markTheoryRead(lesson.id)
    if (onNext) onNext()
    else onClose()
  }

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <span className={styles.modalIcon}>{lesson.icon}</span>
          <div className={styles.modalTitleGroup}>
            <h3 className={styles.modalTitle}>{lesson.title}</h3>
            <p className={styles.modalSubtitle}>{lesson.subtitle}</p>
          </div>
          <button className={styles.modalClose} onClick={onClose} title="Закрыть (Esc)">✕</button>
        </div>

        <div className={styles.modalBody}>
          {lesson.blocks.map((block, i) => <BlockRenderer key={i} block={block} />)}
        </div>

        <div className={styles.modalFoot}>
          <div className={styles.stepDots}>
            <span>{stepIdx + 1} / {totalSteps}</span>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                key={i}
                className={`${styles.stepDot} ${i === stepIdx ? styles.stepDotActive : ''}`}
              />
            ))}
          </div>
          <div className={styles.modalNav}>
            <button
              className={styles.btnGhost}
              onClick={onPrev}
              disabled={!onPrev}
              title="← Назад"
            >
              ← Назад
            </button>
            <button className={styles.btnPrimary} onClick={handleUnderstood}>
              {done ? (onNext ? 'Дальше →' : 'Закрыть') : (onNext ? 'Понял! →' : 'Понял, к миссиям!')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Block renderers ─────────────────────────────────────────────────────────

function BlockRenderer({ block }: { block: LessonBlock }) {
  if (block.kind === 'text') return <p className={styles.text}>{block.text}</p>
  if (block.kind === 'tip') return <div className={styles.tip}>{block.text}</div>
  if (block.kind === 'code') return <pre className={styles.code}>{block.code}</pre>
  if (block.kind === 'actions') return <ActionsBlock />
  if (block.kind === 'ctx') return <CtxBlock />
  if (block.kind === 'blocksVsCode') return <BlocksVsCodeBlock />
  return null
}

const ACTIONS = [
  { name: 'Атака',     icon: '👊', code: 'attack',  desc: 'Базовый удар. 12 урона, 10 выносливости. Самый частый выбор.' },
  { name: 'Тяжёлый',   icon: '💥', code: 'heavy',   desc: '28 урона. Стоит 35 выносливости. Без неё провалится!' },
  { name: 'Лазер',     icon: '⚡', code: 'laser',   desc: '20 урона на расстоянии. Кулдаун 3 хода. Контрится dodge.' },
  { name: 'Щит',       icon: '🛡️', code: 'shield',  desc: 'Поглощает 60% урона на этом ходу. Не наносит урона.' },
  { name: 'Уклон',     icon: '💨', code: 'dodge',   desc: 'Уклоняется от лазера и тяжёлого. Не работает против attack.' },
  { name: 'Лечение',   icon: '💊', code: 'repair',  desc: '+25 HP. Враг успеет ударить — выбирай момент.' },
  { name: 'Спецудар',  icon: '☄️', code: 'special', desc: '50 урона если ярость = 100. Иначе слабый.' },
]

function ActionsBlock() {
  return (
    <div className={styles.actionsGrid}>
      {ACTIONS.map(a => (
        <div key={a.code} className={styles.actionCard}>
          <div className={styles.actionRow}>
            <span className={styles.actionIcon}>{a.icon}</span>
            <span className={styles.actionName}>{a.name}</span>
            <span className={styles.actionCode}>'{a.code}'</span>
          </div>
          <p className={styles.actionDesc}>{a.desc}</p>
        </div>
      ))}
    </div>
  )
}

const CTX_FIELDS = [
  { name: 'ctx.myHp',           desc: 'Твои очки жизни (0-100). При 0 — поражение.' },
  { name: 'ctx.myStamina',      desc: 'Выносливость (0-100). Тратится на атаки, без неё heavy провалится.' },
  { name: 'ctx.myRage',         desc: 'Ярость (0-100). Копится от получаемых ударов. При 100 — special бьёт на 50!' },
  { name: 'ctx.myLastAction',   desc: 'Что ты делал прошлый ход. Повторы дают штраф к урону.' },
  { name: 'ctx.enemyHp',        desc: 'HP врага. < 25 — добивай heavy.' },
  { name: 'ctx.enemyStamina',   desc: 'Выносливость врага. = 0 — его heavy провалится, атакуй смело.' },
  { name: 'ctx.enemyLastAction', desc: 'Что враг делал прошлый ход. Видишь laser — делай dodge.' },
  { name: 'ctx.turn',           desc: 'Номер хода (1, 2, 3, ...). Полезно для тайминга.' },
]

function CtxBlock() {
  return (
    <div className={styles.ctxTable}>
      {CTX_FIELDS.map(f => (
        <div key={f.name} className={styles.ctxRow}>
          <span className={styles.ctxName}>{f.name}</span>
          <span className={styles.ctxDesc}>{f.desc}</span>
        </div>
      ))}
    </div>
  )
}

function BlocksVsCodeBlock() {
  return (
    <div className={styles.compareGrid}>
      <div className={styles.compareSide}>
        <h4 className={styles.compareTitle}>🧩 Блоки</h4>
        <ul className={styles.compareList}>
          <li>Перетаскиваешь готовые куски мышкой</li>
          <li>Невозможно ошибиться в синтаксисе</li>
          <li>Видишь результат сразу</li>
          <li>Идеально для старта</li>
        </ul>
      </div>
      <div className={styles.compareSide}>
        <h4 className={styles.compareTitle}>💻 Код</h4>
        <ul className={styles.compareList}>
          <li>Пишешь как настоящий программист</li>
          <li>JS / Python / C++ / Java</li>
          <li>Больше гибкости и контроля</li>
          <li>Шаг к настоящему программированию</li>
        </ul>
      </div>
    </div>
  )
}
