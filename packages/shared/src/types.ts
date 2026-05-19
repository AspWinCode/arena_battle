// ─── Enums ────────────────────────────────────────────────────────────────────

// Division system
export type Division = 'DIVISION_2' | 'DIVISION_1' | 'PREMIER_LEAGUE'
export type Language = 'PYTHON' | 'JAVASCRIPT' | 'JAVA' | 'CPP'
export type GameTopic =
  | 'PRINT' | 'ASSIGNMENT' | 'VARIABLES_INPUT' | 'SEP_END_LEN' | 'DATA_TYPES'
  | 'ARITHMETIC' | 'MATH_MODULE' | 'LOGIC' | 'IF_ELSE_ELIF' | 'FOR_LOOP'
  | 'WHILE_LOOP' | 'NESTED_LOOPS' | 'INDEXING' | 'STRING_SLICES' | 'ARRAYS_1D'
  | 'ARRAYS_2D' | 'SETS' | 'TUPLES' | 'FUNCTIONS_BASIC' | 'FUNCTIONS_PARAMS'
  | 'LOCAL_VARS' | 'GLOBAL_VARS' | 'FUNCTIONS_RETURN' | 'FUNCTIONS_BOOL'
  | 'FUNCTIONS_MULTI_RETURN' | 'DICTS' | 'SETS_ADVANCED'

export type SessionLevel = 'blocks' | 'code' | 'pro'
export type SessionStatus = 'WAITING' | 'CODING' | 'BATTLE' | 'DONE'
export type SessionFormat = 'bo1' | 'bo3' | 'bo5'
export type SkinId =
  | 'robot'     | 'gladiator' | 'boxer'     | 'cosmonaut'
  | 'ninja'     | 'mage'      | 'paladin'   | 'sniper'
  | 'tank'      | 'vampire'   | 'samurai'   | 'phantom'
  | 'engineer'  | 'berserker' | 'scorpion'  | 'plague'
export type Lang = 'js' | 'py' | 'cpp' | 'java' | 'auto'

export type ActionName =
  | 'attack'   // basic jab — 12 dmg, costs 10 stamina
  | 'heavy'    // power strike — 28 dmg, costs 35 stamina; MISS if stamina < 35
  | 'laser'    // ranged shot — 20 dmg, costs 20 stamina, CD 3
  | 'shield'   // absorbs 60% dmg; +20 stamina this turn
  | 'dodge'    // evade melee 100% / laser 50%; +10 stamina
  | 'repair'   // heal +20 HP; no stamina cost
  | 'special'  // rage move — 50 dmg; requires rage = 100, resets rage
  | 'combo'          // melee combo — 12 dmg base, ×2 if combo streak active
  | 'overcharge'     // charge up — no direct damage, adds charge stack
  | 'reflect'        // defensive — reflects 40% incoming damage back
  | 'adaptive_shield'// adapts to enemy most frequent action
  | 'trap'           // set a delayed damage trap
  | 'hack'           // reveal enemy next action
  | 'sacrifice'      // lose HP, gain massive rage
  | 'reboot'         // reset all cooldowns (limited uses)
  | 'transfer'       // convert stamina to HP
  | 'analyze'        // skip turn, reduce enemy damage next turn
  | 'overclock'      // 2 actions in 1 turn, CD 6

export type Position = 'close' | 'mid' | 'far'

// ─── Strategy ─────────────────────────────────────────────────────────────────

/**
 * Context passed to strategy(ctx) every turn.
 */
export interface StrategyContext {
  // ── Level 1 — basic state ────────────────────────────────────────────────────
  /** Your HP (0–maxHp) */
  myHp: number
  /** Your max HP — depends on chosen character (100–120) */
  myMaxHp: number
  /** Your stamina (0–100). Low stamina = weak attacks or misses */
  myStamina: number
  /** Your rage (0–100). At 100 you can use 'special' */
  myRage: number

  /** Your current position */
  myPosition: Position
  /** Your last action */
  myLastAction: ActionName | null
  /** How many consecutive turns you've used the same action */
  myRepeatCount: number

  /** Enemy HP */
  enemyHp: number
  /** Enemy max HP */
  enemyMaxHp: number
  /** Enemy stamina — use it to predict if they can heavy-attack */
  enemyStamina: number
  /** Enemy rage — danger when it hits 100 */
  enemyRage: number

  /** Enemy position */
  enemyPosition: Position
  /** Enemy last action */
  enemyLastAction: ActionName | null

  /** Current turn (1–20) */
  turn: number

  /**
   * Remaining cooldown turns for each action. 0 = available.
   */
  cooldowns: Record<string, number>

  /**
   * Current damage multiplier based on your position and your primary action.
   * e.g. heavy at close = 1.5, laser at far = 1.4, attack at far = 0.6
   */
  distanceModifier: number

  // ── Level 2 — history (arrays) ───────────────────────────────────────────────
  myHistory: ActionName[]
  enemyHistory: ActionName[]
  /** damage I dealt each turn */
  damageLog: number[]
  /** damage I took each turn */
  damageTakenLog: number[]
  myHpLog: number[]
  enemyHpLog: number[]

  // ── Level 3 — frequency/patterns ─────────────────────────────────────────────
  /** {'attack':5,'heavy':2,...} */
  enemyFrequency: Record<string, number>
  /** avg damage per action type */
  myEfficiency: Record<string, number>
  /** based on enemy HP: >60% early, >30% mid, else late */
  enemyPhase: 'early' | 'mid' | 'late'
  /** last 5 turns analysis */
  enemyTrend: 'aggressive' | 'defensive' | 'mixed'

