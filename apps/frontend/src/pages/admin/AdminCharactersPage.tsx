import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ALL_SKIN_IDS } from '@robocode/shared'
import { useAdminStore } from '../../stores/adminStore'
import styles from './AdminCharactersPage.module.css'

const API = import.meta.env.VITE_API_URL ?? '/api/v1'

const CHAR_EMOJI: Record<string, string> = {
  robot:      '🤖', gladiator: '⚔️',  boxer:     '🥊', cosmonaut: '🚀',
  ninja:      '🥷', mage:      '🔮',  paladin:   '🛡️', sniper:    '🎯',
  tank:       '🦾', vampire:   '🧛',  samurai:   '🗡️', phantom:   '👻',
  engineer:   '⚙️', berserker: '🪓',  scorpion:  '🦂', plague:    '☠️',
}

const PROFILE: Record<string, string> = {
  boxer: 'Small', ninja: 'Small', phantom: 'Small', scorpion: 'Small',
  robot: 'Medium', mage: 'Medium', sniper: 'Medium', engineer: 'Medium',
  cosmonaut: 'Medium', plague: 'Medium', vampire: 'Medium',
  gladiator: 'Heavy', tank: 'Heavy', paladin: 'Heavy', berserker: 'Heavy', samurai: 'Heavy',
}

const PROFILE_COLOR: Record<string, string> = {
  Small: '#60a5fa', Medium: '#4ade80', Heavy: '#f87171',
}

interface SkinRender {
  characterId: string
  actions?: Record<string, { fps: number; frames: string[] }>
  imgIdle?: string
}

function getIdleFrame(skin: SkinRender): string | null {
  if (skin.actions) {
    for (const key of ['idle', 'ready']) {
      const def = skin.actions[key]
      if (def?.frames?.[0]) return def.frames[0]
    }
  }
  return skin.imgIdle || null
}

export default function AdminCharactersPage() {
  const token = useAdminStore(s => s.accessToken)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch(`${API}/skins/list`)
      .then(r => r.ok ? r.json() : [])
      .then((skins: SkinRender[]) => {
        const map: Record<string, string> = {}
        for (const skin of skins) {
          if (!map[skin.characterId]) {
            const frame = getIdleFrame(skin)
            if (frame) map[skin.characterId] = frame
          }
        }
        setThumbs(map)
      })
      .catch(() => {})
  }, [token])

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to="/admin" className={styles.back}>← Дашборд</Link>
          <h1 className={styles.title}>🎬 Анимации персонажей</h1>
        </div>
      </header>

      <div className={styles.content}>
        <p className={styles.hint}>
          Выберите персонажа для редактирования анимаций.
          Каждое действие поддерживает до 10 кадров (1254×1254 px).
        </p>

        <div className={styles.grid}>
          {ALL_SKIN_IDS.map(id => {
            const profile = PROFILE[id] ?? 'Medium'
            const thumb   = thumbs[id]
            return (
              <Link key={id} to={`/admin/characters/${id}`} className={styles.card}>
                {thumb ? (
                  <img src={thumb} alt={id} className={styles.thumb} />
                ) : (
                  <div className={styles.emoji}>{CHAR_EMOJI[id] ?? '❓'}</div>
                )}
                <div className={styles.name}>{id}</div>
                <div
                  className={styles.profile}
                  style={{ color: PROFILE_COLOR[profile] }}
                >
                  {profile}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
