import {
  DAMAGE_MATRIX,
  REPAIR_AMOUNT,
  COOLDOWNS,
  MAX_HP,
  MAX_TURNS,
  REPEAT_PENALTY_AFTER,
  REPEAT_DAMAGE_FACTOR,
  applyPositionModifier,
} from '@robocode/shared'
import type {
  Strategy,
  StrategyContext,
  ActionName,
  PlayerState,
  TurnResult,
  RoundResult,
  Position,
} from '@robocode/shared'

const VALID_ACTIONS = new Set<ActionName>(['attack', 'laser', 'shield', 'dodge', 'combo', 'repair'])

function isValidAction(v: unknown): v is ActionName {
  return typeof v === 'string' && VALID_ACTIONS.has(v as ActionName)
}

// Extended state tracks repeat count (not in shared PlayerState to avoid breaking types)
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
  ) {}

  private initState(strategy: Strategy): ExtState {
    return {
      hp: MAX_HP,
      position: strategy.position ?? 'mid',
      cooldowns: { attack: 0, laser: 0, combo: 0, repair: 0, shield: 0, dodge: 0 },
      lastAction: null,
      shieldActive: false,
      strategy,
      repeatCount: 0,
    }
  }

  runRound(roundNumber: number): RoundResult {
    this.p1 = this.initState(this.p1Strategy)
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
      round: roundNumber,
      winner,
      p1Hp: Math.max(0, this.p1.hp),
      p2Hp: Math.max(0, this.p2.hp),
      reason: (this.p1.hp <= 0 || this.p2.hp <= 0) ? 'ko' : 'time',
      turns: this.turns,
    }
  }

  private buildContext(self: ExtState, enemy: ExtState, turn: number): StrategyContext {
    return {
      myHp:           self.hp,
      enemyHp:        enemy.hp,
      turn,
      myLastAction:   self.lastAction,
      enemyLastAction: enemy.lastAction,
      cooldowns: {
        attack: self.cooldowns.attack ?? 0,
        laser:  self.cooldowns.laser,
        shield: self.cooldowns.shield,
        dodge:  self.cooldowns.dodge ?? 0,
        combo:  self.cooldowns.combo,
        repair: self.cooldowns.repair,
      },
      myPosition:    self.position,
      enemyPosition: enemy.position,
      myRepeatCount: self.repeatCount,
    }
  }

  private pickAction(self: ExtState, enemy: ExtState, turn: number): ActionName {
    const { strategy, cooldowns } = self

    // ── Dynamic function strategy (CODE / PRO level) ──────────────────
    if (strategy.fn) {
      try {
        const ctx = this.buildContext(self, enemy, turn)
        const chosen = strategy.fn(ctx)
        if (isValidAction(chosen)) {
          const cd = cooldowns[chosen as keyof typeof cooldowns] ?? 0
          if (cd === 0) return chosen
          // chosen is on cooldown — fall through to static
        }
      } catch {
        // user code threw — fall through to static fallback
      }
    }

    // ── Static strategy (BLOCKS level / fallback) ─────────────────────
    if (enemy.hp < 30) {
      const act = strategy.lowHp
      if (act === 'laser'  && cooldowns.laser  > 0) return cooldowns.combo === 0 ? 'combo' : 'attack'
      if (act === 'combo'  && cooldowns.combo  > 0) return 'attack'
      if (act === 'repair' && cooldowns.repair > 0) return 'shield'
      return act
    }

    if (enemy.lastAction === 'laser' && strategy.onHit === 'dodge') return 'dodge'
    if (enemy.shieldActive && ['attack', 'combo'].includes(strategy.primary)) return 'dodge'

    const act = strategy.primary
    if (act === 'laser'  && cooldowns.laser  > 0) return cooldowns.combo === 0 ? 'combo' : 'attack'
    if (act === 'combo'  && cooldowns.combo  > 0) return 'attack'
    if (act === 'repair' && cooldowns.repair > 0) return 'shield'
    if (act === 'shield' && turn % 2 === 0) return 'attack'
    return act
  }

  private resolveTurn(turn: number): TurnResult {
    const a1 = this.pickAction(this.p1, this.p2, turn)
    const a2 = this.pickAction(this.p2, this.p1, turn)

    // Track repeat counts
    this.p1.repeatCount = a1 === this.p1.lastAction ? this.p1.repeatCount + 1 : 1
    this.p2.repeatCount = a2 === this.p2.lastAction ? this.p2.repeatCount + 1 : 1

    // Reset shields
    this.p1.shieldActive = false
    this.p2.shieldActive = false
    if (a1 === 'shield') this.p1.shieldActive = true
    if (a2 === 'shield') this.p2.shieldActive = true

    // Resolve base damage
    const { p1Dmg: rawP1Dmg, p2Dmg: rawP2Dmg } = this.resolveDamage(a1, a2, this.p1.position, this.p2.position)

    // Apply repeat penalty (attacker's repeat count reduces their outgoing damage)
    const p1DmgFactor = this.p1.repeatCount >= REPEAT_PENALTY_AFTER ? REPEAT_DAMAGE_FACTOR : 1
    const p2DmgFactor = this.p2.repeatCount >= REPEAT_PENALTY_AFTER ? REPEAT_DAMAGE_FACTOR : 1

    // p1Dmg = damage P1 takes = damage dealt by P2's action on P1
    // rawP1Dmg is damage a1 takes (from matrix atkDmg), rawP2Dmg is damage a1 deals (defDmg)
    // Wait - let me re-read the matrix carefully:
    // DAMAGE_MATRIX[a1][a2].atkDmg = damage P1 takes (P2 counters)
    // DAMAGE_MATRIX[a1][a2].defDmg = damage P2 takes (P1 deals)
    // So p2DmgFactor applies to P1's outgoing (rawP2Dmg), p1DmgFactor applies to P2's outgoing (rawP1Dmg)
    const p1Dmg = Math.round(rawP1Dmg * p2DmgFactor)  // p1 takes damage from p2's action
    const p2Dmg = Math.round(rawP2Dmg * p1DmgFactor)  // p2 takes damage from p1's action

    const p1Heal = a1 === 'repair' ? REPAIR_AMOUNT : 0
    const p2Heal = a2 === 'repair' ? REPAIR_AMOUNT : 0

    this.p1.hp = Math.min(MAX_HP, Math.max(0, this.p1.hp - p1Dmg + p1Heal))
    this.p2.hp = Math.min(MAX_HP, Math.max(0, this.p2.hp - p2Dmg + p2Heal))

    // Tick down cooldowns
    this.tickCooldowns(this.p1)
    this.tickCooldowns(this.p2)

    // Apply cooldown for used action
    this.applyCooldown(this.p1, a1)
    this.applyCooldown(this.p2, a2)

    this.p1.lastAction = a1
    this.p2.lastAction = a2

    this.updatePosition(this.p1, a1)
    this.updatePosition(this.p2, a2)

    const p1Penalized = this.p1.repeatCount >= REPEAT_PENALTY_AFTER
    const p2Penalized = this.p2.repeatCount >= REPEAT_PENALTY_AFTER

    return {
      turn,
      p1Action: a1,
      p2Action: a2,
      p1DmgTaken: p1Dmg,
      p2DmgTaken: p2Dmg,
      p1HpAfter: this.p1.hp,
      p2HpAfter: this.p2.hp,
      p1Heal,
      p2Heal,
      p1Position: this.p1.position,
      p2Position: this.p2.position,
      log: this.buildLog(a1, a2, p1Dmg, p2Dmg, p1Heal, p2Heal, p1Penalized, p2Penalized),
    }
  }

  private resolveDamage(
    a1: ActionName, a2: ActionName,
    pos1: Position, pos2: Position,
  ): { p1Dmg: number; p2Dmg: number } {
    const entry = DAMAGE_MATRIX[a1][a2]

    if (entry.missChance && Math.random() < entry.missChance) {
      return { p1Dmg: 0, p2Dmg: 0 }
    }

    const p1Dmg = applyPositionModifier(a2, pos2, entry.atkDmg)
    const p2Dmg = applyPositionModifier(a1, pos1, entry.defDmg)

    return { p1Dmg, p2Dmg }
  }

  private tickCooldowns(state: ExtState) {
    for (const key of Object.keys(state.cooldowns) as (keyof typeof state.cooldowns)[]) {
      if (state.cooldowns[key] > 0) state.cooldowns[key]--
    }
  }

  private applyCooldown(state: ExtState, action: ActionName) {
    const cd = COOLDOWNS[action]
    if (cd > 0) {
      const key = action as keyof typeof state.cooldowns
      if (key in state.cooldowns) state.cooldowns[key] = cd
    }
  }

  private updatePosition(state: ExtState, action: ActionName) {
    if (action === 'attack' || action === 'combo') state.position = 'close'
    else if (action === 'laser') state.position = 'far'
    else if (action === 'dodge') {
      state.position = state.position === 'close' ? 'mid' : state.position === 'mid' ? 'far' : 'mid'
    }
  }

  private buildLog(
    a1: ActionName, a2: ActionName,
    d1: number, d2: number,
    h1: number, h2: number,
    p1Pen: boolean, p2Pen: boolean,
  ): string {
    const parts: string[] = []

    if (a1 === 'dodge' && d1 === 0 && d2 === 0) {
      parts.push('P1 dodges!')
    } else if (a2 === 'dodge' && d2 === 0 && d1 === 0) {
      parts.push('P2 dodges!')
    } else if (a1 === 'shield' && a2 === 'attack') {
      parts.push(`Shield absorbs! P1 -${d1}`)
    } else if (a1 === 'laser' && a2 === 'dodge') {
      parts.push('Laser misses! P2 rolled away!')
    } else {
      if (d2 > 0) parts.push(`P2 -${d2}${p1Pen ? '⚠️' : ''}`)
      if (d1 > 0) parts.push(`P1 -${d1}${p2Pen ? '⚠️' : ''}`)
    }

    if (h1 > 0) parts.push(`P1 +${h1}HP`)
    if (h2 > 0) parts.push(`P2 +${h2}HP`)
    if (p1Pen) parts.push('P1 spam ×0.5')
    if (p2Pen) parts.push('P2 spam ×0.5')

    if (parts.length === 0) parts.push('No damage')

    return parts.join(' | ')
  }
}

export function runMatch(
  p1Strategy: Strategy,
  p2Strategy: Strategy,
  format: 'bo1' | 'bo3' | 'bo5'
): { winner: 1 | 2 | 0; score: [number, number]; rounds: RoundResult[] } {
  const maxRounds = format === 'bo1' ? 1 : format === 'bo3' ? 3 : 5
  const winsNeeded = Math.ceil(maxRounds / 2)
  const engine = new BattleEngine(p1Strategy, p2Strategy)
  const rounds: RoundResult[] = []
  const wins: [number, number] = [0, 0]

  for (let r = 1; r <= maxRounds; r++) {
    const result = engine.runRound(r)
    rounds.push(result)
    if (result.winner === 1) wins[0]++
    else if (result.winner === 2) wins[1]++
    if (wins[0] >= winsNeeded || wins[1] >= winsNeeded) break
  }

  const winner: 1 | 2 | 0 = wins[0] > wins[1] ? 1 : wins[1] > wins[0] ? 2 : 0
  return { winner, score: wins, rounds }
}