  // ── Level 4 — simulation/prediction ──────────────────────────────────────────
  simulate: (myAction: string, hisAction: string) => { myHpAfter: number; enemyHpAfter: number; myStaminaAfter: number }
  /** predicts enemy action n steps ahead using markov */
  predict: (n: number) => string
  /** greedy best action via simulate */
  bestAction: () => string
  /** 8x8 matrix [myAction][hisAction] → my damage */
  actionTable: number[][]
  /** transition matrix */
  markov: Record<string, Record<string, number>>

  // ── Sprint 3: ML & visualization ──────────────────────────────────────────
  /**
   * N-gram predictor trained on the full enemy history.
   * More accurate than predict() once 6+ turns of data exist.
   * Usage: const next = ctx.trainedModel.predict(ctx.enemyHistory.slice(-5))
   */
  trainedModel: { predict: (features: string[]) => string }

  /**
   * Minimax state tree for the current turn (depth 1).
   * Each entry = one of YOUR available actions simulated against the predicted enemy move.
   * Sorted best-first; first element has isOptimal=true.
   * Usage: const best = ctx.stateTree[0].action
   */
  stateTree: StateTreeNode[]

  // ── Hack / Analyze extras ──────────────────────────────────────────────────
  /**
   * Set when your hack lands this turn — the enemy's actual chosen action.
   * null/undefined when hack is not active.
   */
  revealedEnemyAction?: ActionName | null
  /**
   * Set the turn after you use analyze — exposes normally-hidden enemy state:
   * their cooldowns, overcharge stack, combo streak, reboot uses.
   */
  enemyDetailedState?: {
    cooldowns: Record<string, number>
    chargeStack: number
    comboStreak: number
    rebootUsed: number
  }
}

export interface StateTreeNode {
  action: ActionName
  /** The enemy action this node was simulated against */
  enemyAction: string
  myHpAfter: number
  enemyHpAfter: number
  /** Net HP advantage: (enemyHpLost) − (yourHpLost). Higher = better for you. */
  score: number
  /** True only for the action with the best expected score */
  isOptimal: boolean
}

export interface Strategy {
  primary: ActionName
  lowHp: ActionName
  onHit: ActionName
  style: 'Aggressive' | 'Defensive' | 'Evasive' | 'Balanced' | 'Standard' | 'Fallback'
  position: Position
  /** Which character skin this strategy belongs to — sets HP, damage multiplier, passive */
  character?: SkinId
  /** Synchronous per-turn fn (JS strategies via isolated-vm) */
  fn?: (ctx: StrategyContext) => ActionName
  /** Async per-turn fn (Python strategies via persistent subprocess) */
  asyncFn?: (ctx: StrategyContext) => Promise<ActionName>
  /** Cleanup to call when battle session ends */
  dispose?: () => void
}

// ─── Player State ─────────────────────────────────────────────────────────────

export type Cooldowns = Record<string, number>

export interface PlayerState {
  hp: number
  stamina: number
  rage: number
  position: Position
  cooldowns: Cooldowns
  lastAction: ActionName | null
  shieldActive: boolean
  reflectActive: boolean
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
  p1PoisonDmg?: number
  p2PoisonDmg?: number
  p1ReflectDmg?: number
  p2ReflectDmg?: number
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
  | { type: 'change_skin'; payload: { skin: SkinId } }
  | { type: 'ready'; payload: { code: string; lang: Lang } }
  | { type: 'chat'; payload: { message: string } }
  | { type: 'ping'; payload: Record<string, never> }

export type ServerMessage =
  | { type: 'connected'; payload: { slot: 1 | 2; sessionLevel: SessionLevel; allowedSkins: SkinId[]; playerDivision?: Division; playerLanguage?: Language; unlockedTopics?: GameTopic[]; availableActions?: string[]; contextVars?: string[] } }
  | { type: 'lobby_update'; payload: { p1: LobbyPlayer | null; p2: LobbyPlayer | null } }
  | { type: 'coding_start'; payload: { timeLimit: number; round?: number; score?: [number, number] } }
  | { type: 'timer_tick'; payload: { remaining: number } }
  | { type: 'battle_start'; payload: { round: number; p1: BattlePlayerInfo; p2: BattlePlayerInfo } }
  | { type: 'turn_result'; payload: TurnResult }
  | { type: 'round_end'; payload: { round: number; winner: 1 | 2 | 0; p1Hp: number; p2Hp: number; reason: 'ko' | 'time' } }
  | { type: 'match_end'; payload: { winner: 0 | 1 | 2; score: [number, number]; rounds: RoundResult[]; eloDelta?: { p1: number; p2: number } } }
  | { type: 'error'; payload: { code: string; message: string } }
  | { type: 'pong'; payload: Record<string, never> }
  | { type: 'compile_status'; payload: { status: 'compiling' | 'done' | 'error'; lang?: Lang; p1Done?: boolean; p2Done?: boolean; message?: string } }
  | { type: 'topic_unlocked'; payload: { topic: GameTopic; newActions?: string[]; newContextVars?: string[] } }
  | { type: 'division_promoted'; payload: { from: Division; to: Division; unlockedFeatures: string[] } }
  | { type: 'recommendation'; payload: { trigger: 'after_loss' | 'after_win' | 'topic_unused'; topic: GameTopic; message: string; codeExample: string; cta: string } }

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
