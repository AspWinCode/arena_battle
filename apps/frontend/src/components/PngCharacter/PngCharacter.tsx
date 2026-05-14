import {
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react'
import type { BattleEvent, AnimationName } from '@robocode/shared'
import styles from './PngCharacter.module.css'

export interface SkinActionDef {
  fps:    number
  frames: string[]
}

export interface PngSkinImages {
  imgIdle:   string
  imgAttack: string
  imgHit:    string
  imgDeath:  string
  actions?:  Record<string, SkinActionDef>
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
  idle:   0,
  attack: 600,
  hit:    400,
  death:  0,
}

// Map ActionKey → actions JSON key
const ACTION_MAP: Record<ActionKey, string[]> = {
  idle:   ['idle', 'ready'],
  attack: ['attack', 'heavy', 'combo'],
  hit:    ['hit'],
  death:  ['ko'],
}

// Resolve a SkinActionDef for a given ActionKey from the actions map,
// falling back to the legacy single-image fields.
function resolveFrames(action: ActionKey, images: PngSkinImages): { frames: string[]; fps: number } {
  if (images.actions) {
    for (const key of ACTION_MAP[action]) {
      const def = images.actions[key]
      if (def && def.frames.length > 0) return def
    }
  }
  // Legacy fallback
  const legacy =
    action === 'idle'   ? images.imgIdle
    : action === 'attack' ? images.imgAttack
    : action === 'hit'    ? images.imgHit
    :                        images.imgDeath
  if (legacy) return { frames: [legacy], fps: 1 }
  return { frames: [images.imgIdle].filter(Boolean), fps: 1 }
}

function usePreload(images: PngSkinImages) {
  useEffect(() => {
    const srcs: string[] = [images.imgIdle, images.imgAttack, images.imgHit, images.imgDeath]
    if (images.actions) {
      for (const def of Object.values(images.actions)) srcs.push(...def.frames)
    }
    srcs.filter(Boolean).forEach(src => { new Image().src = src })
  }, [images])
}

const PngCharacter = forwardRef<PngCharacterHandle, Props>(
  function PngCharacter({ images, flipX = false, className, style }, ref) {
    const [action, setAction] = useState<ActionKey>('idle')
    const [frameIdx, setFrameIdx] = useState(0)
    const [flash,  setFlash]  = useState(false)
    const [dead,   setDead]   = useState(false)

    const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const frameTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null)

    usePreload(images)

    const stopFrameLoop = useCallback(() => {
      if (frameTimerRef.current) clearInterval(frameTimerRef.current)
      frameTimerRef.current = null
    }, [])

    const startFrameLoop = useCallback((def: { frames: string[]; fps: number }) => {
      stopFrameLoop()
      setFrameIdx(0)
      if (def.frames.length <= 1) return
      frameTimerRef.current = setInterval(() => {
        setFrameIdx(i => (i + 1) % def.frames.length)
      }, Math.round(1000 / def.fps))
    }, [stopFrameLoop])

    // Restart frame loop whenever action or images change
    useEffect(() => {
      const def = resolveFrames(action, images)
      startFrameLoop(def)
      return stopFrameLoop
    }, [action, images, startFrameLoop, stopFrameLoop])

    function playAction(a: ActionKey) {
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current)
      setAction(a)
      setFrameIdx(0)
      const dur = ACTION_DURATION[a]
      if (dur > 0) {
        actionTimerRef.current = setTimeout(() => {
          setAction('idle')
          setFrameIdx(0)
        }, dur)
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
        if (actionTimerRef.current) clearTimeout(actionTimerRef.current)
        stopFrameLoop()
        setAction('idle')
        setFrameIdx(0)
        setFlash(false)
        setDead(false)
      },
    }), [stopFrameLoop])

    const def = resolveFrames(action, images)
    const src = def.frames[frameIdx] ?? def.frames[0] ?? images.imgIdle

    return (
      <div
        className={`${styles.wrap} ${className ?? ''}`}
        style={style}
      >
        <img
          src={src}
          alt=""
          className={styles.img}
          style={{
            transform: flipX ? 'scaleX(-1)' : undefined,
            filter:    flash  ? 'brightness(8) saturate(0)' : undefined,
            opacity:   dead && action === 'death' ? 0.5 : 1,
          }}
          draggable={false}
        />
      </div>
    )
  }
)

export default PngCharacter
