import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useAdminStore } from '../../stores/adminStore'
import styles from './AdminUsersPage.module.css'

interface UserRow {
  id: string; username: string; displayName: string; email: string
  avatar: string; preferredLang: string; preferredSkin: string
  experienceLevel: string; createdAt: string; totalWins: number
  totalBattles: number; _count: { players: number }
}

const LANG: Record<string, string> = { js: 'JS', py: 'Py', cpp: 'C++', java: 'Java' }
const EXP: Record<string, string> = { beginner: 'Начинающий', intermediate: 'Средний', advanced: 'Продвинутый' }
const SKIN: Record<string, string> = { robot: '🤖', gladiator: '⚔️', boxer: '🥊', cosmonaut: '🚀' }

function AvatarCell({ avatar }: { avatar: string }) {
  const isImage = avatar.startsWith('data:') || avatar.startsWith('/')
  if (isImage) return <img src={avatar} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{avatar}</span>
}

export default function AdminUsersPage() {
  const token = useAdminStore(s => s.accessToken)
  const [users, setUsers] = useState<UserRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<UserRow[]>('/auth/users', token ?? undefined)
      .then(setUsers)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.displayName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.left}>
          <Link to="/admin" className="btn btn-ghost" style={{ fontSize: 13 }}>← Назад</Link>
          <span className={styles.title}>👥 Игроки</span>
        </div>
        <span className={styles.count}>{users.length} зарегистрировано</span>
      </header>

      <div className={styles.content}>
        <input
          className={styles.search}
          placeholder="🔍 Поиск по нику, имени, email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {loading && <div className={styles.loading}>Загрузка...</div>}
        {error && <div className={styles.error}>{error}</div>}

        {!loading && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Игрок</th>
                  <th>Email</th>
                  <th>Язык</th>
                  <th>Уровень</th>
                  <th>Матчей</th>
                  <th>Побед</th>
                  <th>Регистрация</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className={styles.row}>
                    <td>
                      <div className={styles.playerCell}>
                        <AvatarCell avatar={u.avatar} />
                        <div>
                          <div className={styles.displayName}>{u.displayName}</div>
                          <div className={styles.username}>@{u.username} {SKIN[u.preferredSkin] ?? u.preferredSkin}</div>
                        </div>
                      </div>
                    </td>
                    <td className={styles.email}>{u.email}</td>
                    <td><span className={styles.langBadge}>{LANG[u.preferredLang] ?? u.preferredLang}</span></td>
                    <td className={styles.muted}>{EXP[u.experienceLevel] ?? u.experienceLevel}</td>
                    <td className={styles.num}>{u._count.players}</td>
                    <td className={styles.num}>{u.totalWins}</td>
                    <td className={styles.muted}>{new Date(u.createdAt).toLocaleDateString('ru')}</td>
                    <td>
                      <Link
                        to={`/profile/${u.username}`}
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: '4px 8px' }}
                        target="_blank"
                      >
                        👁 Профиль
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && !loading && (
              <div className={styles.empty}>Игроки не найдены</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
