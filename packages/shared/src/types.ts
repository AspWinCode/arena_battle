// ─── Enums ────────────────────────────────────────────────────────────────────

export type SessionLevel = 'blocks' | 'code' | 'pro'
export type SessionStatus = 'WAITING' | 'CODING' | 'BATTLE' | 'DONE'
export type SessionFormat = 'bo1' | 'bo3' | 'bo5'
export type SkinId = 'robot' | 'gladiator' | 'boxer' | 'cosmonaut'
export type Lang = 'js' | 'py' | 'cpp' | 'java' | 'auto'

export type ActionName = 'attack' | 'laser' | 'shield' | 'dodge' | 'combo' | 'repair'
export type Position = 'close' | 'mid' | 'far'
export type AttackType = 'jab' | 'hook' | 'uppercut' | 'sweep'
export type DodgeDir = 'left' | 'right' | 'back' | 'roll'

// ─── Strategy ─────────────────────────────────────────────────────────────────

export interface Strategy {
  primary: ActionName
  lowHp: ActionName
  onHit: ActionName
  style: 'Aggressive' | 'Defensive' | 'Evasive' | 'Balanced' | 'Standard'
  position: Position
}

// ─── Player State ─────────────────────────────────────────────────────────────

export interface Cooldowns {
  laser: number
  combo: number
  repair: number
  shield: number
}

export interface PlayerState {
  hp: number
  position: Position
  cooldowns: Cooldowns
  lastAction: ActionName | null
  shieldActive: boolean
  strategy: Strategy
}

// ─── Battle Events ────────────────────────────────────────────────────────────

export interface TurnResult {
  turn: number
  p1Action: ActionName
  p2Action: ActionName
  p1DmgTaken: number
  p2DmgTaken: number
  p1HpAfter: number
  p2HpAfter: number
  p1Heal: number
  p2Heal: number
  p1Position: Position
  p2Position: Position
  log: string
}

export interface RoundResult {
  round: number
  winner: 1 | 2 | 0
  p1Hp: number
  p2Hp: number
  reason: 'ko' | 'time'
  turns: TurnResult[]
}

// ─── WebSocket Messages ───────────────────────────────────────────────────────

// Client → Server
export type ClientMessage =
  | { type: 'connect'; payload: { playerCode: string; name: string; skin: SkinId } }
  | { type: 'ready'; payload: { code: string; lang: Lang } }
  | { type: 'chat'; payload: { message: string } }
  | { type: 'ping'; payload: Record<string, never> }

// Server → Client
export type ServerMessage =
  | { type: 'connected'; payload: { slot: 1 | 2; sessionLevel: SessionLevel; allowedSkins: SkinId[] } }
  | { type: 'lobby_update'; payload: { p1: LobbyPlayer | null; p2: LobbyPlayer | null } }
  | { type: 'coding_start'; payload: { timeLimit: number } }
  | { type: 'timer_tick'; payload: { remaining: number } }
  | { type: 'battle_start'; payload: { round: number; p1: BattlePlayerInfo; p2: BattlePlayerInfo } }
  | { type: 'turn_result'; payload: TurnResult }
  | { type: 'round_end'; payload: { round: number; winner: 1 | 2 | 0; p1Hp: number; p2Hp: number; reason: 'ko' | 'time' } }
  | { type: 'match_end'; payload: { winner: 0 | 1 | 2; score: [number, number]; rounds: RoundResult[] } }
  | { type: 'error'; payload: { code: string; message: string } }
  | { type: 'pong'; payload: Record<string, never> }
  | { type: 'compile_status'; payload: { status: 'compiling' | 'done' | 'error'; message?: string } }

export interface LobbyPlayer {
  name: string
  skin: SkinId
  ready: boolean
  lang?: Lang
}

export interface BattlePlayerInfo {
  name: string
  skin: SkinId
  hp: number
}

// ─── API Types ────────────────────────────────────────────────────────────────

export interface CreateSessionBody {
  name: string
  level: SessionLevel
  lang: Lang
  format: SessionFormat
  timeLimit: number
  allowedSkins?: SkinId[]
}

export interface JoinSessionBody {
  sessionCode: string
  name: string
  skin: SkinId
}

export interface JoinSessionResponse {
  sessionId: string
  playerSlot: 1 | 2
  wsToken: string
}

export interface SessionInfo {
  id: string
  name: string
  level: SessionLevel
  lang: Lang
  format: SessionFormat
  timeLimit: number
  status: SessionStatus
  code1: string
  code2: string
  createdAt: string
  players: Array<{
    slot: number
    name: string
    skin: SkinId
    lang?: Lang
  }>
}

export interface ApiError {
  error: string
  code: string
}
