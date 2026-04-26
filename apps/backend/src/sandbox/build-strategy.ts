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

export function buildStrategy(calls: ActionCall[]): Strategy {
  // calls[0] = action at normal HP (enemy HP ~60)
  // calls[1] = action at low HP (enemy HP ~20)
  const primary = (calls[0]?.action ?? 'attack') as ActionName
  const lowHp = (calls[1]?.action ?? primary) as ActionName

  const hasShield = calls.some(c => c.action === 'shield')
  const hasDodge = calls.some(c => c.action === 'dodge')

  const onHit: ActionName = hasDodge ? 'dodge' : hasShield ? 'shield' : 'attack'

  const style =
    primary === 'laser' ? 'Aggressive' :
    primary === 'combo' ? 'Balanced' :
    primary === 'dodge' ? 'Evasive' :
    hasShield ? 'Defensive' : 'Standard'

  const moveCall = calls.find(c => c.action?.startsWith('move'))
  const position: Position =
    moveCall?.action === 'moveForward' ? 'close' :
    moveCall?.action === 'moveBackward' ? 'far' : 'mid'

  return { primary, lowHp, onHit, style, position }
}
