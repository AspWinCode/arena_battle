import { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBattleStore } from '../stores/battleStore'
import { useWebSocket } from '../hooks/useWebSocket'
import LobbyScreen    from '../components/battle/LobbyScreen'
import CodingScreen   from '../components/battle/CodingScreen'
import BattleScreen   from '../components/battle/BattleScreen'
import ResultScreen   from '../components/battle/ResultScreen'
import styles from './BattlePage.module.css'

export default function BattlePage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const phase   = useBattleStore(s => s.phase)
  const slot    = useBattleStore(s => s.slot)
  const wsToken = useBattleStore(s => s.wsToken)
  // myName/mySkin saved at join — p1/p2 are null until lobby_update arrives from server
  const myName  = useBattleStore(s => s.myName)
  const mySkin  = useBattleStore(s => s.mySkin)

  const { send } = useWebSocket(sessionId ?? null)
  const connected = useRef(false)

  useEffect(() => {
    if (!sessionId || !wsToken || !slot) {
      navigate('/join')
    }
  }, [sessionId, wsToken, slot, navigate])

  useEffect(() => {
    if (!slot || !wsToken || !myName || !mySkin || connected.current) return

    const timer = setInterval(() => {
      const sent = send({
        type: 'connect',
        payload: {
          playerCode: wsToken,
          name: myName,
          skin: mySkin,
        },
      })

      if (sent) {
        connected.current = true
        clearInterval(timer)
      }
    }, 300)

    return () => clearInterval(timer)
  }, [slot, wsToken, myName, mySkin, send])

  if (!sessionId) return null

  return (
    <div className={styles.root}>
      {phase === 'lobby' && <LobbyScreen />}
      {phase === 'coding' && (
        <CodingScreen
          onReady={(code, lang) => send({ type: 'ready', payload: { code, lang } })}
        />
      )}
      {(phase === 'compiling' || phase === 'battle') && <BattleScreen />}
      {phase === 'result' && (
        <ResultScreen onPlayAgain={() => { useBattleStore.getState().reset(); navigate('/join') }} />
      )}
    </div>
  )
}
