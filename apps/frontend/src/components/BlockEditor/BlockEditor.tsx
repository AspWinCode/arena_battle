import { useState, useRef, useCallback, useEffect } from 'react'
import type { SkinId } from '@robocode/shared'
import type { BlockInstance, Script, SlotType } from './types'
import { BLOCK_DEFS, BLOCK_DEF_MAP, CATEGORIES, CATEGORY_META, ALL_SKINS } from './blockDefs'
import BlockShape from './BlockShape'
import { generateCode } from './codeGen'
import styles from './BlockEditor.module.css'

let _nextId = 1
const uid = () => `b${_nextId++}`

// ── Action limit ──────────────────────────────────────────────────────────────
const ACTION_BLOCK_IDS = new Set([
  'doAttack','doHeavy','doLaser','doShield','doDodge','doRepair','doSpecial','doRandom',
])
const MAX_ACTIONS = 4

function countUniqueActions(scripts: Script[]): Set<string> {
  const found = new Set<string>()
  function walk(inst: BlockInstance) {
    if (ACTION_BLOCK_IDS.has(inst.defId)) found.add(inst.defId)
    for (const slot of inst.slots) {
      if (slot.value && typeof slot.value === 'object' && 'instanceId' in slot.value) {
        walk(slot.value as BlockInstance)
      }
    }
    if (inst.next) walk(inst.next)
    for (const b of inst.body ?? []) walk(b)
    for (const b of inst.elseBody ?? []) walk(b)
  }
  for (const s of scripts) walk(s.root)
  return found
}

function makeInstance(defId: string, x = 0, y = 0): BlockInstance {
  const def = BLOCK_DEF_MAP.get(defId)!
  return {
    instanceId: uid(),
    defId,
    x,
    y,
    slots: (def.slots ?? []).map(s => ({ slotId: s.id, value: s.default ?? null })),
    body:     (def.canHaveBody || def.hasTwoBody) ? [] : undefined,
    elseBody: def.hasTwoBody ? [] : undefined,
    next: undefined,
  }
}

