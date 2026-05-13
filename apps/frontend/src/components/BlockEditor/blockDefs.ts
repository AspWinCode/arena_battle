import type { SkinId } from '@robocode/shared'
import type { BlockDef } from './types'

export const BLOCK_DEFS: BlockDef[] = [
  // ── Combat ────────────────────────────────────────────────────────────────────
  { id: 'doAttack',  type: 'command', category: 'combat', label: '👊 атака',            color: '#e6261f' },
  { id: 'doHeavy',   type: 'command', category: 'combat', label: '💥 тяжёлый удар',     color: '#c0392b' },
  { id: 'doLaser',   type: 'command', category: 'combat', label: '⚡ лазер',            color: '#e74c3c' },
  { id: 'doShield',  type: 'command', category: 'combat', label: '🛡️ щит',             color: '#2980b9' },
  { id: 'doDodge',   type: 'command', category: 'combat', label: '💨 уклон',            color: '#8e44ad' },
  { id: 'doRepair',  type: 'command', category: 'combat', label: '💊 лечение',          color: '#27ae60' },
  { id: 'doSpecial', type: 'command', category: 'combat', label: '☄️ спешл',            color: '#d35400' },
  { id: 'doRandom',         type: 'command', category: 'combat', label: '🎲 случайный приём',      color: '#7f8c8d' },
  // ── Новые действия ────────────────────────────────────────────────────────────
  { id: 'doCombo',          type: 'command', category: 'combat', label: '🥊 комбо-удар',           color: '#e74c3c' },
  { id: 'doOvercharge',     type: 'command', category: 'combat', label: '⚡ зарядка',              color: '#f39c12' },
  { id: 'doReflect',        type: 'command', category: 'combat', label: '🪞 отражение',            color: '#3498db' },
  { id: 'doAdaptiveShield', type: 'command', category: 'combat', label: '🧠 адаптивный щит',      color: '#2980b9' },
  { id: 'doTrap',           type: 'command', category: 'combat', label: '🪤 ловушка',              color: '#8e44ad' },
  { id: 'doHack',           type: 'command', category: 'combat', label: '💻 взлом',                color: '#16a085' },
  { id: 'doSacrifice',      type: 'command', category: 'combat', label: '💀 жертва',               color: '#7f8c8d' },
  { id: 'doReboot',         type: 'command', category: 'combat', label: '🔄 перезагрузка',         color: '#27ae60' },
  { id: 'doTransfer',       type: 'command', category: 'combat', label: '🔋 конвертация',          color: '#1abc9c' },
  { id: 'doAnalyze',        type: 'command', category: 'combat', label: '🔍 анализ',               color: '#2ecc71' },
  { id: 'doOverclock',      type: 'command', category: 'combat', label: '⚙️ разгон (×2 ход)',     color: '#e67e22' },

  // ── Control ───────────────────────────────────────────────────────────────────
  { id: 'whenTurn', type: 'hat', category: 'control', label: '⏱ каждый ход стратегии', color: '#e67e22' },
  {
    id: 'if', type: 'c-block', category: 'control', label: 'если',
    color: '#e67e22', canHaveBody: true,
    slots: [{ id: 'cond', type: 'boolean' }],
  },
  {
    id: 'ifElse', type: 'c-block', category: 'control', label: 'если / иначе',
    color: '#e67e22', canHaveBody: true, hasTwoBody: true,
    slots: [{ id: 'cond', type: 'boolean' }],
  },
  {
    id: 'repeat', type: 'c-block', category: 'control', label: '🔁 повторить',
    color: '#e67e22', canHaveBody: true,
    slots: [{ id: 'n', type: 'number', default: 3 }],
  },
  {
    id: 'forever', type: 'c-block', category: 'control', label: '♾ повторять',
    color: '#e67e22', canHaveBody: true,
  },
  { id: 'stop', type: 'cap', category: 'control', label: '⏹ стоп', color: '#e67e22' },

  // ── Sensing ───────────────────────────────────────────────────────────────────
  { id: 'ctxMyHp',            type: 'reporter',  category: 'sensing', label: 'мой HP',              color: '#5cb1d6' },
  { id: 'ctxEnemyHp',         type: 'reporter',  category: 'sensing', label: 'HP врага',             color: '#5cb1d6' },
  { id: 'ctxMyRage',          type: 'reporter',  category: 'sensing', label: 'моя Rage',             color: '#5cb1d6' },
  { id: 'ctxMyStamina',       type: 'reporter',  category: 'sensing', label: 'выносливость',         color: '#5cb1d6' },
  { id: 'ctxMyLastAction',    type: 'reporter',  category: 'sensing', label: 'мой последний ход',    color: '#5cb1d6' },
  { id: 'ctxEnemyLastAction', type: 'reporter',  category: 'sensing', label: 'ход врага',            color: '#5cb1d6' },
  { id: 'ctxCooldownLaser',   type: 'reporter',  category: 'sensing', label: 'КД лазера',            color: '#5cb1d6' },
  { id: 'ctxCooldownHeavy',   type: 'reporter',  category: 'sensing', label: 'КД heavy',             color: '#5cb1d6' },
  { id: 'ctxTurn',            type: 'reporter',  category: 'sensing', label: 'ход #',               color: '#5cb1d6' },
  { id: 'ctxRepeatCount',     type: 'reporter',  category: 'sensing', label: 'повторов подряд',      color: '#5cb1d6' },
  { id: 'ctxEnemyHasShield',  type: 'predicate', category: 'sensing', label: 'враг в щите?',         color: '#5cb1d6' },
  { id: 'ctxMyHasShield',     type: 'predicate', category: 'sensing', label: 'я в щите?',            color: '#5cb1d6' },
  {
    id: 'percentChance', type: 'predicate', category: 'sensing', label: '🎲 шанс',
    color: '#5cb1d6',
    slots: [{ id: 'pct', type: 'number', default: 50 }],
  },
  // ── Уровень 2: история ────────────────────────────────────────────────────────
  {
    id: 'ctxEnemyHistoryCount', type: 'reporter', category: 'sensing',
    label: 'враг применял (атаку) раз', color: '#5cb1d6',
    slots: [{ id: 'action', type: 'string', default: 'attack' }],
  },
  {
    id: 'ctxMyHistoryCount', type: 'reporter', category: 'sensing',
    label: 'я применял (атаку) раз', color: '#5cb1d6',
    slots: [{ id: 'action', type: 'string', default: 'attack' }],
  },
  { id: 'ctxDamageLast',      type: 'reporter', category: 'sensing', label: 'урон нанесён (пр. ход)', color: '#5cb1d6' },
  { id: 'ctxDamageTakenLast', type: 'reporter', category: 'sensing', label: 'урон получен (пр. ход)',  color: '#5cb1d6' },
  // ── Уровень 3: паттерны ───────────────────────────────────────────────────────
  { id: 'ctxEnemyFreqMost',  type: 'reporter',  category: 'sensing', label: 'любимый приём врага',    color: '#5cb1d6' },
  { id: 'ctxEnemyPhase',     type: 'reporter',  category: 'sensing', label: 'фаза врага',              color: '#5cb1d6' },
  { id: 'ctxEnemyTrend',     type: 'reporter',  category: 'sensing', label: 'тенденция врага',         color: '#5cb1d6' },
  {
    id: 'ctxEnemyFreqCount', type: 'reporter', category: 'sensing', label: 'враг применял (атаку)', color: '#5cb1d6',
    slots: [{ id: 'action', type: 'string', default: 'attack' }],
  },
  {
    id: 'ctxIsEnemyPhase', type: 'predicate', category: 'sensing', label: 'фаза врага =', color: '#5cb1d6',
    slots: [{ id: 'phase', type: 'string', default: 'late' }],
  },
  {
    id: 'ctxIsEnemyTrend', type: 'predicate', category: 'sensing', label: 'тенденция врага =', color: '#5cb1d6',
    slots: [{ id: 'trend', type: 'string', default: 'aggressive' }],
  },
  // ── Кулдауны новых действий ───────────────────────────────────────────────────
  { id: 'ctxCooldownCombo',     type: 'reporter', category: 'sensing', label: 'КД комбо',       color: '#5cb1d6' },
  { id: 'ctxCooldownTrap',      type: 'reporter', category: 'sensing', label: 'КД ловушки',      color: '#5cb1d6' },
  { id: 'ctxCooldownReflect',   type: 'reporter', category: 'sensing', label: 'КД отражения',    color: '#5cb1d6' },
  { id: 'ctxCooldownSacrifice', type: 'reporter', category: 'sensing', label: 'КД жертвы',       color: '#5cb1d6' },
  { id: 'ctxCooldownReboot',    type: 'reporter', category: 'sensing', label: 'КД перезагр.',    color: '#5cb1d6' },
  { id: 'ctxCooldownHack',      type: 'reporter', category: 'sensing', label: 'КД взлома',       color: '#5cb1d6' },
  { id: 'ctxCooldownAnalyze',   type: 'reporter', category: 'sensing', label: 'КД анализа',      color: '#5cb1d6' },

  // ── Operators ─────────────────────────────────────────────────────────────────
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
    id: 'leq', type: 'predicate', category: 'operators', label: '≤',
    color: '#59c059',
    slots: [{ id: 'a', type: 'reporter' }, { id: 'b', type: 'number', default: 50 }],
  },
  {
    id: 'equals', type: 'predicate', category: 'operators', label: '=',
    color: '#59c059',
    slots: [{ id: 'a', type: 'reporter' }, { id: 'b', type: 'string', default: 'attack' }],
  },
  {
    id: 'notEquals', type: 'predicate', category: 'operators', label: '≠',
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

  // ── Variables ─────────────────────────────────────────────────────────────────
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
  combat:    { label: 'Бой',        color: '#e6261f', icon: '⚔️' },
  control:   { label: 'Управление', color: '#e67e22', icon: '🔁' },
  sensing:   { label: 'Сенсоры',    color: '#5cb1d6', icon: '👁' },
  operators: { label: 'Операторы',  color: '#59c059', icon: '➕' },
  variables: { label: 'Переменные', color: '#ff8c1a', icon: '📦' },
}

