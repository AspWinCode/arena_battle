import type { BlockDef } from './types'

export const BLOCK_DEFS: BlockDef[] = [
  // ── Combat ─────────────────────────────────────────────────────────────────
  {
    id: 'attack',
    type: 'command',
    category: 'combat',
    label: 'удар',
    color: '#e6261f',
    slots: [{ id: 'type', type: 'dropdown', default: 'hook', options: ['jab', 'hook', 'uppercut', 'sweep'] }],
  },
  {
    id: 'laser',
    type: 'command',
    category: 'combat',
    label: 'лазер',
    color: '#e6261f',
    slots: [{ id: 'power', type: 'number', default: 80 }],
  },
  {
    id: 'shield',
    type: 'command',
    category: 'combat',
    label: 'щит',
    color: '#e6261f',
    slots: [{ id: 'dur', type: 'number', default: 1 }],
  },
  {
    id: 'dodge',
    type: 'command',
    category: 'combat',
    label: 'уклон',
    color: '#e6261f',
    slots: [{ id: 'dir', type: 'dropdown', default: 'left', options: ['left', 'right', 'back', 'roll'] }],
  },
  {
    id: 'combo',
    type: 'command',
    category: 'combat',
    label: 'комбо',
    color: '#e6261f',
  },
  {
    id: 'repair',
    type: 'command',
    category: 'combat',
    label: 'ремонт',
    color: '#e6261f',
    slots: [{ id: 'amt', type: 'number', default: 20 }],
  },
  {
    id: 'moveForward',
    type: 'command',
    category: 'combat',
    label: 'вперёд',
    color: '#e6261f',
    slots: [{ id: 'n', type: 'number', default: 1 }],
  },
  {
    id: 'moveBackward',
    type: 'command',
    category: 'combat',
    label: 'назад',
    color: '#e6261f',
    slots: [{ id: 'n', type: 'number', default: 1 }],
  },

  // ── Control ────────────────────────────────────────────────────────────────
  {
    id: 'whenRoundStarts',
    type: 'hat',
    category: 'control',
    label: 'когда раунд начинается',
    color: '#ffab19',
  },
  {
    id: 'whenHit',
    type: 'hat',
    category: 'control',
    label: 'когда получен урон',
    color: '#ffab19',
  },
  {
    id: 'if',
    type: 'c-block',
    category: 'control',
    label: 'если',
    color: '#ffab19',
    canHaveBody: true,
    slots: [{ id: 'cond', type: 'boolean' }],
  },
  {
    id: 'ifElse',
    type: 'c-block',
    category: 'control',
    label: 'если / иначе',
    color: '#ffab19',
    canHaveBody: true,
    slots: [{ id: 'cond', type: 'boolean' }],
  },
  {
    id: 'repeat',
    type: 'c-block',
    category: 'control',
    label: 'повторить',
    color: '#ffab19',
    canHaveBody: true,
    slots: [{ id: 'n', type: 'number', default: 10 }],
  },
  {
    id: 'forever',
    type: 'c-block',
    category: 'control',
    label: 'всегда',
    color: '#ffab19',
    canHaveBody: true,
  },
  {
    id: 'stop',
    type: 'cap',
    category: 'control',
    label: 'стоп',
    color: '#ffab19',
  },

  // ── Sensing ─────────────────────────────────────────────────────────────────
  {
    id: 'enemyHp',
    type: 'reporter',
    category: 'sensing',
    label: 'HP врага',
    color: '#5cb1d6',
  },
  {
    id: 'myHp',
    type: 'reporter',
    category: 'sensing',
    label: 'мой HP',
    color: '#5cb1d6',
  },
  {
    id: 'enemyLastAction',
    type: 'reporter',
    category: 'sensing',
    label: 'последнее действие врага',
    color: '#5cb1d6',
  },
  {
    id: 'enemyHasShield',
    type: 'predicate',
    category: 'sensing',
    label: 'враг в щите?',
    color: '#5cb1d6',
  },
  {
    id: 'roundNumber',
    type: 'reporter',
    category: 'sensing',
    label: 'номер раунда',
    color: '#5cb1d6',
  },

  // ── Operators ──────────────────────────────────────────────────────────────
  {
    id: 'greaterThan',
    type: 'predicate',
    category: 'operators',
    label: '>',
    color: '#59c059',
    slots: [
      { id: 'a', type: 'reporter' },
      { id: 'b', type: 'number', default: 0 },
    ],
  },
  {
    id: 'lessThan',
    type: 'predicate',
    category: 'operators',
    label: '<',
    color: '#59c059',
    slots: [
      { id: 'a', type: 'reporter' },
      { id: 'b', type: 'number', default: 0 },
    ],
  },
  {
    id: 'equals',
    type: 'predicate',
    category: 'operators',
    label: '=',
    color: '#59c059',
    slots: [
      { id: 'a', type: 'reporter' },
      { id: 'b', type: 'string', default: '' },
    ],
  },
  {
    id: 'and',
    type: 'predicate',
    category: 'operators',
    label: 'и',
    color: '#59c059',
    slots: [
      { id: 'a', type: 'boolean' },
      { id: 'b', type: 'boolean' },
    ],
  },
  {
    id: 'or',
    type: 'predicate',
    category: 'operators',
    label: 'или',
    color: '#59c059',
    slots: [
      { id: 'a', type: 'boolean' },
      { id: 'b', type: 'boolean' },
    ],
  },
  {
    id: 'not',
    type: 'predicate',
    category: 'operators',
    label: 'не',
    color: '#59c059',
    slots: [{ id: 'a', type: 'boolean' }],
  },

  // ── Variables ──────────────────────────────────────────────────────────────
  {
    id: 'setVar',
    type: 'command',
    category: 'variables',
    label: 'установить',
    color: '#ff8c1a',
    slots: [
      { id: 'name', type: 'varname', default: '' },
      { id: 'value', type: 'number', default: 0 },
    ],
  },
  {
    id: 'changeVar',
    type: 'command',
    category: 'variables',
    label: 'изменить',
    color: '#ff8c1a',
    slots: [
      { id: 'name', type: 'varname', default: '' },
      { id: 'by', type: 'number', default: 1 },
    ],
  },
  {
    id: 'varReporter',
    type: 'reporter',
    category: 'variables',
    label: '',
    color: '#ff8c1a',
    slots: [{ id: 'name', type: 'varname', default: '' }],
  },
]

export const BLOCK_DEF_MAP = new Map(BLOCK_DEFS.map(b => [b.id, b]))

export const CATEGORY_META: Record<string, { label: string; color: string; icon: string }> = {
  combat:    { label: 'Бой',        color: '#e6261f', icon: '⚔️' },
  control:   { label: 'Управление', color: '#ffab19', icon: '🔁' },
  sensing:   { label: 'Сенсоры',    color: '#5cb1d6', icon: '👁' },
  operators: { label: 'Операторы',  color: '#59c059', icon: '➕' },
  variables: { label: 'Переменные', color: '#ff8c1a', icon: '📦' },
}

export const CATEGORIES = Object.keys(CATEGORY_META)
