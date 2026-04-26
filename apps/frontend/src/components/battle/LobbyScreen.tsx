import { useBattleStore } from '../../stores/battleStore'
import styles from './LobbyScreen.module.css'

const SKIN_ICONS: Record<string, string> = {
  robot: '🤖', gladiator: '⚔️', boxer: '🥊', cosmonaut: '🚀',
}

export default function LobbyScreen() {
  const p1 = useBattleStore(s => s.p1)
  const p2 = useBattleStore(s => s.p2)
  const slot = useBattleStore(s => s.slot)

  const me = slot === 1 ? p1 : p2
  const opponent = slot === 1 ? p2 : p1

  return (
    <div className={styles.root}>
      <div className={styles.logo}>
        <span>🤖</span>
        <span>RoboCode Arena</span>
      </div>

      <div className={styles.players}>
        <PlayerCard
          player={p1}
          label="Игрок 1"
          isMe={slot === 1}
        />
        <div className={styles.vs}>VS</div>
        <PlayerCard
          player={p2}
          label="Игрок 2"
          isMe={slot === 2}
        />
      </div>

      <div className={styles.status}>
        {!opponent ? (
          <div className={styles.waiting}>
            <span className={styles.dots}>Ожидаем противника</span>
            <WaitingDots />
          </div>
        ) : (
          <div className={styles.ready}>
            ✅ Противник подключился! Сейчас начнём...
          </div>
        )}
      </div>
    </div>
  )
}

function PlayerCard({
  player,
  label,
  isMe,
}: {
  player: { name: string; skin: string; ready: boolean } | null
  label: string
  isMe: boolean
}) {
  return (
    <div className={`${styles.playerCard} ${isMe ? styles.myCard : ''}`}>
      <div className={styles.playerLabel}>{label}{isMe ? ' (ты)' : ''}</div>
      {player ? (
        <>
          <div className={styles.playerIcon}>{SKIN_ICONS[player.skin] ?? '🤖'}</div>
          <div className={styles.playerName}>{player.name}</div>
          <div className={`${styles.playerStatus} ${player.ready ? styles.statusReady : ''}`}>
            {player.ready ? '✅ Готов' : '⏳ Ждёт'}
          </div>
        </>
      ) : (
        <div className={styles.playerEmpty}>
          <div className={styles.playerIcon}>❓</div>
          <div className={styles.playerName} style={{ color: 'var(--text-muted)' }}>Ожидание...</div>
        </div>
      )}
    </div>
  )
}

function WaitingDots() {
  return (
    <span className={styles.dotsAnim}>
      <span>.</span><span>.</span><span>.</span>
    </span>
  )
}
