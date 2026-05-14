/**
 * CharacterView.tsx
 *
 * High-level character component that:
 *   1. Chooses renderer: Spritesheet (if /sprites/<id>/<id>.json exists)
 *                        or Spine (fallback for all others)
 *   2. Overlays damage / heal floating numbers
 *   3. Exposes an imperative handle (CharacterViewHandle) for AnimationPlayer
 *
 * Usage:
 *   const ref = useRef<CharacterViewHandle>(null)
 *   <CharacterView ref={ref} skinId="boxer" flipX={false} />
 *   ref.current?.applyEvent(event)
 */

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
  useEffect,
} from 'react'
import SpineCharacter from '../components/SpineCharacter/SpineCharacter'
import SpritesheetCharacter from '../components/SpritesheetCharacter/SpritesheetCharacter'
import type { SpritesheetCharacterHandle } from '../components/SpritesheetCharacter/SpritesheetCharacter'
import { SpineAdapter } from './adapters/SpineAdapter'
import type { SpineAdapterState } from './adapters/SpineAdapter'
import type { BattleEvent, AnimationName, CharacterSkin } from '@robocode/shared'
import styles from './CharacterView.module.css'

// ── Which characters use spritesheet (have /sprites/<id>/<id>.json) ────────────
// Add more ids here as you create spritesheets
const SPRITESHEET_CHARS = new Set(['boxer'])

// ── Floating number ────────────────────────────────────────────────────────────

interface FloatEntry {
  id:     number
  text:   string
  kind:   'damage' | 'crit' | 'heal'
}

let _floatId = 0

// ── Public handle ──────────────────────────────────────────────────────────────

export interface CharacterViewHandle {
  applyEvent(event: BattleEvent): void
  playAnimation(name: AnimationName): void
  showDamageNumber(amount: number, isCrit?: boolean): void
  showHealNumber(amount: number): void
  reset(): void
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface CharacterViewProps {
  skinId:     string
  flipX?:     boolean
  skin?:      CharacterSkin
  className?: string
  style?:     React.CSSProperties
}

// ── Component ──────────────────────────────────────────────────────────────────

const CharacterView = forwardRef<CharacterViewHandle, CharacterViewProps>(
  function CharacterView({ skinId, flipX = false, className, style }, ref) {

    const useSprite = SPRITESHEET_CHARS.has(skinId)

    // ── Spritesheet path ─────────────────────────────────────────────────────
    const spriteRef = useRef<SpritesheetCharacterHandle>(null)

    // ── Spine path ───────────────────────────────────────────────────────────
    const [spineState, setSpineState] = useState<SpineAdapterState>({
      action:  null,
      turnKey: 0,
      hitKey:  0,
      isDead:  false,
    })
    const spineAdapterRef = useRef<SpineAdapter | null>(null)
    if (!spineAdapterRef.current) {
      spineAdapterRef.current = new SpineAdapter(setSpineState)
    }
    useEffect(() => {
      if (!useSprite) {
        spineAdapterRef.current = new SpineAdapter(setSpineState)
        spineAdapterRef.current.reset()
      }
    }, [skinId, useSprite])

    // ── Floating numbers ─────────────────────────────────────────────────────
    const [floats, setFloats] = useState<FloatEntry[]>([])
    const addFloat = useCallback((text: string, kind: FloatEntry['kind']) => {
      const id = _floatId++
      setFloats(prev => [...prev, { id, text, kind }])
      setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 900)
    }, [])

    // ── Imperative handle ─────────────────────────────────────────────────────

    useImperativeHandle(ref, () => ({
      applyEvent(event: BattleEvent) {
        if (useSprite) {
          spriteRef.current?.applyEvent(event)
        } else {
          spineAdapterRef.current?.applyEvent(event)
        }
        if (event.type === 'damage') {
          addFloat(`-${event.amount}`, event.isCrit ? 'crit' : 'damage')
        } else if (event.type === 'heal') {
          addFloat(`+${event.amount}`, 'heal')
        }
      },

      playAnimation(name: AnimationName) {
        if (useSprite) {
          spriteRef.current?.playAnimation(name)
        } else {
          spineAdapterRef.current?.playAnimation(name)
        }
      },

      showDamageNumber(amount: number, isCrit = false) {
        addFloat(`-${amount}`, isCrit ? 'crit' : 'damage')
      },

      showHealNumber(amount: number) {
        addFloat(`+${amount}`, 'heal')
      },

      reset() {
        if (useSprite) {
          spriteRef.current?.reset()
        } else {
          spineAdapterRef.current?.reset()
          setSpineState({ action: null, turnKey: 0, hitKey: 0, isDead: false })
        }
        setFloats([])
      },
    }), [useSprite, addFloat])

    // ── Render ────────────────────────────────────────────────────────────────

    return (
      <div className={`${styles.wrap} ${className ?? ''}`} style={style}>

        {useSprite ? (
          <SpritesheetCharacter
            ref={spriteRef}
            spriteId={skinId}
            flipX={flipX}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <SpineCharacter
            skinId={skinId}
            action={spineState.action}
            turnKey={spineState.turnKey}
            hitKey={spineState.hitKey}
            isDead={spineState.isDead}
            flipX={flipX}
          />
        )}

        {floats.map(f => (
          <span key={f.id} className={`${styles.float} ${styles[f.kind]}`}>
            {f.text}
          </span>
        ))}
      </div>
    )
  }
)

export default CharacterView
