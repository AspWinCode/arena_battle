import {
  MAX_STAMINA, MAX_RAGE, MAX_TURNS,
  STAMINA_REGEN, STAMINA_COSTS,
  STAMINA_THRESHOLD_HEAVY, STAMINA_THRESHOLD_ATTACK, STAMINA_THRESHOLD_LASER,
  ATTACK_EXHAUSTED_DAMAGE,
  RAGE_PER_DAMAGE,
  BASE_DAMAGE, SHIELD_ABSORB,
  DODGE_LASER_EVADE_CHANCE, DODGE_SPECIAL_ABSORB,
  REPEAT_PENALTY_AFTER, REPEAT_DAMAGE_FACTOR,
  COOLDOWNS, REPAIR_AMOUNT,
  applyPositionModifier, getPositionMultiplier,
  CHARACTER_STATS,
  TRAP_DAMAGE,
  SACRIFICE_HP_COST,
  SACRIFICE_RAGE_GAIN,
  TRANSFER_STAMINA_COST,
  TRANSFER_HP_GAIN,
  OVERCHARGE_DAMAGE_PER_STACK,
  REFLECT_RETURN_RATE,
} from '@robocode/shared'
import type {
  Strategy, StrategyContext, ActionName, SkinId, PlayerState, TurnResult, RoundResult, StateTreeNode,
} from '@robocode/shared'

const ALL_ACTIONS: ActionName[] = [
  'attack', 'heavy', 'laser', 'shield', 'dodge', 'repair', 'special',
  'combo', 'overcharge', 'reflect', 'adaptive_shield', 'trap',
  'hack', 'sacrifice', 'reboot', 'transfer', 'analyze', 'overclock',
]

const VALID_ACTIONS = new Set<ActionName>(ALL_ACTIONS)

function isValidAction(v: unknown): v is ActionName {
  return typeof v === 'string' && VALID_ACTIONS.has(v as ActionName)
}

// ─── 8 primary actions for actionTable ───────────────────────────────────────
const TABLE_ACTIONS: ActionName[] = ['attack', 'heavy', 'laser', 'shield', 'dodge', 'repair', 'special', 'combo']

interface ExtState extends PlayerState {
  repeatCount:  number
  // ── Character identity ───────────────────────────────────────────────────────
  character:    SkinId
  maxHp:        number
  dmgMult:      number
  rageMult:     number
  repairBonus:  number
  shieldBonus:  number
  // ── Active passives ──────────────────────────────────────────────────────────
  hasCounter:          boolean
  counterReady:        boolean   // Boxer: set after successful dodge
  superDodge:          boolean   // Ninja
  shieldHealAmount:    number    // Paladin
  lifestealRate:       number    // Vampire
  bushidoThreshold:    number    // Samurai
  bushidoMult:         number    // Samurai
  flatDmgReduction:    number    // Tank
  specialRageCost:     number    // Engineer (60), others (100)
  rageFromDealt:       boolean   // Berserker
  attackIgnoresDodge:  boolean   // Scorpion
  poisonOnHit:         number    // Plague Doctor: HP/turn applied to enemy
  poisonStacks:        number    // runtime: current incoming poison per turn
  actionDmgOverrides:  Partial<Record<ActionName, number>>  // Sniper
  cooldownOverrides:   Partial<Record<ActionName, number>>  // Phantom, Sniper
  staminaCostOverrides:Partial<Record<ActionName, number>>  // Mage
  // ── New Sprint 2 state ───────────────────────────────────────────────────────
  // History tracking
  history: ActionName[]
  damageDealtLog: number[]
  damageTakenLog: number[]
  hpLog: number[]
  // New action states
  comboStreak: number              // consecutive attack/combo count
  chargeStack: number              // overcharge charge count
  trapTriggerTurns: number[]       // turns when traps will trigger
  rebootUsed: number               // times reboot has been used this round
  hackRevealTurn: number           // turn when hack info was revealed (0 = none)
  analyzedTurn: number             // turn when analyze was used (0 = none)
  defenselessStreak: number        // turns without shield/dodge (for Samurai)
  adaptiveShieldAction: string | null  // action that adaptive_shield is blocking
  // Per-character caps from CharacterStats
  maxChargeStacks: number
  maxRebootUses: number
  sacrificeRageBonus: number
  enhancedLaserFar: boolean
  staminaDrainMult: number
  trapOnDodge: boolean
  comboRequiredStreak: number
  berserkThreshold: number
  berserkMult: number
  bushidoNoDefenseStreak: number
  // ── Phantom подмена ──────────────────────────────────────────────────────────
  phantomMaskCount: number    // increments each turn; every 3rd = fake lastAction shown to enemy
  // ── Plague дебафф ────────────────────────────────────────────────────────────
  debuffedAction:   ActionName | null  // which of MY actions is debuffed (set by enemy Plague)
  debuffTurnsLeft:  number             // how many turns the debuff lasts
  plagueDebuffCount: number            // Plague's own turn counter for triggering debuff
  // ── Overclock ────────────────────────────────────────────────────────────────
  overclockBonus:   number             // extra damage this turn from overclock second action
  // ── Scorpion poison tracking ─────────────────────────────────────────────────
  poisonTicksLeft:  number             // turns remaining on Scorpion poison (clears stacks at 0)
  // ── Plague flat poison (separate from Scorpion stacks) ───────────────────────
  plaguePoison:     number             // flat HP/turn from Plague Doctor's attack
}

export class BattleEngine {
  private p1!: ExtState
  private p2!: ExtState
  private turns: TurnResult[] = []

  constructor(
    private p1Strategy: Strategy,
    private p2Strategy: Strategy,
  ) {}

