import { useEffect, useRef, useState } from 'react'
import { useAchievementsStore, ACHIEVEMENTS } from '../stores/achievementsStore'
import styles from './AchievementToast.module.css'

interface ToastItem {
  id: string
  key: number
  leaving: boolean
}

/**
 * Mount this once near the root (e.g. in App.tsx) — it listens to the
 * achievement store and pops a toast for each newly unlocked achievement.
 */
export default function AchievementToast() {
  const pendingToast = useAchievementsStore(s => s.pendingToast)
  const clearToast   = useAchievementsStore(s => s.clearToast)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const keyRef = useRef(0)

  useEffect(() => {
    if (pendingToast.length === 0) return

    const newItems: ToastItem[] = pendingToast.map(id => ({
      id,
      key: ++keyRef.current,
      leaving: false,
    }))

    setToasts(prev => [...prev, ...newItems])
    clearToast(pendingToast)

    // Auto-dismiss after 4s
    newItems.forEach(item => {
      setTimeout(() => {
        // Start leave animation
        setToasts(prev =>
          prev.map(t => t.key === item.key ? { ...t, leaving: true } : t)
        )
        // Remove from DOM after animation
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.key !== item.key))
        }, 400)
      }, 4000)
    })
  }, [pendingToast]) // eslint-disable-line react-hooks/exhaustive-deps

  if (toasts.length === 0) return null

  return (
    <div className={styles.container}>
      {toasts.map(toast => {
        const def = ACHIEVEMENTS.find(a => a.id === toast.id)
        if (!def) return null
        return (
          <div
            key={toast.key}
            className={`${styles.toast} ${toast.leaving ? styles.leaving : ''}`}
          >
            <div className={styles.iconWrap}>
              <span className={styles.icon}>{def.icon}</span>
              <div className={styles.iconGlow} />
            </div>
            <div className={styles.body}>
              <div className={styles.label}>🏅 Достижение разблокировано!</div>
              <div className={styles.title}>{def.title}</div>
              <div className={styles.desc}>{def.desc}</div>
            </div>
            <div className={styles.xp}>+{def.xp} XP</div>
          </div>
        )
      })}
    </div>
  )
}
