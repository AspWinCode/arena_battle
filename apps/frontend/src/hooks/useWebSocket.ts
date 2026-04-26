import { useEffect, useRef, useCallback } from 'react'
import type { ClientMessage, ServerMessage } from '@robocode/shared'
import { useBattleStore } from '../stores/battleStore'

const WS_URL = import.meta.env.VITE_WS_URL ?? `ws://${window.location.host}`

export function useWebSocket(sessionId: string | null) {
  const ws = useRef<WebSocket | null>(null)
  const handleMessage = useBattleStore(s => s.handleMessage)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()

  const send = useCallback((msg: ClientMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg))
    }
  }, [])

  const connect = useCallback(() => {
    if (!sessionId) return
    if (ws.current?.readyState === WebSocket.OPEN) return

    const url = `${WS_URL}/ws/battle/${sessionId}`
    ws.current = new WebSocket(url)

    ws.current.onopen = () => {
      console.log('[WS] connected')
    }

    ws.current.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as ServerMessage
        handleMessage(msg)
      } catch {
        console.warn('[WS] invalid message', e.data)
      }
    }

    ws.current.onclose = (e) => {
      console.log('[WS] closed', e.code, e.reason)
      if (e.code !== 1000 && e.code !== 4001 && e.code !== 4004) {
        // Reconnect after 2s for non-intentional closes
        reconnectTimer.current = setTimeout(connect, 2000)
      }
    }

    ws.current.onerror = (e) => {
      console.error('[WS] error', e)
    }
  }, [sessionId, handleMessage])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      ws.current?.close(1000)
    }
  }, [connect])

  // Ping every 25 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      send({ type: 'ping', payload: {} })
    }, 25000)
    return () => clearInterval(interval)
  }, [send])

  return { send, ws }
}
