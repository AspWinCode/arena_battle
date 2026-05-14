/**
 * SpritesheetAdapter.ts
 *
 * Renders a spritesheet character onto a <canvas>.
 * Driven by the same BattleEvent system as SpineAdapter.
 *
 * JSON format: /sprites/<id>/<id>.json  (see boxer.json for example)
 */

import type { BattleEvent, AnimationName } from '@robocode/shared'

// ── JSON types ────────────────────────────────────────────────────────────────

interface FrameRect { x: number; y: number; w: number; h: number }

interface AnimDef {
  frames: FrameRect[]
  fps: number
  loop: boolean
  holdLastFrame?: boolean
}

interface SheetDef {
  image: string
  animations: Record<string, AnimDef>
  /** map animation names that don't exist → fallback name */
  aliases?: Record<string, string>
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class SpritesheetAdapter {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private img: HTMLImageElement | null = null
  private def: SheetDef | null = null

  private currentAnim = 'idle'
  private frameIndex  = 0
  private elapsed     = 0          // ms since last frame
  private finished    = false       // one-shot anim done
  private rafId       = 0
  private lastTime    = 0
  private flipX       = false
  private dead        = false

  // pending hit overlay (brief flash)
  private hitFlash    = 0           // countdown frames

  // stable scale computed once from the largest frame across all animations
  private stableScale  = 1
  private stableCanonW = 0
  private stableCanonH = 0

  constructor(canvas: HTMLCanvasElement, flipX = false) {
    this.canvas = canvas
    this.ctx    = canvas.getContext('2d')!
    this.flipX  = flipX
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  async load(spriteId: string): Promise<void> {
    const base = `/sprites/${spriteId}/`
    const [def] = await Promise.all([
      fetch(base + `${spriteId}.json`).then(r => r.json()) as Promise<SheetDef>,
    ])
    this.def = def

    // Precompute a stable scale from the largest frame across ALL animations.
    // This keeps the character anchored (feet at same pixel) across every frame.
    const allFrames = Object.values(def.animations).flatMap(a => a.frames)
    const maxW = Math.max(...allFrames.map(f => f.w))
    const maxH = Math.max(...allFrames.map(f => f.h))
    this.stableScale  = Math.min(
      (this.canvas.width  * 0.92) / maxW,
      (this.canvas.height * 0.92) / maxH,
    )
    this.stableCanonW = maxW * this.stableScale
    this.stableCanonH = maxH * this.stableScale

    await new Promise<void>((resolve, reject) => {
      const img  = new Image()
      img.onload = () => { this.img = img; resolve() }
      img.onerror = reject
      img.src = base + def.image
    })

    this.play('idle')
  }

  // ── BattleEvent handler ───────────────────────────────────────────────────

  applyEvent(event: BattleEvent): void {
    switch (event.type) {
      case 'action':
        this._playAnim(this._resolveAnim(event.action))
        break
      case 'damage':
        this.hitFlash = 4   // flash for 4 frames
        this._playAnim('hit')
        break
      case 'ko':
        this.dead = true
        this._playAnim('death')
        break
      case 'victory':
        this._playAnim('idle')
        break
    }
  }

  // ── Public control ────────────────────────────────────────────────────────

  play(animName: string): void {
    this._playAnim(animName)
  }

  setFlipX(flip: boolean): void {
    this.flipX = flip
  }

  reset(): void {
    this.dead      = false
    this.hitFlash  = 0
    this._playAnim('idle')
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId)
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _resolveAnim(name: string): string {
    if (!this.def) return 'idle'
    if (this.def.animations[name]) return name
    if (this.def.aliases?.[name]) return this.def.aliases[name]
    return 'idle'
  }

  private _playAnim(name: string): void {
    if (!this.def) return
    const resolved = this._resolveAnim(name)
    if (this.currentAnim === resolved && !this.finished) return
    this.currentAnim = resolved
    this.frameIndex  = 0
    this.elapsed     = 0
    this.finished    = false

    if (this.rafId === 0) this._startLoop()
  }

  private _startLoop(): void {
    const loop = (now: number) => {
      if (!this.img || !this.def) { this.rafId = requestAnimationFrame(loop); return }

      const delta = now - (this.lastTime || now)
      this.lastTime = now

      const anim = this.def.animations[this.currentAnim]
      if (!anim) { this.rafId = requestAnimationFrame(loop); return }

      // Advance frame
      if (!this.finished) {
        this.elapsed += delta
        const frameDuration = 1000 / anim.fps
        while (this.elapsed >= frameDuration) {
          this.elapsed -= frameDuration
          if (this.frameIndex < anim.frames.length - 1) {
            this.frameIndex++
          } else if (anim.loop) {
            this.frameIndex = 0
          } else {
            this.finished = true
            // Return to idle after one-shot (except death)
            if (this.currentAnim !== 'death' && !this.dead) {
              this.currentAnim = 'idle'
              this.frameIndex  = 0
              this.elapsed     = 0
              this.finished    = false
            }
            break
          }
        }
      }

      this._draw()

      if (this.hitFlash > 0) this.hitFlash--

      this.rafId = requestAnimationFrame(loop)
    }

    this.rafId = requestAnimationFrame(loop)
  }

  private _draw(): void {
    const { canvas, ctx, img, flipX, def } = this
    if (!img || !def) return

    const anim = def.animations[this.currentAnim]
    if (!anim) return

    // Reset ALL context state before every frame to avoid filter/alpha leakage
    ctx.globalAlpha      = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.filter           = 'none'
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const frame = anim.frames[this.frameIndex]
    if (!frame) return

    // Use stable scale (computed from max frame across all animations) so the
    // character stays anchored at the same position regardless of frame size.
    const scale = this.stableScale
    const dw = frame.w * scale
    const dh = frame.h * scale

    // Center horizontally and pin feet to bottom within the canonical bounding box.
    const dx = (canvas.width  - this.stableCanonW) / 2 + (this.stableCanonW - dw) / 2
    const dy = canvas.height  - this.stableCanonH - 2  + (this.stableCanonH - dh)

    // Hit flash
    if (this.hitFlash > 0) {
      ctx.filter = 'brightness(8) saturate(0)'
    }

    if (flipX) {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }

    ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, dx, dy, dw, dh)

    // Fade to nothing on death held frame
    if (this.dead && this.finished) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalAlpha = 0
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }
}
