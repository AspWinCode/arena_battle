import type { ServerMessage, LobbyPlayer, SkinId, Lang, Strategy } from '@robocode/shared'
import { prisma } from '../db/client.js'
import { runInSandbox } from '../sandbox/sandbox-service.js'
import { runRound } from '../engine/battle-engine.js'

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

// How many round wins needed to win the match
const WINS_NEEDED: Record<string, number>  = { bo1: 1, bo3: 2, bo5: 3 }
// Maximum rounds in the format (after which match ends regardless)
const MAX_ROUNDS:  Record<string, number>  = { bo1: 1, bo3: 3, bo5: 5 }

export class SessionRoom {
  private players       = new Map<1 | 2, PlayerConn>()
  private observers     = new Set<WsSocket>()
  private timerInterval?: ReturnType<typeof setInterval>
  private codingTimeLeft = 0

  // Match state
  private currentRound = 0
  private score: [number, number] = [0, 0]   // [p1wins, p2wins]
  private completedRounds: import('@robocode/shared').RoundResult[] = []

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
    // Reset compiled strategy so new code is used
    player.strategy = undefined

    this.broadcastLobbyUpdate()

    if ([...this.players.values()].every(p => p.ready)) {
      this.stopCodingTimer()
      this.startNextRound()
    }
  }

  addObserver(ws: WsSocket) {
    this.observers.add(ws)
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

  // ── Private ────────────────────────────────────────────────────────────────

  private startCoding(isInterRound = false) {
    this.codingTimeLeft = this.timeLimit * 60

    // Reset ready flags for next round
    for (const p of this.players.values()) p.ready = false

    this.broadcastAll({
      type: 'coding_start',
      payload: {
        timeLimit: this.codingTimeLeft,
        round: isInterRound ? this.currentRound + 1 : 1,
        score: isInterRound ? this.score : undefined,
      },
    })

    this.broadcastLobbyUpdate()

    this.timerInterval = setInterval(() => {
      this.codingTimeLeft--
      this.broadcastAll({
        type: 'timer_tick',
        payload: { remaining: this.codingTimeLeft },
      })

      if (this.codingTimeLeft <= 0) {
        this.stopCodingTimer()
        this.startNextRound()
      }
    }, 1000)
  }

  private stopCodingTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = undefined
    }
  }

  private async startNextRound() {
    const p1 = this.players.get(1)
    const p2 = this.players.get(2)
    if (!p1 || !p2) return

    this.currentRound++

    this.broadcastAll({
      type: 'compile_status',
      payload: { status: 'compiling', p1Done: false, p2Done: false },
    })

    await prisma.session.update({
      where: { id: this.sessionId },
      data: { status: 'BATTLE' },
    }).catch(() => {})

    try {
      // Asymmetric fallbacks so two fallback players don't always draw
      const FALLBACK_P1: Strategy = { primary: 'attack', lowHp: 'repair', onHit: 'dodge', style: 'Fallback', position: 'close' }
      const FALLBACK_P2: Strategy = { primary: 'laser',  lowHp: 'repair', onHit: 'shield', style: 'Fallback', position: 'far' }

      // Compile both players independently — on error notify that player and use fallback
      const compileWithFallback = async (player: PlayerConn, isP1: boolean): Promise<Strategy> => {
        try {
          const s = await this.compilePlayer(player)
          this.send(player.slot, {
            type: 'compile_status',
            payload: { status: 'compiling', p1Done: isP1, p2Done: !isP1 },
          })
          return s
        } catch (err) {
          const msg = String(err).replace(/^Error:\s*/, '')
          console.error(`[room] P${player.slot} compile error:`, msg)
          // Notify the specific player about the error
          this.send(player.slot, {
            type: 'compile_status',
            payload: { status: 'error', message: msg },
          })
          // Delay slightly so the client receives the error before battle starts
          await sleep(100)
          return isP1 ? FALLBACK_P1 : FALLBACK_P2
        }
      }

      const [s1, s2] = await Promise.all([
        compileWithFallback(p1, true),
        compileWithFallback(p2, false),
      ])

      this.broadcastAll({ type: 'compile_status', payload: { status: 'done', p1Done: true, p2Done: true } })

      // Run ONE round
      const round = await runRound(s1, s2, this.currentRound)

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
          log: round.turns as never,
        },
      })

      // Update score
      if (round.winner === 1) this.score[0]++
      else if (round.winner === 2) this.score[1]++

      this.completedRounds.push({ ...round, turns: round.turns })

      await sleep(1500)

      // Check if match is over
      const winsNeeded  = WINS_NEEDED[this.format] ?? 2
      const maxRounds   = MAX_ROUNDS[this.format]  ?? 3

      const leadWinner: 0 | 1 | 2 =
        this.score[0] >= winsNeeded ? 1 :
        this.score[1] >= winsNeeded ? 2 : 0

      // Match ends when: someone has enough wins, OR max rounds exhausted
      const roundsExhausted = this.currentRound >= maxRounds
      const isMatchOver = leadWinner !== 0 || roundsExhausted

      if (isMatchOver) {
        // Tiebreak by score if rounds exhausted without a clear winner
        const finalWinner: 0 | 1 | 2 = leadWinner !== 0 ? leadWinner :
          this.score[0] > this.score[1] ? 1 :
          this.score[1] > this.score[0] ? 2 : 0

        this.broadcastAll({
          type: 'match_end',
          payload: {
            winner: finalWinner,
            score: this.score,
            rounds: this.completedRounds,
          },
        })

        await prisma.session.update({
          where: { id: this.sessionId },
          data: { status: 'DONE' },
        })
      } else {
        // More rounds — go back to coding
        this.startCoding(true)
      }

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

    const strategy = await runInSandbox(code, lang)

    await prisma.player.updateMany({
      where: { sessionId: this.sessionId, slot: player.slot },
      data: { code, lang, strategy: strategy as never },
    })

    player.strategy = strategy
    return strategy
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
