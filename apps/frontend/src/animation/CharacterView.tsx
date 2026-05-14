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
import PngCharacter from '../components/PngCharacter/PngCharacter'
import type { SpritesheetCharacterHandle } from '../components/SpritesheetCharacter/SpritesheetCharacter'
import type { PngCharacterHandle, PngSkinImages } from '../components/PngCharacter/PngCharacter'
import { SpineAdapter } from './adapters/SpineAdapter'
import type { SpineAdapterState } from './adapters/SpineAdapter'
import type { BattleEvent, AnimationName, CharacterSkin } from '@robocode/shared'
import styles from './CharacterView.module.css'

// ── Which characters use spritesheet (have /sprites/<id>/<id>.json) ────────────
// Add more ids here as you create spritesheets
const SPRITESHEET_CHARS = new Set(['boxer'])

// ── Fetch skin render data from the public skins API ──────────────────────────
// Tries exact skinId first, then falls back to the character's default skin.
async function fetchSkinImages(skinId: string): Promise<PngSkinImages | null> {
  // Derive character ID: "boxer_blue" → "boxer", "boxer" → "boxer"
  const charId = skinId.includes('_') ? skinId.split('_')[0] : skinId
  try {
    const res = await fetch(`/api/v1/skins/character/${charId}`)
    if (!res.ok) return null
    const skin: {
      id: string
      imgIdle: string; imgAttack: string; imgHit: string; imgDeath: string
      actions?: Record<string, { fps: number; frames: string[] }>
    } = await res.json()
    // Only use PNG mode if there is at least one frame or legacy image
    const hasFrames = skin.actions && Object.values(skin.actions).some(a => a.frames.length > 0)
    const hasLegacy = skin.imgIdle || skin.imgAttack || skin.imgHit || skin.imgDeath
    if (!hasFrames && !hasLegacy) return null
    return {
      imgIdle:   skin.imgIdle,
      imgAttack: skin.imgAttack,
      imgHit:    skin.imgHit,
      imgDeath:  skin.imgDeath,
      actions:   skin.actions ?? undefined,
    }
  } catch {
    return null
  }
}

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

    // skinId can be a base characterId ("boxer") or a full skin variant ("boxer_blue_gloves")
    const baseCharId = skinId.includes('_') ? skinId.split('_')[0] : skinId

    // ── PNG path: try to load frames for any skin; fall back to spritesheet/spine ─
    const [pngImages, setPngImages] = useState<PngSkinImages | null>(null)
    const pngRef = useRef<PngCharacterHandle>(null)
    useEffect(() => {
      fetchSkinImages(skinId).then(imgs => setPngImages(imgs))
    }, [skinId])
    const usePng    = pngImages !== null
    const useSprite = !usePng && SPRITESHEET_CHARS.has(baseCharId)

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
        if (usePng) {
          pngRef.current?.applyEvent(event)
        } else if (useSprite) {
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
        if (usePng) {
          pngRef.current?.playAnimation(name)
        } else if (useSprite) {
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
        if (usePng) {
          pngRef.current?.reset()
        } else if (useSprite) {
          spriteRef.current?.reset()
        } else {
          spineAdapterRef.current?.reset()
          setSpineState({ action: null, turnKey: 0, hitKey: 0, isDead: false })
        }
        setFloats([])
      },
    }), [usePng, useSprite, addFloat])

    // ── Render ────────────────────────────────────────────────────────────────

    return (
      <div className={`${styles.wrap} ${className ?? ''}`} style={style}>

        {usePng && pngImages ? (
          <PngCharacter
            ref={pngRef}
            images={pngImages}
            flipX={flipX}
            style={{ width: '100%', height: '100%' }}
          />
        ) : useSprite ? (
          <SpritesheetCharacter
            ref={spriteRef}
            spriteId={baseCharId}
            flipX={flipX}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <SpineCharacter
            skinId={baseCharId}
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
