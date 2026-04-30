import {
  DAMAGE_MATRIX, REPAIR_AMOUNT, COOLDOWNS, MAX_HP, MAX_TURNS, applyPositionModifier,
} from '@robocode/shared'
import type { Strategy, ActionName, PlayerState, TurnResult, RoundResult } from '@robocode/shared'

export class BattleEngine {
  private p1: PlayerState
  private p2: PlayerState
  private turns: TurnResult[] = []

  constructor(p1Strategy: Strategy, p2Strategy: Strategy) {
    this.p1 = this.initState(p1Strategy)
    this.p2 = this.initState(p2Strategy)
  }

  private initState(strategy: Strategy): PlayerState {
    return {
      hp: MAX_HP,
      position: strategy.position,
      cooldowns: { laser: 0, combo: 0, repair: 0, shield: 0 },
      lastAction: null,
      shieldActive: false,
      strategy,
    }
  }

  runRound(roundNumber: number): RoundResult {
    this.p1 = this.initState(this.p1.strategy)
    this.p2 = this.initState(this.p2.strategy)
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

  private resolveTurn(turn: number): TurnResult {
    const a1 = this.pickAction(this.p1, this.p2, turn)
    const a2 = this.pickAction(this.p2, this.p1, turn)

    this.p1.shieldActive = false
    this.p2.shieldActive = false
    if (a1 === 'shield') this.p1.shieldActive = true
    if (a2 === 'shield') this.p2.shieldActive = true

    const entry = DAMAGE_MATRIX[a1][a2]
    let p1Dmg = 0, p2Dmg = 0
    if (!entry.missChance || Math.random() >= entry.missChance) {
      p1Dmg = applyPositionModifier(a2, this.p2.position, entry.atkDmg)
      p2Dmg = applyPositionModifier(a1, this.p1.position, entry.defDmg)
    }

    const p1Heal = a1 === 'repair' ? REPAIR_AMOUNT : 0
    const p2Heal = a2 === 'repair' ? REPAIR_AMOUNT : 0

    this.p1.hp = Math.min(MAX_HP, Math.max(0, this.p1.hp - p1Dmg + p1Heal))
    this.p2.hp = Math.min(MAX_HP, Math.max(0, this.p2.hp - p2Dmg + p2Heal))

    this.tickCooldowns(this.p1)
    this.tickCooldowns(this.p2)
    this.applyCooldown(this.p1, a1)
    this.applyCooldown(this.p2, a2)

    this.p1.lastAction = a1
    this.p2.lastAction = a2
    this.updatePosition(this.p1, a1)
    this.updatePosition(this.p2, a2)

    return {
      turn, p1Action: a1, p2Action: a2,
      p1DmgTaken: p1Dmg, p2DmgTaken: p2Dmg,
      p1HpAfter: this.p1.hp, p2HpAfter: this.p2.hp,
      p1Heal, p2Heal,
      p1Position: this.p1.position, p2Position: this.p2.position,
      log: this.buildLog(a1, a2, p1Dmg, p2Dmg, p1Heal, p2Heal),
    }
  }

  private pickAction(self: PlayerState, enemy: PlayerState, turn: number): ActionName {
    const { strategy, cooldowns } = self
    if (enemy.hp < 30) {
      const act = strategy.lowHp
      if (act === 'laser' && cooldowns.laser > 0) return cooldowns.combo === 0 ? 'combo' : 'attack'
      if (act === 'combo' && cooldowns.combo > 0) return 'attack'
      if (act === 'repair' && cooldowns.repair > 0) return 'shield'
      return act
    }
    if (enemy.lastAction === 'laser' && strategy.onHit === 'dodge') return 'dodge'
    if (enemy.shieldActive && ['attack', 'combo'].includes(strategy.primary)) return 'dodge'
    const act = strategy.primary
    if (act === 'laser' && cooldowns.laser > 0) return cooldowns.combo === 0 ? 'combo' : 'attack'
    if (act === 'combo' && cooldowns.combo > 0) return 'attack'
    if (act === 'repair' && cooldowns.repair > 0) return 'shield'
    if (act === 'shield' && turn % 2 === 0) return 'attack'
    return act
  }

  private tickCooldowns(s: PlayerState) {
    for (const k of Object.keys(s.cooldowns) as (keyof typeof s.cooldowns)[]) {
      if (s.cooldowns[k] > 0) s.cooldowns[k]--
    }
  }

  private applyCooldown(s: PlayerState, action: ActionName) {
    const cd = COOLDOWNS[action]
    if (cd > 0 && action in s.cooldowns) s.cooldowns[action as keyof typeof s.cooldowns] = cd
  }

  private updatePosition(s: PlayerState, action: ActionName) {
    if (action === 'attack' || action === 'combo') s.position = 'close'
    else if (action === 'laser') s.position = 'far'
    else if (action === 'dodge') s.position = s.position === 'close' ? 'mid' : s.position === 'mid' ? 'far' : 'mid'
  }

  private buildLog(a1: ActionName, a2: ActionName, d1: number, d2: number, h1: number, h2: number): string {
    const parts: string[] = []
    if (d2 > 0) parts.push(`P2 -${d2}`)
    if (d1 > 0) parts.push(`P1 -${d1}`)
    if (h1 > 0) parts.push(`P1 +${h1}HP`)
    if (h2 > 0) parts.push(`P2 +${h2}HP`)
    if (parts.length === 0) parts.push(`${a1} vs ${a2} — нет урона`)
    return parts.join(' | ')
  }
}

export function runLocalMatch(p1: Strategy, p2: Strategy, format: 'bo1' | 'bo3' | 'bo5') {
  const maxRounds = format === 'bo1' ? 1 : format === 'bo3' ? 3 : 5
  const winsNeeded = Math.ceil(maxRounds / 2)
  const engine = new BattleEngine(p1, p2)
  const rounds: RoundResult[] = []
  const wins: [number, number] = [0, 0]

  for (let r = 1; r <= maxRounds; r++) {
    const result = engine.runRound(r)
    rounds.push(result)
    if (result.winner === 1) wins[0]++
    else if (result.winner === 2) wins[1]++
    if (wins[0] >= winsNeeded || wins[1] >= winsNeeded) break
  }

  return { winner: wins[0] > wins[1] ? 1 : wins[1] > wins[0] ? 2 : 0 as 1 | 2 | 0, score: wins, rounds }
}
