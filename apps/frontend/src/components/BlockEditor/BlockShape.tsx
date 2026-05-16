import type { BlockDef, BlockInstance } from './types'
import { BLOCK_DEF_MAP } from './blockDefs'
import styles from './BlockShape.module.css'

interface Props {
  inst: BlockInstance
  def: BlockDef
  onSlotChange: (instanceId: string, slotId: string, value: string | number | BlockInstance | null) => void
  onDropOnSlot?: (instanceId: string, slotId: string, dropped: BlockInstance) => void
  onBlockMouseDown?: (e: React.MouseEvent, inst: BlockInstance) => void
  onBlockContextMenu?: (e: React.MouseEvent, inst: BlockInstance) => void
  depth?: number
  isDragging?: boolean
  isSnapTarget?: boolean
  isUnreachable?: boolean
  activeSlotTargetKey?: string | null
  variables?: string[]
}

const NOTCH_W = 20
const NOTCH_H = 6

function PuzzleTop({ color }: { color: string }) {
  return (
    <svg width="100%" height={NOTCH_H} style={{ display: 'block', overflow: 'visible' }}>
      <path
        d={`M0,0 L30,0 L30,${NOTCH_H} L${30 + NOTCH_W},${NOTCH_H} L${30 + NOTCH_W},0 L9999,0`}
        fill={color}
        stroke="rgba(0,0,0,.3)"
        strokeWidth={1}
      />
    </svg>
  )
}

function PuzzleBottom({ color }: { color: string }) {
  return (
    <svg width="100%" height={NOTCH_H} style={{ display: 'block', overflow: 'visible' }}>
      <path
        d={`M0,0 L30,0 L30,${NOTCH_H} L${30 + NOTCH_W},${NOTCH_H} L${30 + NOTCH_W},0 L9999,0`}
        fill={color}
        stroke="rgba(0,0,0,.3)"
        strokeWidth={1}
        transform={`scale(1,-1) translate(0,-${NOTCH_H})`}
      />
    </svg>
  )
}

export default function BlockShape({
  inst, def, onSlotChange, onDropOnSlot, onBlockMouseDown, onBlockContextMenu, depth = 0, isDragging, isSnapTarget, isUnreachable, activeSlotTargetKey, variables = [],
}: Props) {
  const color = def.color ?? '#7c3aed'
  const darkerColor = darken(color, 20)

  return (
    <div
      className={`${styles.block} ${styles[`type-${def.type}`]} ${isSnapTarget ? styles.snapTarget : ''} ${isUnreachable ? styles.unreachable : ''}`}
      style={{ '--block-color': color, '--block-darker': darkerColor } as React.CSSProperties}
      onMouseDown={onBlockMouseDown ? e => onBlockMouseDown(e, inst) : undefined}
      onContextMenu={onBlockContextMenu ? e => onBlockContextMenu(e, inst) : undefined}
    >
      {def.type !== 'hat' && <PuzzleTop color={color} />}

      <div className={styles.body}>
        <div className={styles.labelRow}>
          {renderLabel(def, inst, onSlotChange, onDropOnSlot, onBlockMouseDown, onBlockContextMenu, variables, activeSlotTargetKey)}
        </div>

        {def.canHaveBody && !def.hasTwoBody && (
          <div className={styles.innerBody}>
            {(inst.body ?? []).length === 0 && (
              <div className={styles.innerPlaceholder}>перетащи блок сюда</div>
            )}
            {(inst.body ?? []).map(child => {
              const childDef = BLOCK_DEF_MAP.get(child.defId)
              if (!childDef) return null
              return (
                <BlockShape
                  key={child.instanceId}
                  inst={child}
                  def={childDef}
                  onSlotChange={onSlotChange}
                  onBlockMouseDown={onBlockMouseDown}
                  onBlockContextMenu={onBlockContextMenu}
                  depth={depth + 1}
                  activeSlotTargetKey={activeSlotTargetKey}
                  variables={variables}
                />
              )
            })}
          </div>
        )}

        {def.hasTwoBody && (
          <>
            <div className={styles.twoBodyLabel}>тогда</div>
            <div className={`${styles.innerBody} ${styles.thenZone}`}>
              {(inst.body ?? []).length === 0 && (
                <div className={styles.innerPlaceholder}>перетащи блок сюда</div>
              )}
              {(inst.body ?? []).map(child => {
                const childDef = BLOCK_DEF_MAP.get(child.defId)
                if (!childDef) return null
                return (
                  <BlockShape
                    key={child.instanceId}
                    inst={child}
                    def={childDef}
                    onSlotChange={onSlotChange}
                    onBlockMouseDown={onBlockMouseDown}
                    onBlockContextMenu={onBlockContextMenu}
                    depth={depth + 1}
                    activeSlotTargetKey={activeSlotTargetKey}
                    variables={variables}
                  />
                )
              })}
            </div>
            <div className={styles.twoBodyLabel}>иначе</div>
            <div className={`${styles.innerBody} ${styles.elseZone}`}>
              {(inst.elseBody ?? []).length === 0 && (
                <div className={styles.innerPlaceholder}>перетащи блок сюда</div>
              )}
              {(inst.elseBody ?? []).map(child => {
                const childDef = BLOCK_DEF_MAP.get(child.defId)
                if (!childDef) return null
                return (
                  <BlockShape
                    key={child.instanceId}
                    inst={child}
                    def={childDef}
                    onSlotChange={onSlotChange}
                    onBlockMouseDown={onBlockMouseDown}
                    onBlockContextMenu={onBlockContextMenu}
                    depth={depth + 1}
                    activeSlotTargetKey={activeSlotTargetKey}
                    variables={variables}
                  />
                )
              })}
            </div>
          </>
        )}
      </div>

      {def.type !== 'cap' && <PuzzleBottom color={color} />}
    </div>
  )
}

