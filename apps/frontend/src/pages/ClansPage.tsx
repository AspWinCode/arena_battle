import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useUserStore } from '../stores/userStore'

interface Clan {
  id: string
  name: string
  tag: string
  description: string | null
  avatar: string
  elo: number
  totalWins: number
  totalWars: number
  createdAt: string
  owner: { id: string; username: string; displayName: string; avatar: string }
  _count: { members: number }
}

interface MyClan { id: string; name: string; tag: string }

export default function ClansPage() {
  const navigate = useNavigate()
  const { token, user } = useUserStore()
  const [clans, setClans]     = useState<Clan[]>([])
  const [myClan, setMyClan]   = useState<MyClan | null | undefined>(undefined) // undefined = not yet loaded
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<Clan[]>('/clans')
      .then(setClans)
      .catch(console.error)
      .finally(() => setLoading(false))

    if (token) {
      api.get<MyClan | null>('/clans/me', token)
        .then(setMyClan)
        .catch(() => setMyClan(null))
    } else {
      setMyClan(null)
    }
  }, [token])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 16px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Header */}
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, display: 'block' }}>← Назад</button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>⚔️ Кланы</h1>
            <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
              Объединяйся с другими игроками, сражайся в войнах кланов
            </p>
            <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(250,204,21,.08)', border: '1px solid rgba(250,204,21,.25)', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: '#facc15' }}>
              🏆 Рейтинг кланов
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {myClan ? (
              <Link to={`/clans/${myClan.id}`} className="btn btn-primary">
                [{myClan.tag}] Мой клан
              </Link>
            ) : user ? (
              <Link to="/clans/create" className="btn btn-primary">
                ⚔️ Создать клан
              </Link>
            ) : (
              <Link to="/login" className="btn btn-ghost">
                Войти
              </Link>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40 }}>⏳</div>
          </div>
        ) : clans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>⚔️</div>
            <p style={{ color: 'var(--text-muted)' }}>Кланов пока нет. Будь первым!</p>
            {user && !myClan && (
              <Link to="/clans/create" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-block' }}>
                Создать клан
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {clans.map((clan, index) => (
              <Link
                key={clan.id}
                to={`/clans/${clan.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${myClan?.id === clan.id ? 'rgba(0,229,255,.35)' : 'var(--border)'}`,
                  borderRadius: 14,
                  padding: '18px 22px',
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: 16,
                  alignItems: 'center',
                  transition: 'border-color .2s, transform .15s',
                }}>
                  {/* Rank + Avatar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: index < 3 ? ['#facc15','#d1d5db','#cd7c2f'][index] : 'var(--text-muted)', minWidth: 28, textAlign: 'center' }}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </div>
                    <div style={{ fontSize: 36, width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-mid)', borderRadius: 12, border: '1px solid var(--border)' }}>
                      {clan.avatar}
                    </div>
                  </div>

                  {/* Info */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: 16 }}>{clan.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--bg-mid)', border: '1px solid var(--border)', padding: '1px 7px', borderRadius: 99, color: 'var(--text-muted)', letterSpacing: '.06em' }}>
                        [{clan.tag}]
                      </span>
                      {myClan?.id === clan.id && (
                        <span style={{ fontSize: 11, background: 'rgba(0,229,255,.12)', border: '1px solid rgba(0,229,255,.3)', color: 'var(--accent)', padding: '1px 8px', borderRadius: 99, fontWeight: 700 }}>
                          Мой клан
                        </span>
                      )}
                    </div>
                    {clan.description && (
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>
                        {clan.description}
                      </p>
                    )}
                    <div style={{ marginTop: 6, display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>👥 {clan._count.members} / 20</span>
                      <span>⚔️ {clan.totalWars} войн</span>
                      <span style={{ color: 'var(--text-muted)' }}>Владелец: {clan.owner.displayName}</span>
                    </div>
                  </div>

                  {/* ELO */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--lightning)' }}>{clan.elo}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Рейтинг</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
