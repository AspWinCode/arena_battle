import type { Strategy, SkinId } from './types'
import {
  HEAVY_SPAMMER, LASER_SNIPER, SHIELD_TURTLE, COMBO_BOXER,
  HEALER, BERSERKER, VETERAN, GHOST_SNIPER, CHAMPION,
} from './missions'

export interface SparringBot {
  id:          string
  name:        string
  description: string
  skin:        SkinId
  difficulty:  1 | 2 | 3 | 4 | 5
  strategy:    Strategy
  tags:        string[]
}

export const SPARRING_BOTS: SparringBot[] = [
  {
    id: 'dummy',
    name: 'Манекен',
    description: 'Только атакует — идеально для отладки кода',
    skin: 'robot',
    difficulty: 1,
    tags: ['attack only'],
    strategy: {
      primary: 'attack', lowHp: 'attack', onHit: 'attack',
      style: 'Standard', position: 'mid',
    },
  },
  {
    id: 'heavy_spammer',
    name: 'Силач',
    description: 'Спамит heavy и быстро теряет выносливость',
    skin: 'gladiator',
    difficulty: 2,
    tags: ['heavy spam', 'stamina trap'],
    strategy: HEAVY_SPAMMER,
  },
  {
    id: 'laser_sniper',
    name: 'Снайпер',
    description: 'Держит дальнюю дистанцию и бьёт лазером',
    skin: 'cosmonaut',
    difficulty: 2,
    tags: ['laser', 'far range'],
    strategy: LASER_SNIPER,
  },
  {
    id: 'shield_turtle',
    name: 'Черепаха',
    description: 'Стоит в блоке — нужен heavy или laser',
    skin: 'gladiator',
    difficulty: 2,
    tags: ['shield', 'defensive'],
    strategy: SHIELD_TURTLE,
  },
  {
    id: 'combo_boxer',
    name: 'Боксёр',
    description: 'Агрессивный ближний бой с heavy',
    skin: 'boxer',
    difficulty: 3,
    tags: ['heavy', 'close range'],
    strategy: COMBO_BOXER,
  },
  {
    id: 'healer',
    name: 'Целитель',
    description: 'Восстанавливает HP и ждёт твоих ошибок',
    skin: 'robot',
    difficulty: 3,
    tags: ['repair', 'sustain'],
    strategy: HEALER,
  },
  {
    id: 'ghost_sniper',
    name: 'Призрак',
    description: 'Уклоняется и бьёт лазером с дистанции',
    skin: 'cosmonaut',
    difficulty: 3,
    tags: ['dodge', 'laser', 'evasive'],
    strategy: GHOST_SNIPER,
  },
  {
    id: 'berserker',
    name: 'Берсерк',
    description: 'Максимальная агрессия без оглядки на ресурсы',
    skin: 'gladiator',
    difficulty: 4,
    tags: ['heavy', 'special', 'rage'],
    strategy: BERSERKER,
  },
  {
    id: 'veteran',
    name: 'Ветеран',
    description: 'Адаптируется к твоим действиям',
    skin: 'boxer',
    difficulty: 4,
    tags: ['adaptive', 'balanced'],
    strategy: VETERAN,
  },
  {
    id: 'champion',
    name: 'Чемпион',
    description: 'Максимальный ИИ — использует все механики',
    skin: 'robot',
    difficulty: 5,
    tags: ['all mechanics', 'boss'],
    strategy: CHAMPION,
  },
]

export const DIFF_LABEL: Record<number, string> = {
  1: 'Легко', 2: 'Просто', 3: 'Средне', 4: 'Сложно', 5: 'Босс',
}

export const DIFF_COLOR: Record<number, string> = {
  1: '#4ade80', 2: '#86efac', 3: '#facc15', 4: '#f97316', 5: '#f43f5e',
}
