import { useState, useRef, useCallback, useEffect } from 'react'
import type { BlockInstance, Script } from './types'
import { BLOCK_DEFS, BLOCK_DEF_MAP, CATEGORIES, CATEGORY_META } from './blockDefs'
import BlockShape from './BlockShape'
import { generateCode } from './codeGen'
import styles from './BlockEditor.module.css'

let _nextId = 1
const uid = () => `b${_nextId++}`

const SKINS = [
  { id: 'robot',     icon: '🤖', label: 'Робот' },
  { id: 'gladiator', icon: '⚔️', label: 'Гладиатор' },
  { id: 'boxer',     icon: '🥊', label: 'Боксёр' },
  { id: 'cosmonaut', icon: '🚀', label: 'Космонавт' },
]

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

function deepCopy(inst: BlockInstance): BlockInstance {
  return {
    ...inst,
    instanceId: uid(),
    next: inst.next ? deepCopy(inst.next) : undefined,
    body: inst.body?.map(deepCopy),
    slots: inst.slots.map(s => ({
      ...s,
      value: s.value && typeof s.value === 'object' && 'instanceId' in s.value
        ? deepCopy(s.value as BlockInstance)
        : s.value,
    })),
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

interface ContextMenu {
  x: number
  y: number
  scriptId: string
  instId: string
}

interface Props {
  onChange?: (code: string) => void
  skin?: string
  onSkinChange?: (skin: string) => void
}

export default function BlockEditor({ onChange, skin = 'robot', onSkinChange }: Props) {
  const [scripts, setScripts]         = useState<Script[]>([])
  const [variables, setVariables]     = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState('combat')
  const [drag, setDrag]               = useState<DragState | null>(null)
  const [zoom, setZoom]               = useState(1)
  const [panOffset, setPanOffset]     = useState({ x: 0, y: 0 })
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const canvasRef  = useRef<HTMLDivElement>(null)
  const isPanning  = useRef(false)
  const panStart   = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const firstScript = scripts[0]
    const code = firstScript ? generateCode(firstScript.root) : ''
    onChange?.(code)
  }, [scripts, onChange])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [contextMenu])

  // Keyboard: Escape closes context menu
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Make variable ──────────────────────────────────────────────────────────

  const handleMakeVariable = () => {
    const name = window.prompt('Имя переменной:')?.trim()
    if (!name || variables.includes(name)) return
    setVariables(prev => [...prev, name])
  }

  // ── Drag from palette ──────────────────────────────────────────────────────

  const handlePaletteMouseDown = (defId: string, e: React.MouseEvent) => {
    e.preventDefault()
    const inst = makeInstance(defId, e.clientX, e.clientY)
    if (variables.length > 0) {
      inst.slots = inst.slots.map(s => {
        const slotDef = BLOCK_DEF_MAP.get(defId)?.slots?.find(sd => sd.id === s.slotId)
        if (slotDef?.type === 'varname') return { ...s, value: variables[0] }
        return s
      })
    }
    setDrag({ inst, fromPalette: true, offsetX: 0, offsetY: 0, currentX: e.clientX, currentY: e.clientY })
  }

  // ── Drag from canvas (pick up existing block) ───────────────────────────────

  const handleCanvasBlockMouseDown = useCallback((e: React.MouseEvent, inst: BlockInstance, scriptId: string) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    // Cut block (and its chain) out of the script tree
    setScripts(prev => {
      const [next] = pickUpBlock(prev, scriptId, inst.instanceId)
      return next
    })
    setDrag({ inst, fromPalette: false, offsetX: 0, offsetY: 0, currentX: e.clientX, currentY: e.clientY })
  }, [])

  // ── Mouse move / up ────────────────────────────────────────────────────────

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning.current) {
      setPanOffset({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y })
      return
    }
    if (!drag) return
    setDrag(d => d ? { ...d, currentX: e.clientX, currentY: e.clientY } : null)
  }, [drag])

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (isPanning.current) {
      isPanning.current = false
      return
    }
    if (!drag) return

    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left - panOffset.x) / zoom
    const y = (e.clientY - rect.top  - panOffset.y) / zoom

    // Dropped on palette → delete
    const onPalette = e.clientX < rect.left
    if (onPalette && !drag.fromPalette) {
      setScripts(prev => removeBlock(prev, findScriptOf(prev, drag.inst.instanceId) ?? '', drag.inst.instanceId))
      setDrag(null)
      return
    }

    const snapTarget = findSnapTarget(scripts, { ...drag.inst, x, y }, 55)

    if (snapTarget) {
      setScripts(prev => attachBlock(prev, drag.inst, snapTarget))
    } else {
      const newInst = { ...drag.inst, x, y }
      const def = BLOCK_DEF_MAP.get(newInst.defId)
      if (def?.type === 'hat' || def?.type === 'command' || def?.type === 'c-block' || def?.type === 'cap' || def?.type === 'reporter') {
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

  // ── Canvas interactions ────────────────────────────────────────────────────

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Middle-click → pan
    if (e.button === 1) {
      e.preventDefault()
      isPanning.current = true
      panStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y }
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(z => Math.min(2, Math.max(0.5, z * delta)))
  }

  // ── Slot change ────────────────────────────────────────────────────────────

  const handleSlotChange = useCallback((instId: string, slotId: string, value: string | number) => {
    setScripts(prev => prev.map(s => ({
      ...s,
      root: updateSlot(s.root, instId, slotId, value),
    })))
  }, [])

  // ── Context menu ───────────────────────────────────────────────────────────

  const handleBlockRightClick = useCallback((e: React.MouseEvent, scriptId: string, instId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, scriptId, instId })
  }, [])

  const handleContextDuplicate = () => {
    if (!contextMenu) return
    const script = scripts.find(s => s.id === contextMenu.scriptId)
    const inst = script ? findInstance(script.root, contextMenu.instId) : null
    if (!inst) return
    const copy = deepCopy(inst)
    copy.x = inst.x + 24
    copy.y = inst.y + 24
    setScripts(prev => [...prev, { id: uid(), root: copy }])
    setContextMenu(null)
  }

  const handleContextDelete = () => {
    if (!contextMenu) return
    setScripts(prev => removeBlock(prev, contextMenu.scriptId, contextMenu.instId))
    setContextMenu(null)
  }

  // ── Render palette ─────────────────────────────────────────────────────────

  const blocksInCategory = activeCategory === 'variables'
    ? BLOCK_DEFS.filter(b => b.category === 'variables')
    : BLOCK_DEFS.filter(b => b.category === activeCategory)

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
          {/* Variables: "Make variable" button + reporter ovals per variable */}
          {activeCategory === 'variables' && (
            <>
              <button className={styles.makeVarBtn} onClick={handleMakeVariable}>
                + Создать переменную
              </button>
              {variables.map(v => {
                const def = BLOCK_DEF_MAP.get('varReporter')!
                const inst = makeInstance('varReporter')
                inst.slots = [{ slotId: 'name', value: v }]
                return (
                  <div key={`var-${v}`} className={styles.paletteBlock} onMouseDown={e => handlePaletteMouseDown('varReporter', e)}>
                    <BlockShape inst={inst} def={def} onSlotChange={() => {}} variables={variables} />
                  </div>
                )
              })}
              <div className={styles.paletteDivider} />
            </>
          )}

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
                variables={variables}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Canvas + Sprite Selector */}
      <div className={styles.mainArea}>
        <div
          ref={canvasRef}
          className={styles.canvas}
          onWheel={handleWheel}
          onMouseDown={handleCanvasMouseDown}
          style={{ cursor: isPanning.current ? 'grabbing' : drag ? 'grabbing' : 'default' }}
        >
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
                {renderStack(script.root, script.id, handleSlotChange, handleBlockRightClick, variables, handleCanvasBlockMouseDown)}
              </div>
            ))}
          </div>

          {/* Drag ghost */}
          {drag && (
            <div className={styles.dragGhost} style={{ left: drag.currentX, top: drag.currentY }}>
              {(() => {
                const def = BLOCK_DEF_MAP.get(drag.inst.defId)
                return def ? <BlockShape inst={drag.inst} def={def} onSlotChange={() => {}} variables={variables} /> : null
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

          {/* Toolbar */}
          <div className={styles.toolbar}>
            <button className={`btn btn-ghost ${styles.toolBtn}`} onClick={() => setScripts([])}>🗑 Очистить</button>
            <button className={`btn btn-ghost ${styles.toolBtn}`} onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }) }}>
              🔍 {Math.round(zoom * 100)}%
            </button>
          </div>
        </div>

        {/* Sprite Selector */}
        <div className={styles.spriteBar}>
          <span className={styles.spriteBarLabel}>Персонаж:</span>
          {SKINS.map(s => (
            <button
              key={s.id}
              className={`${styles.skinCard} ${skin === s.id ? styles.skinCardActive : ''}`}
              onClick={() => onSkinChange?.(s.id)}
              title={s.label}
            >
              <span className={styles.skinIcon}>{s.icon}</span>
              <span className={styles.skinLabel}>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <button className={styles.contextItem} onClick={handleContextDuplicate}>
            📋 Дублировать
          </button>
          <button className={styles.contextItem} onClick={handleContextDelete}>
            🗑 Удалить
          </button>
        </div>
      )}
    </div>
  )
}

