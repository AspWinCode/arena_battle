import { useState, useRef, useCallback, useEffect } from 'react'
import type { BlockInstance, SlotValue, Script } from './types'
import { BLOCK_DEFS, BLOCK_DEF_MAP, CATEGORIES, CATEGORY_META } from './blockDefs'
import BlockShape from './BlockShape'
import { generateCode } from './codeGen'
import styles from './BlockEditor.module.css'

let _nextId = 1
const uid = () => `b${_nextId++}`

function makeInstance(defId: string, x = 0, y = 0): BlockInstance {
  const def = BLOCK_DEF_MAP.get(defId)!
  return {
    instanceId: uid(),
    defId,
    x,
    y,
    slots: (def.slots ?? []).map(s => ({ slotId: s.id, value: s.default ?? null })),
    body: def.canHaveBody ? [] : undefined,
    next: undefined,
  }
}

interface DragState {
  inst: BlockInstance
  fromPalette: boolean
  offsetX: number
  offsetY: number
  currentX: number
  currentY: number
}

interface Props {
  onChange?: (code: string) => void
}

export default function BlockEditor({ onChange }: Props) {
  const [scripts, setScripts]       = useState<Script[]>([])
  const [activeCategory, setActiveCategory] = useState('combat')
  const [drag, setDrag]             = useState<DragState | null>(null)
  const [zoom, setZoom]             = useState(1)
  const [panOffset, setPanOffset]   = useState({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)

  // Generate code when scripts change
  useEffect(() => {
    const firstScript = scripts[0]
    const code = firstScript ? generateCode(firstScript.root) : ''
    onChange?.(code)
  }, [scripts, onChange])

  const handlePaletteMouseDown = (defId: string, e: React.MouseEvent) => {
    e.preventDefault()
    const inst = makeInstance(defId, e.clientX, e.clientY)
    setDrag({
      inst,
      fromPalette: true,
      offsetX: 0,
      offsetY: 0,
      currentX: e.clientX,
      currentY: e.clientY,
    })
  }

  const handleCanvasMouseDown = (scriptId: string, instId: string, e: React.MouseEvent) => {
    e.preventDefault()
    const script = scripts.find(s => s.id === scriptId)
    if (!script) return
    // Find instance (simplified: just root)
    const inst = findInstance(script.root, instId)
    if (!inst) return
    setDrag({
      inst,
      fromPalette: false,
      offsetX: e.clientX - inst.x,
      offsetY: e.clientY - inst.y,
      currentX: e.clientX,
      currentY: e.clientY,
    })
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!drag) return
    setDrag(d => d ? { ...d, currentX: e.clientX, currentY: e.clientY } : null)
  }, [drag])

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!drag) return

    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left - panOffset.x) / zoom
    const y = (e.clientY - rect.top - panOffset.y) / zoom

    // Check if dropped on palette (to delete)
    const onPalette = e.clientX < rect.left
    if (onPalette && !drag.fromPalette) {
      // Remove from scripts
      setScripts(prev => prev.filter(s => {
        if (s.root.instanceId === drag.inst.instanceId) return false
        return true
      }))
      setDrag(null)
      return
    }

    // Snap: find closest script endpoint
    const snapTarget = findSnapTarget(scripts, { ...drag.inst, x, y }, 30)

    if (snapTarget) {
      setScripts(prev => attachBlock(prev, drag.inst, snapTarget))
    } else {
      // Place as new script
      const newInst = { ...drag.inst, x, y }
      const def = BLOCK_DEF_MAP.get(newInst.defId)
      if (def?.type === 'hat' || def?.type === 'command' || def?.type === 'c-block' || def?.type === 'cap') {
        setScripts(prev => [...prev, { id: uid(), root: newInst }])
      }
    }
    setDrag(null)
  }, [drag, scripts, panOffset, zoom])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(z => Math.min(2, Math.max(0.5, z * delta)))
  }

  const handleSlotChange = useCallback((instId: string, slotId: string, value: string | number) => {
    setScripts(prev => prev.map(s => ({
      ...s,
      root: updateSlot(s.root, instId, slotId, value),
    })))
  }, [])

  const blocksInCategory = BLOCK_DEFS.filter(b => b.category === activeCategory)

  return (
    <div className={styles.root}>
      {/* Palette */}
      <div className={styles.palette}>
        <div className={styles.categories}>
          {CATEGORIES.map(cat => {
            const meta = CATEGORY_META[cat]
            return (
              <button
                key={cat}
                className={`${styles.catBtn} ${activeCategory === cat ? styles.catBtnActive : ''}`}
                style={{ '--cat-color': meta.color } as React.CSSProperties}
                onClick={() => setActiveCategory(cat)}
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
              </button>
            )
          })}
        </div>

        <div className={styles.blockList}>
          {blocksInCategory.map(def => (
            <div
              key={def.id}
              className={styles.paletteBlock}
              onMouseDown={e => handlePaletteMouseDown(def.id, e)}
            >
              <BlockShape
                inst={makeInstance(def.id)}
                def={def}
                onSlotChange={() => {}}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Script Canvas */}
      <div
        ref={canvasRef}
        className={styles.canvas}
        onWheel={handleWheel}
        style={{ cursor: drag ? 'grabbing' : 'default' }}
      >
        {/* Grid */}
        <div className={styles.grid} />

        <div
          className={styles.canvasContent}
          style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})` }}
        >
          {scripts.map(script => (
            <div
              key={script.id}
              className={styles.scriptStack}
              style={{ left: script.root.x, top: script.root.y }}
            >
              {renderStack(script.root, script.id, handleSlotChange, () => {})}
            </div>
          ))}
        </div>

        {/* Drag ghost */}
        {drag && (
          <div
            className={styles.dragGhost}
            style={{ left: drag.currentX, top: drag.currentY }}
          >
            {(() => {
              const def = BLOCK_DEF_MAP.get(drag.inst.defId)
              return def ? <BlockShape inst={drag.inst} def={def} onSlotChange={() => {}} /> : null
            })()}
          </div>
        )}

        {/* Empty state */}
        {scripts.length === 0 && !drag && (
          <div className={styles.emptyHint}>
            <div className={styles.emptyIcon}>🧩</div>
            <div className={styles.emptyText}>Перетащи блоки сюда для создания программы</div>
            <div className={styles.emptySubText}>Начни с блока <strong>«когда раунд начинается»</strong></div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <button className={`btn btn-ghost ${styles.toolBtn}`} onClick={() => setScripts([])}>🗑 Очистить</button>
        <button className={`btn btn-ghost ${styles.toolBtn}`} onClick={() => setZoom(1)}>🔍 {Math.round(zoom * 100)}%</button>
      </div>
    </div>
  )
}

function renderStack(
  inst: BlockInstance,
  scriptId: string,
  onSlotChange: (id: string, slotId: string, v: string | number) => void,
  onCanvasMouseDown: (sId: string, iId: string, e: React.MouseEvent) => void,
): React.ReactNode {
  const def = BLOCK_DEF_MAP.get(inst.defId)
  if (!def) return null
  return (
    <div key={inst.instanceId} className={styles.stackItem}>
      <BlockShape
        inst={inst}
        def={def}
        onSlotChange={onSlotChange}
      />
      {inst.next && renderStack(inst.next, scriptId, onSlotChange, onCanvasMouseDown)}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function findInstance(root: BlockInstance, id: string): BlockInstance | null {
  if (root.instanceId === id) return root
  if (root.next) {
    const found = findInstance(root.next, id)
    if (found) return found
  }
  for (const child of root.body ?? []) {
    const found = findInstance(child, id)
    if (found) return found
  }
  return null
}

function updateSlot(inst: BlockInstance, instId: string, slotId: string, value: string | number): BlockInstance {
  if (inst.instanceId === instId) {
    return {
      ...inst,
      slots: inst.slots.map(s => s.slotId === slotId ? { ...s, value } : s),
    }
  }
  return {
    ...inst,
    next: inst.next ? updateSlot(inst.next, instId, slotId, value) : undefined,
    body: inst.body?.map(b => updateSlot(b, instId, slotId, value)),
  }
}

interface SnapTarget {
  scriptId: string
  afterInstanceId: string
  type: 'next' | 'body'
}

function findSnapTarget(
  scripts: Script[],
  inst: BlockInstance,
  radius: number,
): SnapTarget | null {
  for (const script of scripts) {
    const target = findSnap(script.id, script.root, inst, radius)
    if (target) return target
  }
  return null
}

function findSnap(
  scriptId: string,
  root: BlockInstance,
  inst: BlockInstance,
  radius: number,
): SnapTarget | null {
  // Check if inst is close to the bottom of root (next)
  const dx = inst.x - root.x
  const dy = inst.y - (root.y + 32) // approximate block height
  if (Math.abs(dx) < radius && Math.abs(dy) < radius) {
    const def = BLOCK_DEF_MAP.get(root.defId)
    if (def?.type !== 'cap') {
      return { scriptId, afterInstanceId: root.instanceId, type: 'next' }
    }
  }
  if (root.next) {
    const found = findSnap(scriptId, root.next, inst, radius)
    if (found) return found
  }
  return null
}

function attachBlock(scripts: Script[], newInst: BlockInstance, target: SnapTarget): Script[] {
  return scripts.map(s => {
    if (s.id !== target.scriptId) return s
    return {
      ...s,
      root: attachToInstance(s.root, target.afterInstanceId, newInst),
    }
  })
}

function attachToInstance(inst: BlockInstance, targetId: string, newInst: BlockInstance): BlockInstance {
  if (inst.instanceId === targetId) {
    if (inst.next) {
      // Chain: newInst → old next
      return { ...inst, next: { ...newInst, next: inst.next } }
    }
    return { ...inst, next: { ...newInst, next: undefined } }
  }
  return {
    ...inst,
    next: inst.next ? attachToInstance(inst.next, targetId, newInst) : undefined,
    body: inst.body?.map(b => attachToInstance(b, targetId, newInst)),
  }
}