  private initState(strategy: Strategy): ExtState {
    const charId = strategy.character ?? 'robot'
    const char   = CHARACTER_STATS[charId] ?? CHARACTER_STATS.robot
    // Build full cooldowns record with all actions at 0
    const cooldowns: Record<string, number> = {}
    for (const act of ALL_ACTIONS) cooldowns[act] = 0
    return {
      hp:           char.maxHp,
      stamina:      MAX_STAMINA,
      rage:         0,
      position:     strategy.position ?? 'mid',
      cooldowns,
      lastAction:   null,
      shieldActive: false,
      reflectActive: false,
      strategy,
      repeatCount:  0,
      character:    charId,
      maxHp:        char.maxHp,
      dmgMult:      char.dmgMult,
      rageMult:     char.rageMult,
      repairBonus:  char.repairBonus,
      shieldBonus:  char.shieldBonus,
      hasCounter:          char.hasCounter,
      counterReady:        false,
      superDodge:          char.superDodge,
      shieldHealAmount:    char.shieldHealAmount,
      lifestealRate:       char.lifestealRate,
      bushidoThreshold:    char.bushidoThreshold,
      bushidoMult:         char.bushidoMult,
      flatDmgReduction:    char.flatDmgReduction,
      specialRageCost:     char.specialRageCost,
      rageFromDealt:       char.rageFromDealt,
      attackIgnoresDodge:  char.attackIgnoresDodge,
      poisonOnHit:         char.poisonOnHit,
      poisonStacks:        0,
      actionDmgOverrides:  char.actionDmgOverrides,
      cooldownOverrides:   char.cooldownOverrides,
      staminaCostOverrides:char.staminaCostOverrides,
      // Sprint 2 fields
      history:         [],
      damageDealtLog:  [],
      damageTakenLog:  [],
      hpLog:           [],
      comboStreak:     0,
      chargeStack:     0,
      trapTriggerTurns: [],
      rebootUsed:      0,
      hackRevealTurn:  0,
      analyzedTurn:    0,
      defenselessStreak: 0,
      adaptiveShieldAction: null,
      maxChargeStacks:      char.maxChargeStacks,
      maxRebootUses:        char.maxRebootUses,
      sacrificeRageBonus:   char.sacrificeRageBonus,
      enhancedLaserFar:     char.enhancedLaserFar,
      staminaDrainMult:     char.staminaDrainMult,
      trapOnDodge:          char.trapOnDodge,
      comboRequiredStreak:  char.comboRequiredStreak,
      berserkThreshold:     char.berserkThreshold,
      berserkMult:          char.berserkMult,
      bushidoNoDefenseStreak: char.bushidoNoDefenseStreak,
      phantomMaskCount:  0,
      debuffedAction:    null,
      debuffTurnsLeft:   0,
      plagueDebuffCount: 0,
      overclockBonus:    0,
      poisonTicksLeft:   0,
      plaguePoison:      0,
    }
  }

  async runRound(roundNumber: number): Promise<RoundResult> {
    this.p1 = this.initState(this.p1Strategy)
    this.p2 = this.initState(this.p2Strategy)
    this.turns = []

    for (let turn = 1; turn <= MAX_TURNS; turn++) {
      const result = await this.resolveTurn(turn)
      this.turns.push(result)
      if (this.p1.hp <= 0 || this.p2.hp <= 0) break
    }

    const winner: 1 | 2 | 0 =
      this.p1.hp <= 0 && this.p2.hp <= 0 ? 0 :
      this.p1.hp <= 0 ? 2 :
      this.p2.hp <= 0 ? 1 :
      this.p1.hp > this.p2.hp ? 1 :
      this.p2.hp > this.p1.hp ? 2 : 0

    return {
      round: roundNumber, winner,
      p1Hp: Math.max(0, this.p1.hp),
      p2Hp: Math.max(0, this.p2.hp),
      reason: (this.p1.hp <= 0 || this.p2.hp <= 0) ? 'ko' : 'time',
      turns: this.turns,
    }
  }

  // ── Context ─────────────────────────────────────────────────────────────────

  private buildContext(self: ExtState, enemy: ExtState, turn: number, revealedEnemyAction?: ActionName | null): StrategyContext {
    // Build enemy frequency map
    const enemyFrequency: Record<string, number> = {}
    for (const act of enemy.history) {
      enemyFrequency[act] = (enemyFrequency[act] ?? 0) + 1
    }

    // Build markov transition matrix from enemy history
    const markov: Record<string, Record<string, number>> = {}
    for (let i = 0; i < enemy.history.length - 1; i++) {
      const from = enemy.history[i]
      const to   = enemy.history[i + 1]
      if (!markov[from]) markov[from] = {}
      markov[from][to] = (markov[from][to] ?? 0) + 1
    }

    // Enemy phase based on enemy HP
    const enemyHpRatio = enemy.hp / enemy.maxHp
    const enemyPhase: 'early' | 'mid' | 'late' =
      enemyHpRatio > 0.6 ? 'early' : enemyHpRatio > 0.3 ? 'mid' : 'late'

    // Enemy trend: analyse last 5 turns
    const recent = enemy.history.slice(-5)
    const aggressiveActions = new Set(['attack', 'heavy', 'laser', 'special', 'combo', 'overcharge', 'sacrifice'])
    const defensiveActions  = new Set(['shield', 'dodge', 'repair', 'reflect', 'adaptive_shield', 'reboot', 'transfer', 'analyze'])
    let aggressiveCount = 0
    let defensiveCount  = 0
    for (const act of recent) {
      if (aggressiveActions.has(act)) aggressiveCount++
      else if (defensiveActions.has(act)) defensiveCount++
    }
    const enemyTrend: 'aggressive' | 'defensive' | 'mixed' =
      aggressiveCount > defensiveCount + 1 ? 'aggressive' :
      defensiveCount > aggressiveCount + 1 ? 'defensive' : 'mixed'

    // Build myEfficiency: avg damage per action type
    const myEfficiency: Record<string, number> = {}
    const damageByAction: Record<string, number[]> = {}
    for (let i = 0; i < self.history.length; i++) {
      const act = self.history[i]
      const dmg = self.damageDealtLog[i] ?? 0
      if (!damageByAction[act]) damageByAction[act] = []
      damageByAction[act].push(dmg)
    }
    for (const [act, dmgs] of Object.entries(damageByAction)) {
      myEfficiency[act] = dmgs.reduce((a, b) => a + b, 0) / dmgs.length
    }

    // Snapshot of cooldowns
    const cooldowns: Record<string, number> = { ...self.cooldowns }

    // simulate closure
    const simulate = (myAct: string, hisAct: string): { myHpAfter: number; enemyHpAfter: number; myStaminaAfter: number } => {
      const myDmg  = BASE_DAMAGE[myAct  as ActionName] ?? 0
      const hisDmg = BASE_DAMAGE[hisAct as ActionName] ?? 0
      const myAfterDmg  = hisAct === 'shield' ? Math.round(hisDmg * 0.4) : hisAct === 'dodge' ? 0 : hisDmg
      const hisAfterDmg = myAct  === 'shield' ? Math.round(myDmg  * 0.4) : myAct  === 'dodge' ? 0 : myDmg
      const myStamCost = STAMINA_COSTS[myAct as ActionName] ?? 0
      return {
        myHpAfter:      Math.max(0, self.hp  - myAfterDmg),
        enemyHpAfter:   Math.max(0, enemy.hp - hisAfterDmg),
        myStaminaAfter: Math.max(0, self.stamina - myStamCost),
      }
    }

    // predict closure using markov
    const predict = (n: number): string => {
      let current: string = enemy.lastAction ?? 'attack'
      for (let i = 0; i < n; i++) {
        const probs = markov[current]
        if (!probs || Object.keys(probs).length === 0) break
        current = Object.keys(probs).reduce((a, b) => (probs[a] > probs[b] ? a : b))
      }
      return current
    }

    // bestAction closure
    const bestAction = (): string => {
      const predicted = predict(1)
      let bestAct = 'attack'
      let bestScore = -Infinity
      for (const act of TABLE_ACTIONS) {
        const { enemyHpAfter, myHpAfter } = simulate(act, predicted)
        const score = (enemy.hp - enemyHpAfter) - (self.hp - myHpAfter)
        if (score > bestScore) { bestScore = score; bestAct = act }
      }
      return bestAct
    }

    // actionTable: 8×8 matrix
    const actionTable: number[][] = TABLE_ACTIONS.map(myAct =>
      TABLE_ACTIONS.map(hisAct => {
        const { enemyHpAfter } = simulate(myAct, hisAct)
        return enemy.hp - enemyHpAfter
      })
    )

    // ── trainedModel: n-gram predictor (3→2→1-gram, falls back to markov) ────
    const trainedModel = {
      predict: (features: string[]): string => {
        if (features.length === 0) return predict(1)
        // Try longest matching n-gram first
        for (const n of [3, 2, 1]) {
          if (features.length < n) continue
          const key = features.slice(-n).join(',')
          const counts: Record<string, number> = {}
          for (let i = n; i < enemy.history.length; i++) {
            const pat = enemy.history.slice(i - n, i).join(',')
            if (pat === key) {
              const next = enemy.history[i]
              counts[next] = (counts[next] ?? 0) + 1
            }
          }
          if (Object.keys(counts).length > 0) {
            return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b)
          }
        }
        return predict(1)  // fallback to markov single-step
      },
    }

