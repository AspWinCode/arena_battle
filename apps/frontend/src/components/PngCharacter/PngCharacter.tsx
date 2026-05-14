/**
 * PngCharacter.tsx
 *
 * Renders a character using separate PNG images per action.
 * Driven by the same BattleEvent system as SpritesheetAdapter.
 *
 * Skin images come from SkinDef: { imgIdle, imgAttack, imgHit, imgDeath }
 */

import {
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
  useRef,
} from 'react'
import type { BattleEvent, AnimationName } from '@robocode/shared'
import styles from './PngCharacter.module.css'

export interface PngSkinImages {
  imgIdle:   string
  imgAttack: string
  imgHit:    string
  imgDeath:  string
}

export interface PngCharacterHandle {
  applyEvent(event: BattleEvent): void
  playAnimation(name: AnimationName): void
  reset(): void
}

interface Props {
  images:     PngSkinImages
  flipX?:     boolean
  className?: string
  style?:     React.CSSProperties
}

type ActionKey = 'idle' | 'attack' | 'hit' | 'death'

const ACTION_DURATION: Record<ActionKey, number> = {
  idle:   0,      // permanent
  attack: 600,    // ms then back to idle
  hit:    400,
  death:  0,      // permanent
}

// Preload all 4 images as soon as component mounts to avoid first-show flash
function usePreload(images: PngSkinImages) {
  useEffect(() => {
    const srcs = [images.imgIdle, images.imgAttack, images.imgHit, images.imgDeath]
    srcs.filter(Boolean).forEach(src => { new Image().src = src })
  }, [images.imgIdle, images.imgAttack, images.imgHit, images.imgDeath])
}

const PngCharacter = forwardRef<PngCharacterHandle, Props>(
  function PngCharacter({ images, flipX = false, className, style }, ref) {
    const [action, setAction] = useState<ActionKey>('idle')
    const [flash,  setFlash]  = useState(false)
    const [dead,   setDead]   = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    usePreload(images)

    function playAction(a: ActionKey) {
      if (timerRef.current) clearTimeout(timerRef.current)
      setAction(a)
      const dur = ACTION_DURATION[a]
      if (dur > 0) {
        timerRef.current = setTimeout(() => setAction('idle'), dur)
      }
    }

    useImperativeHandle(ref, () => ({
      applyEvent(event: BattleEvent) {
        switch (event.type) {
          case 'action':
            playAction('attack')
            break
          case 'damage':
            setFlash(true)
            playAction('hit')
            setTimeout(() => setFlash(false), 200)
            break
          case 'ko':
            setDead(true)
            playAction('death')
            break
          case 'victory':
            playAction('idle')
            break
        }
      },
      playAnimation(name: AnimationName) {
        if (name === 'ko') { setDead(true); playAction('death') }
        else if (name === 'idle' || name === 'ready') playAction('idle')
        else playAction('attack')
      },
      reset() {
        if (timerRef.current) clearTimeout(timerRef.current)
        setAction('idle')
        setFlash(false)
        setDead(false)
      },
    }), [])

    const src = action === 'idle'   ? images.imgIdle
              : action === 'attack' ? images.imgAttack
              : action === 'hit'    ? images.imgHit
              :                       images.imgDeath

    return (
      <div
        className={`${styles.wrap} ${className ?? ''}`}
        style={style}
      >
        <img
          src={src || images.imgIdle}
          alt=""
          className={styles.img}
          style={{
            transform:  flipX ? 'scaleX(-1)' : undefined,
            filter:     flash  ? 'brightness(8) saturate(0)' : undefined,
            opacity:    dead && action === 'death' ? 0.5 : 1,
          }}
          draggable={false}
        />
      </div>
    )
  }
)

export default PngCharacter
