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

export const MISSIONS: Mission[] = [
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
        title: 'Привет, боец!',
        body: 'Это редактор кода. Ты пишешь функцию strategy(ctx) — она вызывается каждый ход и должна вернуть действие.',
        highlight: 'editor',
      },
      {
        title: 'Объект ctx',
        body: 'ctx содержит всё что нужно: ctx.myHp, ctx.enemyHp, ctx.enemyLastAction, ctx.cooldowns. Верни название действия строкой.',
        highlight: 'editor',
        codeHint: `function strategy(ctx) {\n  return 'attack';\n}`,
      },
      {
        title: 'Запусти бой!',
        body: 'Нажми кнопку "Запустить бой" и посмотри результат.',
        highlight: 'ready-btn',
      },
    ],
    starterCode: `// Функция strategy(ctx) вызывается каждый ход.
// Верни название действия: 'attack', 'laser', 'shield', 'dodge', 'combo', 'repair'

function strategy(ctx) {
  // Манекен слабый — просто атакуй!
  return 'attack';
}`,
  },

  {
    id: 'mission-02',
    order: 2,
    title: 'Лазерная угроза',
    description: 'Противник использует лазер. Научись уклоняться!',
    story: 'Робот-снайпер держится на расстоянии и стреляет лазером. Нужно уворачиваться!',
    difficulty: 1,
    opponentName: 'Снайпер',
    opponentSkin: 'robot',
    opponentStrategy: { primary: 'laser', lowHp: 'laser', onHit: 'dodge', style: 'Aggressive', position: 'far' },
    tutorial: [
      {
        title: 'ctx.enemyLastAction',
        body: 'Узнай что сделал противник в прошлый ход через ctx.enemyLastAction.',
        highlight: 'editor',
      },
      {
        title: 'Уклонение',
        body: 'Если противник стрелял лазером — уклонись! Лазер снайпера делает 25 урона, dodge делает 0.',
        highlight: 'editor',
        codeHint: `if (ctx.enemyLastAction === 'laser') {\n  return 'dodge';\n}`,
      },
    ],
    starterCode: `function strategy(ctx) {
  // Если враг только что выстрелил лазером — уклонись!
  if (ctx.enemyLastAction === 'laser') {
    return 'dodge';
  }
  // Иначе сближайся и атакуй
  return 'attack';
}`,
  },

  {
    id: 'mission-03',
    order: 3,
    title: 'Щитоносец',
    description: 'Противник прячется за щитом. Найди слабое место!',
    story: 'Гладиатор с большим щитом блокирует каждую атаку. Но щит не вечен — combo пробивает его!',
    difficulty: 2,
    opponentName: 'Щитоносец',
    opponentSkin: 'gladiator',
    opponentStrategy: { primary: 'shield', lowHp: 'attack', onHit: 'shield', style: 'Defensive', position: 'mid' },
    tutorial: [
      {
        title: 'Проверяй последнее действие',
        body: 'ctx.enemyLastAction === "shield" означает что враг только что поставил щит. Атака слабеет до 8 урона!',
        highlight: 'editor',
      },
      {
        title: 'Combo пробивает щит',
        body: 'combo наносит 12 урона даже через щит. А laser и combo во второй ход — уже без защиты.',
        codeHint: `if (ctx.enemyLastAction === 'shield') {\n  return 'combo'; // пробиваем щит!\n}`,
      },
    ],
    starterCode: `function strategy(ctx) {
  // Враг поставил щит — пробиваем combo
  if (ctx.enemyLastAction === 'shield') {
    return 'combo';
  }
  // Враг атакует — ставим щит в ответ
  if (ctx.enemyLastAction === 'attack') {
    return 'shield';
  }
  return 'attack';
}`,
  },

  {
    id: 'mission-04',
    order: 4,
    title: 'Боксёрский клуб',
    description: 'Быстрый combo-боец. Следи за перезарядкой!',
    story: 'Боксёр-молния атакует combo на ближней дистанции. Уклоняйся и бей лазером!',
    difficulty: 2,
    opponentName: 'Боксёр',
    opponentSkin: 'boxer',
    opponentStrategy: { primary: 'combo', lowHp: 'attack', onHit: 'combo', style: 'Aggressive', position: 'close' },
    tutorial: [
      {
        title: 'ctx.cooldowns',
        body: 'ctx.cooldowns.combo покажет сколько ходов до следующего combo. 0 = готово, >0 = перезарядка.',
        highlight: 'editor',
      },
      {
        title: 'Атакуй в окно перезарядки',
        body: 'Combo у врага на CD 4 хода — у тебя есть 4 хода для свободной атаки!',
        codeHint: `if (ctx.cooldowns.combo > 0) {\n  return 'laser'; // combo на перезарядке!\n}`,
      },
    ],
    starterCode: `function strategy(ctx) {
  // Combo врага на перезарядке — стреляем лазером
  if (ctx.cooldowns.combo > 0) {
    return 'laser';
  }
  // Combo скоро будет — уклоняемся
  return 'dodge';
}`,
  },

  {
    id: 'mission-05',
    order: 5,
    title: 'Целитель',
    description: 'Противник лечится. Прерви его восстановление!',
    story: 'Космонавт использует аптечки и уходит от боя. Когда враг лечится — он беззащитен!',
    difficulty: 2,
    opponentName: 'Медик',
    opponentSkin: 'cosmonaut',
    opponentStrategy: { primary: 'repair', lowHp: 'repair', onHit: 'shield', style: 'Defensive', position: 'mid' },
    tutorial: [
      {
        title: 'Repair = 0 брони',
        body: 'Когда противник делает repair — он не защищается. Combo наносит 25 урона по лечащемуся противнику!',
        highlight: 'editor',
      },
      {
        title: 'ctx.enemyHp',
        body: 'ctx.enemyHp покажет сколько HP у врага. Если много — он будет лечиться снова.',
        codeHint: `if (ctx.enemyLastAction === 'repair') {\n  return 'combo'; // наказываем!\n}`,
      },
    ],
    starterCode: `function strategy(ctx) {
  // Враг только что лечился — максимальный урон!
  if (ctx.enemyLastAction === 'repair') {
    return 'combo';
  }
  // Враг почти мёртв — добиваем лазером
  if (ctx.enemyHp < 25) {
    return 'laser';
  }
  // Ждём момент
  return 'attack';
}`,
  },

  {
    id: 'mission-06',
    order: 6,
    title: 'Зеркальный боец',
    description: 'Противник адаптируется. Будь непредсказуем — никаких повторов!',
    story: 'Этот робот учится на твоих ходах. ⚠️ Новое правило: 3+ одинаковых хода подряд = урон ×0.5!',
    difficulty: 3,
    opponentName: 'Зеркало',
    opponentSkin: 'robot',
    opponentStrategy: { primary: 'attack', lowHp: 'combo', onHit: 'dodge', style: 'Balanced', position: 'mid' },
    tutorial: [
      {
        title: '⚠️ Штраф за повторы',
        body: 'Если ты используешь одно и то же действие 3+ раза подряд, твой урон снижается вдвое! ctx.myRepeatCount покажет счётчик.',
        highlight: 'editor',
      },
      {
        title: 'Чередуй действия',
        body: 'Используй ctx.myRepeatCount чтобы знать когда пора менять тактику.',
        codeHint: `if (ctx.myRepeatCount >= 2) {\n  return 'dodge'; // разбиваем серию\n}`,
      },
    ],
    starterCode: `function strategy(ctx) {
  // Если атаковал 2 раза подряд — пора менять тактику
  if (ctx.myRepeatCount >= 2) {
    // Чередуем: уклон или лазер
    if (ctx.myLastAction === 'dodge') {
      return 'laser';
    }
    return 'dodge';
  }

  if (ctx.enemyHp < 30) {
    return 'combo';
  }

  return 'attack';
}`,
  },

  {
    id: 'mission-07',
    order: 7,
    title: 'Берсерк',
    description: 'Яростный combo-спамер. Контратакуй щитом!',
    story: 'Гладиатор-берсерк атакует combo без остановки. Он никогда не защищается — используй это!',
    difficulty: 3,
    opponentName: 'Берсерк',
    opponentSkin: 'gladiator',
    opponentStrategy: { primary: 'combo', lowHp: 'combo', onHit: 'combo', style: 'Aggressive', position: 'close' },
    tutorial: [
      {
        title: 'Shield vs Combo',
        body: 'Shield поглощает часть урона от combo (0 вместо 22). После щита — combo на перезарядке 4 хода!',
        highlight: 'editor',
      },
      {
        title: 'Контратака в окно',
        body: 'Поставь щит → враг тратит combo → атакуй laser пока combo на CD.',
        codeHint: `// shield → counter pattern`,
      },
    ],
    starterCode: `function strategy(ctx) {
  // Combo готово у врага — ставим щит
  if (ctx.cooldowns.combo === 0) {
    return 'shield';
  }
  // Combo на перезарядке — атакуем!
  if (ctx.cooldowns.combo > 0) {
    return 'laser';
  }
  return 'attack';
}`,
  },

  {
    id: 'mission-08',
    order: 8,
    title: 'Адаптивный боец',
    description: 'Противник меняет тактику. Нужна полная стратегия!',
    story: 'Опытный боксёр умеет всё: атаковать, защищаться, лечиться. Читай его ходы и реагируй!',
    difficulty: 4,
    opponentName: 'Ветеран',
    opponentSkin: 'boxer',
    opponentStrategy: { primary: 'attack', lowHp: 'repair', onHit: 'shield', style: 'Balanced', position: 'mid' },
    tutorial: [
      {
        title: 'Полный контекст',
        body: 'ctx содержит: myHp, enemyHp, turn, enemyLastAction, cooldowns (все 6 действий), myRepeatCount. Используй всё!',
        highlight: 'editor',
      },
      {
        title: 'Дерево решений',
        body: 'Строй условия от наиболее критичных (своё HP) к тактическим (читай ходы врага).',
        codeHint: `// myHp → enemyHp → enemyLastAction → cooldowns`,
      },
    ],
    starterCode: `function strategy(ctx) {
  // Критично: своё HP низкое — лечимся
  if (ctx.myHp < 25 && ctx.cooldowns.repair === 0) {
    return 'repair';
  }

  // Враг лечится — максимальный урон
  if (ctx.enemyLastAction === 'repair') {
    return 'combo';
  }

  // Враг почти мёртв — добиваем
  if (ctx.enemyHp < 20) {
    return ctx.cooldowns.combo === 0 ? 'combo' : 'laser';
  }

  // Избегаем штрафа за повторы
  if (ctx.myRepeatCount >= 2) {
    return 'dodge';
  }

  return 'attack';
}`,
  },

  {
    id: 'mission-09',
    order: 9,
    title: 'Снайпер-призрак',
    description: 'Дальний уклонист. Нужен точный тайминг!',
    story: 'Космонавт держится на дистанции, стреляет лазером и уходит от ударов. Поймай его в момент перезарядки!',
    difficulty: 4,
    opponentName: 'Призрак',
    opponentSkin: 'cosmonaut',
    opponentStrategy: { primary: 'laser', lowHp: 'dodge', onHit: 'dodge', style: 'Evasive', position: 'far' },
    tutorial: [
      {
        title: 'Позиция',
        body: 'ctx.myPosition и ctx.enemyPosition: close/mid/far. Laser наносит +15% с far. Attack с far = 0 урона!',
        highlight: 'editor',
      },
      {
        title: 'Момент для атаки',
        body: 'После laser у врага 3 хода CD. Это твоё окно! Combo с close даёт +20% урона.',
        codeHint: `if (ctx.cooldowns.laser > 0) {\n  return 'combo'; // враг разряжен!\n}`,
      },
    ],
    starterCode: `function strategy(ctx) {
  // Лазер на перезарядке — атакуем combo
  if (ctx.cooldowns.laser > 0) {
    return ctx.cooldowns.combo === 0 ? 'combo' : 'attack';
  }

  // Уклоняемся от лазера
  if (ctx.enemyLastAction === 'laser') {
    return 'dodge';
  }

  // Наше HP низкое — лечимся
  if (ctx.myHp < 30 && ctx.cooldowns.repair === 0) {
    return 'repair';
  }

  // Сближаемся
  return 'attack';
}`,
  },

  {
    id: 'mission-10',
    order: 10,
    title: 'Чемпион Арены',
    description: 'Финальный босс. Используй всё что знаешь!',
    story: 'Действующий чемпион арены. Он использует каждый твой промах. Напиши лучший код!',
    difficulty: 5,
    opponentName: 'Чемпион',
    opponentSkin: 'gladiator',
    opponentStrategy: { primary: 'laser', lowHp: 'combo', onHit: 'dodge', style: 'Aggressive', position: 'far' },
    tutorial: [
      {
        title: 'Финальный бой!',
        body: 'Чемпион использует laser + combo + dodge. Читай его ходы, управляй HP, ломай его паттерны.',
        highlight: 'editor',
      },
      {
        title: 'Ты готов',
        body: 'Ты прошёл 9 миссий и знаешь всё: ctx.cooldowns, ctx.myRepeatCount, позиции, HP. Покажи лучшую стратегию!',
        highlight: 'arena',
      },
    ],
    starterCode: `function strategy(ctx) {
  // ── Критические ситуации ──────────────────────────
  if (ctx.myHp < 25 && ctx.cooldowns.repair === 0) {
    return 'repair';
  }

  // ── Добиваем врага ────────────────────────────────
  if (ctx.enemyHp < 20) {
    return ctx.cooldowns.combo === 0 ? 'combo' : 'laser';
  }

  // ── Читаем ходы чемпиона ──────────────────────────
  if (ctx.enemyLastAction === 'laser') {
    return 'dodge'; // уклон от следующего
  }

  if (ctx.enemyLastAction === 'dodge') {
    return ctx.cooldowns.laser === 0 ? 'laser' : 'attack';
  }

  // ── Избегаем штрафа за повторы ────────────────────
  if (ctx.myRepeatCount >= 2) {
    return ctx.myLastAction === 'dodge' ? 'laser' : 'dodge';
  }

  // ── Используем combo в окне перезарядки ──────────
  if (ctx.cooldowns.combo === 0 && ctx.cooldowns.laser > 0) {
    return 'combo';
  }

  return 'laser';
}`,
  },
]
