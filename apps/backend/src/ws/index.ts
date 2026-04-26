import type { FastifyPluginAsync } from 'fastify'
import type { ClientMessage, Lang, SkinId } from '@robocode/shared'
import { prisma } from '../db/client.js'
import { SessionRoom } from './session-room.js'

// Minimal socket interface to avoid @fastify/websocket version differences
interface BareSocket {
  readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
  on(event: string, listener: (...args: unknown[]) => void): void
}

const rooms = new Map<string, SessionRoom>()

export const wsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { sessionId: string } }>(
    '/battle/:sessionId',
    { websocket: true },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket: any, request: any) => {
      const { sessionId } = request.params as { sessionId: string }
      const ws = socket as BareSocket

      let playerSlot: 1 | 2 | null = null
      let joinedRoom = false

      ws.on('message', async (rawData: unknown) => {
        let msg: ClientMessage
        try {
          const raw = Buffer.isBuffer(rawData) ? rawData.toString() : String(rawData)
          msg = JSON.parse(raw) as ClientMessage
        } catch {
          return
        }

        // ── CONNECT ────────────────────────────────────────────────
        if (msg.type === 'connect' && !joinedRoom) {
          const { playerCode, name, skin } = msg.payload

          const session = await prisma.session.findUnique({
            where: { id: sessionId },
          })

          if (!session) {
            ws.send(JSON.stringify({
              type: 'error',
              payload: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
            }))
            ws.close(4004, 'Session not found')
            return
          }

          let slot: 1 | 2 | null = null

          // Try direct 6-char code first
          if (playerCode === session.code1) slot = 1
          else if (playerCode === session.code2) slot = 2
          else {
            // Try JWT wsToken
            try {
              const payload = fastify.jwt.verify<{
                sessionId: string; slot: 1 | 2
              }>(playerCode)
              if (payload.sessionId === sessionId) slot = payload.slot
            } catch { /* not a JWT */ }
          }

          if (!slot) {
            ws.send(JSON.stringify({
              type: 'error',
              payload: { code: 'INVALID_CODE', message: 'Invalid session code or token' },
            }))
            ws.close(4001, 'Invalid code')
            return
          }

          playerSlot = slot
          joinedRoom = true

          if (!rooms.has(sessionId)) {
            rooms.set(sessionId, new SessionRoom(
              sessionId,
              session.level.toLowerCase(),
              (session.lang ?? 'auto') as Lang,
              session.format as 'bo1' | 'bo3' | 'bo5',
              session.timeLimit,
              session.allowedSkins as SkinId[],
            ))
          }

          const room = rooms.get(sessionId)!
          room.addPlayer(ws, playerSlot, name, skin as SkinId)

          await prisma.player.upsert({
            where: { sessionId_slot: { sessionId, slot: playerSlot } },
            update: { name, skin },
            create: { sessionId, slot: playerSlot, name, skin },
          }).catch(() => {})

          const count = await prisma.player.count({ where: { sessionId } })
          if (count >= 2) {
            await prisma.session.update({
              where: { id: sessionId },
              data: { status: 'CODING' },
            }).catch(() => {})
          }
          return
        }

        // ── READY ──────────────────────────────────────────────────
        if (msg.type === 'ready' && playerSlot) {
          rooms.get(sessionId)?.handleReady(playerSlot, msg.payload.code, msg.payload.lang)
          return
        }

        // ── PING ───────────────────────────────────────────────────
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', payload: {} }))
        }
      })

      ws.on('close', () => {
        if (playerSlot) rooms.get(sessionId)?.handleDisconnect(playerSlot)
      })

      ws.on('error', (err: unknown) => {
        fastify.log.error({ err }, '[WS] socket error')
      })
    }
  )
}
