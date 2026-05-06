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
} from '@robocode/shared'
import type {
  Strategy, StrategyContext, ActionName, SkinId, PlayerState, TurnResult, RoundResult,
} from '@robocode/shared'

const VALID_ACTIONS = new Set<ActionName>(['attack', 'heavy', 'laser', 'shield', 'dodge', 'repair', 'special'])

function isValidAction(v: unknown): v is ActionName {
  return typeof v === 'string' && VALID_ACTIONS.has(v as ActionName)
}

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
  actionDmgOverrides:  Partial<Record<ActionName, number>>  // Sniper
  cooldownOverrides:   Partial<Record<ActionName, number>>  // Phantom, Sniper
  staminaCostOverrides:Partial<Record<ActionName, number>>  // Mage
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
    return {
      hp:           char.maxHp,
      stamina:      MAX_STAMINA,
      rage:         0,
      position:     strategy.position ?? 'mid',
      cooldowns:    { attack: 0, heavy: 0, laser: 0, shield: 0, dodge: 0, repair: 0, special: 0 },
      lastAction:   null,
      shieldActive: false,
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
      actionDmgOverrides:  char.actionDmgOverrides,
      cooldownOverrides:   char.cooldownOverrides,
      staminaCostOverrides:char.staminaCostOverrides,
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

  private buildContext(self: ExtState, enemy: ExtState, turn: number): StrategyContext {
    return {
      myHp:         self.hp,
      myMaxHp:      self.maxHp,
      myStamina:    self.stamina,
      myRage:       self.rage,
      enemyHp:      enemy.hp,
      enemyMaxHp:   enemy.maxHp,
      enemyStamina: enemy.stamina,
      enemyRage:    enemy.rage,
      turn,
      myLastAction:    self.lastAction,
      enemyLastAction: enemy.lastAction,
      cooldowns: { ...self.cooldowns },
      myPosition:    self.position,
      enemyPosition: enemy.position,
      distanceModifier: getPositionMultiplier(self.strategy.primary, self.position),
      myRepeatCount: self.repeatCount,
    }
  }

  // ── Action selection ────────────────────────────────────────────────────────

  private async pickActionAsync(self: ExtState, enemy: ExtState, turn: number): Promise<ActionName> {
    const ctx = this.buildContext(self, enemy, turn)

    if (self.strategy.asyncFn) {
      try {
        const chosen = await self.strategy.asyncFn(ctx)
        if (isValidAction(chosen) && this.isActionAvailable(self, chosen)) return chosen
      } catch { /* fall through */ }
    }
    if (self.strategy.fn) {
      try {
        const chosen = self.strategy.fn(ctx)
        if (isValidAction(chosen) && this.isActionAvailable(self, chosen)) return chosen
      } catch { /* fall through */ }
    }
    return this.pickStaticAction(self, enemy)
  }

  private pickStaticAction(self: ExtState, enemy: ExtState): ActionName {
    const { strategy } = self
    if (self.rage >= self.specialRageCost && this.isActionAvailable(self, 'special')) return 'special'
    if (self.hp < 30) return this.resolveStaticAction(self, strategy.lowHp)
    if (enemy.lastAction === 'laser' && strategy.onHit === 'dodge') return 'dodge'
    if (enemy.shieldActive && (strategy.primary === 'attack' || strategy.primary === 'heavy')) return 'heavy'
    return this.resolveStaticAction(self, strategy.primary)
  }

  private isActionAvailable(state: ExtState, action: ActionName): boolean {
    if ((state.cooldowns[action as keyof typeof state.cooldowns] ?? 0) > 0) return false
    if (action === 'special' && state.rage < state.specialRageCost) return false
    return true
  }

  private resolveStaticAction(self: ExtState, act: ActionName): ActionName {
    if (!this.isActionAvailable(self, act)) {
      if (act === 'heavy')  return self.cooldowns.laser === 0 ? 'laser' : 'attack'
      if (act === 'laser')  return 'attack'
      if (act === 'repair') return 'shield'
      if (act === 'shield') return 'attack'
      return 'attack'
    }
    return act
  }

  // ── Turn resolution ─────────────────────────────────────────────────────────

  private async resolveTurn(turn: number): Promise<TurnResult> {
    this.p1.stamina = Math.min(MAX_STAMINA, this.p1.stamina + STAMINA_REGEN)
    this.p2.stamina = Math.min(MAX_STAMINA, this.p2.stamina + STAMINA_REGEN)

    const [a1, a2] = await Promise.all([
      this.pickActionAsync(this.p1, this.p2, turn),
      this.pickActionAsync(this.p2, this.p1, turn),
    ])

    this.p1.repeatCount = a1 === this.p1.lastAction ? this.p1.repeatCount + 1 : 1
    this.p2.repeatCount = a2 === this.p2.lastAction ? this.p2.repeatCount + 1 : 1

    this.p1.shieldActive = a1 === 'shield'
    this.p2.shieldActive = a2 === 'shield'

    const p1Factor = this.p1.repeatCount >= REPEAT_PENALTY_AFTER ? REPEAT_DAMAGE_FACTOR : 1
    const p2Factor = this.p2.repeatCount >= REPEAT_PENALTY_AFTER ? REPEAT_DAMAGE_FACTOR : 1

    // Base damage
    let p2DmgDealt = Math.round(this.calcDamage(a1, this.p1, a2, this.p2) * p1Factor)
    let p1DmgDealt = Math.round(this.calcDamage(a2, this.p2, a1, this.p1) * p2Factor)

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

    this.applyStaminaCost(this.p1, a1)
    this.applyStaminaCost(this.p2, a2)

    if (a1 === 'special') this.p1.rage = 0
    if (a2 === 'special') this.p2.rage = 0

    // ── Healing: repair (+ Cosmonaut bonus) + Paladin shield heal ────────────
    let p1Heal = a1 === 'repair' ? REPAIR_AMOUNT + this.p1.repairBonus : 0
    if (a1 === 'shield' && this.p1.shieldHealAmount > 0) p1Heal += this.p1.shieldHealAmount
    p1Heal += p1Lifesteal

    let p2Heal = a2 === 'repair' ? REPAIR_AMOUNT + this.p2.repairBonus : 0
    if (a2 === 'shield' && this.p2.shieldHealAmount > 0) p2Heal += this.p2.shieldHealAmount
    p2Heal += p2Lifesteal

    this.p1.hp = Math.min(this.p1.maxHp, Math.max(0, this.p1.hp - p1DmgDealt + p1Heal))
    this.p2.hp = Math.min(this.p2.maxHp, Math.max(0, this.p2.hp - p2DmgDealt + p2Heal))

    // ── Rage accumulation ────────────────────────────────────────────────────
    // Base: rage from damage taken
    if (p1DmgDealt > 0) this.p1.rage = Math.min(MAX_RAGE, this.p1.rage + p1DmgDealt * RAGE_PER_DAMAGE * this.p1.rageMult)
    if (p2DmgDealt > 0) this.p2.rage = Math.min(MAX_RAGE, this.p2.rage + p2DmgDealt * RAGE_PER_DAMAGE * this.p2.rageMult)
    // Berserker: also gain rage from damage dealt
    if (this.p1.rageFromDealt && p2DmgDealt > 0) this.p1.rage = Math.min(MAX_RAGE, this.p1.rage + p2DmgDealt * RAGE_PER_DAMAGE)
    if (this.p2.rageFromDealt && p1DmgDealt > 0) this.p2.rage = Math.min(MAX_RAGE, this.p2.rage + p1DmgDealt * RAGE_PER_DAMAGE)

    this.tickCooldowns(this.p1); this.tickCooldowns(this.p2)
    this.applyCooldown(this.p1, a1); this.applyCooldown(this.p2, a2)

    this.p1.lastAction = a1; this.p2.lastAction = a2
    this.updatePosition(this.p1, a1); this.updatePosition(this.p2, a2)

    return {
      turn, p1Action: a1, p2Action: a2,
      p1DmgTaken: p1DmgDealt, p2DmgTaken: p2DmgDealt,
      p1HpAfter: this.p1.hp, p2HpAfter: this.p2.hp,
      p1Heal, p2Heal,
      p1Stamina: Math.round(this.p1.stamina),
      p2Stamina: Math.round(this.p2.stamina),
      p1Rage: Math.round(this.p1.rage),
      p2Rage: Math.round(this.p2.rage),
      p1Position: this.p1.position, p2Position: this.p2.position,
      log: this.buildLog(a1, a2, p1DmgDealt, p2DmgDealt, p1Heal, p2Heal, this.p1, this.p2),
    }
  }

  // ── Damage calculation ──────────────────────────────────────────────────────

  private calcDamage(attAction: ActionName, att: ExtState, defAction: ActionName, def: ExtState): number {
    let dmg = BASE_DAMAGE[attAction] ?? 0
    if (dmg === 0) return 0

    if (attAction === 'heavy'  && att.stamina < STAMINA_THRESHOLD_HEAVY)  return 0
    if (attAction === 'attack' && att.stamina < STAMINA_THRESHOLD_ATTACK) dmg = ATTACK_EXHAUSTED_DAMAGE
    if (attAction === 'laser'  && att.stamina < STAMINA_THRESHOLD_LASER)  dmg = Math.floor(dmg * 0.5)

    // Global character damage multiplier
    if (att.dmgMult !== 1.0) dmg = Math.floor(dmg * att.dmgMult)

    // Per-action override (e.g. Sniper: attack × 0.5)
    const actionOverride = att.actionDmgOverrides[attAction]
    if (actionOverride !== undefined) dmg = Math.floor(dmg * actionOverride)

    // Samurai bushido: HP ≤ 25% → all damage × 2
    if (att.bushidoThreshold > 0 && att.hp <= att.maxHp * att.bushidoThreshold) {
      dmg = Math.floor(dmg * att.bushidoMult)
    }

    dmg = applyPositionModifier(attAction, att.position, dmg)

    // Defender passives
    const shieldAbsorb = SHIELD_ABSORB + def.shieldBonus
    if (defAction === 'shield') {
      dmg = Math.round(dmg * (1 - shieldAbsorb))
    } else if (defAction === 'dodge') {
      if (attAction === 'attack' || attAction === 'heavy') {
        dmg = 0
      } else if (attAction === 'laser') {
        // Ninja: 100% evade; others: 50%
        if (def.superDodge || Math.random() < DODGE_LASER_EVADE_CHANCE) dmg = 0
      } else if (attAction === 'special') {
        // Ninja: blocks 80%; others: 50%
        const absorb = def.superDodge ? 0.8 : DODGE_SPECIAL_ABSORB
        dmg = Math.floor(dmg * (1 - absorb))
      }
    }

    // Tank: flat damage reduction (minimum 1 always gets through)
    if (def.flatDmgReduction > 0 && dmg > 0) {
      dmg = Math.max(1, dmg - def.flatDmgReduction)
    }

    return Math.max(0, dmg)
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private applyStaminaCost(state: ExtState, action: ActionName) {
    const cost = state.staminaCostOverrides[action] ?? STAMINA_COSTS[action] ?? 0
    state.stamina = Math.min(MAX_STAMINA, Math.max(0, state.stamina - cost))
  }

  private tickCooldowns(state: ExtState) {
    for (const k of Object.keys(state.cooldowns) as (keyof typeof state.cooldowns)[]) {
      if (state.cooldowns[k] > 0) state.cooldowns[k]--
    }
  }

  private applyCooldown(state: ExtState, action: ActionName) {
    const cd = state.cooldownOverrides[action] ?? COOLDOWNS[action]
    if (cd > 0) state.cooldowns[action as keyof typeof state.cooldowns] = cd
  }

  private updatePosition(state: ExtState, action: ActionName) {
    if (action === 'attack' || action === 'heavy') state.position = 'close'
    else if (action === 'laser') state.position = 'far'
    else if (action === 'dodge') {
      state.position = state.position === 'close' ? 'mid' : state.position === 'mid' ? 'far' : 'mid'
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
    if (p1.character === 'ninja' && a1 === 'dodge') parts.push('🌑 Ниндзя уклонился!')
    if (p2.character === 'ninja' && a2 === 'dodge') parts.push('🌑 Ниндзя уклонился!')
    if (p1.character === 'samurai' && p1.hp <= p1.maxHp * p1.bushidoThreshold && d2 > 0) parts.push('⚔️ БУСИДО!')
    if (p2.character === 'samurai' && p2.hp <= p2.maxHp * p2.bushidoThreshold && d1 > 0) parts.push('⚔️ БУСИДО!')
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
