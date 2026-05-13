import { useEffect, useRef, useState } from 'react'
import {
  AssetManager,
  SkeletonRenderer,
} from '@esotericsoftware/spine-canvas'
import {
  Skeleton,
  AnimationState,
  AnimationStateData,
  SkeletonJson,
  AtlasAttachmentLoader,
  Physics,
} from '@esotericsoftware/spine-canvas'
import type { ActionName } from '@robocode/shared'
import styles from './SpineCharacter.module.css'

// ── Animation mapping: game actions → Spine animation names ───────────────────
// These names must match what the artist used in the Spine Editor.
// Spineboy demo has: idle, walk, run, jump, shoot, aim, hit, death
const ACTION_TO_ANIM: Record<string, string> = {
  idle:    'idle',
  attack:  'shoot',
  heavy:   'shoot',
  laser:   'shoot',
  shield:  'aim',
  dodge:   'jump',
  repair:  'walk',
  special: 'shoot',
  hurt:    'hit',
  victory: 'run',
  dead:    'death',
}

// One-shot animations that should return to idle after finishing
const ONE_SHOT_ANIMS = new Set(['shoot', 'hit', 'jump', 'death'])

// Mix times between animations (seconds)
const MIX_TIMES: Array<[string, string, number]> = [
  ['idle',  'shoot', 0.1],
  ['shoot', 'idle',  0.2],
  ['idle',  'hit',   0.05],
  ['hit',   'idle',  0.2],
  ['idle',  'jump',  0.1],
  ['jump',  'idle',  0.3],
  ['idle',  'aim',   0.15],
  ['aim',   'idle',  0.2],
  ['idle',  'walk',  0.2],
  ['walk',  'idle',  0.2],
  ['idle',  'death', 0.1],
]

// ── Config per skin: which spine directory + scale ────────────────────────────
// Add entries here as you get real assets for each skin.
// Falls back to 'spineboy' for any unknown skin.
export const SPINE_SKIN_CONFIG: Record<string, { dir: string; scale: number; yOffset?: number }> = {
  default:   { dir: 'spineboy', scale: 0.38, yOffset: 0 },
  robot:     { dir: 'spineboy', scale: 0.38, yOffset: 0 },
  boxer:     { dir: 'spineboy', scale: 0.38, yOffset: 0 },
  gladiator: { dir: 'spineboy', scale: 0.38, yOffset: 0 },
  cosmonaut: { dir: 'spineboy', scale: 0.38, yOffset: 0 },
  ninja:     { dir: 'spineboy', scale: 0.38, yOffset: 0 },
  mage:      { dir: 'spineboy', scale: 0.38, yOffset: 0 },
  paladin:   { dir: 'spineboy', scale: 0.38, yOffset: 0 },
  sniper:    { dir: 'spineboy', scale: 0.38, yOffset: 0 },
  tank:      { dir: 'spineboy', scale: 0.38, yOffset: 0 },
  vampire:   { dir: 'spineboy', scale: 0.38, yOffset: 0 },
  samurai:   { dir: 'spineboy', scale: 0.38, yOffset: 0 },
  phantom:   { dir: 'spineboy', scale: 0.38, yOffset: 0 },
  engineer:  { dir: 'spineboy', scale: 0.38, yOffset: 0 },
  berserker: { dir: 'spineboy', scale: 0.38, yOffset: 0 },
}

interface SpineRefs {
  skeleton: Skeleton
  state:    AnimationState
  renderer: SkeletonRenderer
  ctx:      CanvasRenderingContext2D
}

interface Props {
  skinId:    string
  action?:   ActionName | null
  flipX?:    boolean
  isDead?:   boolean
  /** CSS class applied to the wrapper div — used by parent to position it */
  className?: string
  style?:     React.CSSProperties
}

