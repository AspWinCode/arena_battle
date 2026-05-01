import { create } from 'zustand'
import type {
  ServerMessage, TurnResult, RoundResult,
  LobbyPlayer, SkinId, SessionLevel, Lang,
} from '@robocode/shared'

type BattlePhase = 'lobby' | 'coding' | 'compiling' | 'battle' | 'result'

interface BattleState {
  // Connection
  sessionId: string | null
  slot: 1 | 2 | null
  sessionLevel: SessionLevel | null
  allowedSkins: SkinId[]
  wsToken: string | null
  // Player identity (saved at join time, before lobby_update arrives)
  myName: string | null
  mySkin: SkinId | null

  // Lobby
  p1: LobbyPlayer | null
  p2: LobbyPlayer | null
  phase: BattlePhase
  timeLeft: number

  // Code
  code: string
  lang: Lang

  // Battle
  currentRound: number
  p1Hp: number
  p2Hp: number
  p1MaxHp: number
  p2MaxHp: number
  p1Stamina: number
  p2Stamina: number
  p1Rage: number
  p2Rage: number
  turns: TurnResult[]
  latestTurn: TurnResult | null
  completedRounds: RoundResult[]
  matchWinner: 0 | 1 | 2 | null  // null = not finished, 0 = draw, 1|2 = winner slot
  score: [number, number]

  // Actions
  setSession: (sessionId: string, slot: 1 | 2, level: SessionLevel, skins: SkinId[], token: string, name: string, skin: SkinId) => void
  setCode: (code: string) => void
  setLang: (lang: Lang) => void
  handleMessage: (msg: ServerMessage) => void
  reset: () => void
}

const initialState = {
  sessionId: null,
  slot: null,
  sessionLevel: null,
  allowedSkins: ['robot', 'gladiator', 'boxer', 'cosmonaut'] as SkinId[],
  wsToken: null,
  myName: null,
  mySkin: null,
  p1: null,
  p2: null,
  phase: 'lobby' as BattlePhase,
  timeLeft: 0,
  code: '',
  lang: 'js' as Lang,
  currentRound: 1,
  p1Hp: 100,
  p2Hp: 100,
  p1MaxHp: 100,
  p2MaxHp: 100,
  p1Stamina: 100,
  p2Stamina: 100,
  p1Rage: 0,
  p2Rage: 0,
  turns: [],
  latestTurn: null,
  completedRounds: [],
  matchWinner: null,
  score: [0, 0] as [number, number],
}

export const useBattleStore = create<BattleState>((set) => ({
  ...initialState,

  setSession: (sessionId, slot, sessionLevel, allowedSkins, wsToken, myName, mySkin) =>
    set({ sessionId, slot, sessionLevel, allowedSkins, wsToken, myName, mySkin }),

  setCode: (code) => set({ code }),
  setLang: (lang) => set({ lang }),

  handleMessage: (msg) => {
    switch (msg.type) {
      case 'connected':
        set({
          slot: msg.payload.slot,
          sessionLevel: msg.payload.sessionLevel,
          allowedSkins: msg.payload.allowedSkins,
        })
        break

      case 'lobby_update':
        set({ p1: msg.payload.p1, p2: msg.payload.p2 })
        break

      case 'coding_start':
        set({ phase: 'coding', timeLeft: msg.payload.timeLimit })
        break

      case 'timer_tick':
        set({ timeLeft: msg.payload.remaining })
        break

      case 'compile_status':
        if (msg.payload.status === 'compiling') set({ phase: 'compiling' })
        else if (msg.payload.status === 'done') set({ phase: 'battle' })
        break

      case 'battle_start':
        set((s) => ({
          phase: 'battle',
          currentRound: msg.payload.round,
          p1: {
            name: msg.payload.p1.name,
            skin: msg.payload.p1.skin,
            ready: s.p1?.ready ?? true,
            lang: s.p1?.lang,
          },
          p2: {
            name: msg.payload.p2.name,
            skin: msg.payload.p2.skin,
            ready: s.p2?.ready ?? true,
            lang: s.p2?.lang,
          },
          p1Hp: msg.payload.p1.hp,
          p2Hp: msg.payload.p2.hp,
          p1MaxHp: msg.payload.p1.hp,
          p2MaxHp: msg.payload.p2.hp,
          turns: [],
          latestTurn: null,
        }))
        break

      case 'turn_result':
        set((s) => ({
          p1Hp: msg.payload.p1HpAfter,
          p2Hp: msg.payload.p2HpAfter,
          p1Stamina: msg.payload.p1Stamina ?? s.p1Stamina,
          p2Stamina: msg.payload.p2Stamina ?? s.p2Stamina,
          p1Rage: msg.payload.p1Rage ?? s.p1Rage,
          p2Rage: msg.payload.p2Rage ?? s.p2Rage,
          turns: [...s.turns, msg.payload],
          latestTurn: msg.payload,
        }))
        break

      case 'round_end':
        set((s) => ({
          completedRounds: [...s.completedRounds, {
            round: msg.payload.round,
            winner: msg.payload.winner,
            p1Hp: msg.payload.p1Hp,
            p2Hp: msg.payload.p2Hp,
            reason: msg.payload.reason,
            turns: s.turns,
          }],
          p1Hp: msg.payload.p1Hp,
          p2Hp: msg.payload.p2Hp,
        }))
        break

      case 'match_end':
        set({
          matchWinner: msg.payload.winner,
          score: msg.payload.score,
          completedRounds: msg.payload.rounds,
          phase: 'result',
        })
        break
    }
  },

  reset: () => set(initialState),
}))
