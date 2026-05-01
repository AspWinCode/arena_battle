import type { Strategy, ActionName, Position } from '@robocode/shared'

export interface ActionCall {
  action: string
  type?: string
  power?: number
  dir?: string
  amt?: number
  n?: number
  moves?: ActionCall[]
}

const BATTLE_ACTIONS = new Set<ActionName>([
  'attack', 'heavy', 'laser', 'shield', 'dodge', 'repair', 'special',
])

function isBattleAction(action: string | undefined): action is ActionName {
  return !!action && BATTLE_ACTIONS.has(action as ActionName)
}

export function buildStrategy(calls: ActionCall[]): Strategy {
  const battleCalls = calls.filter(c => isBattleAction(c.action))

  const primary: ActionName = isBattleAction(battleCalls[0]?.action)
    ? battleCalls[0].action as ActionName
    : 'attack'

  const lowHp: ActionName = isBattleAction(battleCalls[1]?.action)
    ? battleCalls[1].action as ActionName
    : primary

  const hasShield = battleCalls.some(c => c.action === 'shield')
  const hasDodge  = battleCalls.some(c => c.action === 'dodge')
  const onHit: ActionName = hasDodge ? 'dodge' : hasShield ? 'shield' : 'attack'

  const style: Strategy['style'] =
    primary === 'laser' || primary === 'heavy' ? 'Aggressive' :
    primary === 'special' ? 'Balanced' :
    primary === 'dodge'  ? 'Evasive' :
    hasShield ? 'Defensive' : 'Standard'

  const moveCall = [...calls].reverse().find(c => c.action?.startsWith('move'))
  const position: Position =
    moveCall?.action === 'moveForward'  ? 'close' :
    moveCall?.action === 'moveBackward' ? 'far'   : 'mid'

  return { primary, lowHp, onHit, style, position }
}
