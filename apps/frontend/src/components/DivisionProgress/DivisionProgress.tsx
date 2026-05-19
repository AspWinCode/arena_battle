import { useNavigate } from 'react-router-dom'
import { DIVISION_LABELS, DIVISION_ICONS, LANGUAGE_ICONS, LANGUAGE_LABELS } from '../../api/progress'
import type { DivisionProgressData } from '../../api/progress'
import styles from './DivisionProgress.module.css'

interface Props {
  data: DivisionProgressData
}

export default function DivisionProgress({ data }: Props) {
  const navigate = useNavigate()
  const p = data.progressToNext

  if (data.division === 'PREMIER_LEAGUE') {
    return (
      <div className={styles.card}>
        <div className={styles.premier}>
          <div className={styles.premierIcon}>👑</div>
          <div className={styles.premierText}>Высшая лига</div>
          <div className={styles.premierSub}>{data.rating} очков · {data.topicsUnlocked} тем</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.divInfo}>
          <span className={styles.divIcon}>{DIVISION_ICONS[data.division]}</span>
          <div>
            <div className={styles.divName}>{DIVISION_LABELS[data.division]}</div>
            <div className={styles.divSub}>
              {LANGUAGE_ICONS[data.language]} {LANGUAGE_LABELS[data.language]} · {data.totalWins} побед
            </div>
          </div>
        </div>
        <div className={styles.rating}>
          <div className={styles.ratingNum}>{data.rating}</div>
          <div className={styles.ratingLabel}>очков</div>
        </div>
      </div>

      {p && (
        <div className={styles.bars}>
          <div className={styles.barRow}>
            <span className={styles.barLabel}>Рейтинг</span>
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{ width: `${Math.min(100, (p.ratingProgress / p.ratingThreshold) * 100)}%` }}
              />
            </div>
            <span className={styles.barValue}>{p.ratingProgress}/{p.ratingThreshold}</span>
          </div>

          <div className={styles.barRow}>
            <span className={styles.barLabel}>Победы</span>
            <div className={styles.barTrack}>
              <div
                className={`${styles.barFill} ${styles.barFillOrange}`}
                style={{ width: `${Math.min(100, (p.winsProgress / p.winsThreshold) * 100)}%` }}
              />
            </div>
            <span className={styles.barValue}>{p.winsProgress}/{p.winsThreshold}</span>
          </div>

          {p.topicsThreshold != null && p.topicsProgress != null && (
            <div className={styles.barRow}>
              <span className={styles.barLabel}>Темы</span>
              <div className={styles.barTrack}>
                <div
                  className={`${styles.barFill} ${styles.barFillPurple}`}
                  style={{ width: `${Math.min(100, (p.topicsProgress / p.topicsThreshold) * 100)}%` }}
                />
              </div>
              <span className={styles.barValue}>{p.topicsProgress}/{p.topicsThreshold}</span>
            </div>
          )}
        </div>
      )}

      <div className={styles.footer}>
        <span className={styles.pct}>
          До следующего: <span className={styles.pctNum}>{p?.percentComplete ?? 0}%</span>
        </span>
        <button className={styles.linkBtn} onClick={() => navigate('/division')}>
          Подробнее →
        </button>
      </div>
    </div>
  )
}
