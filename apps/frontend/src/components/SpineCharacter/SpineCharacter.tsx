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
const ACTION_TO_ANIM: Record<string, string> = {
  idle:            'idle',
  attack:          'shoot',
  heavy:           'shoot',
  laser:           'shoot',
  shield:          'aim',
  dodge:           'jump',
  repair:          'walk',
  special:         'shoot',
  hurt:            'hit',
  victory:         'run',
  dead:            'death',
  combo:           'shoot',
  overcharge:      'aim',
  reflect:         'aim',
  adaptive_shield: 'aim',
  trap:            'walk',
  hack:            'walk',
  sacrifice:       'hit',
  reboot:          'walk',
  transfer:        'walk',
  analyze:         'walk',
  overclock:       'run',
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

// ── Config per skin ───────────────────────────────────────────────────────────
// scale: rendered size relative to canvas.
//   skelJson.scale is set to 1 (no pre-baking); skeleton.scaleX/Y = cfg.scale.
// Falls back to 'spineboy' for unknown skins.
export const SPINE_SKIN_CONFIG: Record<string, { dir: string; scale: number; yOffset?: number }> = {
  default:   { dir: 'spineboy', scale: 0.38, yOffset: 0 },
  robot:     { dir: 'spineboy', scale: 0.38, yOffset: 0 },
  boxer:     { dir: 'spineboy', scale: 0.38, yOffset: 0 },
  // Gladiator skeleton: attachments use full atlas px as Spine units.
  // Character spans ~510 units (boots bottom y≈−120 → head top y≈390).
  // scale=0.45 → fits ~230px of the 280px canvas.
  // yOffset = scale*120 so boot soles land exactly at canvas bottom.
  gladiator: { dir: 'gladiator', scale: 0.45, yOffset: 54 },
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
  scorpion:  { dir: 'spineboy', scale: 0.38, yOffset: 0 },
  plague:    { dir: 'spineboy', scale: 0.38, yOffset: 0 },
}

interface SpineRefs {
  skeleton: Skeleton
  state:    AnimationState
  renderer: SkeletonRenderer
  ctx:      CanvasRenderingContext2D
  scale:    number   // cfg.scale stored for flipX updates
}

interface Props {
  skinId:    string
  action?:   ActionName | null
  /** Increments each turn — ensures the animation fires even if action didn't change */
  turnKey?:  number
  flipX?:    boolean
  isDead?:   boolean
  className?: string
  style?:     React.CSSProperties
}

export default function SpineCharacter({ skinId, action, turnKey, flipX = false, isDead = false, className, style }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const spineRef    = useRef<SpineRefs | null>(null)
  const rafRef      = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const [loaded, setLoaded] = useState(false)
  const [error,  setError]  = useState(false)

  // ── Load assets & initialize skeleton ──────────────────────────────────────
  useEffect(() => {
    const cfg    = SPINE_SKIN_CONFIG[skinId] ?? SPINE_SKIN_CONFIG['default']
    const baseUrl = `/spine/${cfg.dir}/`
    // Use RELATIVE filenames — AssetManager prepends baseUrl (pathPrefix) internally.
    // Absolute paths would be doubled: /spine/dir//spine/dir/file → 404.
    const jsonFile  = 'spineboy.json'
    const atlasFile = 'spineboy.atlas'

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let cancelled = false

    const assetManager = new AssetManager(baseUrl)
    assetManager.loadText(jsonFile)
    assetManager.loadTextureAtlas(atlasFile)

    const timeoutId = window.setTimeout(() => {
      if (cancelled) return
      console.error('[SpineCharacter] Load timeout for', skinId, assetManager.getErrors())
      setError(true)
    }, 6000)

    assetManager.loadAll().then(() => {
      if (cancelled) return
      try {
        const atlas    = assetManager.require(atlasFile)
        const jsonText = assetManager.require(jsonFile)

        const loader   = new AtlasAttachmentLoader(atlas)
        const skelJson = new SkeletonJson(loader)
        // skelJson.scale = 1 intentionally — we apply scale via skeleton.scaleX/Y.
        // Using skelJson.scale to pre-bake AND skeleton.scaleX would double-scale,
        // pushing all bone worldY values off-screen (below canvas.height).
        skelJson.scale = 1

        const skelData = skelJson.readSkeletonData(jsonText)
        const skeleton = new Skeleton(skelData)
        skeleton.setToSetupPose()

        // Spine uses Y-UP coordinates; canvas is Y-DOWN.
        // We apply ctx.translate(0, canvas.height) + ctx.scale(1, -1) before rendering,
        // so the skeleton's origin (feet) should be at y=0 in Spine space.
        // The flip maps: screen_y = canvas.height - spine_y
        //   → feet (spine_y = 0) at screen bottom ✓
        //   → head (spine_y > 0) at screen top ✓
        skeleton.x      = canvas.width / 2
        skeleton.y      = cfg.yOffset ?? 0
        skeleton.scaleX = flipX ? -cfg.scale : cfg.scale
        skeleton.scaleY = cfg.scale

        const stateData = new AnimationStateData(skelData)
        stateData.defaultMix = 0.2
        for (const [from, to, mix] of MIX_TIMES) {
          try { stateData.setMix(from, to, mix) } catch { /* animation not found */ }
        }

        const state    = new AnimationState(stateData)
        const renderer = new SkeletonRenderer(ctx)
        renderer.debugRendering    = false
        renderer.triangleRendering = true

        try { state.setAnimation(0, 'idle', true) } catch { /* ignore */ }

        spineRef.current = { skeleton, state, renderer, ctx, scale: cfg.scale }
        setLoaded(true)
        setError(false)
      } catch (e) {
        console.error('[SpineCharacter] Init error:', e)
        setError(true)
      }
    }).catch((e) => {
      if (cancelled) return
      console.error('[SpineCharacter] Load error:', e)
      setError(true)
    }).finally(() => {
      window.clearTimeout(timeoutId)
    })

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      cancelAnimationFrame(rafRef.current)
      spineRef.current = null
      setLoaded(false)
      setError(false)
    }
  }, [skinId])

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

      // Apply Y-flip so Spine's Y-UP coordinate space maps correctly to canvas Y-DOWN.
      // Without this, characters render with positive-Y bones off the bottom of canvas.
      ctx.save()
      ctx.translate(0, canvas.height)
      ctx.scale(1, -1)
      renderer.draw(skeleton)
      ctx.restore()

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

    if (isDead) {
      if (skelData.findAnimation('death')) {
        try { state.setAnimation(0, 'death', false) } catch { /* ignore */ }
      }
      return
    }

    const animName = ACTION_TO_ANIM[action ?? 'idle'] ?? 'idle'
    if (!skelData.findAnimation(animName)) return

    try {
      if (ONE_SHOT_ANIMS.has(animName)) {
        state.setAnimation(0, 'idle', true)
        const entry = state.setAnimation(1, animName, false)
        entry.listener = {
          complete: () => { try { state.clearTrack(1) } catch { /* ignore */ } },
        }
      } else {
        state.clearTrack(1)
        state.setAnimation(0, animName, true)
      }
    } catch { /* animation not found */ }
  // turnKey changes every turn (even if action is the same) → animation re-fires.
  // loaded is included so the effect re-runs once the skeleton is ready (handles the
  // race where action arrived before the skeleton finished loading).
  }, [action, isDead, turnKey, loaded])

  // ── Update flipX reactively ────────────────────────────────────────────────
  useEffect(() => {
    if (!spineRef.current) return
    const { skeleton, scale } = spineRef.current
    skeleton.scaleX = flipX ? -scale : scale
  }, [flipX, skinId])

  // ── Render ─────────────────────────────────────────────────────────────────
  if (error) return null

  return (
    <div className={`${styles.wrap} ${className ?? ''}`} style={style}>
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
