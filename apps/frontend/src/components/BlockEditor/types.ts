export type BlockType = 'hat' | 'command' | 'c-block' | 'reporter' | 'predicate' | 'cap'

export type SlotType = 'number' | 'string' | 'dropdown' | 'boolean' | 'reporter'

export interface SlotDef {
  id: string
  type: SlotType
  default?: string | number
  options?: string[]
  label?: string
}

export interface BlockDef {
  id: string
  type: BlockType
  category: string
  label: string
  slots?: SlotDef[]
  color?: string
  canHaveBody?: boolean  // for c-blocks
}

export interface SlotValue {
  slotId: string
  value: string | number | BlockInstance | null
}

export interface BlockInstance {
  instanceId: string
  defId: string
  x: number
  y: number
  slots: SlotValue[]
  body?: BlockInstance[]   // inner blocks for c-blocks
  next?: BlockInstance     // next command block in stack
}

export interface Script {
  id: string
  root: BlockInstance
}