    // ── stateTree: depth-1 minimax vs predicted enemy move ────────────────────
    const predictedForTree = predict(1) as ActionName
    const rawTree: StateTreeNode[] = TABLE_ACTIONS.map(act => {
      const { myHpAfter, enemyHpAfter } = simulate(act, predictedForTree)
      return {
        action: act,
        enemyAction: predictedForTree,
        myHpAfter,
        enemyHpAfter,
        score: (enemy.hp - enemyHpAfter) - (self.hp - myHpAfter),
        isOptimal: false,
      }
    }).sort((a, b) => b.score - a.score)
    if (rawTree.length > 0) rawTree[0].isOptimal = true

    // ── Phantom подмена: every 3rd turn show fake lastAction ─────────────────
    let maskedEnemyLastAction = enemy.lastAction
    if (enemy.character === 'phantom' && enemy.phantomMaskCount > 0 && enemy.phantomMaskCount % 3 === 0) {
      const opts = CHARACTER_STATS.phantom.allowedActions
      maskedEnemyLastAction = opts[Math.floor(Math.random() * opts.length)] as ActionName
    }

    return {
      myHp:         self.hp,
      myMaxHp:      self.maxHp,
      myStamina:    self.stamina,
      myRage:       self.rage,
      myPosition:   self.position,
      myLastAction: self.lastAction,
      myRepeatCount: self.repeatCount,
      enemyHp:      enemy.hp,
      enemyMaxHp:   enemy.maxHp,
      enemyStamina: enemy.stamina,
      enemyRage:    enemy.rage,
      enemyPosition: enemy.position,
      enemyLastAction: maskedEnemyLastAction,
      turn,
      cooldowns,
      distanceModifier: getPositionMultiplier(self.strategy.primary, self.position),
      // Level 2
      myHistory:     [...self.history],
      enemyHistory:  [...enemy.history],
      damageLog:     [...self.damageDealtLog],
      damageTakenLog: [...self.damageTakenLog],
      myHpLog:       [...self.hpLog],
      enemyHpLog:    [...enemy.hpLog],
      // Level 3
      enemyFrequency,
      myEfficiency,
      enemyPhase,
      enemyTrend,
      // Level 4
      simulate,
      predict,
      bestAction,
      actionTable,
      markov,
      trainedModel,
      stateTree: rawTree,
      // ── Hack: actual enemy action this turn ──────────────────────────────────
      revealedEnemyAction: revealedEnemyAction ?? null,
      // ── Analyze: enemy hidden state (available turn after analyze) ────────────
      enemyDetailedState: self.analyzedTurn === turn - 1 ? {
        cooldowns:   { ...enemy.cooldowns },
        chargeStack: enemy.chargeStack,
        comboStreak: enemy.comboStreak,
        rebootUsed:  enemy.rebootUsed,
      } : undefined,
    }
  }

  // ── Action selection ────────────────────────────────────────────────────────

  private isActionAllowed(self: ExtState, action: ActionName): boolean {
    const char = CHARACTER_STATS[self.character]
    if (!char.allowedActions || char.allowedActions.length === 0) return true
    return char.allowedActions.includes(action)
  }

  private async pickActionAsync(self: ExtState, enemy: ExtState, turn: number, revealedEnemyAction?: ActionName | null): Promise<ActionName> {
    const ctx = this.buildContext(self, enemy, turn, revealedEnemyAction)

    if (self.strategy.asyncFn) {
      try {
        const chosen = await self.strategy.asyncFn(ctx)
        if (isValidAction(chosen) && this.isActionAllowed(self, chosen) && this.isActionAvailable(self, chosen)) return chosen
      } catch { /* fall through */ }
    }
    if (self.strategy.fn) {
      try {
        const chosen = self.strategy.fn(ctx)
        if (isValidAction(chosen) && this.isActionAllowed(self, chosen) && this.isActionAvailable(self, chosen)) return chosen
      } catch { /* fall through */ }
    }
    return this.pickStaticAction(self, enemy)
  }

  private pickStaticAction(self: ExtState, enemy: ExtState): ActionName {
    const { strategy } = self
    // Use the first available action from allowedActions for special
    if (self.rage >= self.specialRageCost && this.isActionAllowed(self, 'special') && this.isActionAvailable(self, 'special')) return 'special'
    if (self.hp < 30) return this.resolveStaticAction(self, strategy.lowHp)
    if (enemy.lastAction === 'laser' && strategy.onHit === 'dodge' && this.isActionAllowed(self, 'dodge')) return 'dodge'
    if (enemy.shieldActive && (strategy.primary === 'attack' || strategy.primary === 'heavy') && this.isActionAllowed(self, 'heavy')) return 'heavy'
    return this.resolveStaticAction(self, strategy.primary)
  }

  private isActionAvailable(state: ExtState, action: ActionName): boolean {
    if ((state.cooldowns[action] ?? 0) > 0) return false
    if (action === 'special' && state.rage < state.specialRageCost) return false
    if (action === 'reboot' && state.rebootUsed >= state.maxRebootUses) return false
    return true
  }

  private resolveStaticAction(self: ExtState, act: ActionName): ActionName {
    if (!this.isActionAvailable(self, act) || !this.isActionAllowed(self, act)) {
      // Try fallback actions in order of character's allowed list
      const allowed = CHARACTER_STATS[self.character].allowedActions
      if (allowed && allowed.length > 0) {
        for (const fallback of allowed) {
          if (fallback !== act && this.isActionAvailable(self, fallback)) return fallback
        }
      }
      // Generic fallbacks
      if (act === 'heavy')  return (self.cooldowns['laser'] ?? 0) === 0 && this.isActionAllowed(self, 'laser') ? 'laser' : 'attack'
      if (act === 'laser')  return 'attack'
      if (act === 'repair') return this.isActionAllowed(self, 'shield') ? 'shield' : 'attack'
      if (act === 'shield') return 'attack'
      return 'attack'
    }
    return act
  }

  // ── Turn resolution ─────────────────────────────────────────────────────────

  private async resolveTurn(turn: number): Promise<TurnResult> {
    this.p1.stamina = Math.min(MAX_STAMINA, this.p1.stamina + STAMINA_REGEN)
    this.p2.stamina = Math.min(MAX_STAMINA, this.p2.stamina + STAMINA_REGEN)

    // Reset reflect each turn
    this.p1.reflectActive = false
    this.p2.reflectActive = false

    // ── Hack: the hacked player picks AFTER enemy, seeing their real action ────
    let a1: ActionName
    let a2: ActionName
    const p1Hacked = this.p1.hackRevealTurn === turn
    const p2Hacked = this.p2.hackRevealTurn === turn
    if (p1Hacked && !p2Hacked) {
      a2 = await this.pickActionAsync(this.p2, this.p1, turn)
      a1 = await this.pickActionAsync(this.p1, this.p2, turn, a2)
    } else if (p2Hacked && !p1Hacked) {
      a1 = await this.pickActionAsync(this.p1, this.p2, turn)
      a2 = await this.pickActionAsync(this.p2, this.p1, turn, a1)
    } else {
      ;[a1, a2] = await Promise.all([
        this.pickActionAsync(this.p1, this.p2, turn),
        this.pickActionAsync(this.p2, this.p1, turn),
      ])
    }

    this.p1.repeatCount = a1 === this.p1.lastAction ? this.p1.repeatCount + 1 : 1
    this.p2.repeatCount = a2 === this.p2.lastAction ? this.p2.repeatCount + 1 : 1

    this.p1.shieldActive = a1 === 'shield'
    this.p2.shieldActive = a2 === 'shield'

    // Reflect active this turn
    if (a1 === 'reflect') this.p1.reflectActive = true
    if (a2 === 'reflect') this.p2.reflectActive = true

    // ── Trap check: check if any trap triggers this turn ─────────────────────
    let p1TrapDmg = 0
    let p2TrapDmg = 0
    // p2's traps hitting p1
    this.p2.trapTriggerTurns = this.p2.trapTriggerTurns.filter(t => {
      if (t === turn) {
        // Trigger if p1 is attacking OR if ninja trapOnDodge and p1 is dodging
        const triggerOnAttack = ['attack', 'heavy', 'laser', 'special', 'combo'].includes(a1)
        const triggerOnDodge  = this.p2.trapOnDodge && a1 === 'dodge'
        if (triggerOnAttack || triggerOnDodge) { p1TrapDmg += TRAP_DAMAGE; return false }
        return false // trap expires even if not triggered
      }
      return true
    })
    // p1's traps hitting p2
    this.p1.trapTriggerTurns = this.p1.trapTriggerTurns.filter(t => {
      if (t === turn) {
        const triggerOnAttack = ['attack', 'heavy', 'laser', 'special', 'combo'].includes(a2)
        const triggerOnDodge  = this.p1.trapOnDodge && a2 === 'dodge'
        if (triggerOnAttack || triggerOnDodge) { p2TrapDmg += TRAP_DAMAGE; return false }
        return false
      }
      return true
    })

    // ── Pre-action: special new actions (self-effects, no damage yet) ─────────
    // sacrifice
    if (a1 === 'sacrifice') {
      this.p1.hp   = Math.max(1, this.p1.hp - SACRIFICE_HP_COST)
      this.p1.rage = Math.min(MAX_RAGE, this.p1.rage + SACRIFICE_RAGE_GAIN + this.p1.sacrificeRageBonus)
    }
    if (a2 === 'sacrifice') {
      this.p2.hp   = Math.max(1, this.p2.hp - SACRIFICE_HP_COST)
      this.p2.rage = Math.min(MAX_RAGE, this.p2.rage + SACRIFICE_RAGE_GAIN + this.p2.sacrificeRageBonus)
    }
    // reboot
    if (a1 === 'reboot' && this.p1.rebootUsed < this.p1.maxRebootUses) {
      for (const k of Object.keys(this.p1.cooldowns)) this.p1.cooldowns[k] = 0
      this.p1.rebootUsed++
    }
    if (a2 === 'reboot' && this.p2.rebootUsed < this.p2.maxRebootUses) {
      for (const k of Object.keys(this.p2.cooldowns)) this.p2.cooldowns[k] = 0
      this.p2.rebootUsed++
    }
    // transfer (generic: stamina→HP | Mage: rage→bonus damage)
    if (a1 === 'transfer') {
      if (this.p1.character === 'mage' && this.p1.rage > 0) {
        this.p1.overclockBonus += Math.floor(this.p1.rage / 2)  // rage ÷2 → bonus damage
        this.p1.rage = 0
      } else if (this.p1.stamina >= TRANSFER_STAMINA_COST) {
        this.p1.stamina -= TRANSFER_STAMINA_COST
        this.p1.hp = Math.min(this.p1.maxHp, this.p1.hp + TRANSFER_HP_GAIN)
      }
    }
    if (a2 === 'transfer') {
      if (this.p2.character === 'mage' && this.p2.rage > 0) {
        this.p2.overclockBonus += Math.floor(this.p2.rage / 2)
        this.p2.rage = 0
      } else if (this.p2.stamina >= TRANSFER_STAMINA_COST) {
        this.p2.stamina -= TRANSFER_STAMINA_COST
        this.p2.hp = Math.min(this.p2.maxHp, this.p2.hp + TRANSFER_HP_GAIN)
      }
    }
    // overcharge
    if (a1 === 'overcharge') {
      this.p1.chargeStack = Math.min(this.p1.maxChargeStacks, this.p1.chargeStack + 1)
    }
    if (a2 === 'overcharge') {
      this.p2.chargeStack = Math.min(this.p2.maxChargeStacks, this.p2.chargeStack + 1)
    }
    // trap placement
    if (a1 === 'trap') {
      const maxTraps = this.p1.character === 'engineer' ? 2 : 1
      if (this.p1.trapTriggerTurns.length < maxTraps) {
        this.p1.trapTriggerTurns.push(turn + 4)
      }
    }
    if (a2 === 'trap') {
      const maxTraps = this.p2.character === 'engineer' ? 2 : 1
      if (this.p2.trapTriggerTurns.length < maxTraps) {
        this.p2.trapTriggerTurns.push(turn + 4)
      }
    }
    // hack
    if (a1 === 'hack') this.p1.hackRevealTurn = turn + 1
    if (a2 === 'hack') this.p2.hackRevealTurn = turn + 1
    // analyze
    if (a1 === 'analyze') this.p1.analyzedTurn = turn
    if (a2 === 'analyze') this.p2.analyzedTurn = turn

    // ── Plague дебафф: every 3 turns debuff enemy's most frequent action ──────
    if (this.p1.character === 'plague') {
      this.p1.plagueDebuffCount++
      if (this.p1.plagueDebuffCount % 3 === 0) {
        const freq = this.computeFrequency(this.p2.history)
        const target = this.mostFrequent(freq) ?? a2
        this.p2.debuffedAction   = target as ActionName
        this.p2.debuffTurnsLeft  = 2
      }
    }
    if (this.p2.character === 'plague') {
      this.p2.plagueDebuffCount++
      if (this.p2.plagueDebuffCount % 3 === 0) {
        const freq = this.computeFrequency(this.p1.history)
        const target = this.mostFrequent(freq) ?? a1
        this.p1.debuffedAction   = target as ActionName
        this.p1.debuffTurnsLeft  = 2
      }
    }

    // ── Overclock: pick second action and add its damage as bonus ────────────
    this.p1.overclockBonus = 0
    this.p2.overclockBonus = 0
    if (a1 === 'overclock' && this.p1.stamina >= 40) {
      const a1b = this.pickStaticAction(this.p1, this.p2)
      if (a1b !== 'overclock') {
        this.p1.overclockBonus = Math.round(this.calcDamage(a1b, this.p1, a2, this.p2))
        this.applyCooldown(this.p1, a1b)
      }
    }
    if (a2 === 'overclock' && this.p2.stamina >= 40) {
      const a2b = this.pickStaticAction(this.p2, this.p1)
      if (a2b !== 'overclock') {
        this.p2.overclockBonus = Math.round(this.calcDamage(a2b, this.p2, a1, this.p1))
        this.applyCooldown(this.p2, a2b)
      }
    }
    // adaptive_shield: determine what to block based on enemy frequency
    if (a1 === 'adaptive_shield') {
      const freq = this.computeFrequency(this.p2.history)
      this.p1.adaptiveShieldAction = this.mostFrequent(freq)
    }
    if (a2 === 'adaptive_shield') {
      const freq = this.computeFrequency(this.p1.history)
      this.p2.adaptiveShieldAction = this.mostFrequent(freq)
    }

    const p1Factor = this.p1.repeatCount >= REPEAT_PENALTY_AFTER ? REPEAT_DAMAGE_FACTOR : 1
    const p2Factor = this.p2.repeatCount >= REPEAT_PENALTY_AFTER ? REPEAT_DAMAGE_FACTOR : 1

    // Base damage
    let p2DmgDealt = Math.round(this.calcDamage(a1, this.p1, a2, this.p2) * p1Factor)
    let p1DmgDealt = Math.round(this.calcDamage(a2, this.p2, a1, this.p1) * p2Factor)

    // ── Reflect mechanic ─────────────────────────────────────────────────────
    let p1ReflectDmg = 0
    let p2ReflectDmg = 0
    if (this.p2.reflectActive && p1DmgDealt > 0) {
      // p2 is reflecting: p2 takes reduced damage, p1 takes reflect damage
      p2ReflectDmg = Math.round(p1DmgDealt * REFLECT_RETURN_RATE)
      p1DmgDealt   = Math.round(p1DmgDealt * (1 - REFLECT_RETURN_RATE))
      // reflect damage added to p1's taken later
    }
    if (this.p1.reflectActive && p2DmgDealt > 0) {
      p1ReflectDmg = Math.round(p2DmgDealt * REFLECT_RETURN_RATE)
      p2DmgDealt   = Math.round(p2DmgDealt * (1 - REFLECT_RETURN_RATE))
    }

    // ── Adaptive shield: block if enemy used the predicted action ────────────
    if (this.p1.adaptiveShieldAction && a2 === this.p1.adaptiveShieldAction) {
      p1DmgDealt = 0
      this.p1.adaptiveShieldAction = null
    }
    if (this.p2.adaptiveShieldAction && a1 === this.p2.adaptiveShieldAction) {
      p2DmgDealt = 0
      this.p2.adaptiveShieldAction = null
    }

    // ── Boxer counter-strike ─────────────────────────────────────────────────
    if (this.p1.counterReady && a1 !== 'attack') this.p1.counterReady = false
    if (this.p2.counterReady && a2 !== 'attack') this.p2.counterReady = false
    if (this.p1.counterReady && a1 === 'attack' && p2DmgDealt > 0) {
      p2DmgDealt = Math.round(p2DmgDealt * 2); this.p1.counterReady = false
    }
    if (this.p2.counterReady && a2 === 'attack' && p1DmgDealt > 0) {
      p1DmgDealt = Math.round(p1DmgDealt * 2); this.p2.counterReady = false
    }
    if (this.p1.hasCounter && a1 === 'dodge' && (a2 === 'attack' || a2 === 'heavy')) this.p1.counterReady = true
    if (this.p2.hasCounter && a2 === 'dodge' && (a1 === 'attack' || a1 === 'heavy')) this.p2.counterReady = true

    // ── Vampire lifesteal ────────────────────────────────────────────────────
    const p1Lifesteal = (this.p1.lifestealRate > 0 && (a1 === 'attack' || a1 === 'heavy') && p2DmgDealt > 0)
      ? Math.round(p2DmgDealt * this.p1.lifestealRate) : 0
    const p2Lifesteal = (this.p2.lifestealRate > 0 && (a2 === 'attack' || a2 === 'heavy') && p1DmgDealt > 0)
      ? Math.round(p1DmgDealt * this.p2.lifestealRate) : 0

    // ── Mage stamina drain ───────────────────────────────────────────────────
    if (this.p1.staminaDrainMult > 0 && p2DmgDealt > 0) {
      const extraDrain = Math.floor((BASE_DAMAGE[a1] ?? 0) * this.p1.staminaDrainMult * 0.5)
      this.p2.stamina = Math.max(0, this.p2.stamina - extraDrain)
    }
    if (this.p2.staminaDrainMult > 0 && p1DmgDealt > 0) {
      const extraDrain = Math.floor((BASE_DAMAGE[a2] ?? 0) * this.p2.staminaDrainMult * 0.5)
      this.p1.stamina = Math.max(0, this.p1.stamina - extraDrain)
    }

    this.applyStaminaCost(this.p1, a1)
    this.applyStaminaCost(this.p2, a2)

    if (a1 === 'special') this.p1.rage = 0
    if (a2 === 'special') this.p2.rage = 0

    // ── Healing: repair (+ Cosmonaut bonus) + Paladin shield heal + transfer ─
    let p1Heal = a1 === 'repair' ? REPAIR_AMOUNT + this.p1.repairBonus : 0
    if (a1 === 'shield' && this.p1.shieldHealAmount > 0) p1Heal += this.p1.shieldHealAmount
    p1Heal += p1Lifesteal

    let p2Heal = a2 === 'repair' ? REPAIR_AMOUNT + this.p2.repairBonus : 0
    if (a2 === 'shield' && this.p2.shieldHealAmount > 0) p2Heal += this.p2.shieldHealAmount
    p2Heal += p2Lifesteal

    // Apply all damage (base + reflect + trap + overclock)
    const p1TotalDmg = p1DmgDealt + p2ReflectDmg + p1TrapDmg
    const p2TotalDmg = p2DmgDealt + p1ReflectDmg + p2TrapDmg + this.p1.overclockBonus

    this.p1.hp = Math.min(this.p1.maxHp, Math.max(0, this.p1.hp - p1TotalDmg + p1Heal))
    this.p2.hp = Math.min(this.p2.maxHp, Math.max(0, this.p2.hp - p2TotalDmg + p2Heal))

    // ── Scorpion / Plague: apply new poison ──────────────────────────────────
    // Scorpion: stacking poison (+1 stack per hit, max 3), expires after 5 ticks
    if (this.p1.character === 'scorpion' && (a1 === 'attack' || a1 === 'heavy') && p2DmgDealt > 0) {
      this.p2.poisonStacks  = Math.min(3, this.p2.poisonStacks + 1)
      this.p2.poisonTicksLeft = Math.max(this.p2.poisonTicksLeft, 5)
    }
    if (this.p2.character === 'scorpion' && (a2 === 'attack' || a2 === 'heavy') && p1DmgDealt > 0) {
      this.p1.poisonStacks  = Math.min(3, this.p1.poisonStacks + 1)
      this.p1.poisonTicksLeft = Math.max(this.p1.poisonTicksLeft, 5)
    }
    // Plague Doctor: flat 4 HP/turn poison until end of round
    if (this.p1.character === 'plague' && (a1 === 'attack' || a1 === 'heavy') && p2DmgDealt > 0) {
      this.p2.plaguePoison = this.p1.poisonOnHit  // 4 HP/turn
    }
    if (this.p2.character === 'plague' && (a2 === 'attack' || a2 === 'heavy') && p1DmgDealt > 0) {
      this.p1.plaguePoison = this.p2.poisonOnHit
    }

    // ── Poison tick (after all damage is applied) ────────────────────────────
    let p1PoisonDmg = 0
    let p2PoisonDmg = 0
    // Tank is immune to all poison
    if (this.p1.character !== 'tank') {
      p1PoisonDmg = this.p1.poisonStacks * 3 + this.p1.plaguePoison
      if (p1PoisonDmg > 0) this.p1.hp = Math.max(0, this.p1.hp - p1PoisonDmg)
      // Scorpion poison expiry
      if (this.p1.poisonTicksLeft > 0) {
        this.p1.poisonTicksLeft--
        if (this.p1.poisonTicksLeft === 0) this.p1.poisonStacks = 0
      }
    }
    if (this.p2.character !== 'tank') {
      p2PoisonDmg = this.p2.poisonStacks * 3 + this.p2.plaguePoison
      if (p2PoisonDmg > 0) this.p2.hp = Math.max(0, this.p2.hp - p2PoisonDmg)
      if (this.p2.poisonTicksLeft > 0) {
        this.p2.poisonTicksLeft--
        if (this.p2.poisonTicksLeft === 0) this.p2.poisonStacks = 0
      }
    }

    // ── Rage accumulation ────────────────────────────────────────────────────
    // Base: rage from damage taken
    if (p1TotalDmg > 0) this.p1.rage = Math.min(MAX_RAGE, this.p1.rage + p1TotalDmg * RAGE_PER_DAMAGE * this.p1.rageMult)
    if (p2TotalDmg > 0) this.p2.rage = Math.min(MAX_RAGE, this.p2.rage + p2TotalDmg * RAGE_PER_DAMAGE * this.p2.rageMult)
    // Berserker: also gain rage from damage dealt
    if (this.p1.rageFromDealt && p2DmgDealt > 0) this.p1.rage = Math.min(MAX_RAGE, this.p1.rage + p2DmgDealt * RAGE_PER_DAMAGE)
    if (this.p2.rageFromDealt && p1DmgDealt > 0) this.p2.rage = Math.min(MAX_RAGE, this.p2.rage + p1DmgDealt * RAGE_PER_DAMAGE)

    this.tickCooldowns(this.p1); this.tickCooldowns(this.p2)
    this.applyCooldown(this.p1, a1); this.applyCooldown(this.p2, a2)

    // ── Update combo streak ───────────────────────────────────────────────────
    if (a1 === 'attack' || a1 === 'combo') this.p1.comboStreak++
    else this.p1.comboStreak = 0
    if (a2 === 'attack' || a2 === 'combo') this.p2.comboStreak++
    else this.p2.comboStreak = 0

    // ── Update defenseless streak (Samurai) ──────────────────────────────────
    if (a1 === 'shield' || a1 === 'dodge') this.p1.defenselessStreak = 0
    else this.p1.defenselessStreak++
    if (a2 === 'shield' || a2 === 'dodge') this.p2.defenselessStreak = 0
    else this.p2.defenselessStreak++

    this.p1.lastAction = a1; this.p2.lastAction = a2
    this.updatePosition(this.p1, a1); this.updatePosition(this.p2, a2)

    // ── Phantom maskCount ────────────────────────────────────────────────────
    if (this.p1.character === 'phantom') this.p1.phantomMaskCount++
    if (this.p2.character === 'phantom') this.p2.phantomMaskCount++

    // ── Plague debuff tick ───────────────────────────────────────────────────
    if (this.p1.debuffTurnsLeft > 0) {
      this.p1.debuffTurnsLeft--
      if (this.p1.debuffTurnsLeft === 0) this.p1.debuffedAction = null
    }
    if (this.p2.debuffTurnsLeft > 0) {
      this.p2.debuffTurnsLeft--
      if (this.p2.debuffTurnsLeft === 0) this.p2.debuffedAction = null
    }

    // ── History logging ───────────────────────────────────────────────────────
    this.p1.history.push(a1); this.p2.history.push(a2)
    this.p1.damageDealtLog.push(p2DmgDealt); this.p2.damageDealtLog.push(p1DmgDealt)
    this.p1.damageTakenLog.push(p1TotalDmg); this.p2.damageTakenLog.push(p2TotalDmg)
    this.p1.hpLog.push(this.p1.hp); this.p2.hpLog.push(this.p2.hp)

    return {
      turn, p1Action: a1, p2Action: a2,
      p1DmgTaken: p1TotalDmg, p2DmgTaken: p2TotalDmg,
      p1HpAfter: this.p1.hp, p2HpAfter: this.p2.hp,
      p1Heal, p2Heal,
      p1Stamina: Math.round(this.p1.stamina),
      p2Stamina: Math.round(this.p2.stamina),
      p1Rage: Math.round(this.p1.rage),
      p2Rage: Math.round(this.p2.rage),
      p1Position: this.p1.position, p2Position: this.p2.position,
      log: this.buildLog(a1, a2, p1TotalDmg, p2TotalDmg, p1Heal, p2Heal, this.p1, this.p2),
      p1PoisonDmg: p1PoisonDmg > 0 ? p1PoisonDmg : undefined,
      p2PoisonDmg: p2PoisonDmg > 0 ? p2PoisonDmg : undefined,
      p1ReflectDmg: p2ReflectDmg > 0 ? p2ReflectDmg : undefined,
      p2ReflectDmg: p1ReflectDmg > 0 ? p1ReflectDmg : undefined,
    }
  }

  // ── Damage calculation ──────────────────────────────────────────────────────

  private calcDamage(attAction: ActionName, att: ExtState, defAction: ActionName, def: ExtState): number {
    let dmg = BASE_DAMAGE[attAction] ?? 0
    if (dmg === 0) return 0

    if (attAction === 'heavy'  && att.stamina < STAMINA_THRESHOLD_HEAVY)  return 0
    if (attAction === 'attack' && att.stamina < STAMINA_THRESHOLD_ATTACK) dmg = ATTACK_EXHAUSTED_DAMAGE
    if (attAction === 'laser'  && att.stamina < STAMINA_THRESHOLD_LASER)  dmg = Math.floor(dmg * 0.5)

    // Combo multiplier: ×2 if streak >= required
    if (attAction === 'combo' && att.comboStreak >= att.comboRequiredStreak) {
      dmg *= 2
    }

    // Overcharge bonus: consume stacks on offensive action
    // Sniper has enhanced overcharge: 18 dmg/stack instead of default 15
    if (att.chargeStack > 0 && (attAction === 'attack' || attAction === 'heavy' || attAction === 'laser' || attAction === 'combo')) {
      const stackDmg = att.character === 'sniper' ? 18 : OVERCHARGE_DAMAGE_PER_STACK
      dmg += att.chargeStack * stackDmg
      att.chargeStack = 0
    }

    // Global character damage multiplier
    if (att.dmgMult !== 1.0) dmg = Math.floor(dmg * att.dmgMult)

    // Per-action override (e.g. Sniper: attack × 0.5)
    const actionOverride = att.actionDmgOverrides[attAction]
    if (actionOverride !== undefined) dmg = Math.floor(dmg * actionOverride)

    // Samurai bushido: HP ≤ 25% → all damage × 2
    if (att.bushidoThreshold > 0 && att.hp <= att.maxHp * att.bushidoThreshold) {
      dmg = Math.floor(dmg * att.bushidoMult)
    }

    // Samurai bushidoNoDefenseStreak: heavy ×2 after N turns without defense
    if (att.bushidoNoDefenseStreak > 0 && att.defenselessStreak >= att.bushidoNoDefenseStreak && attAction === 'heavy') {
      dmg *= 2
    }

    // Berserker berserk mode: at low HP, all damage × berserkMult
    if (att.berserkThreshold > 0 && att.hp <= att.berserkThreshold) {
      dmg = Math.floor(dmg * att.berserkMult)
    }

    // Cosmonaut enhanced laser at far range
    if (att.enhancedLaserFar && attAction === 'laser' && att.position === 'far') {
      // Override position multiplier to 2.0 instead of 1.4
      dmg = Math.floor((BASE_DAMAGE['laser'] + (att.chargeStack > 0 ? 0 : 0)) * (att.dmgMult !== 1.0 ? att.dmgMult : 1.0) * 2.0)
      // Re-apply stamina half-damage if needed
      if (att.stamina < STAMINA_THRESHOLD_LASER) dmg = Math.floor(dmg * 0.5)
    } else {
      dmg = applyPositionModifier(attAction, att.position, dmg)
    }

    // Defender passives
    const shieldAbsorb = SHIELD_ABSORB + def.shieldBonus
    if (defAction === 'shield') {
      dmg = Math.round(dmg * (1 - shieldAbsorb))
    } else if (defAction === 'dodge') {
      if (attAction === 'attack' || attAction === 'heavy' || attAction === 'combo') {
        // Scorpion: dodge doesn't work vs his attack/heavy
        if (!att.attackIgnoresDodge) dmg = 0
      } else if (attAction === 'laser') {
        // Ninja: 100% evade; others: 50%
        if (def.superDodge || Math.random() < DODGE_LASER_EVADE_CHANCE) dmg = 0
      } else if (attAction === 'special') {
        // Ninja: blocks 80%; others: 50%
        const absorb = def.superDodge ? 0.8 : DODGE_SPECIAL_ABSORB
        dmg = Math.floor(dmg * (1 - absorb))
      }
    }

    // Rino: flat damage reduction (minimum 1 always gets through)
    if (def.flatDmgReduction > 0 && dmg > 0) {
      dmg = Math.max(1, dmg - def.flatDmgReduction)
    }

    // ── Plague дебафф: attacker's action is debuffed -50% ────────────────────
    if (att.debuffedAction === attAction && att.debuffTurnsLeft > 0) {
      dmg = Math.floor(dmg * 0.5)
    }

    return Math.max(0, dmg)
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private computeFrequency(history: ActionName[]): Record<string, number> {
    const freq: Record<string, number> = {}
    for (const act of history) freq[act] = (freq[act] ?? 0) + 1
    return freq
  }

  private mostFrequent(freq: Record<string, number>): string | null {
    let best: string | null = null
    let bestCount = 0
    for (const [act, count] of Object.entries(freq)) {
      if (count > bestCount) { bestCount = count; best = act }
    }
    return best
  }

  private applyStaminaCost(state: ExtState, action: ActionName) {
    const cost = state.staminaCostOverrides[action] ?? STAMINA_COSTS[action] ?? 0
    state.stamina = Math.min(MAX_STAMINA, Math.max(0, state.stamina - cost))
  }

  private tickCooldowns(state: ExtState) {
    for (const k of Object.keys(state.cooldowns)) {
      if ((state.cooldowns[k] ?? 0) > 0) state.cooldowns[k]--
    }
  }

  private applyCooldown(state: ExtState, action: ActionName) {
    const cd = state.cooldownOverrides[action] ?? COOLDOWNS[action] ?? 0
    if (cd > 0) state.cooldowns[action] = cd
  }

  private updatePosition(state: ExtState, action: ActionName) {
    if (action === 'attack' || action === 'heavy' || action === 'combo') state.position = 'close'
    else if (action === 'laser') state.position = 'far'
    else if (action === 'dodge') {
      if (state.character === 'cosmonaut') {
        // Cosmonaut: dodge doesn't move position backward — only retreats from close
        if (state.position === 'close') state.position = 'mid'
        // mid/far stays as-is (stays at range)
      } else {
        state.position = state.position === 'close' ? 'mid' : state.position === 'mid' ? 'far' : 'mid'
      }
    }
  }

  private buildLog(a1: ActionName, a2: ActionName, d1: number, d2: number, h1: number, h2: number, p1: ExtState, p2: ExtState): string {
    const parts: string[] = []
    const pen1 = p1.repeatCount >= REPEAT_PENALTY_AFTER
    const pen2 = p2.repeatCount >= REPEAT_PENALTY_AFTER
    if (a1 === 'heavy' && d2 === 0 && p1.stamina < STAMINA_THRESHOLD_HEAVY) parts.push('P1 ПРОМАХ!')
    if (a2 === 'heavy' && d1 === 0 && p2.stamina < STAMINA_THRESHOLD_HEAVY) parts.push('P2 ПРОМАХ!')
    if (d2 > 0) parts.push(`P2 -${d2}HP${pen1 ? '⚠️' : ''}`)
    if (d1 > 0) parts.push(`P1 -${d1}HP${pen2 ? '⚠️' : ''}`)
    if (h1 > 0) parts.push(`P1 +${h1}HP`)
    if (h2 > 0) parts.push(`P2 +${h2}HP`)
    if (a1 === 'special') parts.push('⚡ P1 RAGE!')
    if (a2 === 'special') parts.push('⚡ P2 RAGE!')
    if (a1 === 'reflect') parts.push('🔄 P1 отражает!')
    if (a2 === 'reflect') parts.push('🔄 P2 отражает!')
    if (a1 === 'sacrifice') parts.push('💀 P1 жертвует HP!')
    if (a2 === 'sacrifice') parts.push('💀 P2 жертвует HP!')
    if (a1 === 'overcharge') parts.push(`⚡ P1 заряжается (${p1.chargeStack})`)
    if (a2 === 'overcharge') parts.push(`⚡ P2 заряжается (${p2.chargeStack})`)
    if (p1.character === 'ninja' && a1 === 'dodge') parts.push('🌑 Ниндзя уклонился!')
    if (p2.character === 'ninja' && a2 === 'dodge') parts.push('🌑 Ниндзя уклонился!')
    if (p1.character === 'samurai' && p1.hp <= p1.maxHp * p1.bushidoThreshold && d2 > 0) parts.push('⚔️ БУСИДО!')
    if (p2.character === 'samurai' && p2.hp <= p2.maxHp * p2.bushidoThreshold && d1 > 0) parts.push('⚔️ БУСИДО!')
    if (p1.poisonStacks > 0) parts.push(`☠️ P1 яд -${p1.poisonStacks * 3}`)
    if (p2.poisonStacks > 0) parts.push(`☠️ P2 яд -${p2.poisonStacks * 3}`)
    if (p1.character === 'scorpion' && (a1 === 'attack' || a1 === 'heavy') && a2 === 'dodge') parts.push('🦂 Захват!')
    if (p1.berserkThreshold > 0 && p1.hp <= p1.berserkThreshold) parts.push('😤 P1 БЕРСЕРК!')
    if (p2.berserkThreshold > 0 && p2.hp <= p2.berserkThreshold) parts.push('😤 P2 БЕРСЕРК!')
    if (a1 === 'overclock' && p1.overclockBonus > 0) parts.push(`⚙️ P1 РАЗГОН +${p1.overclockBonus}`)
    if (a2 === 'overclock' && p2.overclockBonus > 0) parts.push(`⚙️ P2 РАЗГОН +${p2.overclockBonus}`)
    if (p2.debuffedAction) parts.push(`☢️ P2 ${p2.debuffedAction} дебаффнут!`)
    if (p1.debuffedAction) parts.push(`☢️ P1 ${p1.debuffedAction} дебаффнут!`)
    if (parts.length === 0) parts.push(`${a1} vs ${a2}`)
    return parts.join(' | ')
  }
}

