import type { Strategy, SkinId } from './types'

export interface TutorialStep {
  title: string
  body: string
  highlight?: 'editor' | 'ready-btn' | 'arena'
  codeHint?: string
}

export interface Mission {
  id: string
  order: number
  title: string
  description: string
  story: string
  difficulty: 1 | 2 | 3 | 4 | 5
  opponentName: string
  opponentSkin: SkinId
  opponentStrategy: Strategy
  tutorial: TutorialStep[]
  starterCode: string
}

// ── Opponent strategies ────────────────────────────────────────────────────────

/** Pure heavy-spammer — exhausts stamina by turn 4 */
const HEAVY_SPAMMER: Strategy = {
  primary: 'heavy', lowHp: 'heavy', onHit: 'heavy',
  style: 'Aggressive', position: 'close',
  fn: (ctx) => {
    // Always tries heavy — illustrates the exhaustion mechanic
    if (ctx.cooldowns.heavy === 0) return 'heavy'
    return 'attack'
  },
}

const LASER_SNIPER: Strategy = {
  primary: 'laser', lowHp: 'laser', onHit: 'dodge',
  style: 'Aggressive', position: 'far',
}

const SHIELD_TURTLE: Strategy = {
  primary: 'shield', lowHp: 'attack', onHit: 'shield',
  style: 'Defensive', position: 'mid',
}

const COMBO_BOXER: Strategy = {
  primary: 'heavy', lowHp: 'attack', onHit: 'heavy',
  style: 'Aggressive', position: 'close',
}

const HEALER: Strategy = {
  primary: 'repair', lowHp: 'repair', onHit: 'shield',
  style: 'Defensive', position: 'mid',
  fn: (ctx) => {
    if (ctx.enemyLastAction === 'heavy') return 'shield'
    if (ctx.myHp < 60 && ctx.cooldowns.repair === 0) return 'repair'
    return 'attack'
  },
}

const MIRROR: Strategy = {
  primary: 'attack', lowHp: 'heavy', onHit: 'dodge',
  style: 'Balanced', position: 'mid',
}

const BERSERKER: Strategy = {
  primary: 'heavy', lowHp: 'heavy', onHit: 'heavy',
  style: 'Aggressive', position: 'close',
  fn: (ctx) => {
    // Berserker spams heavy even when stamina-drained — a punishing opponent
    if (ctx.cooldowns.heavy === 0) return 'heavy'
    return ctx.myRage >= 100 ? 'special' : 'attack'
  },
}

const VETERAN: Strategy = {
  primary: 'attack', lowHp: 'repair', onHit: 'shield',
  style: 'Balanced', position: 'mid',
  fn: (ctx) => {
    if (ctx.myHp < 30 && ctx.cooldowns.repair === 0) return 'repair'
    if (ctx.enemyLastAction === 'heavy') return 'dodge'
    if (ctx.myRage >= 100) return 'special'
    if (ctx.cooldowns.heavy === 0 && ctx.myStamina >= 35) return 'heavy'
    return 'attack'
  },
}

const GHOST_SNIPER: Strategy = {
  primary: 'laser', lowHp: 'dodge', onHit: 'dodge',
  style: 'Evasive', position: 'far',
  fn: (ctx) => {
    if (ctx.cooldowns.laser === 0 && ctx.myStamina >= 20) return 'laser'
    if (ctx.enemyLastAction === 'laser') return 'dodge'
    return 'attack'
  },
}

const CHAMPION: Strategy = {
  primary: 'laser', lowHp: 'heavy', onHit: 'dodge',
  style: 'Aggressive', position: 'far',
  fn: (ctx) => {
    if (ctx.myHp < 25 && ctx.cooldowns.repair === 0) return 'repair'
    if (ctx.myRage >= 100) return 'special'
    if (ctx.enemyLastAction === 'heavy') return 'dodge'
    if (ctx.enemyLastAction === 'repair') return ctx.cooldowns.heavy === 0 ? 'heavy' : 'laser'
    if (ctx.cooldowns.laser === 0 && ctx.myStamina >= 20) return 'laser'
    if (ctx.cooldowns.heavy === 0 && ctx.myStamina >= 35) return 'heavy'
    return ctx.myRepeatCount >= 2 ? 'shield' : 'attack'
  },
}

// ── Missions ──────────────────────────────────────────────────────────────────

