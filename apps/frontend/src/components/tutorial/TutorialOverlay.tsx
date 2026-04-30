import { useState } from 'react'
import type { TutorialStep } from '@robocode/shared'
import styles from './TutorialOverlay.module.css'

interface Props {
  steps: TutorialStep[]
  onDone: () => void
  onSkip: () => void
}

export default function TutorialOverlay({ steps, onDone, onSkip }: Props) {
  const [current, setCurrent] = useState(0)
  const step = steps[current]

  if (!step) return null

  const isLast = current === steps.length - 1

  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        <div className={styles.stepIndicator}>
          {steps.map((_, i) => (
            <div
              key={i}
              className={`${styles.dot} ${i === current ? styles.dotActive : i < current ? styles.dotDone : ''}`}
            />
          ))}
        </div>

        <div className={styles.icon}>
          {step.highlight === 'arena' ? '⚔️' : step.highlight === 'ready-btn' ? '▶' : '💡'}
        </div>

        <h3 className={styles.title}>{step.title}</h3>
        <p className={styles.body}>{step.body}</p>

        {step.codeHint && (
          <pre className={styles.codeHint}>{step.codeHint}</pre>
        )}

        <div className={styles.actions}>
          <button className="btn btn-ghost" onClick={onSkip} style={{ fontSize: 12 }}>
            Пропустить всё
          </button>
          <div className={styles.navBtns}>
            {current > 0 && (
              <button
                className="btn btn-ghost"
                onClick={() => setCurrent(c => c - 1)}
                style={{ fontSize: 13 }}
              >
                ←
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={() => isLast ? onDone() : setCurrent(c => c + 1)}
              style={{ fontSize: 13 }}
            >
              {isLast ? 'Начать!' : 'Далее →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