// ── Render helpers ─────────────────────────────────────────────────────────────

function renderStack(
  inst: BlockInstance,
  scriptId: string,
  onSlotChange: (id: string, slotId: string, v: string | number) => void,
  onRightClick: (e: React.MouseEvent, scriptId: string, instId: string) => void,
  variables: string[],
  onBlockMouseDown: (e: React.MouseEvent, inst: BlockInstance, scriptId: string) => void,
): React.ReactNode {
  const def = BLOCK_DEF_MAP.get(inst.defId)
  if (!def) return null
  return (
    <div
      key={inst.instanceId}
      className={styles.stackItem}
      onContextMenu={e => onRightClick(e, scriptId, inst.instanceId)}
      onMouseDown={e => onBlockMouseDown(e, inst, scriptId)}
    >
      <BlockShape inst={inst} def={def} onSlotChange={onSlotChange} variables={variables} />
      {inst.next && renderStack(inst.next, scriptId, onSlotChange, onRightClick, variables, onBlockMouseDown)}
    </div>
  )
}

// ── Pure helpers ───────────────────────────────────────────────────────────────

function findInstance(root: BlockInstance, id: string): BlockInstance | null {
  if (root.instanceId === id) return root
  if (root.next) {
    const f = findInstance(root.next, id)
    if (f) return f
  }
  for (const child of root.body ?? []) {
    const f = findInstance(child, id)
    if (f) return f
  }
  return null
}

