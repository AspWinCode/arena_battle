import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ServerMessage, TurnResult, RoundResult,
  LobbyPlayer, SkinId, SessionLevel, Lang,
} from '@robocode/shared'

type BattlePhase = 'lobby' | 'coding' | 'inter_round' | 'compiling' | 'battle' | 'result'

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
  compileError: string | null

  // Inter-round context
  interRoundScore: [number, number] | null
  nextRound: number | null

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
  eloDelta: { p1: number; p2: number } | null
  divisionPromoted: { from: string; to: string; unlockedFeatures: string[] } | null
  topicUnlocked: { topic: string; newContextVars?: string[] } | null
  availableActions: string[]
  contextVars: string[]

  // Actions
  setSession: (sessionId: string, slot: 1 | 2, level: SessionLevel, skins: SkinId[], token: string, name: string, skin: SkinId) => void
  setCode: (code: string) => void
  setLang: (lang: Lang) => void
  setMySkin: (skin: SkinId) => void
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
  compileError: null,
  interRoundScore: null,
  nextRound: null,
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
  eloDelta: null,
  divisionPromoted: null,
  topicUnlocked: null,
  availableActions: ['attack', 'dodge', 'shield'],
  contextVars: ['hp', 'enemy_hp', 'round'],
}

export const useBattleStore = create<BattleState>()(
  persist(
    (set) => ({
  ...initialState,

  setSession: (sessionId, slot, sessionLevel, allowedSkins, wsToken, myName, mySkin) =>
    set({ sessionId, slot, sessionLevel, allowedSkins, wsToken, myName, mySkin }),

  setCode: (code) => set({ code }),
  setLang: (lang) => set({ lang }),
  setMySkin: (mySkin) => set((state) => ({
    mySkin,
    p1: state.slot === 1 && state.p1 ? { ...state.p1, skin: mySkin } : state.p1,
    p2: state.slot === 2 && state.p2 ? { ...state.p2, skin: mySkin } : state.p2,
  })),

  handleMessage: (msg) => {
    switch (msg.type) {
      case 'connected':
        set({
          slot: msg.payload.slot,
          sessionLevel: msg.payload.sessionLevel,
          allowedSkins: msg.payload.allowedSkins,
          ...(msg.payload.availableActions && { availableActions: msg.payload.availableActions }),
          ...(msg.payload.contextVars && { contextVars: msg.payload.contextVars }),
        })
        break

      case 'lobby_update':
        set({ p1: msg.payload.p1, p2: msg.payload.p2 })
        break

      case 'coding_start': {
        const isInterRound = msg.payload.score !== undefined
        set({
          phase: isInterRound ? 'inter_round' : 'coding',
          timeLeft: msg.payload.timeLimit,
          interRoundScore: msg.payload.score ?? null,
          nextRound: msg.payload.round ?? null,
          compileError: null,
        })
        break
      }

      case 'timer_tick':
        set({ timeLeft: msg.payload.remaining })
        break

      case 'compile_status':
        if (msg.payload.status === 'compiling') set({ phase: 'compiling', compileError: null })
        else if (msg.payload.status === 'done') set({ phase: 'battle', compileError: null })
        else if (msg.payload.status === 'error') {
          // Compile error for THIS player — go back to coding so they can fix it
          set({ phase: 'coding', compileError: msg.payload.message ?? 'Ошибка компиляции' })
        }
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
        set((s) => {
          const newScore: [number, number] = [s.score[0], s.score[1]]
          if (msg.payload.winner === 1) newScore[0]++
          else if (msg.payload.winner === 2) newScore[1]++
          return {
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
            score: newScore,
          }
        })
        break

      case 'match_end':
        set({
          matchWinner: msg.payload.winner,
          score: msg.payload.score,
          completedRounds: msg.payload.rounds,
          phase: 'result',
          eloDelta: msg.payload.eloDelta ?? null,
        })
        break

      case 'division_promoted':
        set({ divisionPromoted: msg.payload })
        break

      case 'topic_unlocked':
        set({ topicUnlocked: msg.payload })
        break
    }
  },

  reset: () => set(initialState),
    }),
    {
      name: 'battle-code',
      // Only persist code + lang — everything else resets per session
      partialize: (state) => ({ code: state.code, lang: state.lang }),
    }
  )
)
