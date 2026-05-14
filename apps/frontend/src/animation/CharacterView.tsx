/**
 * CharacterView.tsx
 *
 * High-level character component that:
 *   1. Wraps <SpineCharacter /> (via SpineAdapter)
 *   2. Overlays damage / heal floating numbers
 *   3. Exposes an imperative handle (CharacterViewHandle) for AnimationPlayer
 *
 * Usage:
 *   const ref = useRef<CharacterViewHandle>(null)
 *   <CharacterView ref={ref} skinId="boxer" flipX={false} />
 *   // later:
 *   ref.current?.applyEvent(event)
 *   ref.current?.showDamageNumber(35)
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
import { SpineAdapter } from './adapters/SpineAdapter'
import type { SpineAdapterState } from './adapters/SpineAdapter'
import type { BattleEvent, AnimationName, CharacterSkin } from '@robocode/shared'
import styles from './CharacterView.module.css'

// ── Floating number ────────────────────────────────────────────────────────────

interface FloatEntry {
  id:     number
  text:   string
  kind:   'damage' | 'crit' | 'heal'
}

let _floatId = 0

// ── Public handle (consumed by AnimationPlayer hooks / DemoBattlePage) ─────────

export interface CharacterViewHandle {
  applyEvent(event: BattleEvent): void
  playAnimation(name: AnimationName): void
  showDamageNumber(amount: number, isCrit?: boolean): void
  showHealNumber(amount: number): void
  reset(): void
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CharacterViewProps {
  skinId:     string
  flipX?:     boolean
  skin?:      CharacterSkin        // future: apply layer overrides
  className?: string
  style?:     React.CSSProperties
}

// ── Component ─────────────────────────────────────────────────────────────────

const CharacterView = forwardRef<CharacterViewHandle, CharacterViewProps>(
  function CharacterView({ skinId, flipX = false, className, style }, ref) {
    const [spineState, setSpineState] = useState<SpineAdapterState>({
      action:  null,
      turnKey: 0,
      hitKey:  0,
      isDead:  false,
    })

    const [floats, setFloats] = useState<FloatEntry[]>([])

    // Stable adapter — recreated only when skinId changes
    const adapterRef = useRef<SpineAdapter | null>(null)
    if (!adapterRef.current) {
      adapterRef.current = new SpineAdapter(setSpineState)
    }

    // Reset adapter when skin changes
    useEffect(() => {
      adapterRef.current = new SpineAdapter(setSpineState)
      adapterRef.current.reset()
    }, [skinId])

    // ── Floating number helpers ───────────────────────────────────────────────

    const addFloat = useCallback((text: string, kind: FloatEntry['kind']) => {
      const id = _floatId++
      setFloats(prev => [...prev, { id, text, kind }])
      setTimeout(() => {
        setFloats(prev => prev.filter(f => f.id !== id))
      }, 900)
    }, [])

    // ── Imperative handle ─────────────────────────────────────────────────────

    useImperativeHandle(ref, () => ({
      applyEvent(event: BattleEvent) {
        adapterRef.current?.applyEvent(event)

        // Show floating numbers for damage / heal
        if (event.type === 'damage') {
          addFloat(
            `-${event.amount}`,
            event.isCrit ? 'crit' : 'damage',
          )
        } else if (event.type === 'heal') {
          addFloat(`+${event.amount}`, 'heal')
        }
      },

      playAnimation(name: AnimationName) {
        adapterRef.current?.playAnimation(name)
      },

      showDamageNumber(amount: number, isCrit = false) {
        addFloat(`-${amount}`, isCrit ? 'crit' : 'damage')
      },

      showHealNumber(amount: number) {
        addFloat(`+${amount}`, 'heal')
      },

      reset() {
        adapterRef.current?.reset()
        setFloats([])
      },
    }), [addFloat])

    // ── Render ────────────────────────────────────────────────────────────────

    return (
      <div className={`${styles.wrap} ${className ?? ''}`} style={style}>
        <SpineCharacter
          skinId={skinId}
          action={spineState.action}
          turnKey={spineState.turnKey}
          hitKey={spineState.hitKey}
          isDead={spineState.isDead}
          flipX={flipX}
        />

        {/* Floating damage / heal numbers */}
        {floats.map(f => (
          <span
            key={f.id}
            className={`${styles.float} ${styles[f.kind]}`}
          >
            {f.text}
          </span>
        ))}
      </div>
    )
  }
)

export default CharacterView