function findScriptOf(scripts: Script[], instId: string): string | null {
  for (const s of scripts) {
    if (findInstance(s.root, instId)) return s.id
  }
  return null
}

function updateSlot(inst: BlockInstance, instId: string, slotId: string, value: string | number): BlockInstance {
  if (inst.instanceId === instId) {
    return { ...inst, slots: inst.slots.map(s => s.slotId === slotId ? { ...s, value } : s) }
  }
  return {
    ...inst,
    next: inst.next ? updateSlot(inst.next, instId, slotId, value) : undefined,
    body: inst.body?.map(b => updateSlot(b, instId, slotId, value)),
  }
}

function removeBlock(scripts: Script[], targetScriptId: string, targetInstId: string): Script[] {
  return scripts.flatMap(s => {
    if (s.id !== targetScriptId) return [s]
    if (s.root.instanceId === targetInstId) {
      return s.root.next ? [{ ...s, root: s.root.next }] : []
    }
    const newRoot = removeFromInstance(s.root, targetInstId)
    return newRoot ? [{ ...s, root: newRoot }] : []
  })
}

function removeFromInstance(inst: BlockInstance, targetId: string): BlockInstance | null {
  if (inst.next?.instanceId === targetId) {
    return { ...inst, next: inst.next.next }
  }
  return {
    ...inst,
    next: inst.next ? removeFromInstance(inst.next, targetId) ?? undefined : undefined,
    body: inst.body
      ?.filter(b => b.instanceId !== targetId)
      .map(b => removeFromInstance(b, targetId) ?? b),
  }
}

interface SnapTarget {
  scriptId: string
  afterInstanceId: string
  type: 'next' | 'body'
}

// Approximate block height used for snap offset (good enough without measuring DOM)
const BLOCK_H = 36

/** Return estimated Y of the bottom connector of a block chain starting at inst */
function chainBottomY(inst: BlockInstance): number {
  let cur: BlockInstance = inst
  let depth = 0
  // Walk the chain to its end
  while (cur.next) { cur = cur.next; depth++ }
  // Body height adds extra rows
  const bodyRows = cur.body?.length ?? 0
  return cur.y + BLOCK_H + bodyRows * BLOCK_H
}

function findSnapTarget(scripts: Script[], inst: BlockInstance, radius: number): SnapTarget | null {
  for (const script of scripts) {
    const target = findSnap(script.id, script.root, inst, radius)
    if (target) return target
  }
  return null
}

