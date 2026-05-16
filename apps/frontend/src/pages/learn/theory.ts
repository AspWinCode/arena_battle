export interface TheoryLesson {
  id: string
  icon: string
  title: string
  subtitle: string
  blocks: LessonBlock[]
}

export type LessonBlock =
  | { kind: 'text'; text: string }
  | { kind: 'tip'; text: string }
  | { kind: 'code'; code: string }
  | { kind: 'actions' }
  | { kind: 'ctx' }
  | { kind: 'blocksVsCode' }

export const THEORY_LESSONS: TheoryLesson[] = [
  {
    id: 'what-is-strategy',
    icon: '🤔',
    title: 'Что такое стратегия?',
    subtitle: 'Бой состоит из ходов. Твой код решает что делать на каждом ходу.',
    blocks: [
      { kind: 'text', text: 'Каждые 1-2 секунды бой делает «ход». На каждом ходу платформа вызывает твою функцию strategy(ctx) — и ты должен вернуть одно из действий: бить, защищаться, увернуться и т.д.' },
      { kind: 'text', text: 'Враг делает то же самое. Кто грамотнее выбирает действия — тот побеждает.' },
      { kind: 'code', code: `function strategy(ctx) {\n  // ctx — что мы знаем о бое\n  // надо вернуть действие строкой\n  return 'attack';\n}` },
      { kind: 'tip', text: 'Самая простая стратегия — всегда атаковать. Иногда этого хватает против слабых ботов!' },
    ],
  },
  {
    id: 'actions',
    icon: '⚔️',
    title: 'Действия',
    subtitle: 'Семь базовых действий — фундамент любой стратегии.',
    blocks: [
      { kind: 'text', text: 'Каждое действие — это строка, которую возвращает strategy(). Все действия тратят выносливость или имеют кулдаун.' },
      { kind: 'actions' },
      { kind: 'tip', text: 'attack — самый дешёвый. Когда нет ресурсов на другое — атакуй.' },
    ],
  },
  {
    id: 'ctx',
    icon: '📊',
    title: 'Что знает робот: ctx',
    subtitle: 'Объект ctx содержит всю информацию о бое — HP, выносливость, ярость и т.д.',
    blocks: [
      { kind: 'text', text: 'У тебя есть ctx — твой «глаз» в бой. Через него ты видишь своё состояние и состояние врага.' },
      { kind: 'ctx' },
      { kind: 'code', code: `function strategy(ctx) {\n  // если HP меньше 30 — лечимся\n  if (ctx.myHp < 30) return 'repair';\n  return 'attack';\n}` },
      { kind: 'tip', text: 'Проверяй ctx.myStamina перед heavy — он стоит 35 выносливости и провалится если меньше.' },
    ],
  },
  {
    id: 'if-else',
    icon: '🔀',
    title: 'Условия if / else',
    subtitle: 'Главный инструмент стратегии — выбор действия в зависимости от ситуации.',
    blocks: [
      { kind: 'text', text: 'if проверяет условие. Если условие выполняется (true) — делается то что в фигурных скобках. Иначе идём дальше.' },
      { kind: 'code', code: `function strategy(ctx) {\n  if (ctx.myHp < 30) {\n    return 'repair';  // мало HP — лечимся\n  }\n  if (ctx.myRage >= 100) {\n    return 'special'; // ярость полная — спецудар\n  }\n  return 'attack';    // по умолчанию — атакуем\n}` },
      { kind: 'text', text: 'Важно: как только return сработал — функция заканчивается. То что ниже не выполнится. Поэтому порядок проверок важен!' },
      { kind: 'tip', text: 'Сначала проверяй самое срочное (мало HP), потом самое выгодное (полная ярость), потом обычное действие в конце.' },
    ],
  },
  {
    id: 'blocks-vs-code',
    icon: '🧩',
    title: 'Блоки или Код?',
    subtitle: 'Один и тот же мозг робота можно собирать двумя способами.',
    blocks: [
      { kind: 'text', text: 'В редакторе две вкладки: «Код» и «Блоки». Они делают одно и то же — задают стратегию робота.' },
      { kind: 'blocksVsCode' },
      { kind: 'text', text: 'Блоки переводятся в код автоматически. Начни с блоков — потом легко перейти на код.' },
      { kind: 'tip', text: 'В блоках уже встроены проверки против ошибок: нельзя перепутать имена действий или сломать синтаксис.' },
    ],
  },
  {
    id: 'example',
    icon: '🎯',
    title: 'Разбор готовой стратегии',
    subtitle: 'Собираем всё вместе на примере универсальной стратегии.',
    blocks: [
      { kind: 'text', text: 'Вот стратегия, которая обыграет большинство простых ботов. Прочитай и пойми каждую строчку.' },
      { kind: 'code', code: `function strategy(ctx) {\n  // 1. Срочно лечимся при критическом HP\n  if (ctx.myHp < 30) return 'repair';\n\n  // 2. Полная ярость — бьём спецударом (50 урона!)\n  if (ctx.myRage >= 100) return 'special';\n\n  // 3. Враг готовится к лазеру — уворачиваемся\n  if (ctx.enemyLastAction === 'laser') return 'dodge';\n\n  // 4. Враг почти дохлый — добиваем тяжёлым\n  if (ctx.enemyHp < 25 && ctx.myStamina >= 35) return 'heavy';\n\n  // 5. Иначе просто бьём\n  return 'attack';\n}` },
      { kind: 'text', text: 'Порядок проверок важен! Сначала самое срочное (выживание), потом самое выгодное (special), потом тактика (dodge/heavy), потом по умолчанию (attack).' },
      { kind: 'tip', text: 'Теперь ты готов к миссиям! Не бойся пробовать — после поражения можно сразу запустить заново.' },
    ],
  },
]
