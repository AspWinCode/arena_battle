import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useUserStore } from '../stores/userStore'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ClanMember {
  id: string; role: string; joinedAt: string
  user: { id: string; username: string; displayName: string; avatar: string; elo: number }
}

interface Clan {
  id: string; name: string; tag: string; description: string | null
  avatar: string; elo: number; totalWins: number; totalWars: number
  ownerId: string
  owner: { id: string; username: string; displayName: string; avatar: string }
  members: ClanMember[]
  _count: { members: number }
  myRole?: string
}

interface ChatMessage {
  id: string; content: string; createdAt: string
  user: { id: string; username: string; displayName: string; avatar: string }
}

interface ClanWar {
  id: string; status: string
  clan1Score: number; clan2Score: number
  startDate: string; endDate: string
  winnerId: string | null
  clan1: { id: string; name: string; tag: string; avatar: string }
  clan2: { id: string; name: string; tag: string; avatar: string }
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = { OWNER: '👑 Владелец', OFFICER: '⭐ Офицер', MEMBER: '👤 Участник' }
const WAR_STATUS: Record<string, string> = { PENDING: '⏳ Ожидание', ACTIVE: '⚔️ Идёт', DONE: '✅ Завершена' }

// ── Component ──────────────────────────────────────────────────────────────────

export default function ClanDetailPage() {
  const { id }           = useParams<{ id: string }>()
  const { token, user }  = useUserStore()
  const navigate         = useNavigate()

  const [clan, setClan]           = useState<Clan | null>(null)
  const [messages, setMessages]   = useState<ChatMessage[]>([])
  const [wars, setWars]           = useState<ClanWar[]>([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<'members' | 'chat' | 'wars'>('members')
  const [chatInput, setChatInput] = useState('')
  const [sending, setSending]     = useState(false)
  const [acting, setActing]       = useState(false)
  const [error, setError]         = useState('')
  const [warTarget, setWarTarget] = useState('')
  const [warDays, setWarDays]     = useState(3)
  const chatEndRef                = useRef<HTMLDivElement>(null)
  const pollRef                   = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = async () => {
    if (!id) return
    try {
      const [clanData, warsData] = await Promise.all([
        api.get<Clan>(`/clans/${id}`, token ?? undefined),
        api.get<ClanWar[]>(`/clans/${id}/wars`),
      ])
      setClan(clanData)
      setWars(warsData)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async () => {
    if (!id || !token) return
    try {
      const msgs = await api.get<ChatMessage[]>(`/clans/${id}/messages`, token)
      setMessages(msgs)
    } catch { /* not a member */ }
  }

  useEffect(() => {
    load()
  }, [id])

  useEffect(() => {
    if (tab === 'chat') {
      loadMessages()
      pollRef.current = setInterval(loadMessages, 5_000)
    } else {
      clearInterval(pollRef.current!)
    }
    return () => clearInterval(pollRef.current!)
  }, [tab, id, token])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const isMember    = !!clan?.myRole
  const isOfficer   = clan?.myRole === 'OFFICER' || clan?.myRole === 'OWNER'
  const isOwner     = clan?.myRole === 'OWNER'
  const myMemberId  = clan?.members.find(m => m.user.id === user?.id)?.user.id

  const handleJoin = async () => {
    if (!token || !id) return
    setActing(true)
    try {
      await api.post(`/clans/${id}/join`, {}, token)
      await load()
    } catch (e: any) { setError(e.message) }
    finally { setActing(false) }
  }

  const handleLeave = async () => {
    if (!token || !id || !confirm('Покинуть клан?')) return
    setActing(true)
    try {
      await api.post(`/clans/${id}/leave`, {}, token)
      navigate('/clans')
    } catch (e: any) { setError(e.message) }
    finally { setActing(false) }
  }

  const handleKick = async (userId: string) => {
    if (!token || !id || !confirm('Исключить участника?')) return
    try {
      await api.delete(`/clans/${id}/members/${userId}`, token)
      await load()
    } catch (e: any) { setError(e.message) }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!token || !id) return
    try {
      await api.patch(`/clans/${id}/members/${userId}/role`, { role: newRole }, token)
      await load()
    } catch (e: any) { setError(e.message) }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !id || !chatInput.trim()) return
    setSending(true)
    try {
      await api.post(`/clans/${id}/messages`, { content: chatInput.trim() }, token)
      setChatInput('')
      await loadMessages()
    } catch (e: any) { setError(e.message) }
    finally { setSending(false) }
  }

  const handleDeclareWar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !id || !warTarget.trim()) return
    setActing(true)
    try {
      // warTarget can be clan ID or tag — for simplicity accept clan ID
      await api.post(`/clans/${id}/wars`, { targetClanId: warTarget.trim(), durationDays: warDays }, token)
      setWarTarget('')
      await load()
      setTab('wars')
    } catch (e: any) { setError(e.message) }
    finally { setActing(false) }
  }

  const handleAcceptWar = async (warId: string) => {
    if (!token || !confirm('Принять вызов на войну?')) return
    try {
      await api.post(`/clans/wars/${warId}/accept`, {}, token)
      await load()
    } catch (e: any) { setError(e.message) }
  }

  const handleDeclineWar = async (warId: string) => {
    if (!token || !confirm('Отклонить вызов на войну?')) return
    try {
      await api.post(`/clans/wars/${warId}/decline`, {}, token)
      await load()
    } catch (e: any) { setError(e.message) }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <span style={{ fontSize: 36, animation: 'spin 1s linear infinite' }}>⚙️</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (error && !clan) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: 12 }}>
      <p style={{ color: '#f87171' }}>{error}</p>
      <Link to="/clans" className="btn btn-ghost">← Кланы</Link>
    </div>
  )

  if (!clan) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '32px 16px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        <Link to="/clans" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', display: 'block', marginBottom: 20 }}>
          ← Все кланы
        </Link>

        {/* ── Clan hero ───────────────────────────────────────────────────────── */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 28px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 56, width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-mid)', border: '2px solid var(--border)', borderRadius: 16 }}>
              {clan.avatar}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>{clan.name}</h1>
                <span style={{ fontSize: 12, fontWeight: 700, background: 'var(--bg-mid)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 99, color: 'var(--text-muted)', letterSpacing: '.07em' }}>
                  [{clan.tag}]
                </span>
                {clan.myRole && (
                  <span style={{ fontSize: 11, background: 'rgba(0,229,255,.1)', border: '1px solid rgba(0,229,255,.3)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>
                    {ROLE_LABEL[clan.myRole]}
                  </span>
                )}
              </div>
              {clan.description && <p style={{ margin: '0 0 10px', color: 'var(--text-muted)', fontSize: 14 }}>{clan.description}</p>}
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <span>👥 {clan._count.members} / 20 участников</span>
                <span>⚔️ {clan.totalWars} войн</span>
                <span>🏆 {clan.totalWins} побед</span>
                <span style={{ color: 'var(--lightning)', fontWeight: 700 }}>{clan.elo} Рейтинг</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              {!user && <Link to="/login" className="btn btn-ghost">Войти</Link>}
              {user && !isMember && clan._count.members < 20 && (
                <button className="btn btn-primary" onClick={handleJoin} disabled={acting}>
                  {acting ? '⏳' : '➕ Вступить'}
                </button>
              )}
              {user && isMember && !isOwner && (
                <button className="btn btn-ghost" style={{ color: '#f87171' }} onClick={handleLeave} disabled={acting}>
                  Покинуть
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active war banner */}
        {wars.filter(w => w.status === 'ACTIVE').map(w => {
          const weClan1  = w.clan1.id === id
          const opponent = weClan1 ? w.clan2 : w.clan1
          const ourScore = weClan1 ? w.clan1Score : w.clan2Score
          const theirScore = weClan1 ? w.clan2Score : w.clan1Score
          return (
            <div key={w.id} onClick={() => setTab('wars')} style={{ background: 'rgba(249,115,22,.08)', border: '1px solid rgba(249,115,22,.4)', borderRadius: 12, padding: '12px 18px', marginBottom: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#fb923c' }}>
                ⚔️ Идёт война с [{opponent.tag}] {opponent.name}
              </div>
              <div style={{ fontWeight: 900, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: ourScore >= theirScore ? '#4ade80' : '#f87171' }}>{ourScore}</span>
                <span style={{ color: 'var(--text-muted)' }}> : </span>
                <span style={{ color: theirScore > ourScore ? '#f87171' : 'var(--text-muted)' }}>{theirScore}</span>
              </div>
            </div>
          )
        })}

        {/* Pending war invites for our clan */}
        {wars.filter(w => w.status === 'PENDING' && w.clan2.id === id).map(w => (
          <div key={w.id} onClick={() => setTab('wars')} style={{ background: 'rgba(250,204,21,.06)', border: '1px solid rgba(250,204,21,.3)', borderRadius: 12, padding: '12px 18px', marginBottom: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#facc15' }}>
              ⏳ [{w.clan1.tag}] {w.clan1.name} бросил вам вызов на войну
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Открыть вкладку Войны →</span>
          </div>
        ))}

        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.3)', borderRadius: 8, fontSize: 13, color: '#f87171', marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-mid)', border: '1px solid var(--border)', borderRadius: 12, padding: 4 }}>
          {([['members', `👥 Участники (${clan._count.members})`], ['wars', `⚔️ Войны (${wars.length})`], ...(isMember ? [['chat', '💬 Чат']] : [])] as [string, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t as typeof tab)}
              style={{
                flex: 1, padding: '8px 14px', fontSize: 13, fontWeight: 700,
                background: tab === t ? 'var(--bg-card)' : 'transparent',
                border: tab === t ? '1px solid var(--border)' : '1px solid transparent',
                borderRadius: 8, cursor: 'pointer', color: tab === t ? 'var(--text)' : 'var(--text-muted)',
                transition: 'all .15s',
              }}
            >{label}</button>
          ))}
        </div>

        {/* ── Members tab ──────────────────────────────────────────────────────── */}
        {tab === 'members' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {clan.members.map(m => (
              <div key={m.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Avatar */}
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--bg-mid)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, overflow: 'hidden', flexShrink: 0 }}>
                  {m.user.avatar?.startsWith('data:') || m.user.avatar?.startsWith('/')
                    ? <img src={m.user.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    : m.user.avatar || '🤖'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link to={`/profile/${m.user.username}`} style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', textDecoration: 'none' }}>
                      {m.user.displayName}
                    </Link>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{m.user.username}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ROLE_LABEL[m.role]}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--lightning)', fontWeight: 700, marginTop: 2 }}>{m.user.elo} Рейтинг</div>
                </div>

                {/* Owner management controls */}
                {isOwner && m.user.id !== user?.id && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select
                      value={m.role}
                      onChange={e => handleRoleChange(m.user.id, e.target.value)}
                      style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, background: 'var(--bg-mid)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}
                    >
                      <option value="MEMBER">Участник</option>
                      <option value="OFFICER">Офицер</option>
                    </select>
                    <button
                      onClick={() => handleKick(m.user.id)}
                      style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.3)', color: '#f87171', cursor: 'pointer' }}
                    >
                      Исключить
                    </button>
                  </div>
                )}

                {/* Officer kick controls */}
                {isOfficer && !isOwner && m.role === 'MEMBER' && m.user.id !== user?.id && (
                  <button
                    onClick={() => handleKick(m.user.id)}
                    style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.3)', color: '#f87171', cursor: 'pointer' }}
                  >
                    Исключить
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Wars tab ─────────────────────────────────────────────────────────── */}
        {tab === 'wars' && (
          <div>
            {/* Declare war form */}
            {isOfficer && (
              <form onSubmit={handleDeclareWar} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>⚔️ Объявить войну</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    className="input"
                    placeholder="ID клана-противника"
                    value={warTarget}
                    onChange={e => setWarTarget(e.target.value)}
                    style={{ flex: 1, minWidth: 200, fontSize: 13 }}
                  />
                  <select
                    value={warDays}
                    onChange={e => setWarDays(Number(e.target.value))}
                    style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-mid)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13 }}
                  >
                    {[1,2,3,5,7,14].map(d => <option key={d} value={d}>{d} {d === 1 ? 'день' : d < 5 ? 'дня' : 'дней'}</option>)}
                  </select>
                  <button type="submit" className="btn btn-primary" disabled={acting} style={{ fontSize: 13 }}>
                    {acting ? '⏳' : '⚔️ Объявить'}
                  </button>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                  Скопируй ID клана из его страницы (в адресной строке /clans/&lt;ID&gt;)
                </p>
              </form>
            )}

            {wars.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🕊️</div>
                <p>Войн пока не было</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {wars.map(w => {
                  const weClan1    = w.clan1.id === id
                  const ourScore   = weClan1 ? w.clan1Score : w.clan2Score
                  const theirScore = weClan1 ? w.clan2Score : w.clan1Score
                  const opponent   = weClan1 ? w.clan2 : w.clan1
                  const ourClan    = weClan1 ? w.clan1 : w.clan2
                  const weWon      = w.winnerId === id
                  const theyWon    = w.winnerId && w.winnerId !== id
                  const canAccept  = isOfficer && w.clan2.id === id && w.status === 'PENDING'
                  const canDecline = canAccept
                  const total      = ourScore + theirScore
                  const ourPct     = total === 0 ? 50 : Math.round((ourScore / total) * 100)

                  // Time remaining
                  const msLeft  = new Date(w.endDate).getTime() - Date.now()
                  const daysLeft  = Math.floor(msLeft / 86400000)
                  const hoursLeft = Math.floor((msLeft % 86400000) / 3600000)
                  const timeLabel = msLeft <= 0 ? 'Завершена'
                    : daysLeft > 0 ? `${daysLeft}д ${hoursLeft}ч`
                    : `${hoursLeft}ч`

                  const borderColor = weWon ? 'rgba(74,222,128,.35)'
                    : theyWon ? 'rgba(248,113,113,.25)'
                    : w.status === 'ACTIVE' ? 'rgba(249,115,22,.4)'
                    : 'var(--border)'

                  return (
                    <div key={w.id} style={{ background: 'var(--bg-card)', border: `1px solid ${borderColor}`, borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {/* Header row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 28 }}>{ourClan.avatar}</span>
                          <span style={{ fontWeight: 900, fontSize: 22, color: 'var(--text-muted)' }}>vs</span>
                          <span style={{ fontSize: 28 }}>{opponent.avatar}</span>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 15 }}>[{opponent.tag}] {opponent.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              <span style={{ marginRight: 8 }}>{WAR_STATUS[w.status]}</span>
                              {w.status !== 'DONE' && <span>⏱ осталось: {timeLabel}</span>}
                              {w.status === 'DONE' && <span>до {new Date(w.endDate).toLocaleDateString('ru-RU')}</span>}
                            </div>
                          </div>
                        </div>
                        {/* Score */}
                        <div style={{ textAlign: 'center', minWidth: 80 }}>
                          <div style={{ fontSize: 28, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                            <span style={{ color: ourScore > theirScore ? '#4ade80' : ourScore < theirScore ? '#f87171' : 'var(--text)' }}>{ourScore}</span>
                            <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>:</span>
                            <span style={{ color: theirScore > ourScore ? '#f87171' : 'var(--text-muted)' }}>{theirScore}</span>
                          </div>
                          {weWon  && <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 800 }}>🏆 Победа!</div>}
                          {theyWon && <div style={{ fontSize: 11, color: '#f87171', fontWeight: 800 }}>💀 Поражение</div>}
                          {w.status === 'DONE' && !w.winnerId && <div style={{ fontSize: 11, color: '#facc15', fontWeight: 800 }}>🤝 Ничья</div>}
                        </div>
                      </div>

                      {/* Score bar */}
                      {(w.status === 'ACTIVE' || (w.status === 'DONE' && total > 0)) && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                            <span>[{ourClan.tag}]</span>
                            <span>[{opponent.tag}]</span>
                          </div>
                          <div style={{ height: 8, background: 'var(--bg-mid)', borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
                            <div style={{ width: `${ourPct}%`, background: weWon || ourScore > theirScore ? '#4ade80' : ourScore < theirScore ? '#f87171' : '#facc15', borderRadius: 99, transition: 'width .4s ease' }} />
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      {w.status === 'PENDING' && canAccept && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-primary" onClick={() => handleAcceptWar(w.id)} style={{ fontSize: 13, flex: 1 }}>
                            ✅ Принять вызов
                          </button>
                          <button className="btn btn-ghost" onClick={() => handleDeclineWar(w.id)} style={{ fontSize: 13, color: '#f87171' }}>
                            ❌ Отклонить
                          </button>
                        </div>
                      )}

                      {w.status === 'ACTIVE' && isMember && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-mid)', borderRadius: 8, padding: '8px 12px' }}>
                          💡 Сражайся с участниками клана <strong>[{opponent.tag}]</strong> — победы идут в счёт войны
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Chat tab ─────────────────────────────────────────────────────────── */}
        {tab === 'chat' && isMember && (
          <div style={{ display: 'flex', flexDirection: 'column', height: 480 }}>
            {/* Messages area */}
            <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px 12px 0 0', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.length === 0 && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                  Пока нет сообщений. Начни разговор!
                </div>
              )}
              {messages.map(m => {
                const isMe = m.user.id === user?.id
                return (
                  <div key={m.id} style={{ display: 'flex', gap: 10, flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-mid)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, overflow: 'hidden' }}>
                      {m.user.avatar?.startsWith('data:') || m.user.avatar?.startsWith('/')
                        ? <img src={m.user.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                        : m.user.avatar || '🤖'}
                    </div>
                    <div style={{ maxWidth: '70%' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, textAlign: isMe ? 'right' : 'left' }}>
                        {m.user.displayName} · {new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ background: isMe ? 'rgba(0,229,255,.15)' : 'var(--bg-mid)', border: `1px solid ${isMe ? 'rgba(0,229,255,.25)' : 'var(--border)'}`, borderRadius: isMe ? '12px 12px 0 12px' : '12px 12px 12px 0', padding: '8px 12px', fontSize: 14, wordBreak: 'break-word' }}>
                        {m.content}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '12px 14px' }}>
              <input
                className="input"
                style={{ flex: 1, fontSize: 13 }}
                placeholder="Сообщение..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                maxLength={1000}
                disabled={sending}
              />
              <button type="submit" className="btn btn-primary" disabled={sending || !chatInput.trim()} style={{ fontSize: 13, padding: '0 18px' }}>
                {sending ? '⏳' : '→'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  )
}
