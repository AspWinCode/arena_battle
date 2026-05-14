import { Link } from 'react-router-dom'
import { ALL_SKIN_IDS } from '@robocode/shared'
import styles from './AdminCharactersPage.module.css'

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

export default function AdminCharactersPage() {
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
            return (
              <Link key={id} to={`/admin/characters/${id}`} className={styles.card}>
                <div className={styles.emoji}>{CHAR_EMOJI[id] ?? '❓'}</div>
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
