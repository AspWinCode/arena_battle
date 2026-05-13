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
import type { PerkEffect } from '@robocode/shared'

const VALID_ACTIONS = new Set<ActionName>(['attack', 'heavy', 'laser', 'shield', 'dodge', 'repair', 'special'])
function isValidAction(v: unknown): v is ActionName {
  return typeof v === 'string' && VALID_ACTIONS.has(v as ActionName)
}

interface ExtState extends PlayerState {
  repeatCount:  number
  character:    SkinId
  maxHp:        number
  dmgMult:      number
  rageMult:     number
  repairBonus:  number
  shieldBonus:  number
  hasCounter:          boolean
  counterReady:        boolean
  superDodge:          boolean
  shieldHealAmount:    number
  lifestealRate:       number
  bushidoThreshold:    number
  bushidoMult:         number
  flatDmgReduction:    number
  specialRageCost:     number
  rageFromDealt:       boolean
  attackIgnoresDodge:  boolean   // Scorpion
  poisonOnHit:         number    // Plague Doctor
  poisonStacks:        number    // runtime: incoming poison per turn
  actionDmgOverrides:  Partial<Record<ActionName, number>>
  cooldownOverrides:   Partial<Record<ActionName, number>>
  staminaCostOverrides:Partial<Record<ActionName, number>>
}

export class BattleEngine {
  private p1!: ExtState
  private p2!: ExtState
  private turns: TurnResult[] = []

  constructor(
    private p1Strategy: Strategy,
    private p2Strategy: Strategy,
    private p1Perks: PerkEffect = {},
  ) {}

  private initState(s: Strategy, perks: PerkEffect = {}): ExtState {
    const charId = s.character ?? 'robot'
    const char   = CHARACTER_STATS[charId] ?? CHARACTER_STATS.robot
    const baseHp = char.maxHp + (perks.bonusHp ?? 0)
    return {
      hp:       baseHp,
      stamina:  Math.min(MAX_STAMINA, MAX_STAMINA + (perks.bonusStamina ?? 0)),
      rage:     Math.min(MAX_RAGE,    0           + (perks.bonusRage    ?? 0)),
      position: s.position ?? 'mid',
      cooldowns: { attack: 0, heavy: 0, laser: 0, shield: 0, dodge: 0, repair: 0, special: 0 },
      lastAction:    null,
      shieldActive:  false,
      reflectActive: false,
      strategy: s,
      repeatCount:  0,
      character:    charId,
      maxHp:        baseHp,
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
    }
  }

