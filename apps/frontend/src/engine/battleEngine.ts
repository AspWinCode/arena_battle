import {
  MAX_HP, MAX_STAMINA, MAX_RAGE, MAX_TURNS,
  STAMINA_REGEN, STAMINA_COSTS,
  STAMINA_THRESHOLD_HEAVY, STAMINA_THRESHOLD_ATTACK, STAMINA_THRESHOLD_LASER,
  ATTACK_EXHAUSTED_DAMAGE,
  RAGE_PER_DAMAGE, SPECIAL_RAGE_COST,
  BASE_DAMAGE, SHIELD_ABSORB,
  DODGE_LASER_EVADE_CHANCE, DODGE_SPECIAL_ABSORB,
  REPEAT_PENALTY_AFTER, REPEAT_DAMAGE_FACTOR,
  COOLDOWNS, REPAIR_AMOUNT,
  applyPositionModifier, getPositionMultiplier,
} from '@robocode/shared'
import type {
  Strategy, StrategyContext, ActionName, PlayerState, TurnResult, RoundResult,
} from '@robocode/shared'
import type { PerkEffect } from '@robocode/shared'

const VALID_ACTIONS = new Set<ActionName>(['attack', 'heavy', 'laser', 'shield', 'dodge', 'repair', 'special'])

function isValidAction(v: unknown): v is ActionName {
  return typeof v === 'string' && VALID_ACTIONS.has(v as ActionName)
}

interface ExtState extends PlayerState {
  repeatCount: number
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
    return {
      hp:       Math.min(MAX_HP,      MAX_HP      + (perks.bonusHp      ?? 0)),
      stamina:  Math.min(MAX_STAMINA, MAX_STAMINA + (perks.bonusStamina ?? 0)),
      rage:     Math.min(MAX_RAGE,    0           + (perks.bonusRage    ?? 0)),
      position: s.position ?? 'mid',
      cooldowns: { attack: 0, heavy: 0, laser: 0, shield: 0, dodge: 0, repair: 0, special: 0 },
      lastAction: null,
      shieldActive: false,
      strategy: s,
      repeatCount: 0,
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
    return {
      myHp: self.hp, myStamina: self.stamina, myRage: self.rage,
      enemyHp: enemy.hp, enemyStamina: enemy.stamina, enemyRage: enemy.rage,
      turn,
      myLastAction: self.lastAction,
      enemyLastAction: enemy.lastAction,
      cooldowns: { ...self.cooldowns },
      myPosition: self.position,
      enemyPosition: enemy.position,
      distanceModifier: getPositionMultiplier(self.strategy.primary, self.position),
      myRepeatCount: self.repeatCount,
    }
  }

  private isAvailable(state: ExtState, action: ActionName): boolean {
    if ((state.cooldowns[action as keyof typeof state.cooldowns] ?? 0) > 0) return false
    if (action === 'special' && state.rage < SPECIAL_RAGE_COST) return false
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
    const { strategy } = self

    if (strategy.fn) {
      try {
        const ctx = this.buildContext(self, enemy, turn)
        const chosen = strategy.fn(ctx)
        if (isValidAction(chosen) && this.isAvailable(self, chosen)) return chosen
      } catch { /* fall through */ }
    }

    if (self.rage >= SPECIAL_RAGE_COST && this.isAvailable(self, 'special')) return 'special'

    if (enemy.hp < 30) return this.resolveStatic(self, strategy.lowHp)
    if (enemy.lastAction === 'laser' && strategy.onHit === 'dodge') return 'dodge'
    if (enemy.shieldActive && (strategy.primary === 'attack' || strategy.primary === 'heavy')) return 'heavy'
    return this.resolveStatic(self, strategy.primary)
  }