function findSnap(scriptId: string, root: BlockInstance, inst: BlockInstance, radius: number): SnapTarget | null {
  const def = BLOCK_DEF_MAP.get(root.defId)

  // ── Try BODY snap (drop into c-block: if / ifElse / repeat / forever) ──
  if (def?.canHaveBody) {
    const bodyX = root.x + 16          // indented
    const bodyY = root.y + BLOCK_H     // first slot inside body
    const dx = inst.x - bodyX
    const dy = inst.y - bodyY
    if (Math.abs(dx) < radius * 1.5 && Math.abs(dy) < radius * 1.5) {
      return { scriptId, afterInstanceId: root.instanceId, type: 'body' }
    }
  }

  // ── Try NEXT snap (attach below this block or its chain end) ──
  if (def?.type !== 'cap') {
    const bottomY = chainBottomY(root)
    const dx = inst.x - root.x
    const dy = inst.y - bottomY
    // Accept if horizontally aligned and vertically near the bottom connector
    if (Math.abs(dx) < radius && Math.abs(dy) < radius) {
      // Find the last block in the chain to attach after
      let last: BlockInstance = root
      while (last.next) last = last.next
      return { scriptId, afterInstanceId: last.instanceId, type: 'next' }
    }
  }

  // ── Recurse into next ──
  if (root.next) {
    const found = findSnap(scriptId, root.next, inst, radius)
    if (found) return found
  }

  // ── Recurse into body ──
  for (const child of root.body ?? []) {
    const found = findSnap(scriptId, child, inst, radius)
    if (found) return found
  }

  return null
}

function attachBlock(scripts: Script[], newInst: BlockInstance, target: SnapTarget): Script[] {
  return scripts.map(s => {
    if (s.id !== target.scriptId) return s
    return { ...s, root: attachToInstance(s.root, target.afterInstanceId, newInst, target.type) }
  })
}

/** Remove a block (and its entire chain/body) from the script tree.
 *  Returns [updatedScripts, pickedBlock]. */
function pickUpBlock(scripts: Script[], scriptId: string, instId: string): [Script[], BlockInstance | null] {
  let picked: BlockInstance | null = null
  const newScripts = scripts.flatMap(s => {
    if (s.id !== scriptId) return [s]
    // Picking up the root → whole script removed
    if (s.root.instanceId === instId) {
      picked = s.root
      // Keep the remainder after it as a new script
      if (s.root.next) {
        return [{ ...s, root: s.root.next }]
      }
      return []
    }
    const [newRoot, pickedBlock] = cutAtBlock(s.root, instId)
    picked = pickedBlock
    return newRoot ? [{ ...s, root: newRoot }] : []
  })
  return [newScripts, picked]
}

function cutAtBlock(inst: BlockInstance, targetId: string): [BlockInstance | null, BlockInstance | null] {
  // Target is the direct next of this node
  if (inst.next?.instanceId === targetId) {
    const cut = inst.next
    return [{ ...inst, next: undefined }, cut]
  }
  // Recurse into next chain
  if (inst.next) {
    const [newNext, picked] = cutAtBlock(inst.next, targetId)
    if (picked !== null) return [{ ...inst, next: newNext ?? undefined }, picked]
  }
  // Recurse into body children
  for (let i = 0; i < (inst.body ?? []).length; i++) {
    const child = inst.body![i]
    if (child.instanceId === targetId) {
      return [{ ...inst, body: inst.body!.filter((_, j) => j !== i) }, child]
    }
    const [newChild, picked] = cutAtBlock(child, targetId)
    if (picked !== null) {
      return [
        { ...inst, body: inst.body!.map((b, j) => j === i ? newChild! : b) },
        picked,
      ]
    }
  }
  return [inst, null]
}

function attachToInstance(inst: BlockInstance, targetId: string, newInst: BlockInstance, type: 'next' | 'body'): BlockInstance {
  if (inst.instanceId === targetId) {
    if (type === 'body') {
      // Append to the end of body list
      const existingBody = inst.body ?? []
      const lastBodyBlock = existingBody[existingBody.length - 1]
      if (lastBodyBlock) {
        // Attach as next of last body block
        return {
          ...inst,
          body: existingBody.map((b, i) =>
            i === existingBody.length - 1
              ? attachToInstance(b, lastBodyBlock.instanceId, newInst, 'next')
              : b
          ),
        }
      }
      return { ...inst, body: [{ ...newInst, next: undefined }] }
    }
    // type === 'next': insert newInst, push existing next after it
    return { ...inst, next: { ...newInst, next: inst.next ?? undefined } }
  }
  return {
    ...inst,
    next: inst.next ? attachToInstance(inst.next, targetId, newInst, type) : undefined,
    body: inst.body?.map(b => attachToInstance(b, targetId, newInst, type)),
  }
}