export async function runRound(p1Strategy: Strategy, p2Strategy: Strategy, roundNumber: number): Promise<RoundResult> {
  return new BattleEngine(p1Strategy, p2Strategy).runRound(roundNumber)
}

export async function runMatch(
  p1Strategy: Strategy,
  p2Strategy: Strategy,
  format: 'bo1' | 'bo3' | 'bo5',
): Promise<{ winner: 1 | 2 | 0; score: [number, number]; rounds: RoundResult[] }> {
  const maxRounds  = format === 'bo1' ? 1 : format === 'bo3' ? 3 : 5
  const winsNeeded = Math.ceil(maxRounds / 2)
  const engine     = new BattleEngine(p1Strategy, p2Strategy)
  const rounds: RoundResult[] = []
  const wins: [number, number] = [0, 0]

  for (let r = 1; r <= maxRounds; r++) {
    const result = await engine.runRound(r)
    rounds.push(result)
    if (result.winner === 1) wins[0]++
    else if (result.winner === 2) wins[1]++
    if (wins[0] >= winsNeeded || wins[1] >= winsNeeded) break
  }

  p1Strategy.dispose?.()
  p2Strategy.dispose?.()

  const winner: 1 | 2 | 0 = wins[0] > wins[1] ? 1 : wins[1] > wins[0] ? 2 : 0
  return { winner, score: wins, rounds }
}
