// ─── Enums ────────────────────────────────────────────────────────────────────

export type SessionLevel = 'blocks' | 'code' | 'pro'
export type SessionStatus = 'WAITING' | 'CODING' | 'BATTLE' | 'DONE'
export type SessionFormat = 'bo1' | 'bo3' | 'bo5'
export type SkinId = 'robot' | 'gladiator' | 'boxer' | 'cosmonaut'
export type Lang = 'js' | 'py' | 'cpp' | 'java' | 'auto'

export type ActionName =
  | 'attack'   // basic jab — 12 dmg, costs 10 stamina
  | 'heavy'    // power strike — 28 dmg, costs 35 stamina; MISS if stamina < 35
  | 'laser'    // ranged shot — 20 dmg, costs 20 stamina, CD 3
  | 'shield'   // absorbs 60% dmg; +20 stamina this turn
  | 'dodge'    // evade melee 100% / laser 50%; +10 stamina
  | 'repair'   // heal +20 HP; no stamina cost
  | 'special'  // rage move — 50 dmg; requires rage = 100, resets rage

export type Position = 'close' | 'mid' | 'far'

// ─── Strategy ─────────────────────────────────────────────────────────────────

/**
 * Context passed to strategy(ctx) every turn.
 */
export interface StrategyContext {
  /** Your HP (0–100) */
  myHp: number
  /** Your stamina (0–100). Low stamina = weak attacks or misses */
  myStamina: number
  /** Your rage (0–100). At 100 you can use 'special' */
  myRage: number

  /** Enemy HP */
  enemyHp: number
  /** Enemy stamina — use it to predict if they can heavy-attack */
  enemyStamina: number
  /** Enemy rage — danger when it hits 100 */
  enemyRage: number

  /** Current turn (1–20) */
  turn: number
  myLastAction: ActionName | null
  enemyLastAction: ActionName | null

  /**
   * Remaining cooldown turns for each action. 0 = available.
   */
  cooldowns: {
    attack: number
    heavy: number
    laser: number
    shield: number
    dodge: number
    repair: number
    special: number
  }

  myPosition: Position
  enemyPosition: Position

  /**
   * Current damage multiplier based on your position and your primary action.
   * e.g. heavy at close = 1.5, laser at far = 1.4, attack at far = 0.6
   */
  distanceModifier: number

  /**
   * How many consecutive turns you've used the same action.
   * ≥ 3 triggers repeat penalty (outgoing damage ×0.5).
   */
  myRepeatCount: number
}

export interface Strategy {
  primary: ActionName
  lowHp: ActionName
  onHit: ActionName
  style: 'Aggressive' | 'Defensive' | 'Evasive' | 'Balanced' | 'Standard'
  position: Position
  /** Synchronous per-turn fn (JS strategies via isolated-vm) */
  fn?: (ctx: StrategyContext) => ActionName
  /** Async per-turn fn (Python strategies via persistent subprocess) */
  asyncFn?: (ctx: StrategyContext) => Promise<ActionName>
  /** Cleanup to call when battle session ends */
  dispose?: () => void
}

// ─── Player State ─────────────────────────────────────────────────────────────

export interface Cooldowns {
  attack: number
  heavy: number
  laser: number
  shield: number
  dodge: number
  repair: number
  special: number
}

export interface PlayerState {
  hp: number
  stamina: number
  rage: number
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
  p1Stamina: number
  p2Stamina: number
  p1Rage: number
  p2Rage: number
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

export type ClientMessage =
  | { type: 'connect'; payload: { playerCode: string; name: string; skin: SkinId } }
  | { type: 'ready'; payload: { code: string; lang: Lang } }
  | { type: 'chat'; payload: { message: string } }
  | { type: 'ping'; payload: Record<string, never> }

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
  | { type: 'compile_status'; payload: { status: 'compiling' | 'done' | 'error'; lang?: Lang; p1Done?: boolean; p2Done?: boolean; message?: string } }

export interface LobbyPlayer {
  name: string; skin: SkinId; ready: boolean; lang?: Lang
}

export interface BattlePlayerInfo {
  name: string; skin: SkinId; hp: number
}

// ─── API Types ────────────────────────────────────────────────────────────────

export interface CreateSessionBody {
  name: string; level: SessionLevel; lang: Lang; format: SessionFormat; timeLimit: number; allowedSkins?: SkinId[]
}

export interface JoinSessionBody {
  sessionCode: string; name: string; skin: SkinId
}

export interface JoinSessionResponse {
  sessionId: string; playerSlot: 1 | 2; wsToken: string
}

export interface SessionInfo {
  id: string; name: string; level: SessionLevel; lang: Lang; format: SessionFormat
  timeLimit: number; status: SessionStatus; code1: string; code2: string; createdAt: string
  players: Array<{ slot: number; name: string; skin: SkinId; lang?: Lang }>
}

export interface ApiError {
  error: string; code: string
}
