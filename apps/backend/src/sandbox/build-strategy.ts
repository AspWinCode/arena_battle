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

function isBattleAction(action: string | undefined): action is ActionName {
  return action === 'attack'
    || action === 'laser'
    || action === 'shield'
    || action === 'dodge'
    || action === 'combo'
    || action === 'repair'
}

export function buildStrategy(calls: ActionCall[]): Strategy {
  const battleCalls = calls.filter(call => isBattleAction(call.action))

  // battleCalls[0] = action at normal HP (enemy HP ~60)
  // battleCalls[1] = action at low HP (enemy HP ~20)
  const primary = battleCalls[0]?.action ?? 'attack'
  const lowHp = battleCalls[1]?.action ?? primary

  const hasShield = battleCalls.some(c => c.action === 'shield')
  const hasDodge = battleCalls.some(c => c.action === 'dodge')

  const onHit: ActionName = hasDodge ? 'dodge' : hasShield ? 'shield' : 'attack'

  const style =
    primary === 'laser' ? 'Aggressive' :
    primary === 'combo' ? 'Balanced' :
    primary === 'dodge' ? 'Evasive' :
    hasShield ? 'Defensive' : 'Standard'

  const moveCall = [...calls].reverse().find(c => c.action?.startsWith('move'))
  const position: Position =
    moveCall?.action === 'moveForward' ? 'close' :
    moveCall?.action === 'moveBackward' ? 'far' : 'mid'

  return { primary, lowHp, onHit, style, position }
}