function deepCopy(inst: BlockInstance): BlockInstance {
  return {
    ...inst,
    instanceId: uid(),
    next:     inst.next ? deepCopy(inst.next) : undefined,
    body:     inst.body?.map(deepCopy),
    elseBody: inst.elseBody?.map(deepCopy),
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
  defId: string
}

interface SlotDropTarget {
  instanceId: string
  slotId: string
  slotType: SlotType
}

interface Props {
  onChange?: (code: string) => void
  skin?: SkinId
  onSkinChange?: (skin: SkinId) => void
  allowedSkins?: SkinId[]
}

export default function BlockEditor({ onChange, skin = 'robot', onSkinChange, allowedSkins }: Props) {
  const [scripts, setScripts]         = useState<Script[]>([])
  const [variables, setVariables]     = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState('combat')
  const [drag, setDrag]               = useState<DragState | null>(null)
  const [zoom, setZoom]               = useState(1)
  const [panOffset, setPanOffset]     = useState({ x: 0, y: 0 })
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [snapTargetId, setSnapTargetId] = useState<string | null>(null)
  const [slotDropTargetKey, setSlotDropTargetKey] = useState<string | null>(null)
  const [showCode, setShowCode]       = useState(true)
  const canvasRef  = useRef<HTMLDivElement>(null)
  const isPanning  = useRef(false)
  const panStart   = useRef({ x: 0, y: 0 })

  // Emit generated code whenever scripts change
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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Variable management ────────────────────────────────────────────────────
  const handleMakeVariable = () => {
    const name = window.prompt('Имя переменной:')?.trim()
    if (!name || variables.includes(name)) return
    setVariables(prev => [...prev, name])
  }

  // ── Action limit ──────────────────────────────────────────────────────────
  const usedActions = countUniqueActions(scripts)

  // ── Drag from palette ──────────────────────────────────────────────────────
  const handlePaletteMouseDown = (defId: string, e: React.MouseEvent) => {
    if (ACTION_BLOCK_IDS.has(defId) && !usedActions.has(defId) && usedActions.size >= MAX_ACTIONS) return
    e.preventDefault()
    const inst = makeInstance(defId, e.clientX, e.clientY)
    // Pre-fill first varname slot with first available variable
    if (variables.length > 0) {
      inst.slots = inst.slots.map(s => {
        const slotDef = BLOCK_DEF_MAP.get(defId)?.slots?.find(sd => sd.id === s.slotId)
        if (slotDef?.type === 'varname') return { ...s, value: variables[0] }
        return s
      })
    }
    setDrag({ inst, fromPalette: true, offsetX: 0, offsetY: 0, currentX: e.clientX, currentY: e.clientY })
  }

  // ── Drag from canvas ───────────────────────────────────────────────────────
  const handleCanvasBlockMouseDown = useCallback((e: React.MouseEvent, inst: BlockInstance) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const scriptId = findScriptOf(scriptsRef.current, inst.instanceId)
    if (!scriptId) return
    setScripts(prev => {
      const [next] = pickUpBlock(prev, scriptId, inst.instanceId)
      return next
    })
    setSnapTargetId(null)
    setSlotDropTargetKey(null)
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

    // Compute snap target for highlight (use current scripts from closure)
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left - panOffset.x) / zoom
    const y = (e.clientY - rect.top  - panOffset.y) / zoom
    // We need access to scripts here, but handleMouseMove captures them via closure
    // This runs via useEffect dependency on [drag, scripts, panOffset, zoom]
  }, [drag, panOffset, zoom])

  // We track snap separately so we can update it during mousemove with live scripts
  const dragRef = useRef(drag)
  const scriptsRef = useRef(scripts)
  dragRef.current = drag
  scriptsRef.current = scripts

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (isPanning.current) {
        setPanOffset({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y })
        return
      }
      const d = dragRef.current
      if (!d) return
      setDrag(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null)

      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left - panOffset.x) / zoom
      const y = (e.clientY - rect.top  - panOffset.y) / zoom
      const slotTarget = findSlotDropTargetAtPoint(e.clientX, e.clientY, d.inst)
      setSlotDropTargetKey(slotTarget ? makeSlotTargetKey(slotTarget.instanceId, slotTarget.slotId) : null)
      if (slotTarget) {
        setSnapTargetId(null)
        return
      }
      const snapTarget = findSnapTarget(scriptsRef.current, { ...d.inst, x, y }, 55)
      setSnapTargetId(snapTarget?.afterInstanceId ?? null)
    }

    function onUp(e: MouseEvent) {
      if (isPanning.current) { isPanning.current = false; return }
      const d = dragRef.current
      if (!d) return
      setSnapTargetId(null)
      setSlotDropTargetKey(null)

      const canvas = canvasRef.current!
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left - panOffset.x) / zoom
      const y = (e.clientY - rect.top  - panOffset.y) / zoom

      // Dropped on palette → delete
      const onPalette = e.clientX < rect.left
      if (onPalette && !d.fromPalette) {
        setScripts(prev => removeBlock(prev, findScriptOf(prev, d.inst.instanceId) ?? '', d.inst.instanceId))
        setDrag(null)
        return
      }

      const slotTarget = findSlotDropTargetAtPoint(e.clientX, e.clientY, d.inst)
      if (slotTarget) {
        setScripts(prev => prev.map(s => ({
          ...s,
          root: updateSlot(s.root, slotTarget.instanceId, slotTarget.slotId, deepCopy(d.inst)),
        })))
        setDrag(null)
        return
      }

      const snapTarget = findSnapTarget(scriptsRef.current, { ...d.inst, x, y }, 55)
      if (snapTarget) {
        setScripts(prev => attachBlock(prev, d.inst, snapTarget))
      } else {
        const newInst = { ...d.inst, x, y }
        const def = BLOCK_DEF_MAP.get(newInst.defId)
        if (def && (def.type === 'hat' || def.type === 'command' || def.type === 'c-block' || def.type === 'cap')) {
          setScripts(prev => [...prev, { id: uid(), root: newInst }])
        }
      }
      setDrag(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [panOffset, zoom])  // re-attach only when pan/zoom changes

  // ── Canvas interactions ────────────────────────────────────────────────────
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      isPanning.current = true
      panStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y }
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(z => Math.min(2.5, Math.max(0.4, z * delta)))
  }

  // ── Slot change ────────────────────────────────────────────────────────────
  const handleSlotChange = useCallback((instId: string, slotId: string, value: string | number | BlockInstance | null) => {
    setScripts(prev => prev.map(s => ({ ...s, root: updateSlot(s.root, instId, slotId, value) })))
  }, [])

  // ── Context menu ───────────────────────────────────────────────────────────
  const handleBlockRightClick = useCallback((e: React.MouseEvent, inst: BlockInstance) => {
    e.preventDefault()
    e.stopPropagation()
    const scriptId = findScriptOf(scriptsRef.current, inst.instanceId)
    if (!scriptId) return
    setContextMenu({ x: e.clientX, y: e.clientY, scriptId, instId: inst.instanceId, defId: inst.defId })
  }, [])

  const handleContextDuplicate = () => {
    if (!contextMenu) return
    const script = scripts.find(s => s.id === contextMenu.scriptId)
    const inst = script ? findInstance(script.root, contextMenu.instId) : null
    if (!inst) return
    const copy = deepCopy(inst)
    const def = BLOCK_DEF_MAP.get(inst.defId)
    if (!def) return

    if (def.type === 'reporter' || def.type === 'predicate') {
      setDrag({
        inst: copy,
        fromPalette: true,
        offsetX: 0,
        offsetY: 0,
        currentX: contextMenu.x,
        currentY: contextMenu.y,
      })
    } else {
      copy.x = inst.x + 24
      copy.y = inst.y + 24
      setScripts(prev => [...prev, { id: uid(), root: copy }])
    }
    setContextMenu(null)
  }

  const handleContextDelete = () => {
    if (!contextMenu) return
    setScripts(prev => removeBlock(prev, contextMenu.scriptId, contextMenu.instId))
    setContextMenu(null)
  }

  // ── Computed code ──────────────────────────────────────────────────────────
  const generatedCode = scripts[0] ? generateCode(scripts[0].root) : '// нет блоков'

  // ── Palette content ────────────────────────────────────────────────────────
  const blocksInCategory = BLOCK_DEFS.filter(b => b.category === activeCategory)
  const visibleSkins = allowedSkins
    ? ALL_SKINS.filter(s => allowedSkins.includes(s.id))
    : ALL_SKINS

  return (
    <div className={styles.root}>

      {/* ── Palette ─────────────────────────────────────────────────────── */}
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
                  <div key={`var-${v}`} className={styles.paletteBlock}
                    onMouseDown={e => handlePaletteMouseDown('varReporter', e)}>
                    <BlockShape inst={inst} def={def} onSlotChange={() => {}} variables={variables} />
                  </div>
                )
              })}
              {variables.length > 0 && <div className={styles.paletteDivider} />}
            </>
          )}

          {blocksInCategory.map(def => {
            const isAction = ACTION_BLOCK_IDS.has(def.id)
            const isUsed   = usedActions.has(def.id)
            const isLocked = isAction && !isUsed && usedActions.size >= MAX_ACTIONS
            return (
              <div
                key={def.id}
                className={`${styles.paletteBlock} ${isLocked ? styles.paletteBlockLocked : ''}`}
                onMouseDown={e => handlePaletteMouseDown(def.id, e)}
                title={isLocked ? `Лимит ${MAX_ACTIONS} приёмов достигнут` : undefined}
              >
                <BlockShape
                  inst={makeInstance(def.id)}
                  def={def}
                  onSlotChange={() => {}}
                  variables={variables}
                />
                {isAction && isUsed && (
                  <span className={styles.actionUsedDot} title="Используется" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className={styles.mainArea}>

        {/* Canvas */}
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
                {renderStack(
                  script.root, script.id,
                  handleSlotChange, handleBlockRightClick, variables,
                  handleCanvasBlockMouseDown, snapTargetId, slotDropTargetKey,
                )}
              </div>
            ))}
          </div>

          {/* Drag ghost */}
          {drag && (
            <div className={styles.dragGhost} style={{ left: drag.currentX, top: drag.currentY }}>
              {(() => {
                const def = BLOCK_DEF_MAP.get(drag.inst.defId)
                return def ? <BlockShape inst={drag.inst} def={def} onSlotChange={() => {}} variables={variables} isDragging /> : null
              })()}
            </div>
          )}

          {/* Empty state */}
          {scripts.length === 0 && !drag && (
            <div className={styles.emptyHint}>
              <div className={styles.emptyIcon}>🧩</div>
              <div className={styles.emptyText}>Перетащи блоки сюда для создания программы</div>
              <div className={styles.emptySubText}>Начни с блока <strong>«⏱ каждый ход стратегии»</strong></div>
            </div>
          )}

          {/* Toolbar */}
          <div className={styles.toolbar}>
            <button className={`btn btn-ghost ${styles.toolBtn}`} onClick={() => setScripts([])}>
              🗑 Очистить
            </button>
            <div className={styles.actionCounter}>
              <span>⚔️</span>
              <span className={usedActions.size >= MAX_ACTIONS ? styles.actionCounterFull : ''}>
                {usedActions.size}/{MAX_ACTIONS}
              </span>
              {usedActions.size >= MAX_ACTIONS && <span className={styles.actionCounterWarn}>лимит</span>}
            </div>
            <button className={`btn btn-ghost ${styles.toolBtn}`}
              onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }) }}>
              🔍 {Math.round(zoom * 100)}%
            </button>
            <button
              className={`btn btn-ghost ${styles.toolBtn} ${showCode ? styles.toolBtnActive : ''}`}
              onClick={() => setShowCode(v => !v)}
              title="Показать/скрыть сгенерированный код"
            >
              Код
            </button>
          </div>
        </div>

        {/* Code preview panel */}
        {showCode && (
          <div className={styles.codePanel}>
            <div className={styles.codePanelHeader}>
              <span>Сгенерированный код</span>
              <button className={styles.codePanelClose} onClick={() => setShowCode(false)}>✕</button>
            </div>
            <pre className={styles.codePre}>{generatedCode}</pre>
          </div>
        )}

        {/* Skin selector */}
        <div className={styles.spriteBar}>
          <span className={styles.spriteBarLabel}>Персонаж:</span>
          <div className={styles.skinList}>
            {visibleSkins.map(s => (
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
      </div>

      {/* Context menu */}
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
  onSlotChange: (id: string, slotId: string, v: string | number | BlockInstance | null) => void,
  onRightClick: (e: React.MouseEvent, inst: BlockInstance) => void,
  variables: string[],
  onBlockMouseDown: (e: React.MouseEvent, inst: BlockInstance) => void,
  snapTargetId: string | null,
  slotDropTargetKey: string | null,
): React.ReactNode {
  const def = BLOCK_DEF_MAP.get(inst.defId)
  if (!def) return null
  return (
    <div
      key={inst.instanceId}
      className={styles.stackItem}
    >
      <BlockShape
        inst={inst}
        def={def}
        onSlotChange={onSlotChange}
        onBlockMouseDown={onBlockMouseDown}
        onBlockContextMenu={onRightClick}
        variables={variables}
        isSnapTarget={snapTargetId === inst.instanceId}
        activeSlotTargetKey={slotDropTargetKey}
      />
      {inst.next && renderStack(inst.next, scriptId, onSlotChange, onRightClick, variables, onBlockMouseDown, snapTargetId, slotDropTargetKey)}
    </div>
  )
}

// ── Pure tree helpers ──────────────────────────────────────────────────────────

function findInstance(root: BlockInstance, id: string): BlockInstance | null {
  if (root.instanceId === id) return root
  for (const slot of root.slots) {
    if (slot.value && typeof slot.value === 'object' && 'instanceId' in slot.value) {
      const f = findInstance(slot.value as BlockInstance, id)
      if (f) return f
    }
  }
  if (root.next) { const f = findInstance(root.next, id); if (f) return f }
  for (const b of root.body ?? [])     { const f = findInstance(b, id); if (f) return f }
  for (const b of root.elseBody ?? []) { const f = findInstance(b, id); if (f) return f }
  return null
}

function findScriptOf(scripts: Script[], instId: string): string | null {
  for (const s of scripts) { if (findInstance(s.root, instId)) return s.id }
  return null
}

function updateSlot(inst: BlockInstance, instId: string, slotId: string, value: string | number | BlockInstance | null): BlockInstance {
  if (inst.instanceId === instId) {
    return { ...inst, slots: inst.slots.map(s => s.slotId === slotId ? { ...s, value } : s) }
  }
  return {
    ...inst,
    slots: inst.slots.map(s => {
      if (!s.value || typeof s.value !== 'object' || !('instanceId' in s.value)) return s
      return { ...s, value: updateSlot(s.value as BlockInstance, instId, slotId, value) }
    }),
    next:     inst.next     ? updateSlot(inst.next,   instId, slotId, value) : undefined,
    body:     inst.body?.map(b => updateSlot(b, instId, slotId, value)),
    elseBody: inst.elseBody?.map(b => updateSlot(b, instId, slotId, value)),
  }
}

function makeSlotTargetKey(instanceId: string, slotId: string): string {
  return `${instanceId}:${slotId}`
}

function canDropIntoSlot(inst: BlockInstance, slotType: SlotType): boolean {
  const def = BLOCK_DEF_MAP.get(inst.defId)
  if (!def) return false
  if (slotType === 'boolean') return def.type === 'predicate'
  if (slotType === 'reporter') return def.type === 'reporter'
  return false
}

function findSlotDropTargetAtPoint(clientX: number, clientY: number, dragged: BlockInstance): SlotDropTarget | null {
  const el = document
    .elementFromPoint(clientX, clientY)
    ?.closest('[data-slot-host][data-slot-id][data-slot-type]') as HTMLElement | null

  if (!el) return null

  const instanceId = el.dataset.slotHost
  const slotId = el.dataset.slotId
  const slotType = el.dataset.slotType as SlotType | undefined
  if (!instanceId || !slotId || !slotType) return null
  if (!canDropIntoSlot(dragged, slotType)) return null

  return { instanceId, slotId, slotType }
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
    slots: inst.slots.map(s => {
      if (!s.value || typeof s.value !== 'object' || !('instanceId' in s.value)) return s
      const nested = s.value as BlockInstance
      if (nested.instanceId === targetId) return { ...s, value: null }
      return { ...s, value: removeFromInstance(nested, targetId) }
    }),
    next: inst.next ? removeFromInstance(inst.next, targetId) ?? undefined : undefined,
    body: inst.body
      ?.filter(b => b.instanceId !== targetId)
      .map(b => removeFromInstance(b, targetId) ?? b),
    elseBody: inst.elseBody
      ?.filter(b => b.instanceId !== targetId)
      .map(b => removeFromInstance(b, targetId) ?? b),
  }
}

// ── Snap system ────────────────────────────────────────────────────────────────

interface SnapTarget {
  scriptId: string
  afterInstanceId: string
  type: 'next' | 'body' | 'elseBody'
}

const BLOCK_H = 36

/** Estimated bottom Y of the last block in a chain (rough, no DOM measurement) */
function chainBottomY(inst: BlockInstance): number {
  let cur: BlockInstance = inst
  while (cur.next) cur = cur.next
  const bodyRows = (cur.body?.length ?? 0) + (cur.elseBody?.length ?? 0)
  return cur.y + BLOCK_H + bodyRows * BLOCK_H
}

function findSnapTarget(scripts: Script[], inst: BlockInstance, radius: number): SnapTarget | null {
  for (const script of scripts) {
    const t = findSnap(script.id, script.root, inst, radius)
    if (t) return t
  }
  return null
}

function findSnap(scriptId: string, root: BlockInstance, inst: BlockInstance, radius: number): SnapTarget | null {
  const def = BLOCK_DEF_MAP.get(root.defId)

  // ── Single-body snap ──────────────────────────────────────────────────────
  if (def?.canHaveBody && !def.hasTwoBody) {
    const bodyX = root.x + 16
    const bodyY = root.y + BLOCK_H
    const dx = inst.x - bodyX
    const dy = inst.y - bodyY
    if (Math.abs(dx) < radius * 1.5 && Math.abs(dy) < radius * 1.5) {
      return { scriptId, afterInstanceId: root.instanceId, type: 'body' }
    }
  }

  // ── Two-body snap (ifElse) ─────────────────────────────────────────────────
  if (def?.hasTwoBody) {
    const bx = root.x + 16
    const thenBodyY = root.y + BLOCK_H
    const thenBodyH = Math.max(1, root.body?.length ?? 0) * BLOCK_H
    const elseBodyY = thenBodyY + thenBodyH + BLOCK_H   // extra BLOCK_H for "иначе" label

    const dxThen = inst.x - bx
    const dyThen = inst.y - thenBodyY
    if (Math.abs(dxThen) < radius * 1.5 && dyThen > -radius && dyThen < thenBodyH + radius) {
      return { scriptId, afterInstanceId: root.instanceId, type: 'body' }
    }

    const dxElse = inst.x - bx
    const dyElse = inst.y - elseBodyY
    if (Math.abs(dxElse) < radius * 1.5 && Math.abs(dyElse) < radius * 1.5) {
      return { scriptId, afterInstanceId: root.instanceId, type: 'elseBody' }
    }
  }

  // ── Next snap (attach below) ───────────────────────────────────────────────
  if (def?.type !== 'cap') {
    const bottomY = chainBottomY(root)
    const dx = inst.x - root.x
    const dy = inst.y - bottomY
    if (Math.abs(dx) < radius && Math.abs(dy) < radius) {
      let last: BlockInstance = root
      while (last.next) last = last.next
      return { scriptId, afterInstanceId: last.instanceId, type: 'next' }
    }
  }

  // ── Recurse ────────────────────────────────────────────────────────────────
  if (root.next) {
    const f = findSnap(scriptId, root.next, inst, radius)
    if (f) return f
  }
  for (const child of root.body ?? []) {
    const f = findSnap(scriptId, child, inst, radius)
    if (f) return f
  }
  for (const child of root.elseBody ?? []) {
    const f = findSnap(scriptId, child, inst, radius)
    if (f) return f
  }

  return null
}

function attachBlock(scripts: Script[], newInst: BlockInstance, target: SnapTarget): Script[] {
  return scripts.map(s => {
    if (s.id !== target.scriptId) return s
    return { ...s, root: attachToInstance(s.root, target.afterInstanceId, newInst, target.type) }
  })
}

function pickUpBlock(scripts: Script[], scriptId: string, instId: string): [Script[], BlockInstance | null] {
  let picked: BlockInstance | null = null
  const newScripts = scripts.flatMap(s => {
    if (s.id !== scriptId) return [s]
    if (s.root.instanceId === instId) {
      picked = s.root
      return s.root.next ? [{ ...s, root: s.root.next }] : []
    }
    const [newRoot, pickedBlock] = cutAtBlock(s.root, instId)
    picked = pickedBlock
    return newRoot ? [{ ...s, root: newRoot }] : []
  })
  return [newScripts, picked]
}

function cutAtBlock(inst: BlockInstance, targetId: string): [BlockInstance | null, BlockInstance | null] {
  for (let i = 0; i < inst.slots.length; i++) {
    const slot = inst.slots[i]
    if (!slot.value || typeof slot.value !== 'object' || !('instanceId' in slot.value)) continue
    const nested = slot.value as BlockInstance
    if (nested.instanceId === targetId) {
      return [{
        ...inst,
        slots: inst.slots.map((s, j) => j === i ? { ...s, value: null } : s),
      }, nested]
    }
    const [newNested, picked] = cutAtBlock(nested, targetId)
    if (picked !== null) {
      return [{
        ...inst,
        slots: inst.slots.map((s, j) => j === i ? { ...s, value: newNested } : s),
      }, picked]
    }
  }

  // Next chain
  if (inst.next?.instanceId === targetId) {
    const cut = inst.next
    return [{ ...inst, next: undefined }, cut]
  }
  if (inst.next) {
    const [newNext, picked] = cutAtBlock(inst.next, targetId)
    if (picked !== null) return [{ ...inst, next: newNext ?? undefined }, picked]
  }
  // Body children
  for (let i = 0; i < (inst.body ?? []).length; i++) {
    const child = inst.body![i]
    if (child.instanceId === targetId) {
      return [{ ...inst, body: inst.body!.filter((_, j) => j !== i) }, child]
    }
    const [newChild, picked] = cutAtBlock(child, targetId)
    if (picked !== null) {
      return [{ ...inst, body: inst.body!.map((b, j) => j === i ? newChild! : b) }, picked]
    }
  }
  // ElseBody children
  for (let i = 0; i < (inst.elseBody ?? []).length; i++) {
    const child = inst.elseBody![i]
    if (child.instanceId === targetId) {
      return [{ ...inst, elseBody: inst.elseBody!.filter((_, j) => j !== i) }, child]
    }
    const [newChild, picked] = cutAtBlock(child, targetId)
    if (picked !== null) {
      return [{ ...inst, elseBody: inst.elseBody!.map((b, j) => j === i ? newChild! : b) }, picked]
    }
  }
  return [inst, null]
}

function attachToInstance(
  inst: BlockInstance,
  targetId: string,
  newInst: BlockInstance,
  type: 'next' | 'body' | 'elseBody',
): BlockInstance {
  if (inst.instanceId === targetId) {
    if (type === 'body') {
      const existing = inst.body ?? []
      const last = existing[existing.length - 1]
      if (last) {
        return {
          ...inst,
          body: existing.map((b, i) =>
            i === existing.length - 1
              ? attachToInstance(b, last.instanceId, newInst, 'next')
              : b
          ),
        }
      }
      return { ...inst, body: [{ ...newInst, next: undefined }] }
    }
    if (type === 'elseBody') {
      const existing = inst.elseBody ?? []
      const last = existing[existing.length - 1]
      if (last) {
        return {
          ...inst,
          elseBody: existing.map((b, i) =>
            i === existing.length - 1
              ? attachToInstance(b, last.instanceId, newInst, 'next')
              : b
          ),
        }
      }
      return { ...inst, elseBody: [{ ...newInst, next: undefined }] }
    }
    // type === 'next'
    return { ...inst, next: { ...newInst, next: inst.next ?? undefined } }
  }
  return {
    ...inst,
    next:     inst.next     ? attachToInstance(inst.next,   targetId, newInst, type) : undefined,
    body:     inst.body?.map(b => attachToInstance(b, targetId, newInst, type)),
    elseBody: inst.elseBody?.map(b => attachToInstance(b, targetId, newInst, type)),
  }
}
