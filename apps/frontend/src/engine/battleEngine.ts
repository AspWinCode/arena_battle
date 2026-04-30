import {
  DAMAGE_MATRIX, REPAIR_AMOUNT, COOLDOWNS, MAX_HP, MAX_TURNS,
  REPEAT_PENALTY_AFTER, REPEAT_DAMAGE_FACTOR,
  applyPositionModifier,
} from '@robocode/shared'
import type {
  Strategy, StrategyContext, ActionName, PlayerState, TurnResult, RoundResult,
} from '@robocode/shared'

const VALID_ACTIONS = new Set<ActionName>(['attack', 'laser', 'shield', 'dodge', 'combo', 'repair'])

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
      myHp:            self.hp,
      enemyHp:         enemy.hp,
      turn,
      myLastAction:    self.lastAction,
      enemyLastAction: enemy.lastAction,
      cooldowns: {
        attack: (self.cooldowns as any).attack ?? 0,
        laser:  self.cooldowns.laser,
        shield: self.cooldowns.shield,
        dodge:  (self.cooldowns as any).dodge ?? 0,
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

    // ── Dynamic function strategy ─────────────────────────────────────
    if (strategy.fn) {
      try {
        const ctx = this.buildContext(self, enemy, turn)
        const chosen = strategy.fn(ctx)
        if (isValidAction(chosen)) {
          const cd = (cooldowns as any)[chosen] ?? 0
          if (cd === 0) return chosen
        }
      } catch { /* fall through */ }
    }

    // ── Static strategy ───────────────────────────────────────────────
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

    this.p1.shieldActive = false
    this.p2.shieldActive = false
    if (a1 === 'shield') this.p1.shieldActive = true
    if (a2 === 'shield') this.p2.shieldActive = true

    const entry = DAMAGE_MATRIX[a1][a2]
    let rawP1Dmg = 0, rawP2Dmg = 0
    if (!entry.missChance || Math.random() >= entry.missChance) {
      rawP1Dmg = applyPositionModifier(a2, this.p2.position, entry.atkDmg)
      rawP2Dmg = applyPositionModifier(a1, this.p1.position, entry.defDmg)
    }

    // Repeat penalty: penalise outgoing damage of the repeating player
    const p1Factor = this.p1.repeatCount >= REPEAT_PENALTY_AFTER ? REPEAT_DAMAGE_FACTOR : 1
    const p2Factor = this.p2.repeatCount >= REPEAT_PENALTY_AFTER ? REPEAT_DAMAGE_FACTOR : 1
    const p1Dmg = Math.round(rawP1Dmg * p2Factor)
    const p2Dmg = Math.round(rawP2Dmg * p1Factor)

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
      log: this.buildLog(a1, a2, p1Dmg, p2Dmg, p1Heal, p2Heal,
        this.p1.repeatCount >= REPEAT_PENALTY_AFTER,
        this.p2.repeatCount >= REPEAT_PENALTY_AFTER),
    }
  }

  private tickCooldowns(s: ExtState) {
    for (const k of Object.keys(s.cooldowns) as (keyof typeof s.cooldowns)[]) {
      if (s.cooldowns[k] > 0) s.cooldowns[k]--
    }
  }

  private applyCooldown(s: ExtState, action: ActionName) {
    const cd = COOLDOWNS[action]
    if (cd > 0 && action in s.cooldowns) (s.cooldowns as any)[action] = cd
  }

  private updatePosition(s: ExtState, action: ActionName) {
    if (action === 'attack' || action === 'combo') s.position = 'close'
    else if (action === 'laser') s.position = 'far'
    else if (action === 'dodge') s.position = s.position === 'close' ? 'mid' : s.position === 'mid' ? 'far' : 'mid'
  }

  private buildLog(
    a1: ActionName, a2: ActionName,
    d1: number, d2: number, h1: number, h2: number,
    p1Pen: boolean, p2Pen: boolean,
  ): string {
    const parts: string[] = []
    if (a1 === 'dodge' && d1 === 0 && d2 === 0) parts.push('P1 dodge!')
    else if (a2 === 'dodge' && d2 === 0 && d1 === 0) parts.push('P2 dodge!')
    else {
      if (d2 > 0) parts.push(`P2 -${d2}${p1Pen ? '⚠️' : ''}`)
      if (d1 > 0) parts.push(`P1 -${d1}${p2Pen ? '⚠️' : ''}`)
    }
    if (h1 > 0) parts.push(`P1 +${h1}HP`)
    if (h2 > 0) parts.push(`P2 +${h2}HP`)
    if (p1Pen) parts.push('P1 spam×0.5')
    if (p2Pen) parts.push('P2 spam×0.5')
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

  return { winner: (wins[0] > wins[1] ? 1 : wins[1] > wins[0] ? 2 : 0) as 1 | 2 | 0, score: wins, rounds }
}
