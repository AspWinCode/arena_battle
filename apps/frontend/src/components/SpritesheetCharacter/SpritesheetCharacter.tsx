/**
 * SpritesheetCharacter.tsx
 *
 * Drop-in visual replacement for SpineCharacter that uses a PNG spritesheet.
 * Driven by the same BattleEvent system via SpritesheetAdapter.
 *
 * Usage:
 *   <SpritesheetCharacter spriteId="boxer" flipX={false} ref={ref} />
 */

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { SpritesheetAdapter } from '../../animation/adapters/SpritesheetAdapter'
import type { BattleEvent, AnimationName } from '@robocode/shared'
import styles from './SpritesheetCharacter.module.css'

export interface SpritesheetCharacterHandle {
  applyEvent(event: BattleEvent): void
  playAnimation(name: AnimationName): void
  reset(): void
}

interface Props {
  spriteId:   string        // e.g. "boxer" → /sprites/boxer/boxer.json
  flipX?:     boolean
  className?: string
  style?:     React.CSSProperties
}

const SpritesheetCharacter = forwardRef<SpritesheetCharacterHandle, Props>(
  function SpritesheetCharacter({ spriteId, flipX = false, className, style }, ref) {
    const canvasRef    = useRef<HTMLCanvasElement>(null)
    const adapterRef   = useRef<SpritesheetAdapter | null>(null)
    const [loaded, setLoaded] = useState(false)
    const [error,  setError]  = useState(false)

    // ── Load spritesheet when spriteId changes ──────────────────────────────
    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      let cancelled = false
      setLoaded(false)
      setError(false)

      // Clean up previous adapter
      adapterRef.current?.destroy()
      adapterRef.current = null

      const adapter = new SpritesheetAdapter(canvas, flipX)
      adapter.load(spriteId).then(() => {
        if (cancelled) return
        adapterRef.current = adapter
        setLoaded(true)
      }).catch(() => {
        if (cancelled) return
        setError(true)
      })

      return () => {
        cancelled = true
        adapter.destroy()
      }
    }, [spriteId])

    // ── Sync flipX ──────────────────────────────────────────────────────────
    useEffect(() => {
      adapterRef.current?.setFlipX(flipX)
    }, [flipX])

    // ── Imperative handle ───────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      applyEvent(event: BattleEvent) {
        adapterRef.current?.applyEvent(event)
      },
      playAnimation(name: AnimationName) {
        adapterRef.current?.play(name)
      },
      reset() {
        adapterRef.current?.reset()
      },
    }))

    if (error) return null

    return (
      <div className={`${styles.wrap} ${className ?? ''}`} style={style}>
        {!loaded && <div className={styles.shimmer} />}
        <canvas
          ref={canvasRef}
          width={320}
          height={360}
          className={styles.canvas}
          style={{ opacity: loaded ? 1 : 0 }}
        />
      </div>
    )
  }
)

export default SpritesheetCharacter
