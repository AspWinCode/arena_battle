import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../../stores/userStore'
import { useProgressStore } from '../../stores/progressStore'
import type { Recommendation } from '../../api/progress'
import styles from './RecommendationToast.module.css'

const TRIGGER_ICON: Record<string, string> = {
  after_win: '🏆',
  after_loss: '💡',
  topic_unused: '📚',
}

interface Props {
  recommendations: Recommendation[]
  onDismiss?: (id: string) => void
}

export default function RecommendationToast({ recommendations, onDismiss }: Props) {
  const navigate = useNavigate()
  const { token } = useUserStore()
  const { dismissRecommendation } = useProgressStore()

  const handleDismiss = (id: string) => {
    if (onDismiss) {
      onDismiss(id)
    } else if (token) {
      dismissRecommendation(id, token)
    }
  }

  if (!recommendations.length) return null

  return (
    <div className={styles.wrap}>
      {recommendations.slice(0, 2).map(rec => (
        <div
          key={rec.id}
          className={`${styles.toast} ${
            rec.trigger === 'after_win' ? styles.toastWin
            : rec.trigger === 'after_loss' ? styles.toastLoss
            : styles.toastUnused
          }`}
        >
          <button
            className={styles.closeBtn}
            onClick={() => handleDismiss(rec.id)}
          >✕</button>

          <div className={styles.header}>
            <span className={styles.icon}>{TRIGGER_ICON[rec.trigger]}</span>
            <span className={styles.message}>{rec.message}</span>
          </div>

          <div className={styles.codeBlock}>{rec.codeExample}</div>

          <div className={styles.footer}>
            <button
              className={styles.ctaBtn}
              onClick={() => navigate(`/topics`)}
            >
              {rec.cta}
            </button>
            <button
              className={styles.dismissBtn}
              onClick={() => handleDismiss(rec.id)}
            >
              Скрыть
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