  private calcDamage(
    attAction: ActionName, att: ExtState,
    defAction: ActionName,
    def?: ExtState,
  ): number {
    let dmg = BASE_DAMAGE[attAction] ?? 0
    if (dmg === 0) return 0

    // Perk: heavyThreshold override for p1
    const heavyThresh = att === this.p1
      ? (this.p1Perks.heavyThreshold ?? STAMINA_THRESHOLD_HEAVY)
      : STAMINA_THRESHOLD_HEAVY

    if (attAction === 'heavy'  && att.stamina < heavyThresh)              return 0
    if (attAction === 'attack' && att.stamina < STAMINA_THRESHOLD_ATTACK) dmg = ATTACK_EXHAUSTED_DAMAGE
    if (attAction === 'laser'  && att.stamina < STAMINA_THRESHOLD_LASER)  dmg = Math.floor(dmg * 0.5)

    dmg = applyPositionModifier(attAction, att.position, dmg)

    // Perk: shieldAbsorb override for p1 defender
    const shieldAbs = (def === this.p1 && this.p1Perks.shieldAbsorb)
      ? this.p1Perks.shieldAbsorb
      : SHIELD_ABSORB

    if (defAction === 'shield') {
      dmg = Math.round(dmg * (1 - shieldAbs))
    } else if (defAction === 'dodge') {
      if (attAction === 'attack' || attAction === 'heavy') dmg = 0
      else if (attAction === 'laser'  && Math.random() < DODGE_LASER_EVADE_CHANCE) dmg = 0
      else if (attAction === 'special') dmg = Math.floor(dmg * (1 - DODGE_SPECIAL_ABSORB))
    }

    return Math.max(0, dmg)
  }

  private applyStaminaCost(state: ExtState, action: ActionName) {
    const cost = STAMINA_COSTS[action] ?? 0
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

    const p2Dealt = Math.round(this.calcDamage(a1, this.p1, a2, this.p2) * p1Factor)
    const p1Dealt = Math.round(this.calcDamage(a2, this.p2, a1, this.p1) * p2Factor)

    this.applyStaminaCost(this.p1, a1)
    this.applyStaminaCost(this.p2, a2)

    if (a1 === 'special') this.p1.rage = 0
    if (a2 === 'special') this.p2.rage = 0

    const p1Heal = a1 === 'repair' ? REPAIR_AMOUNT : 0
    const p2Heal = a2 === 'repair' ? REPAIR_AMOUNT : 0

    this.p1.hp = Math.min(MAX_HP, Math.max(0, this.p1.hp - p1Dealt + p1Heal))
    this.p2.hp = Math.min(MAX_HP, Math.max(0, this.p2.hp - p2Dealt + p2Heal))

    if (p1Dealt > 0) this.p1.rage = Math.min(MAX_RAGE, this.p1.rage + p1Dealt * RAGE_PER_DAMAGE)
    if (p2Dealt > 0) this.p2.rage = Math.min(MAX_RAGE, this.p2.rage + p2Dealt * RAGE_PER_DAMAGE)

    for (const s of [this.p1, this.p2]) {
      for (const k of Object.keys(s.cooldowns) as (keyof typeof s.cooldowns)[]) {
        if (s.cooldowns[k] > 0) s.cooldowns[k]--
      }
    }
    const applyCd = (s: ExtState, a: ActionName) => {
      let cd = COOLDOWNS[a]
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
    if (a1 === 'heavy' && p2Dealt === 0) logParts.push('P1 ПРОМАХ (выносливость!)')
    if (a2 === 'heavy' && p1Dealt === 0) logParts.push('P2 ПРОМАХ (выносливость!)')
    if (a1 === 'special') logParts.push('⚡ P1 RAGE STRIKE!')
    if (a2 === 'special') logParts.push('⚡ P2 RAGE STRIKE!')
    if (p2Dealt > 0) logParts.push(`P2 -${p2Dealt}${pen1 ? '⚠️' : ''}`)
    if (p1Dealt > 0) logParts.push(`P1 -${p1Dealt}${pen2 ? '⚠️' : ''}`)
    if (p1Heal > 0) logParts.push(`P1 +${p1Heal}HP`)
    if (p2Heal > 0) logParts.push(`P2 +${p2Heal}HP`)
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

export function runLocalMatch(
  p1: Strategy,
  p2: Strategy,
  format: 'bo1' | 'bo3' | 'bo5',
  p1Perks: PerkEffect = {},
) {
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
