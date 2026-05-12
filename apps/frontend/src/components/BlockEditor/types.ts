export type BlockType = 'hat' | 'command' | 'c-block' | 'reporter' | 'predicate' | 'cap'

export type SlotType = 'number' | 'string' | 'dropdown' | 'boolean' | 'reporter' | 'varname'

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
  canHaveBody?: boolean   // single body zone (if, repeat, forever)
  hasTwoBody?: boolean    // two body zones then/else (ifElse) — implies canHaveBody
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
  body?: BlockInstance[]      // "then" body or single body
  elseBody?: BlockInstance[]  // "else" body — only for hasTwoBody blocks
  next?: BlockInstance        // next command block in stack
}

export interface Script {
  id: string
  root: BlockInstance
}