export default function SpineCharacter({ skinId, action, flipX = false, isDead = false, className, style }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const spineRef   = useRef<SpineRefs | null>(null)
  const rafRef     = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const [loaded, setLoaded] = useState(false)
  const [error,  setError]  = useState(false)

  // ── Load assets & initialize skeleton ──────────────────────────────────────
  useEffect(() => {
    const cfg = SPINE_SKIN_CONFIG[skinId] ?? SPINE_SKIN_CONFIG['default']
    const baseUrl = `/spine/${cfg.dir}/`
    const jsonPath  = `${baseUrl}spineboy.json`
    const atlasPath = `${baseUrl}spineboy.atlas`

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let cancelled = false

    const assetManager = new AssetManager(baseUrl)
    assetManager.loadText(jsonPath)
    assetManager.loadTextureAtlas(atlasPath)

    // Poll for loading completion
    let pollId: ReturnType<typeof setInterval>
    pollId = setInterval(() => {
      if (cancelled) { clearInterval(pollId); return }
      if (!assetManager.isLoadingComplete()) return
      clearInterval(pollId)

      if (assetManager.hasErrors()) {
        console.warn('[SpineCharacter] Load errors:', assetManager.getErrors())
        setError(true)
        return
      }

      try {
        const atlas    = assetManager.require(atlasPath)
        const jsonText = assetManager.require(jsonPath)

        const loader   = new AtlasAttachmentLoader(atlas)
        const skelJson = new SkeletonJson(loader)
        skelJson.scale = cfg.scale

        const skelData = skelJson.readSkeletonData(jsonText)
        const skeleton = new Skeleton(skelData)
        skeleton.setToSetupPose()
        // Position origin at bottom-center of canvas
        skeleton.x = canvas.width  / 2
        skeleton.y = canvas.height + (cfg.yOffset ?? 0)
        if (flipX) skeleton.scaleX = -Math.abs(skeleton.scaleX)

        const stateData = new AnimationStateData(skelData)
        stateData.defaultMix = 0.2
        for (const [from, to, mix] of MIX_TIMES) {
          try { stateData.setMix(from, to, mix) } catch { /* animation not found — skip */ }
        }

        const state    = new AnimationState(stateData)
        const renderer = new SkeletonRenderer(ctx)
        renderer.debugRendering   = false
        renderer.triangleRendering = true

        // Start with idle
        try { state.setAnimation(0, 'idle', true) } catch { /* ignore */ }

        spineRef.current = { skeleton, state, renderer, ctx }
        setLoaded(true)
      } catch (e) {
        console.error('[SpineCharacter] Init error:', e)
        setError(true)
      }
    }, 50)

    return () => {
      cancelled = true
      clearInterval(pollId)
      cancelAnimationFrame(rafRef.current)
      spineRef.current = null
      setLoaded(false)
      setError(false)
    }
  }, [skinId])  // re-init when skin changes

  // ── Render loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded || !spineRef.current) return

    const canvas = canvasRef.current!
    const { skeleton, state, renderer, ctx } = spineRef.current

    let dead = false

    function loop(now: number) {
      if (dead) return
      const delta = Math.min((now - (lastTimeRef.current || now)) / 1000, 0.064)
      lastTimeRef.current = now

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      state.update(delta)
      state.apply(skeleton)
      skeleton.update(delta)
      skeleton.updateWorldTransform(Physics.update)

      renderer.draw(skeleton)

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      dead = true
      cancelAnimationFrame(rafRef.current)
    }
  }, [loaded])

  // ── React to action changes ────────────────────────────────────────────────
  useEffect(() => {
    if (!spineRef.current) return
    const { state, skeleton } = spineRef.current
    const skelData = skeleton.data

    // Death — permanent, no return
    if (isDead) {
      const deathAnim = 'death'
      if (skelData.findAnimation(deathAnim)) {
        try { state.setAnimation(0, deathAnim, false) } catch { /* ignore */ }
      }
      return
    }

    const animName = ACTION_TO_ANIM[action ?? 'idle'] ?? 'idle'

    // Check animation exists in skeleton data
    if (!skelData.findAnimation(animName)) return

    try {
      if (ONE_SHOT_ANIMS.has(animName)) {
        // Play once on track 1, return to idle on track 0
        state.setAnimation(0, 'idle', true)
        const entry = state.setAnimation(1, animName, false)
        entry.listener = {
          complete: () => {
            try { state.clearTrack(1) } catch { /* ignore */ }
          },
        }
      } else {
        state.clearTrack(1)
        state.setAnimation(0, animName, true)
      }
    } catch { /* animation not found — ignore */ }
  }, [action, isDead])

  // ── Update flipX reactively ────────────────────────────────────────────────
  useEffect(() => {
    if (!spineRef.current) return
    const { skeleton } = spineRef.current
    const scale = SPINE_SKIN_CONFIG[skinId]?.scale ?? 0.38
    skeleton.scaleX = flipX ? -scale : scale
  }, [flipX, skinId])

  // ── Render ─────────────────────────────────────────────────────────────────
  if (error) return null

  return (
    <div className={`${styles.wrap} ${className ?? ''}`} style={style}>
      {/* Loading shimmer */}
      {!loaded && <div className={styles.shimmer} />}

      <canvas
        ref={canvasRef}
        width={180}
        height={280}
        className={styles.canvas}
        style={{ opacity: loaded ? (isDead ? 0.35 : 1) : 0 }}
      />
    </div>
  )
}