  runRound(roundNumber: number): RoundResult {
    this.p1 = this.initState(this.p1Strategy, this.p1Perks)
    this.p2 = this.initState(this.p2Strategy)
    this.turns = []

    for (let turn = 1; turn <= MAX_TURNS; turn++) {
      const result = this.resolveTurn(turn)
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

  private buildContext(self: ExtState, enemy: ExtState, turn: number): StrategyContext {
    const enemyFrequency: Record<string, number> = {}
    for (const act of (self as ExtState & { history?: string[] }).history ?? []) {
      enemyFrequency[act] = (enemyFrequency[act] ?? 0) + 1
    }
    const noop = () => ({ myHpAfter: self.hp, enemyHpAfter: enemy.hp, myStaminaAfter: self.stamina })
    return {
      myHp: self.hp, myMaxHp: self.maxHp, myStamina: self.stamina, myRage: self.rage,
      enemyHp: enemy.hp, enemyMaxHp: enemy.maxHp, enemyStamina: enemy.stamina, enemyRage: enemy.rage,
      turn,
      myLastAction: self.lastAction, enemyLastAction: enemy.lastAction,
      cooldowns: { ...self.cooldowns },
      myPosition: self.position, enemyPosition: enemy.position,
      distanceModifier: getPositionMultiplier(self.strategy.primary, self.position),
      myRepeatCount: self.repeatCount,
      // Level 2
      myHistory: [], enemyHistory: [],
      damageLog: [], damageTakenLog: [], myHpLog: [], enemyHpLog: [],
      // Level 3
      enemyFrequency, myEfficiency: {},
      enemyPhase: enemy.hp / enemy.maxHp > 0.6 ? 'early' : enemy.hp / enemy.maxHp > 0.3 ? 'mid' : 'late',
      enemyTrend: 'mixed',
      // Level 4
      simulate: noop,
      predict: () => 'attack',
      bestAction: () => 'attack',
      actionTable: [],
      markov: {},
      trainedModel: { predict: () => 'attack' },
      stateTree: [],
    }
  }

  private isAvailable(state: ExtState, action: ActionName): boolean {
    if ((state.cooldowns[action as keyof typeof state.cooldowns] ?? 0) > 0) return false
    if (action === 'special' && state.rage < state.specialRageCost) return false
    return true
  }

  private resolveStatic(self: ExtState, act: ActionName): ActionName {
    if (!this.isAvailable(self, act)) {
      if (act === 'heavy')  return self.cooldowns.laser === 0 ? 'laser' : 'attack'
      if (act === 'laser')  return 'attack'
      if (act === 'repair') return 'shield'
      if (act === 'shield') return 'attack'
      return 'attack'
    }
    return act
  }

  private pickAction(self: ExtState, enemy: ExtState, turn: number): ActionName {
    if (self.strategy.fn) {
      try {
        const ctx = this.buildContext(self, enemy, turn)
        const chosen = self.strategy.fn(ctx)
        if (isValidAction(chosen) && this.isAvailable(self, chosen)) return chosen
      } catch { /* fall through */ }
    }
    if (self.rage >= self.specialRageCost && this.isAvailable(self, 'special')) return 'special'
    if (self.hp < 30) return this.resolveStatic(self, self.strategy.lowHp)
    if (enemy.lastAction === 'laser' && self.strategy.onHit === 'dodge') return 'dodge'
    if (enemy.shieldActive && (self.strategy.primary === 'attack' || self.strategy.primary === 'heavy')) return 'heavy'
    return this.resolveStatic(self, self.strategy.primary)
  }

  private calcDamage(attAction: ActionName, att: ExtState, defAction: ActionName, def: ExtState): number {
    let dmg = BASE_DAMAGE[attAction] ?? 0
    if (dmg === 0) return 0

    const heavyThresh = att === this.p1
      ? (this.p1Perks.heavyThreshold ?? STAMINA_THRESHOLD_HEAVY)
      : STAMINA_THRESHOLD_HEAVY

    if (attAction === 'heavy'  && att.stamina < heavyThresh)              return 0
    if (attAction === 'attack' && att.stamina < STAMINA_THRESHOLD_ATTACK) dmg = ATTACK_EXHAUSTED_DAMAGE
    if (attAction === 'laser'  && att.stamina < STAMINA_THRESHOLD_LASER)  dmg = Math.floor(dmg * 0.5)

    if (att.dmgMult !== 1.0) dmg = Math.floor(dmg * att.dmgMult)

    const actionOverride = att.actionDmgOverrides[attAction]
    if (actionOverride !== undefined) dmg = Math.floor(dmg * actionOverride)

    // Samurai bushido
    if (att.bushidoThreshold > 0 && att.hp <= att.maxHp * att.bushidoThreshold) {
      dmg = Math.floor(dmg * att.bushidoMult)
    }

    dmg = applyPositionModifier(attAction, att.position, dmg)

    // Perk shieldAbsorb override OR character shieldBonus
    const shieldAbs = (def === this.p1 && this.p1Perks.shieldAbsorb)
      ? this.p1Perks.shieldAbsorb
      : SHIELD_ABSORB + def.shieldBonus

    if (defAction === 'shield') {
      dmg = Math.round(dmg * (1 - shieldAbs))
    } else if (defAction === 'dodge') {
      if (attAction === 'attack' || attAction === 'heavy') {
        // Scorpion: dodge doesn't work vs his attack/heavy
        if (!att.attackIgnoresDodge) dmg = 0
      } else if (attAction === 'laser') {
        if (def.superDodge || Math.random() < DODGE_LASER_EVADE_CHANCE) dmg = 0
      } else if (attAction === 'special') {
        const absorb = def.superDodge ? 0.8 : DODGE_SPECIAL_ABSORB
        dmg = Math.floor(dmg * (1 - absorb))
      }
    }

    // Rino flat reduction
    if (def.flatDmgReduction > 0 && dmg > 0) {
      dmg = Math.max(1, dmg - def.flatDmgReduction)
    }

    return Math.max(0, dmg)
  }

  private applyStaminaCost(state: ExtState, action: ActionName) {
    const cost = state.staminaCostOverrides[action] ?? STAMINA_COSTS[action] ?? 0
    state.stamina = Math.min(MAX_STAMINA, Math.max(0, state.stamina - cost))
  }

  private resolveTurn(turn: number): TurnResult {
    this.p1.stamina = Math.min(MAX_STAMINA, this.p1.stamina + STAMINA_REGEN)
    this.p2.stamina = Math.min(MAX_STAMINA, this.p2.stamina + STAMINA_REGEN)

    const a1 = this.pickAction(this.p1, this.p2, turn)
    const a2 = this.pickAction(this.p2, this.p1, turn)

    this.p1.repeatCount = a1 === this.p1.lastAction ? this.p1.repeatCount + 1 : 1
    this.p2.repeatCount = a2 === this.p2.lastAction ? this.p2.repeatCount + 1 : 1
    this.p1.shieldActive = a1 === 'shield'
    this.p2.shieldActive = a2 === 'shield'

    const p1Factor = this.p1.repeatCount >= REPEAT_PENALTY_AFTER ? REPEAT_DAMAGE_FACTOR : 1
    const p2Factor = this.p2.repeatCount >= REPEAT_PENALTY_AFTER ? REPEAT_DAMAGE_FACTOR : 1

    let p2Dealt = Math.round(this.calcDamage(a1, this.p1, a2, this.p2) * p1Factor)
    let p1Dealt = Math.round(this.calcDamage(a2, this.p2, a1, this.p1) * p2Factor)

    // Boxer counter
    if (this.p1.counterReady && a1 !== 'attack') this.p1.counterReady = false
    if (this.p2.counterReady && a2 !== 'attack') this.p2.counterReady = false
    if (this.p1.counterReady && a1 === 'attack' && p2Dealt > 0) { p2Dealt = Math.round(p2Dealt * 2); this.p1.counterReady = false }
    if (this.p2.counterReady && a2 === 'attack' && p1Dealt > 0) { p1Dealt = Math.round(p1Dealt * 2); this.p2.counterReady = false }
    if (this.p1.hasCounter && a1 === 'dodge' && (a2 === 'attack' || a2 === 'heavy')) this.p1.counterReady = true
    if (this.p2.hasCounter && a2 === 'dodge' && (a1 === 'attack' || a1 === 'heavy')) this.p2.counterReady = true

    // Vampire lifesteal
    const p1Lifesteal = (this.p1.lifestealRate > 0 && (a1 === 'attack' || a1 === 'heavy') && p2Dealt > 0)
      ? Math.round(p2Dealt * this.p1.lifestealRate) : 0
    const p2Lifesteal = (this.p2.lifestealRate > 0 && (a2 === 'attack' || a2 === 'heavy') && p1Dealt > 0)
      ? Math.round(p1Dealt * this.p2.lifestealRate) : 0

    this.applyStaminaCost(this.p1, a1); this.applyStaminaCost(this.p2, a2)
    if (a1 === 'special') this.p1.rage = 0
    if (a2 === 'special') this.p2.rage = 0

    let p1Heal = a1 === 'repair' ? REPAIR_AMOUNT + this.p1.repairBonus : 0
    if (a1 === 'shield' && this.p1.shieldHealAmount > 0) p1Heal += this.p1.shieldHealAmount
    p1Heal += p1Lifesteal

    let p2Heal = a2 === 'repair' ? REPAIR_AMOUNT + this.p2.repairBonus : 0
    if (a2 === 'shield' && this.p2.shieldHealAmount > 0) p2Heal += this.p2.shieldHealAmount
    p2Heal += p2Lifesteal

    this.p1.hp = Math.min(this.p1.maxHp, Math.max(0, this.p1.hp - p1Dealt + p1Heal))
    this.p2.hp = Math.min(this.p2.maxHp, Math.max(0, this.p2.hp - p2Dealt + p2Heal))

    // ── Plague Doctor: poison tick ────────────────────────────────────────────
    if (this.p1.poisonStacks > 0) this.p1.hp = Math.max(0, this.p1.hp - this.p1.poisonStacks)
    if (this.p2.poisonStacks > 0) this.p2.hp = Math.max(0, this.p2.hp - this.p2.poisonStacks)
    if (this.p1.poisonOnHit > 0 && (a1 === 'attack' || a1 === 'heavy') && p2Dealt > 0)
      this.p2.poisonStacks = this.p1.poisonOnHit
    if (this.p2.poisonOnHit > 0 && (a2 === 'attack' || a2 === 'heavy') && p1Dealt > 0)
      this.p1.poisonStacks = this.p2.poisonOnHit

    if (p1Dealt > 0) this.p1.rage = Math.min(MAX_RAGE, this.p1.rage + p1Dealt * RAGE_PER_DAMAGE * this.p1.rageMult)
    if (p2Dealt > 0) this.p2.rage = Math.min(MAX_RAGE, this.p2.rage + p2Dealt * RAGE_PER_DAMAGE * this.p2.rageMult)
    if (this.p1.rageFromDealt && p2Dealt > 0) this.p1.rage = Math.min(MAX_RAGE, this.p1.rage + p2Dealt * RAGE_PER_DAMAGE)
    if (this.p2.rageFromDealt && p1Dealt > 0) this.p2.rage = Math.min(MAX_RAGE, this.p2.rage + p1Dealt * RAGE_PER_DAMAGE)

    for (const s of [this.p1, this.p2]) {
      for (const k of Object.keys(s.cooldowns) as (keyof typeof s.cooldowns)[]) {
        if (s.cooldowns[k] > 0) s.cooldowns[k]--
      }
    }

    const applyCd = (s: ExtState, a: ActionName) => {
      let cd = s.cooldownOverrides[a] ?? COOLDOWNS[a]
      if (cd > 0 && s === this.p1) {
        if (a === 'laser') cd = Math.max(0, cd - (this.p1Perks.laserCooldownReduce ?? 0))
        if (a === 'heavy') cd = Math.max(0, cd - (this.p1Perks.heavyCooldownReduce ?? 0))
      }
      if (cd > 0) (s.cooldowns as any)[a] = cd
    }
    applyCd(this.p1, a1); applyCd(this.p2, a2)

    this.p1.lastAction = a1; this.p2.lastAction = a2
    this.updatePos(this.p1, a1); this.updatePos(this.p2, a2)

    const pen1 = this.p1.repeatCount >= REPEAT_PENALTY_AFTER
    const pen2 = this.p2.repeatCount >= REPEAT_PENALTY_AFTER
    const logParts: string[] = []
    if (a1 === 'heavy' && p2Dealt === 0) logParts.push('P1 ПРОМАХ!')
    if (a2 === 'heavy' && p1Dealt === 0) logParts.push('P2 ПРОМАХ!')
    if (a1 === 'special') logParts.push('⚡ P1 RAGE!')
    if (a2 === 'special') logParts.push('⚡ P2 RAGE!')
    if (p2Dealt > 0) logParts.push(`P2 -${p2Dealt}${pen1 ? '⚠️' : ''}`)
    if (p1Dealt > 0) logParts.push(`P1 -${p1Dealt}${pen2 ? '⚠️' : ''}`)
    if (p1Heal > 0) logParts.push(`P1 +${p1Heal}HP`)
    if (p2Heal > 0) logParts.push(`P2 +${p2Heal}HP`)
    if (this.p1.poisonStacks > 0) logParts.push(`☠️ P1 яд -${this.p1.poisonStacks}`)
    if (this.p2.poisonStacks > 0) logParts.push(`☠️ P2 яд -${this.p2.poisonStacks}`)
    if (this.p1.character === 'scorpion' && (a1 === 'attack' || a1 === 'heavy') && a2 === 'dodge') logParts.push('🦂 Захват!')
    if (logParts.length === 0) logParts.push(`${a1} vs ${a2}`)

    return {
      turn, p1Action: a1, p2Action: a2,
      p1DmgTaken: p1Dealt, p2DmgTaken: p2Dealt,
      p1HpAfter: this.p1.hp, p2HpAfter: this.p2.hp,
      p1Heal, p2Heal,
      p1Stamina: Math.round(this.p1.stamina), p2Stamina: Math.round(this.p2.stamina),
      p1Rage: Math.round(this.p1.rage), p2Rage: Math.round(this.p2.rage),
      p1Position: this.p1.position, p2Position: this.p2.position,
      log: logParts.join(' | '),
    }
  }

  private updatePos(s: ExtState, a: ActionName) {
    if (a === 'attack' || a === 'heavy') s.position = 'close'
    else if (a === 'laser') s.position = 'far'
    else if (a === 'dodge') s.position = s.position === 'close' ? 'mid' : s.position === 'mid' ? 'far' : 'mid'
  }
}

export function runLocalMatch(p1: Strategy, p2: Strategy, format: 'bo1' | 'bo3' | 'bo5', p1Perks: PerkEffect = {}) {
  const maxRounds  = format === 'bo1' ? 1 : format === 'bo3' ? 3 : 5
  const winsNeeded = Math.ceil(maxRounds / 2)
  const engine     = new BattleEngine(p1, p2, p1Perks)
  const rounds: RoundResult[] = []
  const wins: [number, number] = [0, 0]

  for (let r = 1; r <= maxRounds; r++) {
    const result = engine.runRound(r)
    rounds.push(result)
    if (result.winner === 1) wins[0]++
    else if (result.winner === 2) wins[1]++
    if (wins[0] >= winsNeeded || wins[1] >= winsNeeded) break
  }

  return { winner: (wins[0] > wins[1] ? 1 : wins[1] > wins[0] ? 2 : 0) as 1 | 2 | 0, score: wins, rounds }
}
