import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUserStore } from '../stores/userStore'
import styles from './ShopPage.module.css'

const API = import.meta.env.VITE_API_URL ?? '/api/v1'

interface ShopSkin {
  id:          string
  characterId: string
  name:        string
  description: string | null
  rarity:      string
  price:       number
  imgIdle:     string
  imgAttack:   string
  imgHit:      string
  imgDeath:    string
  owned:       boolean
  equippedFor: string | null
}

const RARITY_COLOR: Record<string, string> = {
  common:    '#9ca3af',
  rare:      '#60a5fa',
  epic:      '#c084fc',
  legendary: '#fbbf24',
}

const RARITY_LABEL: Record<string, string> = {
  common:    'Обычный',
  rare:      'Редкий',
  epic:      'Эпический',
  legendary: 'Легендарный',
}

export default function ShopPage() {
  const user      = useUserStore(s => s.user)
  const userToken = useUserStore(s => s.token)

  const [skins,    setSkins]    = useState<ShopSkin[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [buying,   setBuying]   = useState<string | null>(null)
  const [filter,   setFilter]   = useState<string>('all')
  const [coins,    setCoins]    = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/shop`, {
        headers: userToken ? { Authorization: `Bearer ${userToken}` } : {},
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Ошибка загрузки магазина')
      setSkins(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  const loadCoins = async () => {
    if (!userToken) return
    try {
      const res = await fetch(`${API}/user/auth/me`, {
        headers: { Authorization: `Bearer ${userToken}` },
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setCoins(data.coins ?? 0)
      }
    } catch { /* noop */ }
  }

  useEffect(() => { load(); loadCoins() }, [])

  const handleBuy = async (skinId: string) => {
    if (!userToken) { alert('Войдите в аккаунт чтобы купить скин'); return }
    if (!confirm('Купить скин?')) return
    setBuying(skinId)
    try {
      const res = await fetch(`${API}/shop/buy/${skinId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Ошибка')
      setCoins(data.coinsLeft)
      setSkins(prev => prev.map(s => s.id === skinId ? { ...s, owned: true } : s))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBuying(null)
    }
  }

  const handleEquip = async (skin: ShopSkin) => {
    if (!userToken) return
    try {
      const res = await fetch(`${API}/shop/equip/${skin.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({ characterId: skin.characterId }),
      })
      if (!res.ok) throw new Error('Ошибка')
      setSkins(prev => prev.map(s =>
        s.characterId === skin.characterId
          ? { ...s, equippedFor: s.id === skin.id ? skin.characterId : null }
          : s
      ))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  const chars = ['all', ...Array.from(new Set(skins.map(s => s.characterId))).sort()]
  const visible = filter === 'all' ? skins : skins.filter(s => s.characterId === filter)

  return (
    <div className={styles.root}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <Link to="/" className={styles.back}>← Главная</Link>
            <h1 className={styles.title}>🛒 Магазин скинов</h1>
            <p className={styles.sub}>Меняй внешний вид персонажей</p>
          </div>
          {user && (
            <div className={styles.balance}>
              <span className={styles.balanceLabel}>Монеты</span>
              <span className={styles.balanceVal}>
                💰 {coins ?? '...'}
              </span>
            </div>
          )}
        </div>

        {/* Filter tabs */}
        {chars.length > 1 && (
          <div className={styles.tabs}>
            {chars.map(c => (
              <button
                key={c}
                className={`${styles.tab} ${filter === c ? styles.tabActive : ''}`}
                onClick={() => setFilter(c)}
              >
                {c === 'all' ? 'Все' : c}
              </button>
            ))}
          </div>
        )}

        {loading && <div className={styles.center}>Загрузка...</div>}
        {error   && <div className={styles.centerErr}>{error}</div>}

        {!loading && visible.length === 0 && (
          <div className={styles.center} style={{ opacity: 0.5 }}>
            Нет доступных скинов
          </div>
        )}

        <div className={styles.grid}>
          {visible.map(skin => (
            <div
              key={skin.id}
              className={`${styles.card} ${skin.owned ? styles.cardOwned : ''}`}
            >
              {/* Rarity ribbon */}
              <div
                className={styles.rarityBadge}
                style={{ background: RARITY_COLOR[skin.rarity] ?? '#9ca3af' }}
              >
                {RARITY_LABEL[skin.rarity] ?? skin.rarity}
              </div>

              {/* Preview images */}
              <div className={styles.preview}>
                {skin.imgIdle ? (
                  <img src={skin.imgIdle} alt={skin.name} className={styles.previewImg} />
                ) : (
                  <div className={styles.previewEmpty}>🎨</div>
                )}
              </div>

              {/* Action previews */}
              {(skin.imgAttack || skin.imgHit || skin.imgDeath) && (
                <div className={styles.actions}>
                  {skin.imgAttack && <img src={skin.imgAttack} alt="attack" className={styles.actionImg} title="Атака" />}
                  {skin.imgHit    && <img src={skin.imgHit}    alt="hit"    className={styles.actionImg} title="Удар" />}
                  {skin.imgDeath  && <img src={skin.imgDeath}  alt="death"  className={styles.actionImg} title="Смерть" />}
                </div>
              )}

              <div className={styles.info}>
                <div className={styles.skinName}>{skin.name}</div>
                <div className={styles.skinChar}>{skin.characterId}</div>
                {skin.description && <div className={styles.skinDesc}>{skin.description}</div>}
              </div>

              <div className={styles.footer}>
                {skin.owned ? (
                  skin.equippedFor ? (
                    <span className={styles.equipped}>✓ Надето</span>
                  ) : (
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 13, width: '100%' }}
                      onClick={() => handleEquip(skin)}
                    >
                      Надеть
                    </button>
                  )
                ) : (
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 13, width: '100%' }}
                    disabled={buying === skin.id}
                    onClick={() => handleBuy(skin.id)}
                  >
                    {buying === skin.id
                      ? 'Покупка...'
                      : skin.price === 0
                        ? 'Получить бесплатно'
                        : `💰 ${skin.price}`}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
