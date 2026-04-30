import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUserStore } from '../stores/userStore'
import styles from './UserMenu.module.css'

export default function UserMenu() {
  const navigate = useNavigate()
  const { user, logout } = useUserStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/join')
    setOpen(false)
  }

  if (!user) {
    return (
      <div className={styles.authLinks}>
        <Link to="/login"    className={styles.authLink}>Войти</Link>
        <Link to="/register" className={`${styles.authLink} ${styles.authLinkPrimary}`}>Регистрация</Link>
      </div>
    )
  }

  return (
    <div className={styles.wrap} ref={ref}>
      <button className={styles.trigger} onClick={() => setOpen(o => !o)}>
        <span className={styles.avatar}>{user.avatar}</span>
        <span className={styles.name}>{user.displayName}</span>
        <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropHeader}>
            <span className={styles.dropAvatar}>{user.avatar}</span>
            <div>
              <div className={styles.dropName}>{user.displayName}</div>
              <div className={styles.dropUser}>@{user.username}</div>
            </div>
          </div>
          <div className={styles.dropDivider} />
          <Link to="/profile" className={styles.dropItem} onClick={() => setOpen(false)}>
            👤 Мой профиль
          </Link>
          <Link to="/tournaments" className={styles.dropItem} onClick={() => setOpen(false)}>
            🏆 Турниры
          </Link>
          <Link to="/learn" className={styles.dropItem} onClick={() => setOpen(false)}>
            🎓 Обучение
          </Link>
          <div className={styles.dropDivider} />
          <button className={`${styles.dropItem} ${styles.dropItemDanger}`} onClick={handleLogout}>
            🚪 Выйти
          </button>
        </div>
      )}
    </div>
  )
}
