import type { ServerMessage, LobbyPlayer, SkinId, Lang, Strategy } from '@robocode/shared'
import { prisma } from '../db/client.js'
import { runInSandbox } from '../sandbox/sandbox-service.js'
import { runMatch } from '../engine/battle-engine.js'

// Minimal WS interface to avoid @types/ws issues
interface WsSocket {
  readyState: number
  send(data: string): void
}

interface PlayerConn {
  ws: WsSocket
  slot: 1 | 2
  name: string
  skin: SkinId
  lang?: Lang
  code?: string
  strategy?: Strategy
  ready: boolean
}

export class SessionRoom {
  private players  = new Map<1 | 2, PlayerConn>()
  private observers = new Set<WsSocket>()
  private timerInterval?: ReturnType<typeof setInterval>
  private codingTimeLeft = 0

  constructor(
    private sessionId: string,
    private level: string,
    private lang: Lang,
    private format: 'bo1' | 'bo3' | 'bo5',
    private timeLimit: number,
    private allowedSkins: SkinId[],
  ) {}

  addPlayer(ws: WsSocket, slot: 1 | 2, name: string, skin: SkinId) {
    this.players.set(slot, { ws, slot, name, skin, ready: false })

    this.send(slot, {
      type: 'connected',
      payload: {
        slot,
        sessionLevel: this.level as 'blocks' | 'code' | 'pro',
        allowedSkins: this.allowedSkins,
      },
    })

    this.broadcastLobbyUpdate()

    if (this.players.size === 2) {
      this.startCoding()
    }
  }

  handleReady(slot: 1 | 2, code: string, lang: Lang) {
    const player = this.players.get(slot)
    if (!player) return

    player.code = code
    player.lang = lang
    player.ready = true

    this.broadcastLobbyUpdate()

    if ([...this.players.values()].every(p => p.ready)) {
      this.stopCodingTimer()
      this.startBattle()
    }
  }

  addObserver(ws: WsSocket) {
    this.observers.add(ws)
    // Send current lobby state as snapshot
    this.sendLobbyUpdateTo(ws)
  }

  removeObserver(ws: WsSocket) {
    this.observers.delete(ws)
  }

  handleDisconnect(slot: 1 | 2) {
    this.players.delete(slot)
    this.stopCodingTimer()

    const other = slot === 1 ? 2 : 1
    const remaining = this.players.get(other)
    if (remaining) {
      this.send(other, {
        type: 'error',
        payload: { code: 'OPPONENT_DISCONNECTED', message: 'Opponent disconnected' },
      })
    }
  }

  private startCoding() {
    this.codingTimeLeft = this.timeLimit * 60

    this.broadcastAll({
      type: 'coding_start',
      payload: { timeLimit: this.codingTimeLeft },
    })

    this.timerInterval = setInterval(() => {
      this.codingTimeLeft--
      this.broadcastAll({
        type: 'timer_tick',
        payload: { remaining: this.codingTimeLeft },
      })

      if (this.codingTimeLeft <= 0) {
        this.stopCodingTimer()
        this.startBattle()
      }
    }, 1000)
  }

  private stopCodingTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = undefined
    }
  }

  private async startBattle() {
    const p1 = this.players.get(1)
    const p2 = this.players.get(2)
    if (!p1 || !p2) return

    const p1Lang = p1.lang ?? 'js'
    const p2Lang = p2.lang ?? 'js'

    this.broadcastAll({
      type: 'compile_status',
      payload: { status: 'compiling', p1Done: false, p2Done: false },
    })

    // Mark session active
    await prisma.session.update({
      where: { id: this.sessionId },
      data: { status: 'BATTLE' },
    }).catch(() => {})

    try {
      // Compile in parallel, report per-player progress
      const [s1, s2] = await Promise.all([
        this.compilePlayer(p1).then(s => {
          this.broadcastAll({
            type: 'compile_status',
            payload: { status: 'compiling', lang: p1Lang, p1Done: true, p2Done: false },
          })
          return s
        }),
        this.compilePlayer(p2).then(s => {
          this.broadcastAll({
            type: 'compile_status',
            payload: { status: 'compiling', lang: p2Lang, p1Done: false, p2Done: true },
          })
          return s
        }),
      ])

      this.broadcastAll({ type: 'compile_status', payload: { status: 'done', p1Done: true, p2Done: true } })

      const { winner, score, rounds } = runMatch(s1, s2, this.format)

      for (const round of rounds) {
        this.broadcastAll({
          type: 'battle_start',
          payload: {
            round: round.round,
            p1: { name: p1.name, skin: p1.skin, hp: 100 },
            p2: { name: p2.name, skin: p2.skin, hp: 100 },
          },
        })

        for (const turn of round.turns) {
          await sleep(400)
          this.broadcastAll({ type: 'turn_result', payload: turn })
        }

        await sleep(500)
        this.broadcastAll({
          type: 'round_end',
          payload: {
            round: round.round,
            winner: round.winner,
            p1Hp: round.p1Hp,
            p2Hp: round.p2Hp,
            reason: round.reason,
          },
        })

        await prisma.battle.create({
          data: {
            sessionId: this.sessionId,
            round: round.round,
            winner: round.winner,
            hp1Final: round.p1Hp,
            hp2Final: round.p2Hp,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            log: round.turns as any,
          },
        })

        await sleep(1500)
      }

      this.broadcastAll({
        type: 'match_end',
        payload: { winner, score, rounds },
      })

      await prisma.session.update({
        where: { id: this.sessionId },
        data: { status: 'DONE' },
      })
    } catch (err) {
      console.error('[room] Battle error:', err)
      this.broadcastAll({
        type: 'error',
        payload: { code: 'BATTLE_ERROR', message: String(err) },
      })
    }
  }

  private async compilePlayer(player: PlayerConn): Promise<Strategy> {
    if (player.strategy) return player.strategy

    const code = player.code ?? ''
    const lang = player.lang ?? 'js'

    try {
      const strategy = await runInSandbox(code, lang)

      await prisma.player.updateMany({
        where: { sessionId: this.sessionId, slot: player.slot },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { code, lang, strategy: strategy as any },
      })

      player.strategy = strategy
      return strategy
    } catch {
      return { primary: 'attack', lowHp: 'combo', onHit: 'dodge', style: 'Standard', position: 'mid' }
    }
  }

  private broadcastLobbyUpdate() {
    const msg = this.buildLobbyUpdateMsg()
    this.broadcastAll(msg)
  }

  private sendLobbyUpdateTo(ws: WsSocket) {
    if (ws.readyState === 1) ws.send(JSON.stringify(this.buildLobbyUpdateMsg()))
  }

  private buildLobbyUpdateMsg(): ServerMessage {
    const p1 = this.players.get(1)
    const p2 = this.players.get(2)
    const toLobby = (p: PlayerConn | undefined): LobbyPlayer | null =>
      p ? { name: p.name, skin: p.skin, ready: p.ready, lang: p.lang } : null
    return { type: 'lobby_update', payload: { p1: toLobby(p1), p2: toLobby(p2) } }
  }

  private broadcastAll(msg: ServerMessage) {
    const raw = JSON.stringify(msg)
    for (const player of this.players.values()) {
      if (player.ws.readyState === 1) player.ws.send(raw)
    }
    for (const obs of this.observers) {
      if (obs.readyState === 1) obs.send(raw)
    }
  }

  private send(slot: 1 | 2, msg: ServerMessage) {
    const player = this.players.get(slot)
    if (player?.ws.readyState === 1) {
      player.ws.send(JSON.stringify(msg))
    }
  }
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}
