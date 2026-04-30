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
    description: 'Противник атакует по прямой. Просто нажми атаку!',
    story: 'Деревянный манекен стоит в центре арены. Он всегда атакует одинаково. Покажи, что умеешь!',
    difficulty: 1,
    opponentName: 'Манекен',
    opponentSkin: 'robot',
    opponentStrategy: { primary: 'attack', lowHp: 'attack', onHit: 'attack', style: 'Standard', position: 'close' },
    tutorial: [
      { title: 'Привет!', body: 'Это редактор кода. Здесь ты пишешь команды своему роботу.', highlight: 'editor' },
      { title: 'Функция onRoundStart', body: 'Каждый ход вызывается функция onRoundStart. Напиши в ней что делать!', highlight: 'editor', codeHint: 'function onRoundStart(enemy) {\n  return attack();\n}' },
      { title: 'Запусти бой!', body: 'Нажми кнопку "Запустить бой" и посмотри что будет.', highlight: 'ready-btn' },
    ],
    starterCode: `function onRoundStart(enemy) {
  // Противник: простой манекен
  // Твоя задача: атаковать!
  return attack();
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
      { title: 'enemy.lastAction', body: 'Узнай что сделал противник в прошлый ход через enemy.lastAction.', highlight: 'editor' },
      { title: 'Уклонение', body: 'Если противник стрелял лазером — уклонись! Используй dodge().', highlight: 'editor', codeHint: `if (enemy.lastAction === 'laser') {\n  return dodge('roll');\n}` },
    ],
    starterCode: `function onRoundStart(enemy) {
  if (enemy.lastAction === 'laser') {
    // Уклонись от следующего выстрела
    return dodge('roll');
  }
  return attack();
}`,
  },

  {
    id: 'mission-03',
    order: 3,
    title: 'Щитоносец',
    description: 'Противник прячется за щитом. Найди слабое место!',
    story: 'Гладиатор с большим щитом блокирует каждую атаку. Но щит не вечен!',
    difficulty: 2,
    opponentName: 'Щитоносец',
    opponentSkin: 'gladiator',
    opponentStrategy: { primary: 'shield', lowHp: 'attack', onHit: 'shield', style: 'Defensive', position: 'mid' },
    tutorial: [
      { title: 'Проверяй щит', body: 'enemy.shieldActive покажет, активен ли щит противника прямо сейчас.', highlight: 'editor' },
      { title: 'Лазер пробивает щит', body: 'Атака в щит не работает — попробуй лазер или combo!', codeHint: `if (enemy.shieldActive) {\n  return laser();\n}` },
    ],
    starterCode: `function onRoundStart(enemy) {
  if (enemy.shieldActive) {
    // Щит активен — используй лазер
    return laser();
  }
  // Щита нет — атакуй!
  return attack();
}`,
  },

  {
    id: 'mission-04',
    order: 4,
    title: 'Боксёрский клуб',
    description: 'Быстрые удары в ближнем бою. Нужна стратегия!',
    story: 'Боксёр-молния атакует combo на ближней дистанции. Отойди назад и используй лазер!',
    difficulty: 2,
    opponentName: 'Боксёр',
    opponentSkin: 'boxer',
    opponentStrategy: { primary: 'combo', lowHp: 'attack', onHit: 'combo', style: 'Aggressive', position: 'close' },
    tutorial: [
      { title: 'Позиция важна!', body: 'Лазер наносит больше урона с дальней дистанции. Уклоняйся чтобы отойти.', highlight: 'editor' },
      { title: 'Комбо-счётчик', body: 'enemy.cooldowns.combo показывает сколько ходов до следующего combo.', codeHint: `if (enemy.cooldowns.combo > 0) {\n  return laser(); // комбо на перезарядке!\n}` },
    ],
    starterCode: `function onRoundStart(enemy) {
  // Если враг может сделать combo — уклонись
  if (enemy.cooldowns.combo === 0) {
    return dodge('back');
  }
  // Иначе атакуй с безопасного расстояния
  return laser();
}`,
  },

  {
    id: 'mission-05',
    order: 5,
    title: 'Целитель',
    description: 'Противник лечится. Прерви его восстановление!',
    story: 'Космонавт использует аптечки и уходит от боя. Атакуй пока он лечится!',
    difficulty: 2,
    opponentName: 'Медик',
    opponentSkin: 'cosmonaut',
    opponentStrategy: { primary: 'repair', lowHp: 'repair', onHit: 'shield', style: 'Defensive', position: 'mid' },
    tutorial: [
      { title: 'Repair уязвим', body: 'Когда противник лечится (repair) — он беззащитен. Это момент для combo!', highlight: 'editor' },
      { title: 'Следи за HP', body: 'enemy.hp покажет сколько здоровья у врага.', codeHint: `if (enemy.lastAction === 'repair') {\n  return combo(); // наказываем за лечение!\n}` },
    ],
    starterCode: `function onRoundStart(enemy) {
  // Если враг только что лечился — атакуй combo
  if (enemy.lastAction === 'repair') {
    return combo();
  }
  // Если враг слабый — добей
  if (enemy.hp < 30) {
    return laser();
  }
  return attack();
}`,
  },

  {
    id: 'mission-06',
    order: 6,
    title: 'Зеркальный боец',
    description: 'Противник копирует твой стиль. Будь непредсказуем!',
    story: 'Этот робот учится на твоих ходах и пытается контратаковать. Чередуй атаки!',
    difficulty: 3,
    opponentName: 'Зеркало',
    opponentSkin: 'robot',
    opponentStrategy: { primary: 'attack', lowHp: 'combo', onHit: 'dodge', style: 'Balanced', position: 'mid' },
    tutorial: [
      { title: 'Чередование', body: 'Не используй одно и то же действие подряд — противник адаптируется.', highlight: 'editor' },
      { title: 'Случайность', body: 'Math.random() помогает быть непредсказуемым!', codeHint: `if (Math.random() > 0.5) {\n  return attack();\n} else {\n  return laser();\n}` },
    ],
    starterCode: `function onRoundStart(enemy) {
  if (enemy.hp < 30) {
    return combo();
  }
  // Чередуй атаки чтобы быть непредсказуемым
  if (Math.random() > 0.5) {
    return attack();
  }
  return laser();
}`,
  },

  {
    id: 'mission-07',
    order: 7,
    title: 'Берсерк',
    description: 'Яростный противник не думает о защите. Используй это!',
    story: 'Гладиатор-берсерк атакует без остановки. Но он никогда не защищается — поставь щит!',
    difficulty: 3,
    opponentName: 'Берсерк',
    opponentSkin: 'gladiator',
    opponentStrategy: { primary: 'combo', lowHp: 'combo', onHit: 'combo', style: 'Aggressive', position: 'close' },
    tutorial: [
      { title: 'Щит контрит combo', body: 'Shield поглощает часть урона от combo. Используй его когда враг бесится!', highlight: 'editor' },
      { title: 'Контратака', body: 'После того как поставил щит — атакуй combo в ответ.', codeHint: `// shield → counter-attack pattern` },
    ],
    starterCode: `function onRoundStart(enemy) {
  // Берсерк всегда делает combo — ставь щит через раз
  if (enemy.lastAction === 'combo') {
    return shield();
  }
  // После щита — контратака!
  return combo();
}`,
  },

  {
    id: 'mission-08',
    order: 8,
    title: 'Адаптивный боец',
    description: 'Противник меняет тактику. Нужна гибкая стратегия!',
    story: 'Опытный боксёр умеет всё: атаковать, защищаться, лечиться. Читай его ходы!',
    difficulty: 4,
    opponentName: 'Ветеран',
    opponentSkin: 'boxer',
    opponentStrategy: { primary: 'attack', lowHp: 'repair', onHit: 'shield', style: 'Balanced', position: 'mid' },
    tutorial: [
      { title: 'Полный контроль', body: 'Проверяй HP врага, его последнее действие и cooldowns — принимай решения!', highlight: 'editor' },
      { title: 'Дерево условий', body: 'Используй несколько if/else для разных ситуаций.', codeHint: `// hp + lastAction + cooldowns → решение` },
    ],
    starterCode: `function onRoundStart(enemy) {
  // Враг почти мёртв — добей
  if (enemy.hp < 25) {
    return combo();
  }
  // Враг лечится — атакуй combo
  if (enemy.lastAction === 'repair') {
    return combo();
  }
  // Враг только что ударил — уклонись
  if (enemy.lastAction === 'attack') {
    return dodge('left');
  }
  // По умолчанию — атака
  return attack();
}`,
  },

  {
    id: 'mission-09',
    order: 9,
    title: 'Снайпер-призрак',
    description: 'Дальний боец с уклонениями. Нужен laser + combo!',
    story: 'Космонавт держится на дистанции, стреляет лазером и уходит от ударов. Поймай его!',
    difficulty: 4,
    opponentName: 'Призрак',
    opponentSkin: 'cosmonaut',
    opponentStrategy: { primary: 'laser', lowHp: 'dodge', onHit: 'dodge', style: 'Evasive', position: 'far' },
    tutorial: [
      { title: 'Сближение', body: 'attack() перемещает тебя ближе. Потом используй combo на близкой дистанции.', highlight: 'editor' },
      { title: 'Перезарядка', body: 'После laser у врага cooldown 3 хода — это твой шанс атаковать!', codeHint: `if (enemy.cooldowns.laser > 0) {\n  return combo();\n}` },
    ],
    starterCode: `function onRoundStart(enemy) {
  // Лазер на перезарядке — combo!
  if (enemy.cooldowns.laser > 0) {
    return combo();
  }
  // Уклоняемся от лазера
  if (enemy.lastAction === 'laser') {
    return dodge('roll');
  }
  // Сближаемся
  return attack();
}`,
  },

  {
    id: 'mission-10',
    order: 10,
    title: 'Чемпион Арены',
    description: 'Финальный бос. Используй всё что знаешь!',
    story: 'Действующий чемпион арены. Он умеет всё и делает это идеально. Покажи ему что ты научился!',
    difficulty: 5,
    opponentName: 'Чемпион',
    opponentSkin: 'gladiator',
    opponentStrategy: { primary: 'laser', lowHp: 'combo', onHit: 'dodge', style: 'Aggressive', position: 'far' },
    tutorial: [
      { title: 'Финальный бой!', body: 'Чемпион использует все свои умения. Напиши наилучший код!', highlight: 'editor' },
      { title: 'Ты готов', body: 'Ты прошёл 9 миссий. Теперь применй всё — читай ходы, адаптируйся, побеждай!', highlight: 'arena' },
    ],
    starterCode: `function onRoundStart(enemy) {
  // Финальная стратегия — здесь твой лучший код!

  if (enemy.hp < 30) {
    return combo();
  }

  if (enemy.lastAction === 'laser') {
    return dodge('roll');
  }

  if (enemy.shieldActive) {
    return laser();
  }

  if (enemy.cooldowns.laser > 0) {
    return combo();
  }

  return attack();
}`,
  },
]
