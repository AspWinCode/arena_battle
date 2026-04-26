import { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBattleStore } from '../stores/battleStore'
import { useWebSocket } from '../hooks/useWebSocket'
import LobbyScreen from '../components/battle/LobbyScreen'
import CodingScreen from '../components/battle/CodingScreen'
import BattleScreen from '../components/battle/BattleScreen'
import ResultScreen from '../components/battle/ResultScreen'
import styles from './BattlePage.module.css'

export default function BattlePage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const phase        = useBattleStore(s => s.phase)
  const slot         = useBattleStore(s => s.slot)
  const wsToken      = useBattleStore(s => s.wsToken)
  const p1           = useBattleStore(s => s.p1)
  const p2           = useBattleStore(s => s.p2)

  const { send } = useWebSocket(sessionId ?? null)
  const connected = useRef(false)

  useEffect(() => {
    if (!sessionId || !wsToken || !slot) {
      navigate('/join')
      return
    }
  }, [sessionId, wsToken, slot, navigate])

  // Send 'connect' once when WS opens — we get the playerCode from the wsToken
  // In a real flow the playerCode is already known; here we derive it from slot.
  useEffect(() => {
    if (!slot || connected.current) return

    // Slight delay to let WS connect
    const timer = setTimeout(() => {
      const myName = (slot === 1 ? p1?.name : p2?.name) ?? 'Player'
      const mySkin = (slot === 1 ? p1?.skin : p2?.skin) ?? 'robot'

      // wsToken encodes sessionId + slot — backend will re-validate
      send({
        type: 'connect',
        payload: {
          playerCode: wsToken ?? '',
          name: myName,
          skin: mySkin as any,
        },
      })
      connected.current = true
    }, 300)

    return () => clearTimeout(timer)
  }, [slot, p1, p2, wsToken, send])

  if (!sessionId) return null

  return (
    <div className={styles.root}>
      {phase === 'lobby'                           && <LobbyScreen />}
      {phase === 'coding'                          && (
        <CodingScreen
          onReady={(code, lang) => send({ type: 'ready', payload: { code, lang } })}
        />
      )}
      {(phase === 'compiling' || phase === 'battle') && <BattleScreen />}
      {phase === 'result'                          && (
        <ResultScreen onPlayAgain={() => { useBattleStore.getState().reset(); navigate('/join') }} />
      )}
    </div>
  )
}