export const MISSIONS: Mission[] = [
  // ── Миссия 1: Знакомство ─────────────────────────────────────────────────
  {
    id: 'mission-01',
    order: 1,
    title: 'Первый бой',
    description: 'Противник атакует по прямой. Напиши первую стратегию!',
    story: 'Деревянный манекен стоит в центре арены. Он всегда атакует одинаково. Покажи, что умеешь!',
    difficulty: 1,
    opponentName: 'Манекен',
    opponentSkin: 'robot',
    opponentStrategy: { primary: 'attack', lowHp: 'attack', onHit: 'attack', style: 'Standard', position: 'close' },
    tutorial: [
      {
        title: 'Добро пожаловать!',
        body: 'Функция strategy(ctx) вызывается каждый ход. Она должна вернуть строку с названием действия.',
        highlight: 'editor',
      },
      {
        title: 'Доступные действия',
        body: '"attack" — удар (12 урона), "heavy" — тяжёлый удар (28 урона, но стоит 35 выносливости!), "laser", "shield", "dodge", "repair", "special"',
        highlight: 'editor',
        codeHint: `function strategy(ctx) {\n  return 'attack';\n}`,
      },
      {
        title: 'Запусти бой!',
        body: 'Нажми "Запустить бой". Манекен слабый — просто атакуй!',
        highlight: 'ready-btn',
      },
    ],
    starterCode: `// strategy(ctx) вызывается каждый ход.
// Верни одно из: 'attack', 'heavy', 'laser', 'shield', 'dodge', 'repair', 'special'

function strategy(ctx) {
  // ctx.myHp       — твоё здоровье
  // ctx.enemyHp    — здоровье врага
  // ctx.myStamina  — твоя выносливость (0-100)

  return 'attack'; // просто атакуй!
}`,
  },

  // ── Миссия 2: Выносливость ────────────────────────────────────────────────
  {
    id: 'mission-02',
    order: 2,
    title: 'Спамер атак',
    description: 'Враг спамит тяжёлыми ударами. Дождись пока он выдохнется!',
    story: 'Перед тобой боец, который знает только одно — бить тяжёлым ударом снова и снова. Но heavy стоит 35 выносливости. Что будет к 4-му ходу?',
    difficulty: 1,
    opponentName: 'Спамер',
    opponentSkin: 'boxer',
    opponentStrategy: HEAVY_SPAMMER,
    tutorial: [
      {
        title: '⚡ Выносливость (Stamina)',
        body: 'heavy стоит 35 выносливости. Спамер начинает с 100 — после 3-го удара у него меньше 35 и тяжёлый удар промахивается!',
        highlight: 'arena',
      },
      {
        title: 'ctx.enemyStamina',
        body: 'Следи за выносливостью врага. Когда enemyStamina < 35 — его heavy промахнётся. Это твоё окно!',
        highlight: 'editor',
        codeHint: `if (ctx.enemyStamina < 35) {\n  return 'heavy'; // бьём пока он беспомощен\n}`,
      },
    ],
    starterCode: `function strategy(ctx) {
  // Враг спамит тяжёлыми ударами.
  // Когда у него кончится выносливость — он начнёт промахиваться!

  if (ctx.enemyStamina < 35) {
    // Враг выдохся — его heavy промахнётся. Бьём тяжёлым в ответ!
    return 'heavy';
  }

  // Пока враг ещё полон сил — прячемся за щитом
  return 'shield';
}`,
  },

  // ── Миссия 3: Щит ────────────────────────────────────────────────────────
  {
    id: 'mission-03',
    order: 3,
    title: 'Лазерный снайпер',
    description: 'Лазер наносит 20 урона. Научись уклоняться!',
    story: 'Снайпер держится на расстоянии и стреляет лазером — 20 урона каждые 3 хода. Уклон — твой лучший друг.',
    difficulty: 2,
    opponentName: 'Снайпер',
    opponentSkin: 'robot',
    opponentStrategy: LASER_SNIPER,
    tutorial: [
      {
        title: 'ctx.enemyLastAction',
        body: 'Узнай что сделал враг в прошлый ход. Если он стрелял — уклонись от следующего выстрела.',
        highlight: 'editor',
      },
      {
        title: 'dodge vs laser',
        body: 'dodge уклоняется от лазера с вероятностью 50%. Но это всё равно лучше, чем получить 20 урона!',
        codeHint: `if (ctx.enemyLastAction === 'laser') {\n  return 'dodge';\n}`,
      },
    ],
    starterCode: `function strategy(ctx) {
  // После выстрела лазером — у снайпера cooldown 3 хода.
  // Когда он стреляет — уклоняйся от следующего выстрела.

  if (ctx.enemyLastAction === 'laser') {
    return 'dodge'; // уклон от возможного второго выстрела
  }

  // Лазер на перезарядке — атакуем!
  if (ctx.cooldowns.laser > 0) {
    return 'attack';
  }

  return 'shield'; // по умолчанию — защита
}`,
  },

  // ── Миссия 4: Щитоносец ──────────────────────────────────────────────────
  {
    id: 'mission-04',
    order: 4,
    title: 'Щитоносец',
    description: 'Щит поглощает 60% урона. Нужен heavy или laser!',
    story: 'Гладиатор прячется за щитом — твои атаки наносят всего 5 урона вместо 12. Но heavy через щит всё равно наносит 11, а laser — 8.',
    difficulty: 2,
    opponentName: 'Щитоносец',
    opponentSkin: 'gladiator',
    opponentStrategy: SHIELD_TURTLE,
    tutorial: [
      {
        title: 'Shield absorbs 60%',
        body: 'attack через щит = 5 урона. heavy через щит = 11 урона. Лучше подождать пока щит спадёт!',
        highlight: 'editor',
      },
      {
        title: 'Читай паттерн',
        body: 'Щитоносец ставит щит каждые 2 хода (cooldown). Когда enemyLastAction === "shield" — щит только что поставлен. Следующий ход он атакует!',
        codeHint: `if (ctx.enemyLastAction === 'attack') {\n  // Враг атаковал — сейчас открыт!\n  return 'heavy';\n}`,
      },
    ],
    starterCode: `function strategy(ctx) {
  // Враг только что атаковал — значит щита нет!
  if (ctx.enemyLastAction === 'attack') {
    // Бьём тяжёлым пока он открыт
    if (ctx.cooldowns.heavy === 0 && ctx.myStamina >= 35) {
      return 'heavy';
    }
    return 'laser';
  }

  // Враг за щитом — экономим выносливость, ставим свой щит
  return 'shield';
}`,
  },

  // ── Миссия 5: Выносливость в бою ─────────────────────────────────────────
  {
    id: 'mission-05',
    order: 5,
    title: 'Боксёрский клуб',
    description: 'Управляй выносливостью — не трать её зря!',
    story: 'Боксёр постоянно давит тяжёлыми ударами. Если ты тоже будешь спамить heavy — выдохнешься первым.',
    difficulty: 2,
    opponentName: 'Боксёр',
    opponentSkin: 'boxer',
    opponentStrategy: COMBO_BOXER,
    tutorial: [
      {
        title: 'ctx.myStamina',
        body: 'Следи за своей выносливостью! heavy стоит 35. Если меньше 35 — heavy промахнётся и ты потеряешь ход.',
        highlight: 'editor',
      },
      {
        title: 'Экономь и восстанавливай',
        body: 'shield и dodge ДАЮТ +20 и +10 выносливости. Иногда выгоднее стать в защиту, чем промахнуться.',
        codeHint: `if (ctx.myStamina < 35) {\n  return 'shield'; // восстанавливаем выносливость\n}`,
      },
    ],
    starterCode: `function strategy(ctx) {
  // Никогда не используй heavy если нет выносливости!
  if (ctx.myStamina < 35) {
    return 'shield'; // восстановит +20 выносливости
  }

  // Враг только что бил heavy — он на cooldown 4 хода
  if (ctx.enemyLastAction === 'heavy') {
    return 'heavy'; // безопасно атаковать
  }

  // По умолчанию — экономная атака
  return 'attack';
}`,
  },

  // ── Миссия 6: Rage ───────────────────────────────────────────────────────
  {
    id: 'mission-06',
    order: 6,
    title: 'Целитель',
    description: 'Враг лечится. Прерви — и накопи ярость!',
    story: 'Медик лечится каждый раз, когда его HP падает. Когда он лечится — он беззащитен. Каждый удар копит твою ярость ⚡',
    difficulty: 3,
    opponentName: 'Медик',
    opponentSkin: 'cosmonaut',
    opponentStrategy: HEALER,
    tutorial: [
      {
        title: '⚡ Ярость (Rage)',
        body: 'Каждые 10 урона что ты получаешь = +4 ярости. При 100 ярости — можно использовать "special" за 50 урона!',
        highlight: 'arena',
      },
      {
        title: 'ctx.myRage',
        body: 'Следи за ctx.myRage. Когда достигнет 100 — используй "special"! Медик беспомощен во время repair.',
        codeHint: `if (ctx.myRage >= 100) return 'special';\nif (ctx.enemyLastAction === 'repair') return 'heavy';`,
      },
    ],
    starterCode: `function strategy(ctx) {
  // Ярость накоплена — используем спецудар!
  if (ctx.myRage >= 100) {
    return 'special'; // 50 урона, сбрасывает ярость
  }

  // Враг лечится — он беззащитен (heavy делает 28 урона по нему)
  if (ctx.enemyLastAction === 'repair') {
    return ctx.myStamina >= 35 ? 'heavy' : 'laser';
  }

  // Наш HP низкий — лечимся
  if (ctx.myHp < 30 && ctx.cooldowns.repair === 0) {
    return 'repair';
  }

  return 'attack';
}`,
  },

  // ── Миссия 7: Повторы ────────────────────────────────────────────────────
  {
    id: 'mission-07',
    order: 7,
    title: 'Зеркальный боец',
    description: '3+ одинаковых хода = урон ×0.5. Чередуй действия!',
    story: 'Зеркало копирует твой стиль и наказывает за предсказуемость. Используй ctx.myRepeatCount чтобы не попасть под штраф.',
    difficulty: 3,
    opponentName: 'Зеркало',
    opponentSkin: 'robot',
    opponentStrategy: MIRROR,
    tutorial: [
      {
        title: '⚠️ Штраф за спам',
        body: 'Если 3+ хода подряд одно действие — твой урон ×0.5. ctx.myRepeatCount показывает счётчик.',
        highlight: 'editor',
      },
      {
        title: 'Ломай паттерн',
        body: 'При myRepeatCount >= 2 — самое время сменить действие. Это не слабость, это тактика!',
        codeHint: `if (ctx.myRepeatCount >= 2) {\n  return 'dodge'; // разбиваем серию\n}`,
      },
    ],
    starterCode: `function strategy(ctx) {
  // Штраф за повторы! Следи за счётчиком
  if (ctx.myRepeatCount >= 2) {
    // Пора менять тактику
    if (ctx.myLastAction === 'attack') return 'dodge';
    if (ctx.myLastAction === 'dodge')  return 'laser';
    return 'attack';
  }

  // Накопили ярость — применяем
  if (ctx.myRage >= 100) return 'special';

  if (ctx.enemyHp < 30) {
    return ctx.cooldowns.heavy === 0 && ctx.myStamina >= 35 ? 'heavy' : 'attack';
  }

  return 'attack';
}`,
  },

  // ── Миссия 8: Берсерк ────────────────────────────────────────────────────
  {
    id: 'mission-08',
    order: 8,
    title: 'Берсерк',
    description: 'Враг бьёт heavy до последнего. Кто выдохнется первым?',
    story: 'Берсерк спамит heavy не думая. Это ловушка — если ты тоже, вы оба выдохнетесь. Нужна умная стратегия выносливости.',
    difficulty: 3,
    opponentName: 'Берсерк',
    opponentSkin: 'gladiator',
    opponentStrategy: BERSERKER,
    tutorial: [
      {
        title: 'Стамина vs Стамина',
        body: 'Берсерк теряет 35 стамины каждый ход на heavy. Ты можешь ставить щит (+20) и копить выносливость пока он выдыхается.',
        highlight: 'editor',
      },
      {
        title: 'Контратака в окно',
        body: 'Когда enemyStamina < 35 — heavy берсерка промахивается! Это безопасное окно для твоей атаки.',
        codeHint: `if (ctx.enemyStamina < 35) {\n  // Берсерк выдохся — атакуем!\n  return 'heavy';\n}`,
      },
    ],
    starterCode: `function strategy(ctx) {
  // Спецудар если ярость накоплена
  if (ctx.myRage >= 100) return 'special';

  // Берсерк выдохся — safe to attack!
  if (ctx.enemyStamina < 35) {
    return ctx.myStamina >= 35 ? 'heavy' : 'laser';
  }

  // Берсерк ещё силён — копим выносливость за щитом
  if (ctx.myStamina < 60) {
    return 'shield'; // восстановит +20 стамины
  }

  // Атакуем экономно
  return 'attack';
}`,
  },

  // ── Миссия 9: Ветеран ────────────────────────────────────────────────────
  {
    id: 'mission-09',
    order: 9,
    title: 'Адаптивный ветеран',
    description: 'Полная стратегия: HP + Stamina + Rage + паттерны врага',
    story: 'Ветеран использует всё: лечится, уклоняется, копит ярость и бьёт в нужный момент. Нужна многоуровневая логика.',
    difficulty: 4,
    opponentName: 'Ветеран',
    opponentSkin: 'boxer',
    opponentStrategy: VETERAN,
    tutorial: [
      {
        title: 'Приоритеты решений',
        body: 'Строй условия от критичных к тактическим: 1) выживание 2) спецудар 3) контратака 4) атака',
        highlight: 'editor',
      },
      {
        title: 'Вся мощь ctx',
        body: 'ctx.myHp, ctx.myStamina, ctx.myRage, ctx.enemyStamina, ctx.enemyRage, ctx.cooldowns — используй всё!',
        codeHint: `// Приоритеты: survival → special → counter → attack`,
      },
    ],
    starterCode: `function strategy(ctx) {
  // ── 1. Выживание ───────────────────────────────────
  if (ctx.myHp < 25 && ctx.cooldowns.repair === 0) {
    return 'repair'; // лечимся когда критично
  }

  // ── 2. Спецудар ────────────────────────────────────
  if (ctx.myRage >= 100) {
    return 'special'; // 50 урона!
  }

  // ── 3. Контратаки ──────────────────────────────────
  if (ctx.enemyLastAction === 'repair') {
    // Враг беззащитен во время лечения
    return ctx.myStamina >= 35 ? 'heavy' : 'laser';
  }

  if (ctx.enemyLastAction === 'heavy') {
    // Heavy врага на CD 4 хода — атакуем безопасно
    return ctx.myStamina >= 35 ? 'heavy' : 'attack';
  }

  // ── 4. Управление выносливостью ────────────────────
  if (ctx.myStamina < 35) {
    return 'shield'; // восстановить выносливость
  }

  // ── 5. Избегаем штрафа за повторы ─────────────────
  if (ctx.myRepeatCount >= 2) {
    return ctx.myLastAction === 'attack' ? 'dodge' : 'attack';
  }

  // ── 6. Основная атака ──────────────────────────────
  return ctx.cooldowns.heavy === 0 ? 'heavy' : 'attack';
}`,
  },

  // ── Миссия 10: Чемпион ───────────────────────────────────────────────────
  {
    id: 'mission-10',
    order: 10,
    title: 'Чемпион Арены',
    description: 'Финальный босс. Использует всю механику на максимуме!',
    story: 'Чемпион управляет выносливостью, копит ярость, читает твои паттерны и наносит спецудар в нужный момент. Покажи лучший код!',
    difficulty: 5,
    opponentName: 'Чемпион',
    opponentSkin: 'gladiator',
    opponentStrategy: CHAMPION,
    tutorial: [
      {
        title: 'Финальный бой!',
        body: 'Чемпион использует все механики: stamina, rage, special, counter-атаки и анти-спам. Нужна идеальная стратегия.',
        highlight: 'editor',
      },
      {
        title: 'Ты всё знаешь',
        body: 'Ты прошёл 9 миссий. Выносливость, ярость, повторы, паттерны врага — применяй всё!',
        highlight: 'arena',
      },
    ],
    starterCode: `function strategy(ctx) {
  // ── Выживание ─────────────────────────────────────
  if (ctx.myHp < 20 && ctx.cooldowns.repair === 0) return 'repair';

  // ── Спецудар ──────────────────────────────────────
  if (ctx.myRage >= 100) return 'special';

  // ── Не позволяй чемпиону использовать спецудар ───
  // Когда у него rage близко к 100 — он сейчас атакует сильнее
  // Уклонись от возможного спецудара
  if (ctx.enemyRage > 80 && ctx.enemyLastAction !== 'special') {
    return 'dodge';
  }

  // ── Контратаки ────────────────────────────────────
  if (ctx.enemyLastAction === 'repair') {
    return ctx.myStamina >= 35 ? 'heavy' : 'laser';
  }

  if (ctx.enemyLastAction === 'heavy') {
    // Heavy на CD 4 хода — окно для атаки
    return ctx.myStamina >= 35 ? 'heavy' : 'laser';
  }

  // ── Управление выносливостью ──────────────────────
  if (ctx.myStamina < 40) return 'shield';

  // ── Анти-спам ─────────────────────────────────────
  if (ctx.myRepeatCount >= 2) {
    if (ctx.myLastAction === 'heavy')  return 'laser';
    if (ctx.myLastAction === 'laser')  return ctx.myStamina >= 35 ? 'heavy' : 'attack';
    return 'dodge';
  }

  // ── Основная атака ────────────────────────────────
  if (ctx.cooldowns.heavy === 0 && ctx.myStamina >= 35) return 'heavy';
  if (ctx.cooldowns.laser === 0 && ctx.myStamina >= 20) return 'laser';
  return 'attack';
}`,
  },
]
