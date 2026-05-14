/**
 * AnimationPlayer.ts
 *
 * Plays back a BattleEvent[] log at a controlled pace.
 * Completely decoupled from React — used as an imperative controller
 * that drives CharacterView (or any subscriber) via callbacks.
 *
 * Usage:
 *   const player = new AnimationPlayer()
 *   player.onEvent = (event, index) => { charView.applyEvent(event) }
 *   player.onTurnStart = (turnIndex) => { /* update HUD *\/ }
 *   player.loadReplay(events)
 *   player.play()
 */

import type { BattleEvent } from '@robocode/shared'

export type SpeedMultiplier = 0.5 | 1 | 2

// ── How long (ms) to wait after each event type ───────────────────────────────
const EVENT_DELAYS: Partial<Record<BattleEvent['type'], number>> = {
  action:  600,   // action animation plays out
  damage:  300,   // brief pause after hit lands
  heal:    250,
  vfx:     0,     // VFX plays in parallel — no extra delay
  status:  200,
  ko:      900,   // dramatic pause for knockdown
  victory: 1200,
}

const DEFAULT_DELAY = 250

// Pause between turns (after all events for a turn have resolved)
const INTER_TURN_DELAY = 400

export interface AnimationPlayerCallbacks {
  /** Called for every event in the log as it fires */
  onEvent?: (event: BattleEvent, index: number) => void
  /** Called right before the first event of each logical "turn" fires */
  onTurnStart?: (turnIndex: number) => void
  /** Called when the entire replay finishes */
  onComplete?: () => void
  /** Called after play/pause/speed changes so UI can sync */
  onStateChange?: (playing: boolean, speed: SpeedMultiplier) => void
}

/** A logical turn boundary marker inserted by the replay builder */
const TURN_BOUNDARY = Symbol('TURN_BOUNDARY')
type EventOrMarker = BattleEvent | typeof TURN_BOUNDARY

export class AnimationPlayer {
  // ── Public callbacks ──────────────────────────────────────────────────────
  onEvent:       AnimationPlayerCallbacks['onEvent']       = undefined
  onTurnStart:   AnimationPlayerCallbacks['onTurnStart']   = undefined
  onComplete:    AnimationPlayerCallbacks['onComplete']    = undefined
  onStateChange: AnimationPlayerCallbacks['onStateChange'] = undefined

  // ── Internal state ────────────────────────────────────────────────────────
  private events: BattleEvent[] = []
  private _playing   = false
  private _speed: SpeedMultiplier = 1
  private _cursor    = 0
  private _timerId: ReturnType<typeof setTimeout> | null = null
  private _turnIndex = 0

  /** Load a flat event array (produced by battleReplay.ts) */
  loadReplay(events: BattleEvent[]): void {
    this.stop()
    this.events   = events
    this._cursor  = 0
    this._turnIndex = 0
  }

  /**
   * Load events grouped by turn.
   * Inserts logical boundaries so onTurnStart fires at the right moment.
   */
  loadTurns(turns: BattleEvent[][]): void {
    this.loadReplay(turns.flat())
    // Store turn start indices for seekToTurn
    this._turnStartIndices = turns.reduce<number[]>((acc, t, i) => {
      acc.push(i === 0 ? 0 : acc[i - 1] + turns[i - 1].length)
      return acc
    }, [])
  }

  private _turnStartIndices: number[] = []

  play(): void {
    if (this._playing) return
    this._playing = true
    this.onStateChange?.(true, this._speed)
    this._scheduleNext()
  }

  pause(): void {
    if (!this._playing) return
    this._playing = false
    if (this._timerId !== null) {
      clearTimeout(this._timerId)
      this._timerId = null
    }
    this.onStateChange?.(false, this._speed)
  }

  stop(): void {
    this.pause()
    this._cursor    = 0
    this._turnIndex = 0
  }

  setSpeed(multiplier: SpeedMultiplier): void {
    this._speed = multiplier
    this.onStateChange?.(this._playing, this._speed)
    // If playing, restart the current tick with new timing
    if (this._playing) {
      if (this._timerId !== null) clearTimeout(this._timerId)
      this._scheduleNext()
    }
  }

  /** Jump to the event that starts a given logical turn (0-based) */
  seekToTurn(turnIndex: number): void {
    if (this._turnStartIndices.length === 0) return
    const idx = Math.max(0, Math.min(turnIndex, this._turnStartIndices.length - 1))
    this._cursor    = this._turnStartIndices[idx] ?? 0
    this._turnIndex = idx
  }

  get isPlaying(): boolean { return this._playing }
  get speed(): SpeedMultiplier { return this._speed }
  get cursor(): number { return this._cursor }
  get totalEvents(): number { return this.events.length }

  // ── Private ───────────────────────────────────────────────────────────────

  private _scheduleNext(): void {
    if (!this._playing) return
    if (this._cursor >= this.events.length) {
      this._playing = false
      this.onStateChange?.(false, this._speed)
      this.onComplete?.()
      return
    }

    const event = this.events[this._cursor]

    // Notify turn start if we're at a known boundary
    if (
      this._turnStartIndices.length > 0 &&
      this._turnStartIndices[this._turnIndex] === this._cursor &&
      this._cursor !== 0 // first turn fires before we even start
    ) {
      this.onTurnStart?.(this._turnIndex)
      this._turnIndex++
    } else if (this._cursor === 0) {
      this.onTurnStart?.(0)
      if (this._turnStartIndices.length > 1) this._turnIndex = 1
    }

    // Fire the event
    this.onEvent?.(event, this._cursor)
    this._cursor++

    // Determine delay to next event
    const baseDelay = EVENT_DELAYS[event.type] ?? DEFAULT_DELAY
    const delay = baseDelay / this._speed

    // Add inter-turn pause if the NEXT event starts a new turn
    const nextIsNewTurn =
      this._turnStartIndices.length > 0 &&
      this._turnIndex < this._turnStartIndices.length &&
      this._turnStartIndices[this._turnIndex] === this._cursor

    const totalDelay = delay + (nextIsNewTurn ? INTER_TURN_DELAY / this._speed : 0)

    this._timerId = setTimeout(() => {
      this._timerId = null
      this._scheduleNext()
    }, totalDelay)
  }
}

// ── Singleton factory for components that don't need multiple players ─────────
let _sharedPlayer: AnimationPlayer | null = null

export function getSharedAnimationPlayer(): AnimationPlayer {
  if (!_sharedPlayer) _sharedPlayer = new AnimationPlayer()
  return _sharedPlayer
}
