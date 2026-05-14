/**
 * SpineAdapter.ts
 *
 * Maps the CharacterView API onto the existing SpineCharacter prop contract.
 * The adapter does NOT render — it only owns state that CharacterView
 * passes down as props to <SpineCharacter />.
 *
 * CharacterView holds a ref to this adapter; when the AnimationPlayer fires
 * an event, CharacterView calls adapter.applyEvent() which updates React state.
 */

import type { ActionName } from '@robocode/shared'
import type { AnimationName, BattleEvent, VFXType } from '@robocode/shared'
import { ACTION_TO_ANIMATION } from '@robocode/shared'

// Spine animation names understood by SpineCharacter
// (maps from our AnimationName → actual Spine track name)
const ANIM_TO_SPINE: Record<AnimationName, string> = {
  idle:          'idle',
  ready:         'aim',
  walk_forward:  'walk',
  walk_backward: 'walk',
  attack:        'shoot',
  heavy:         'shoot',
  ranged:        'shoot',
  shield:        'aim',
  dodge:         'jump',
  hit:           'hit',
  special:       'shoot',
  ko:            'death',
  victory:       'run',
}

export interface SpineAdapterState {
  /** Passed as `action` prop to SpineCharacter */
  action:  ActionName | null
  /** Incremented each turn so SpineCharacter re-fires even if same action */
  turnKey: number
  /** Incremented each time a hit lands — triggers hit reaction */
  hitKey:  number
  /** When true, SpineCharacter fades out and plays death anim */
  isDead:  boolean
}

export class SpineAdapter {
  private _state: SpineAdapterState = {
    action:  null,
    turnKey: 0,
    hitKey:  0,
    isDead:  false,
  }

  private _onChange: (state: SpineAdapterState) => void

  constructor(onChange: (state: SpineAdapterState) => void) {
    this._onChange = onChange
  }

  get state(): SpineAdapterState {
    return this._state
  }

  /** Called by CharacterView when a BattleEvent fires */
  applyEvent(event: BattleEvent): void {
    const next = { ...this._state }

    switch (event.type) {
      case 'action':
        next.action  = event.action
        next.turnKey = next.turnKey + 1
        break

      case 'damage':
        next.hitKey = next.hitKey + 1
        break

      case 'ko':
        next.isDead = true
        break

      case 'victory':
        next.action  = 'special' as ActionName  // plays victory/run anim
        next.turnKey = next.turnKey + 1
        break

      // heal, vfx, status — handled by VFX layer, no spine state change
      default:
        return
    }

    this._state = next
    this._onChange(next)
  }

  /** Play an arbitrary animation by name (bypasses event system) */
  playAnimation(name: AnimationName): void {
    // Map animation name to the closest ActionName for SpineCharacter
    const actionMap: Partial<Record<AnimationName, ActionName>> = {
      idle:   'repair',   // maps to idle in SpineCharacter
      ko:     'dead' as ActionName,
    }
    // For most animations, just set action and bump turnKey
    const next = { ...this._state }
    next.turnKey = next.turnKey + 1
    // We can only drive Spine via action — use the reverse map
    // Find an action that produces this animation
    const actionEntry = Object.entries(ACTION_TO_ANIMATION).find(
      ([, anim]) => anim === name
    )
    if (actionEntry) {
      next.action = actionEntry[0] as ActionName
    }
    if (name === 'ko') next.isDead = true
    this._state = next
    this._onChange(next)
  }

  reset(): void {
    this._state = {
      action:  null,
      turnKey: 0,
      hitKey:  0,
      isDead:  false,
    }
    this._onChange(this._state)
  }
}
