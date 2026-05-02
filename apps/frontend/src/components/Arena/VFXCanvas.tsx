import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'

interface Particle {
  x: number; y: number
  vx: number; vy: number
  life: number; maxLife: number
  color: string; size: number
  type: 'circle' | 'spark' | 'ring'
  gravity?: number
}

export interface VFXHandle {
  spawnHitSparks(x: number, y: number, color: string): void
  spawnLaserImpact(x: number, y: number, color: string): void
  spawnRepairParticles(x: number, y: number): void
  spawnComboSparks(x: number, y: number, color: string): void
  spawnDodgeTrail(x: number, y: number, color: string): void
  spawnDeathExplosion(x: number, y: number, color: string): void
  spawnShieldBlock(x: number, y: number, color: string): void
  spawnMoveTrail(x: number, y: number, color: string, direction: 'forward' | 'backward'): void
  showHitNumber(x: number, y: number, dmg: number, color?: string): void
  showHealNumber(x: number, y: number, hp: number): void
  showLabel(x: number, y: number, text: string, color: string): void
  shake(intensity?: number): void
}

interface HitNumber {
  x: number; y: number; text: string; color: string
  life: number; maxLife: number; vy: number
}

const VFXCanvas = forwardRef<VFXHandle, { width: number; height: number }>((
  { width, height },
  ref,
) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particles = useRef<Particle[]>([])
  const hitNumbers = useRef<HitNumber[]>([])
  const shakeRef = useRef({ x: 0, y: 0, intensity: 0, frames: 0 })
  const rafRef = useRef<number>()

  const spawn = (p: Particle) => particles.current.push(p)

  useImperativeHandle(ref, () => ({
    spawnHitSparks(x, y, color) {
      for (let i = 0; i < 18; i++) {
        const angle = (Math.PI * 2 / 18) * i + Math.random() * 0.3
        const speed = 2 + Math.random() * 4
        spawn({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
          life: 30 + Math.random() * 20, maxLife: 50, color, size: 2 + Math.random() * 3,
          type: 'spark', gravity: 0.15 })
      }
    },
    spawnLaserImpact(x, y, color) {
      for (let i = 0; i < 35; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 1 + Math.random() * 5
        spawn({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          life: 25 + Math.random() * 25, maxLife: 50, color, size: 1.5 + Math.random() * 2.5,
          type: i < 3 ? 'ring' : 'spark', gravity: 0.05 })
      }
    },
    spawnRepairParticles(x, y) {
      for (let i = 0; i < 20; i++) {
        spawn({ x: x + (Math.random() - 0.5) * 30, y, vx: (Math.random() - 0.5) * 1.5,
          vy: -2 - Math.random() * 3, life: 40 + Math.random() * 20, maxLife: 60,
          color: '#22c55e', size: 3 + Math.random() * 3, type: 'circle', gravity: -0.05 })
      }
    },
    spawnComboSparks(x, y, color) {
      for (let i = 0; i < 25; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 3 + Math.random() * 5
        spawn({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1,
          life: 35 + Math.random() * 15, maxLife: 50, color, size: 2 + Math.random() * 3,
          type: 'spark', gravity: 0.12 })
      }
    },
    spawnDodgeTrail(x, y, color) {
      for (let i = 0; i < 10; i++) {
        spawn({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 1, vy: (Math.random() - 0.5) * 1,
          life: 15 + Math.random() * 10, maxLife: 25, color, size: 4 + Math.random() * 4,
          type: 'circle', gravity: 0 })
      }
    },
    showHitNumber(x, y, dmg, color = '#ef4444') {
      hitNumbers.current.push({ x, y, text: `-${dmg}`, color, life: 60, maxLife: 60, vy: -1 })
    },
    showHealNumber(x, y, hp) {
      hitNumbers.current.push({ x, y, text: `+${hp}`, color: '#22c55e', life: 60, maxLife: 60, vy: -1 })
    },
    showLabel(x, y, text, color) {
      hitNumbers.current.push({ x, y, text, color, life: 50, maxLife: 50, vy: -0.6 })
    },
    spawnDeathExplosion(x, y, color) {
      // Large burst — 50 sparks + 5 rings
      for (let i = 0; i < 50; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 3 + Math.random() * 8
        spawn({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 3,
          life: 50 + Math.random() * 40, maxLife: 90, color,
          size: 2 + Math.random() * 5, type: i < 5 ? 'ring' : 'spark', gravity: 0.18 })
      }
    },
    spawnShieldBlock(x, y, color) {
      // Radial burst of shield-colored sparks
      for (let i = 0; i < 14; i++) {
        const angle = (Math.PI * 2 / 14) * i
        const speed = 2 + Math.random() * 3
        spawn({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          life: 20 + Math.random() * 15, maxLife: 35, color,
          size: 2 + Math.random() * 2, type: i < 2 ? 'ring' : 'spark', gravity: 0 })
      }
    },
    spawnMoveTrail(x, y, color, direction) {
      const dx = direction === 'forward' ? 1 : -1
      for (let i = 0; i < 8; i++) {
        spawn({ x: x + dx * (Math.random() * 20), y: y + (Math.random() - 0.5) * 30,
          vx: dx * (1 + Math.random() * 2), vy: (Math.random() - 0.5) * 0.5,
          life: 12 + Math.random() * 8, maxLife: 20, color,
          size: 3 + Math.random() * 3, type: 'circle', gravity: 0 })
      }
    },
    shake(intensity = 8) {
      shakeRef.current = { x: 0, y: 0, intensity, frames: 12 }
    },
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Screen shake
      const sh = shakeRef.current
      const shaking = sh.frames > 0
      if (shaking) {
        sh.x = (Math.random() - 0.5) * sh.intensity * (sh.frames / 12)
        sh.y = (Math.random() - 0.5) * sh.intensity * (sh.frames / 12)
        sh.frames--
        ctx.save()
        ctx.translate(sh.x, sh.y)
      }

      // Particles
      particles.current = particles.current.filter(p => p.life > 0)
      for (const p of particles.current) {
        const alpha = p.life / p.maxLife
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color
        ctx.strokeStyle = p.color

        if (p.type === 'ring') {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * (1 - alpha) * 10, 0, Math.PI * 2)
          ctx.stroke()
        } else if (p.type === 'spark') {
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3)
          ctx.lineWidth = p.size * 0.5
          ctx.stroke()
        } else {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2)
          ctx.fill()
        }

        p.x += p.vx
        p.y += p.vy
        if (p.gravity) p.vy += p.gravity
        p.life--
      }

      // Hit numbers
      ctx.globalAlpha = 1
      hitNumbers.current = hitNumbers.current.filter(n => n.life > 0)
      for (const n of hitNumbers.current) {
        const alpha = n.life / n.maxLife
        ctx.globalAlpha = alpha
        ctx.fillStyle = n.color
        ctx.font = `bold ${16 + (1 - alpha) * 8}px system-ui`
        ctx.textAlign = 'center'
        ctx.fillText(n.text, n.x, n.y)
        n.y += n.vy
        n.life--
      }

      if (shaking) ctx.restore()
      ctx.globalAlpha = 1

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    />
  )
})

VFXCanvas.displayName = 'VFXCanvas'
export default VFXCanvas
