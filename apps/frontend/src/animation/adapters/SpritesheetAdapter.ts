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

      this._draw(anim)

      if (this.hitFlash > 0) this.hitFlash--

      this.rafId = requestAnimationFrame(loop)
    }

    this.rafId = requestAnimationFrame(loop)
  }

  private _draw(anim: AnimDef): void {
    const { canvas, ctx, img, flipX, hitFlash } = this
    if (!img) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const frame = anim.frames[this.frameIndex]
    if (!frame) return

    // Scale to fit canvas while keeping aspect ratio
    const scale = Math.min(
      canvas.width  / frame.w,
      canvas.height / frame.h,
    ) * 0.9  // 90% to leave breathing room

    const dw = frame.w * scale
    const dh = frame.h * scale
    const dx = (canvas.width  - dw) / 2
    const dy = (canvas.height - dh) / 2 + canvas.height * 0.05  // slight bottom offset

    ctx.save()

    if (flipX) {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }

    // Hit flash — white overlay
    if (hitFlash > 0) {
      ctx.filter = 'brightness(10) saturate(0)'
    }

    ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, dx, dy, dw, dh)

    // Fade out on death
    if (this.dead && this.finished) {
      ctx.globalAlpha = 0
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    ctx.restore()
  }
}
