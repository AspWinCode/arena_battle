import type { ServerMessage, LobbyPlayer, SkinId, Lang, Strategy, Division, Language, GameTopic } from '@robocode/shared'
import { CHARACTER_STATS } from '@robocode/shared'
import { prisma } from '../db/client.js'
import { runInSandbox } from '../sandbox/sandbox-service.js'
import { runRound } from '../engine/battle-engine.js'
import { calcElo, xpForWin, xpForLoss } from '../services/elo.js'
import { advanceWinner } from '../tournament/tournament-service.js'
import { addRatingPoints, checkTopicUnlock, getDivisionUnlockedFeatures } from '../services/division-service.js'
import { generateRecommendations } from '../routes/recommendations.js'

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
  userId?: string
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

  addPlayer(
    ws: WsSocket,
    slot: 1 | 2,
    name: string,
    skin: SkinId,
    userId?: string,
    divisionCtx?: {
      playerDivision?: Division
      playerLanguage?: Language
      unlockedTopics?: GameTopic[]
      availableActions?: string[]
      contextVars?: string[]
    },
  ) {
    this.players.set(slot, { ws, slot, name, skin, ready: false, userId })

    this.send(slot, {
      type: 'connected',
      payload: {
        slot,
        sessionLevel: this.level as 'blocks' | 'code' | 'pro',
        allowedSkins: this.allowedSkins,
        ...(divisionCtx?.playerDivision && { playerDivision: divisionCtx.playerDivision }),
        ...(divisionCtx?.playerLanguage && { playerLanguage: divisionCtx.playerLanguage }),
        ...(divisionCtx?.unlockedTopics && { unlockedTopics: divisionCtx.unlockedTopics }),
        ...(divisionCtx?.availableActions && { availableActions: divisionCtx.availableActions }),
        ...(divisionCtx?.contextVars && { contextVars: divisionCtx.contextVars }),
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

  updatePlayerSkin(slot: 1 | 2, skin: SkinId) {
    const player = this.players.get(slot)
    if (!player) return
    if (!this.allowedSkins.includes(skin)) return

    player.skin = skin
    if (player.strategy) {
      player.strategy.character = skin
    }

    this.broadcastLobbyUpdate()
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
      const FALLBACK_P1: Strategy = { primary: 'attack', lowHp: 'repair', onHit: 'dodge', style: 'Fallback', position: 'close', character: p1.skin }
      const FALLBACK_P2: Strategy = { primary: 'laser',  lowHp: 'repair', onHit: 'shield', style: 'Fallback', position: 'far',   character: p2.skin }

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
          p1: { name: p1.name, skin: p1.skin, hp: CHARACTER_STATS[p1.skin]?.maxHp ?? 100 },
          p2: { name: p2.name, skin: p2.skin, hp: CHARACTER_STATS[p2.skin]?.maxHp ?? 100 },
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

        // ── Update ELO / XP / stats for registered users ──────────────────────
        let eloDeltaP1 = 0
        let eloDeltaP2 = 0
        if (finalWinner !== 0) {
          try {
            await this.updateMatchStats(finalWinner, (d1, d2) => {
              eloDeltaP1 = d1
              eloDeltaP2 = d2
            })
          } catch (e) {
            console.error('[room] Failed to update ELO stats:', e)
          }
          try {
            await this.postBattleProgressUpdates(finalWinner)
          } catch (e) {
            console.error('[room] Post-battle progress update failed:', e)
          }
        }

        this.broadcastAll({
          type: 'match_end',
          payload: {
            winner: finalWinner,
            score: this.score,
            rounds: this.completedRounds,
            eloDelta: { p1: eloDeltaP1, p2: eloDeltaP2 },
          },
        })

        await prisma.session.update({
          where: { id: this.sessionId },
          data: { status: 'DONE' },
        })

        // Auto-advance tournament match if this session is linked to one
        if (finalWinner !== 0) {
          try {
            const tournMatch = await prisma.tournamentMatch.findUnique({
              where: { sessionId: this.sessionId },
            })
            if (tournMatch) {
              const winnerAppId = finalWinner === 1 ? tournMatch.p1Id : tournMatch.p2Id
              if (winnerAppId) {
                await advanceWinner(tournMatch.id, winnerAppId)
              }
            }
          } catch (e) {
            console.error('[room] Tournament auto-advance failed:', e)
          }
        }
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

  private async updateMatchStats(
    finalWinner: 1 | 2,
    onDeltas: (deltaP1: number, deltaP2: number) => void,
  ) {
    const p1 = this.players.get(1)
    const p2 = this.players.get(2)

    // Resolve userIds from in-memory (set at addPlayer) or DB Player records
    const userId1 = p1?.userId ?? (await prisma.player.findFirst({
      where: { sessionId: this.sessionId, slot: 1 },
      select: { userId: true },
    }))?.userId ?? null

    const userId2 = p2?.userId ?? (await prisma.player.findFirst({
      where: { sessionId: this.sessionId, slot: 2 },
      select: { userId: true },
    }))?.userId ?? null

    // Only update stats if both players are registered users
    if (!userId1 || !userId2) return

    const [user1, user2] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId1 }, select: { elo: true, totalXp: true, totalWins: true, totalBattles: true, currentStreak: true, bestStreak: true, lastWinDate: true } }),
      prisma.user.findUnique({ where: { id: userId2 }, select: { elo: true, totalXp: true, totalWins: true, totalBattles: true, currentStreak: true, bestStreak: true, lastWinDate: true } }),
    ])
    if (!user1 || !user2) return

    const winnerId = finalWinner === 1 ? userId1 : userId2
    const loserId  = finalWinner === 1 ? userId2 : userId1
    const winUser  = finalWinner === 1 ? user1 : user2
    const loseUser = finalWinner === 1 ? user2 : user1

    const { newA: newWinElo, newB: newLoseElo, deltaA } = calcElo(winUser.elo, loseUser.elo)
    const winXp  = xpForWin(winUser.elo, loseUser.elo)
    const lossXp = xpForLoss()

    // Streak calculation for winner
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const newStreak = winUser.lastWinDate === today
      ? winUser.currentStreak
      : winUser.lastWinDate === yesterday
        ? winUser.currentStreak + 1
        : 1

    await Promise.all([
      prisma.user.update({
        where: { id: winnerId },
        data: {
          elo:            newWinElo,
          totalXp:        { increment: winXp },
          totalWins:      { increment: 1 },
          totalBattles:   { increment: 1 },
          currentStreak:  newStreak,
          bestStreak:     { set: Math.max(winUser.bestStreak, newStreak) },
          lastWinDate:    today,
        },
      }),
      prisma.user.update({
        where: { id: loserId },
        data: {
          elo:          newLoseElo,
          totalXp:      { increment: lossXp },
          totalBattles: { increment: 1 },
          currentStreak: 0,
        },
      }),
      // ELO history records
      prisma.eloHistory.create({
        data: {
          userId:     winnerId,
          elo:        newWinElo,
          delta:      deltaA,
          won:        true,
          sessionId:  this.sessionId,
          opponentId: loserId,
        },
      }),
      prisma.eloHistory.create({
        data: {
          userId:     loserId,
          elo:        newLoseElo,
          delta:      -deltaA,
          won:        false,
          sessionId:  this.sessionId,
          opponentId: winnerId,
        },
      }),
    ])

    const deltaP1 = finalWinner === 1 ? deltaA : -deltaA
    const deltaP2 = finalWinner === 2 ? deltaA : -deltaA
    onDeltas(deltaP1, deltaP2)

    // ── Clan war score tracking ───────────────────────────────────────────────
    try {
      const [winnerClanMember, loserClanMember] = await Promise.all([
        prisma.clanMember.findFirst({ where: { userId: winnerId }, select: { clanId: true } }),
        prisma.clanMember.findFirst({ where: { userId: loserId },  select: { clanId: true } }),
      ])
      if (winnerClanMember && loserClanMember && winnerClanMember.clanId !== loserClanMember.clanId) {
        const activeWar = await prisma.clanWar.findFirst({
          where: {
            status: 'ACTIVE',
            OR: [
              { clan1Id: winnerClanMember.clanId, clan2Id: loserClanMember.clanId },
              { clan1Id: loserClanMember.clanId,  clan2Id: winnerClanMember.clanId },
            ],
          },
        })
        if (activeWar) {
          const isWinnerClan1 = activeWar.clan1Id === winnerClanMember.clanId
          const updated = await prisma.clanWar.update({
            where: { id: activeWar.id },
            data:  isWinnerClan1 ? { clan1Score: { increment: 1 } } : { clan2Score: { increment: 1 } },
          })
          // Auto-complete if endDate passed
          if (new Date(updated.endDate) < new Date()) {
            const winnerId = updated.clan1Score > updated.clan2Score ? updated.clan1Id
              : updated.clan2Score > updated.clan1Score ? updated.clan2Id : null
            await prisma.clanWar.update({
              where: { id: activeWar.id },
              data: { status: 'DONE', winnerId, ...(winnerId ? {
                clan: winnerId === updated.clan1Id
                  ? { update: { where: { id: updated.clan1Id }, data: { totalWins: { increment: 1 }, totalWars: { increment: 1 } } } }
                  : { update: { where: { id: updated.clan2Id }, data: { totalWins: { increment: 1 }, totalWars: { increment: 1 } } } }
              } : {}) },
            })
          }
        }
      }
    } catch (e) {
      console.error('[room] Clan war score update error:', e)
    }
  }

  private async compilePlayer(player: PlayerConn): Promise<Strategy> {
    if (player.strategy) {
      player.strategy.character = player.skin  // keep character in sync
      return player.strategy
    }

    const code = player.code ?? ''
    const lang = player.lang ?? 'js'

    const strategy = await runInSandbox(code, lang)

    // Wire the player's chosen character into the strategy
    strategy.character = player.skin

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

  private async postBattleProgressUpdates(finalWinner: 1 | 2) {
    const p1 = this.players.get(1)
    const p2 = this.players.get(2)

    const userId1 = p1?.userId ?? (await prisma.player.findFirst({
      where: { sessionId: this.sessionId, slot: 1 },
      select: { userId: true },
    }))?.userId ?? null

    const userId2 = p2?.userId ?? (await prisma.player.findFirst({
      where: { sessionId: this.sessionId, slot: 2 },
      select: { userId: true },
    }))?.userId ?? null

    const winnerId   = finalWinner === 1 ? userId1 : userId2
    const loserId    = finalWinner === 1 ? userId2 : userId1
    const winnerSlot = finalWinner
    const loserSlot: 1 | 2 = finalWinner === 1 ? 2 : 1

    if (winnerId) {
      await prisma.playerProgress.updateMany({
        where: { userId: winnerId },
        data: { winsAfterLastTopic: { increment: 1 } },
      })

      const winResult = await addRatingPoints(winnerId, 'win_normal')
      if (winResult.promoted && winResult.from && winResult.to) {
        this.send(winnerSlot, {
          type: 'division_promoted',
          payload: {
            from: winResult.from,
            to: winResult.to,
            unlockedFeatures: getDivisionUnlockedFeatures(winResult.to),
          },
        })
      }

      const topicResult = await checkTopicUnlock(winnerId)
      if (topicResult.unlocked && topicResult.topic) {
        this.send(winnerSlot, {
          type: 'topic_unlocked',
          payload: {
            topic: topicResult.topic,
            newContextVars: topicResult.newContextVarsUnlocked,
          },
        })
      }
    }

    if (loserId) {
      const lossResult = await addRatingPoints(loserId, 'loss_normal')
      if (lossResult.promoted && lossResult.from && lossResult.to) {
        this.send(loserSlot, {
          type: 'division_promoted',
          payload: {
            from: lossResult.from,
            to: lossResult.to,
            unlockedFeatures: getDivisionUnlockedFeatures(lossResult.to),
          },
        })
      }
    }

    // Send recommendations to both players (fire-and-forget, delay slightly so result screen shows first)
    setTimeout(async () => {
      try {
        if (winnerId) {
          const winRecs = await generateRecommendations(winnerId)
          for (const rec of winRecs.slice(0, 2)) {
            this.send(winnerSlot, { type: 'recommendation', payload: rec as any })
          }
        }
        if (loserId) {
          const lossRecs = await generateRecommendations(loserId)
          for (const rec of lossRecs.slice(0, 2)) {
            this.send(loserSlot, { type: 'recommendation', payload: rec as any })
          }
        }
      } catch (e) {
        console.error('[room] Recommendations send failed:', e)
      }
    }, 3000)
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
