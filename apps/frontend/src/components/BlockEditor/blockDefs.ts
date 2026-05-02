import type { BlockDef } from './types'

export const BLOCK_DEFS: BlockDef[] = [
  // ── Combat — each block returns the matching action string ─────────────────
  { id: 'doAttack',  type: 'command', category: 'combat', label: '👊 атака',        color: '#e6261f' },
  { id: 'doHeavy',   type: 'command', category: 'combat', label: '💥 тяжёлый удар', color: '#c0392b' },
  { id: 'doLaser',   type: 'command', category: 'combat', label: '⚡ лазер',        color: '#e74c3c' },
  { id: 'doShield',  type: 'command', category: 'combat', label: '🛡️ щит',          color: '#2980b9' },
  { id: 'doDodge',   type: 'command', category: 'combat', label: '💨 уклон',        color: '#8e44ad' },
  { id: 'doRepair',  type: 'command', category: 'combat', label: '💊 лечение',      color: '#27ae60' },
  { id: 'doSpecial', type: 'command', category: 'combat', label: '☄️ спешл',        color: '#d35400' },

  // ── Control ────────────────────────────────────────────────────────────────
  { id: 'whenTurn', type: 'hat', category: 'control', label: '⏱ каждый ход стратегии', color: '#e67e22' },
  {
    id: 'if', type: 'c-block', category: 'control', label: 'если',
    color: '#e67e22', canHaveBody: true,
    slots: [{ id: 'cond', type: 'boolean' }],
  },
  {
    id: 'ifElse', type: 'c-block', category: 'control', label: 'если / иначе',
    color: '#e67e22', canHaveBody: true,
    slots: [{ id: 'cond', type: 'boolean' }],
  },
  { id: 'stop', type: 'cap', category: 'control', label: '⏹ стоп', color: '#e67e22' },

  // ── Sensing — reporters that map to ctx fields ─────────────────────────────
  { id: 'ctxMyHp',            type: 'reporter',  category: 'sensing', label: 'мой HP',               color: '#5cb1d6' },
  { id: 'ctxEnemyHp',         type: 'reporter',  category: 'sensing', label: 'HP врага',              color: '#5cb1d6' },
  { id: 'ctxMyRage',          type: 'reporter',  category: 'sensing', label: 'моя Rage',              color: '#5cb1d6' },
  { id: 'ctxMyStamina',       type: 'reporter',  category: 'sensing', label: 'выносливость',          color: '#5cb1d6' },
  { id: 'ctxMyLastAction',    type: 'reporter',  category: 'sensing', label: 'мой последний ход',     color: '#5cb1d6' },
  { id: 'ctxEnemyLastAction', type: 'reporter',  category: 'sensing', label: 'ход врага',             color: '#5cb1d6' },
  { id: 'ctxCooldownLaser',   type: 'reporter',  category: 'sensing', label: 'КД лазера',            color: '#5cb1d6' },
  { id: 'ctxCooldownHeavy',   type: 'reporter',  category: 'sensing', label: 'КД heavy',             color: '#5cb1d6' },
  { id: 'ctxTurn',            type: 'reporter',  category: 'sensing', label: 'ход #',                color: '#5cb1d6' },
  { id: 'ctxRepeatCount',     type: 'reporter',  category: 'sensing', label: 'повторов подряд',      color: '#5cb1d6' },
  { id: 'ctxEnemyHasShield',  type: 'predicate', category: 'sensing', label: 'враг в щите?',         color: '#5cb1d6' },

  // ── Operators ──────────────────────────────────────────────────────────────
  {
    id: 'greaterThan', type: 'predicate', category: 'operators', label: '>',
    color: '#59c059',
    slots: [{ id: 'a', type: 'reporter' }, { id: 'b', type: 'number', default: 50 }],
  },
  {
    id: 'lessThan', type: 'predicate', category: 'operators', label: '<',
    color: '#59c059',
    slots: [{ id: 'a', type: 'reporter' }, { id: 'b', type: 'number', default: 50 }],
  },
  {
    id: 'geq', type: 'predicate', category: 'operators', label: '≥',
    color: '#59c059',
    slots: [{ id: 'a', type: 'reporter' }, { id: 'b', type: 'number', default: 100 }],
  },
  {
    id: 'equals', type: 'predicate', category: 'operators', label: '=',
    color: '#59c059',
    slots: [{ id: 'a', type: 'reporter' }, { id: 'b', type: 'string', default: 'attack' }],
  },
  {
    id: 'and', type: 'predicate', category: 'operators', label: 'и',
    color: '#59c059',
    slots: [{ id: 'a', type: 'boolean' }, { id: 'b', type: 'boolean' }],
  },
  {
    id: 'or', type: 'predicate', category: 'operators', label: 'или',
    color: '#59c059',
    slots: [{ id: 'a', type: 'boolean' }, { id: 'b', type: 'boolean' }],
  },
  {
    id: 'not', type: 'predicate', category: 'operators', label: 'не',
    color: '#59c059',
    slots: [{ id: 'a', type: 'boolean' }],
  },

  // ── Variables ──────────────────────────────────────────────────────────────
  {
    id: 'setVar', type: 'command', category: 'variables', label: 'установить',
    color: '#ff8c1a',
    slots: [{ id: 'name', type: 'varname', default: '' }, { id: 'value', type: 'number', default: 0 }],
  },
  {
    id: 'changeVar', type: 'command', category: 'variables', label: 'изменить на',
    color: '#ff8c1a',
    slots: [{ id: 'name', type: 'varname', default: '' }, { id: 'by', type: 'number', default: 1 }],
  },
  {
    id: 'varReporter', type: 'reporter', category: 'variables', label: '',
    color: '#ff8c1a',
    slots: [{ id: 'name', type: 'varname', default: '' }],
  },
]

export const BLOCK_DEF_MAP = new Map(BLOCK_DEFS.map(b => [b.id, b]))

export const CATEGORY_META: Record<string, { label: string; color: string; icon: string }> = {
  combat:    { label: 'Бой',        color: '#e6261f', icon: '⚔️'  },
  control:   { label: 'Управление', color: '#e67e22', icon: '🔁'  },
  sensing:   { label: 'Сенсоры',    color: '#5cb1d6', icon: '👁'  },
  operators: { label: 'Операторы',  color: '#59c059', icon: '➕'  },
  variables: { label: 'Переменные', color: '#ff8c1a', icon: '📦'  },
}

export const CATEGORIES = Object.keys(CATEGORY_META)