export const CATEGORIES = Object.keys(CATEGORY_META)

export const ALL_SKINS: { id: SkinId; icon: string; label: string }[] = [
  { id: 'robot',     icon: '🤖', label: 'Робот' },
  { id: 'gladiator', icon: '⚔️', label: 'Гладиатор' },
  { id: 'boxer',     icon: '🥊', label: 'Боксёр' },
  { id: 'cosmonaut', icon: '🚀', label: 'Космонавт' },
  { id: 'ninja',     icon: '🥷', label: 'Ниндзя' },
  { id: 'mage',      icon: '🧙', label: 'Маг' },
  { id: 'paladin',   icon: '🛡️', label: 'Паладин' },
  { id: 'sniper',    icon: '🎯', label: 'Снайпер' },
  { id: 'tank',      icon: '🛡',  label: 'Танк' },
  { id: 'scorpion', icon: '🦂', label: 'Скорпион' },
  { id: 'plague',   icon: '☠️',  label: 'Чума' },
  { id: 'vampire',   icon: '🧛', label: 'Вампир' },
  { id: 'samurai',   icon: '🗡️', label: 'Самурай' },
  { id: 'phantom',   icon: '👻', label: 'Фантом' },
  { id: 'engineer',  icon: '🔧', label: 'Инженер' },
  { id: 'berserker', icon: '💢', label: 'Берсерк' },
]