function renderLabel(
  def: BlockDef,
  inst: BlockInstance,
  onSlotChange: (instanceId: string, slotId: string, value: string | number | BlockInstance | null) => void,
  onDropOnSlot: ((instanceId: string, slotId: string, dropped: BlockInstance) => void) | undefined,
  onBlockMouseDown: ((e: React.MouseEvent, inst: BlockInstance) => void) | undefined,
  onBlockContextMenu: ((e: React.MouseEvent, inst: BlockInstance) => void) | undefined,
  variables: string[],
  activeSlotTargetKey: string | null | undefined,
) {
  if (!def.slots || def.slots.length === 0) {
    return <span className={styles.labelText}>{def.label}</span>
  }

  const parts: React.ReactNode[] = []
  if (def.label) {
    parts.push(<span key="label" className={styles.labelText}>{def.label} </span>)
  }

  for (const slotDef of def.slots) {
    const sv = inst.slots.find(s => s.slotId === slotDef.id)
    const value = sv?.value ?? slotDef.default ?? ''

    if (slotDef.type === 'dropdown') {
      parts.push(
        <select
          key={slotDef.id}
          className={styles.slotDropdown}
          value={String(value)}
          onChange={e => onSlotChange(inst.instanceId, slotDef.id, e.target.value)}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          {(slotDef.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )
      continue
    }

    if (slotDef.type === 'varname') {
      parts.push(
        <select
          key={slotDef.id}
          className={styles.slotDropdown}
          value={String(value)}
          onChange={e => onSlotChange(inst.instanceId, slotDef.id, e.target.value)}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          {variables.length === 0 && <option value="">нет переменных</option>}
          {variables.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      )
      continue
    }

    if (slotDef.type === 'number') {
      parts.push(
        <input
          key={slotDef.id}
          className={styles.slotNumber}
          type="number"
          value={String(value)}
          onChange={e => onSlotChange(inst.instanceId, slotDef.id, Number(e.target.value))}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        />
      )
      continue
    }

    if (slotDef.type === 'string') {
      parts.push(
        <input
          key={slotDef.id}
          className={styles.slotString}
          type="text"
          value={String(value)}
          onChange={e => onSlotChange(inst.instanceId, slotDef.id, e.target.value)}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        />
      )
      continue
    }

    const nested = typeof value === 'object' && value !== null ? value as BlockInstance : null
    const nestedDef = nested ? BLOCK_DEF_MAP.get(nested.defId) : null
    const isActive = activeSlotTargetKey === `${inst.instanceId}:${slotDef.id}`
    const slotClass = slotDef.type === 'boolean' ? styles.slotBoolean : styles.slotReporter

    parts.push(
      <div
        key={slotDef.id}
        className={`${styles.slotNest} ${slotClass} ${isActive ? styles.slotNestActive : ''}`}
        data-slot-host={inst.instanceId}
        data-slot-id={slotDef.id}
        data-slot-type={slotDef.type}
        onMouseDown={e => e.stopPropagation()}
      >
        {nested && nestedDef ? (
          <>
            <div className={styles.slotNestedBlock}>
              <BlockShape
                inst={nested}
                def={nestedDef}
                onSlotChange={onSlotChange}
                onBlockMouseDown={onBlockMouseDown}
                onBlockContextMenu={onBlockContextMenu}
                variables={variables}
                activeSlotTargetKey={activeSlotTargetKey}
              />
            </div>
            <button
              type="button"
              className={styles.slotClear}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => {
                e.stopPropagation()
                onSlotChange(inst.instanceId, slotDef.id, null)
              }}
            >
              ×
            </button>
          </>
        ) : (
          <span className={slotDef.type === 'boolean' ? styles.slotBooleanEmpty : styles.slotReporterEmpty} />
        )}
      </div>
    )
  }

  return <>{parts}</>
}

function darken(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.max(0, r - amount)},${Math.max(0, g - amount)},${Math.max(0, b - amount)})`
}
