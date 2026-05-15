import { useState, useRef, useCallback, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { MISSIONS, MAX_HP, MAX_STAMINA, MAX_RAGE, SKIN_ICON } from '@robocode/shared'
import type { RoundResult, TurnResult, Lang } from '@robocode/shared'
import { runLocalMatch } from '../engine/battleEngine'
import { runCodeToStrategy } from '../engine/codeRunner'
import { analyzeMatch, evaluateTurns, ACTION_COLOR, ACTION_LABEL } from '../engine/matchAnalysis'
import DecisionGraph from '../components/battle/DecisionGraph'
import { useLearnStore } from '../stores/learnStore'
import { useDailyStore } from '../stores/dailyStore'
import CodeEditor from '../components/CodeEditor/CodeEditor'
import BlockEditor from '../components/BlockEditor/BlockEditor'
import TutorialOverlay from '../components/tutorial/TutorialOverlay'
import { api } from '../api/client'
import styles from './LearningBattlePage.module.css'

const ACTION_ICON: Record<string, string> = {
  attack: '👊', heavy: '💥', laser: '⚡', shield: '🛡️',
  dodge: '💨', repair: '💊', special: '☄️',
}

const LANG_LABELS: Record<string, string> = {
  js: 'JavaScript', py: 'Python', cpp: 'C++', java: 'Java',
}

const LANG_TEMPLATES: Record<string, string> = {
  js: `// strategy(ctx) вызывается каждый ход
// Верни: 'attack'|'heavy'|'laser'|'shield'|'dodge'|'repair'|'special'

function strategy(ctx) {
  if (ctx.myRage >= 100) return 'special';
  if (ctx.myHp < 30) return 'repair';
  if (ctx.enemyLastAction === 'laser') return 'dodge';
  if (ctx.enemyHp < 25) return 'heavy';
  return 'attack';
}`,
  py: `# strategy(ctx) вызывается каждый ход
# Верни строку: 'attack'|'heavy'|'laser'|'shield'|'dodge'|'repair'|'special'

def strategy(ctx):
    if ctx.my_rage >= 100:
        return 'special'
    if ctx.my_hp < 30:
        return 'repair'
    if ctx.enemy_last_action == 'laser':
        return 'dodge'
    if ctx.enemy_hp < 25:
        return 'heavy'
    return 'attack'`,
  cpp: `// strategy вызывается каждый ход
// Верни строку: attack heavy laser shield dodge repair special

#include <string>
std::string strategy(Ctx ctx) {
    if (ctx.my_rage >= 100) return "special";
    if (ctx.my_hp < 30) return "repair";
    if (ctx.enemy_last_action == "laser") return "dodge";
    if (ctx.enemy_hp < 25) return "heavy";
    return "attack";
}`,
  java: `// strategy вызывается каждый ход
// Верни строку: attack heavy laser shield dodge repair special

public class Strategy {
    public static String strategy(Ctx ctx) {
        if (ctx.myRage >= 100) return "special";
        if (ctx.myHp < 30) return "repair";
        if (ctx.enemyLastAction.equals("laser")) return "dodge";
        if (ctx.enemyHp < 25) return "heavy";
        return "attack";
    }
}`,
}

// ── Ctx field definitions for reference panel ─────────────────────────────────

interface CtxField {
  name: string
  tip: string
}

const CTX_GROUPS: { title: string; fields: CtxField[] }[] = [
  {
    title: '🧑‍💻 Ты',
    fields: [
      { name: 'ctx.myHp',           tip: '❤️ Твои очки жизни (0–100).\n\nКогда использовать:\n• HP < 30 → срочно лечись\n• HP < 50 → подумай о защите\n\nПример:\nif (ctx.myHp < 30) return "repair";\nif (ctx.myHp < 50) return "shield";' },
      { name: 'ctx.myMaxHp',        tip: '❤️ Максимальный HP (зависит от персонажа).\n\nКогда использовать:\nДля расчёта процента здоровья:\nconst pct = ctx.myHp / ctx.myMaxHp;\nif (pct < 0.4) return "repair";' },
      { name: 'ctx.myStamina',      tip: '⚡ Выносливость (0–100). Тратится на атаки:\n• attack — 10\n• laser  — 20\n• heavy  — 35 (провалится если меньше!)\n\nКогда использовать:\nif (ctx.myStamina < 35) return "attack";\nif (ctx.myStamina >= 35) return "heavy";' },
      { name: 'ctx.myRage',         tip: '🔥 Ярость (0–100). Копится от полученных ударов.\nПри 100 — special наносит 50 урона!\nБез полной ярости special почти бесполезен.\n\nКогда использовать:\nif (ctx.myRage >= 100) return "special";\n// Иначе не трать special!' },
      { name: 'ctx.myLastAction',   tip: '↩️ Твоё действие в прошлом ходу.\n\nКогда использовать:\nЧередуй удары — повторения дают штраф!\nif (ctx.myLastAction === "heavy")\n  return "attack"; // смени удар\nif (ctx.myLastAction === "shield")\n  return "attack"; // контратакуй' },
      { name: 'ctx.myRepeatCount',  tip: '🔁 Сколько раз подряд делаешь одно и то же.\nПосле 2 повторов — урон снижается!\n\nКогда использовать:\nif (ctx.myRepeatCount >= 2) {\n  // обязательно смени действие!\n  return "laser"; \n}' },
      { name: 'ctx.myPosition',     tip: '📍 Позиция: "close" / "mid" / "far".\n\nКогда использовать:\n• close → attack и heavy сильнее\n• far   → laser сильнее\n\nПример:\nif (ctx.myPosition === "far")\n  return "laser";\nif (ctx.myPosition === "close")\n  return "heavy";' },
    ],
  },
  {
    title: '🤖 Враг',
    fields: [
      { name: 'ctx.enemyHp',         tip: '💀 HP врага (0–100).\n\nКогда использовать:\n• < 25 → добивай тяжёлым ударом\n• < 10 → используй special если rage=100\n\nПример:\nif (ctx.enemyHp < 25) return "heavy";\nif (ctx.enemyHp < 10 && ctx.myRage >= 100)\n  return "special";' },
      { name: 'ctx.enemyMaxHp',       tip: '💀 Максимальный HP врага.\n\nКогда использовать:\nДля расчёта насколько враг здоров:\nconst pct = ctx.enemyHp / ctx.enemyMaxHp;\nif (pct < 0.3) return "heavy"; // добивай!' },
      { name: 'ctx.enemyStamina',     tip: '⚡ Выносливость врага.\n\nКогда использовать:\n• = 0 → его heavy и laser слабее, атакуй!\n• < 20 → хорошее время для агрессии\n\nПример:\nif (ctx.enemyStamina === 0)\n  return "heavy"; // он не ответит сильно\nif (ctx.enemyStamina < 20)\n  return "attack";' },
      { name: 'ctx.enemyRage',        tip: '🔥 Ярость врага.\n\nКогда использовать:\n• ≥ 80 → он скоро применит special!\n           Защищайся или уклоняйся.\n• < 30 → можно атаковать смело\n\nПример:\nif (ctx.enemyRage >= 80) return "shield";\nif (ctx.enemyRage >= 80) return "dodge";' },
      { name: 'ctx.enemyLastAction',  tip: '👁️ Что враг делал в прошлом ходу.\nСАМОЕ ВАЖНОЕ ПОЛЕ! Предсказывай врага.\n\nКогда использовать:\nif (ctx.enemyLastAction === "heavy")\n  return "dodge"; // он снова ударит?\nif (ctx.enemyLastAction === "laser")\n  return "dodge"; // уклонись!\nif (ctx.enemyLastAction === "shield")\n  return "laser"; // пробей щит!' },
      { name: 'ctx.enemyPosition',    tip: '📍 Позиция врага: "close"/"mid"/"far".\n\nКогда использовать:\n• far  → используй laser против него\n• close → атакуй attack или heavy\n\nПример:\nif (ctx.enemyPosition === "far")\n  return "laser";\nif (ctx.enemyPosition === "close")\n  return "heavy";' },
    ],
  },
  {
    title: '⏱️ Перезарядка',
    fields: [
      { name: 'ctx.cooldowns.heavy',   tip: '⏱️ Ходов до следующего heavy.\n0 = можно использовать прямо сейчас.\n\nКогда использовать:\nif (ctx.cooldowns.heavy === 0\n    && ctx.myStamina >= 35\n    && ctx.enemyHp < 50)\n  return "heavy"; // всё готово — бей!' },
      { name: 'ctx.cooldowns.laser',   tip: '⏱️ Ходов до следующего laser.\n0 = готов. Кулдаун — 3 хода после использования.\n\nКогда использовать:\nif (ctx.cooldowns.laser === 0\n    && ctx.myPosition === "far")\n  return "laser";' },
      { name: 'ctx.cooldowns.shield',  tip: '⏱️ Ходов до следующего shield.\n0 = готов к использованию.\n\nКогда использовать:\nif (ctx.cooldowns.shield === 0\n    && ctx.enemyRage >= 80)\n  return "shield"; // блокируй special!' },
      { name: 'ctx.cooldowns.dodge',   tip: '⏱️ Ходов до следующего dodge.\n0 = готов к использованию.\n\nКогда использовать:\nif (ctx.cooldowns.dodge === 0\n    && ctx.enemyLastAction === "attack")\n  return "dodge"; // уклонись!' },
      { name: 'ctx.cooldowns.repair',  tip: '⏱️ Ходов до следующего repair.\n0 = готов. У repair обычно нет кулдауна.\n\nКогда использовать:\nif (ctx.cooldowns.repair === 0\n    && ctx.myHp < 35)\n  return "repair";' },
      { name: 'ctx.cooldowns.special', tip: '⏱️ Ходов до следующего special.\n0 = готов. Не трать special без полной ярости!\n\nКогда использовать:\nif (ctx.cooldowns.special === 0\n    && ctx.myRage >= 100)\n  return "special"; // убойный удар!' },
    ],
  },
  {
    title: '🎮 Бой',
    fields: [
      { name: 'ctx.turn',              tip: '🔢 Номер текущего хода (1–20).\nПосле 20 ходов — ничья если оба живы!\n\nКогда использовать:\n// В конце торопись добить!\nif (ctx.turn > 15 && ctx.enemyHp < 40)\n  return "heavy";\n// В начале можно копить ярость\nif (ctx.turn < 5) return "attack";' },
      { name: 'ctx.distanceModifier',  tip: '📏 Множитель урона от позиции (обычно ~1.0).\n\nКогда использовать:\nЧаще всего можно игнорировать.\nПолезно для точных расчётов урона:\nconst dmg = 12 * ctx.distanceModifier;' },
    ],
  },
  {
    title: '📜 История ходов',
    fields: [
      { name: 'ctx.myHistory',        tip: '📋 Массив твоих действий за раунд.\nПример: ["attack","attack","heavy"]\n\nКогда использовать:\n// Проверь не повторяешься ли ты\nconst last3 = ctx.myHistory.slice(-3);\nconst allSame = last3.every(a => a === last3[0]);\nif (allSame) return "laser"; // смени тактику' },
      { name: 'ctx.enemyHistory',     tip: '📋 Массив всех ударов врага.\n\nКогда использовать:\n// Найди его любимый удар\nconst heavyCount = ctx.enemyHistory\n  .filter(a => a === "heavy").length;\nif (heavyCount > 3) return "shield";\n// Если часто атакует — защищайся!' },
      { name: 'ctx.damageLog',        tip: '💥 Урон, нанесённый тобой на каждом ходу.\nПример: [12, 0, 28, 0, 20]\n\nКогда использовать:\n// Проверь насколько эффективна тактика\nconst avgDmg = ctx.damageLog\n  .reduce((s,d) => s+d, 0) / ctx.damageLog.length;\nif (avgDmg < 8) return "heavy"; // атакуй сильнее' },
      { name: 'ctx.damageTakenLog',   tip: '🩸 Урон, полученный тобой на каждом ходу.\nПример: [0, 28, 0, 12]\n\nКогда использовать:\n// Если часто получаешь — меняй тактику\nconst lastHit = ctx.damageTakenLog.slice(-1)[0];\nif (lastHit > 20) return "dodge"; // уклонись!' },
      { name: 'ctx.myHpLog',          tip: '❤️ Твой HP после каждого хода.\nПример: [100, 88, 88, 60]\n\nКогда использовать:\n// Отследи динамику своего HP\nconst hpDrop = ctx.myHpLog[0] - ctx.myHp;\nif (hpDrop > 40) return "shield"; // теряешь много!' },
      { name: 'ctx.enemyHpLog',       tip: '💀 HP врага после каждого хода.\nПример: [100, 80, 80, 52]\n\nКогда использовать:\n// Проверь как быстро снижается HP врага\nconst dropRate = (ctx.enemyHpLog[0] - ctx.enemyHp)\n  / ctx.enemyHpLog.length;\nif (dropRate < 5) return "heavy"; // нападай сильнее' },
    ],
  },
  {
    title: '📊 Статистика врага',
    fields: [
      { name: 'ctx.enemyFrequency',   tip: '📊 Сколько раз враг использовал каждый удар.\nПример: { attack: 5, heavy: 2, laser: 1 }\n\nКогда использовать:\n// Найди его любимую атаку — заблокируй!\nif (ctx.enemyFrequency["heavy"] > 3)\n  return "shield"; // он любит heavy\nif (ctx.enemyFrequency["laser"] > 2)\n  return "dodge";  // он часто стреляет' },
      { name: 'ctx.enemyPhase',       tip: '🎯 Стадия боя врага по его HP.\n"early" — много HP, осторожен\n"mid"   — средне, непредсказуем\n"late"  — мало HP, отчаянный!\n\nКогда использовать:\nif (ctx.enemyPhase === "late")\n  return "heavy"; // добивай!\nif (ctx.enemyPhase === "early")\n  return "attack"; // не рискуй' },
      { name: 'ctx.enemyTrend',       tip: '📈 Текущий стиль игры врага.\n"aggressive" — атакует без остановки\n"defensive"  — в основном защищается\n"mixed"      — чередует\n\nКогда использовать:\nif (ctx.enemyTrend === "aggressive")\n  return "shield"; // он атакует — блокируй\nif (ctx.enemyTrend === "defensive")\n  return "laser";  // пробивай щит лазером' },
    ],
  },
  {
    title: '🧠 Для продвинутых',
    fields: [
      { name: 'ctx.simulate(a,b)',    tip: '🔮 Предсказывает итог хода заранее.\na — твой удар, b — удар врага.\nВозвращает: { myHpAfter, enemyHpAfter }\n\nКогда использовать:\n// Проверь добьёт ли heavy:\nconst r = ctx.simulate("heavy","attack");\nif (r.enemyHpAfter <= 0) return "heavy";\n// Иначе найди лучший вариант' },
      { name: 'ctx.bestAction()',     tip: '🏆 Автоматически выбирает лучший удар.\nАнализирует всё и возвращает оптимальное действие.\n\nКогда использовать:\n// Замени всю стратегию одной строкой:\nreturn ctx.bestAction();\n// Или используй как запасной вариант:\nreturn myLogic() || ctx.bestAction();' },
      { name: 'ctx.predict(n)',       tip: '🔮 Предсказывает следующий удар врага.\nn=1 — следующий ход, n=2 — через два хода.\n\nКогда использовать:\n// Предугадай и контратакуй!\nconst next = ctx.predict(1);\nif (next === "heavy") return "dodge";\nif (next === "laser") return "dodge";\nif (next === "shield") return "laser";' },
    ],
  },
]

type Phase = 'coding' | 'animating' | 'result'
type EditorMode = 'blocks' | 'code'

interface TipState { text: string; top: number; left: number }

export default function LearningBattlePage() {
  const { missionId } = useParams<{ missionId: string }>()
  const navigate = useNavigate()
  const { completesMission, incrementAttempt } = useLearnStore()
  const recordBattle = useDailyStore(s => s.recordBattle)
  const [floatingTip, setFloatingTip] = useState<TipState | null>(null)

  const mission = MISSIONS.find(m => m.id === missionId)

  const [editorMode, setEditorMode] = useState<EditorMode>('code')
  const [lang, setLang] = useState<Lang>('js')
  const [code, setCode] = useState(mission?.starterCode ?? '')
  const [blocksCode, setBlocksCode] = useState('')
  const [phase, setPhase] = useState<Phase>('coding')
  const [codeError, setCodeError] = useState('')
  const [rounds, setRounds] = useState<RoundResult[]>([])
  const [winner, setWinner] = useState<0 | 1 | 2>(0)
  const [score, setScore] = useState<[number, number]>([0, 0])
  const [displayRound, setDisplayRound] = useState<RoundResult | null>(null)
  const [displayTurn, setDisplayTurn] = useState<TurnResult | null>(null)
  const [tutorialDone, setTutorialDone] = useState(false)
  const [showTutorial, setShowTutorial] = useState(true)

  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const matchAnalysis = useMemo(
    () => (rounds.length > 0 ? analyzeMatch(rounds) : null),
    [rounds],
  )
  const graphEvals = useMemo(
    () => rounds.length > 0 ? evaluateTurns(rounds.flatMap(r => r.turns), 1) : [],
    [rounds],
  )

  const applyResult = useCallback((result: { rounds: RoundResult[]; winner: 0|1|2; score: [number,number] }) => {
    if (!mission) return
    setRounds(result.rounds)
    setWinner(result.winner)
    setScore(result.score)
    setPhase('animating')

    let delay = 0
    for (const round of result.rounds) {
      const r = round
      setTimeout(() => setDisplayRound(r), delay)
      delay += 400
      for (const t of round.turns) {
        const turn = t
        setTimeout(() => setDisplayTurn(turn), delay)
        delay += 350
      }
      delay += 600
    }

    animTimer.current = setTimeout(() => {
      setPhase('result')
      if (result.winner === 1) {
        const stars = result.score[0] > 0 && result.rounds[0]?.p2Hp === 0 ? 3 :
                      result.score[0] > 0 ? 2 : 1
        completesMission(mission.id, stars)
      }
      const allTurns = result.rounds.flatMap(r => r.turns)
      const won = result.winner === 1
      const lastTurn = allTurns[allTurns.length - 1]
      const isKo = won && !!lastTurn && lastTurn.p2HpAfter === 0
      recordBattle({
        won, isKo,
        damageDealt:  allTurns.reduce((s, t) => s + t.p2DmgTaken, 0),
        turnsPlayed:  allTurns.length,
        healing:      allTurns.reduce((s, t) => s + (t.p1Heal ?? 0), 0),
        specialUsed:  allTurns.filter(t => t.p1Action === 'special').length,
        heavyUsed:    allTurns.filter(t => t.p1Action === 'heavy').length,
        laserUsed:    allTurns.filter(t => t.p1Action === 'laser').length,
        dodgeUsed:    allTurns.filter(t => t.p1Action === 'dodge').length,
        usedRepair:   allTurns.some(t => t.p1Action === 'repair'),
      })
    }, delay)
  }, [mission, completesMission, recordBattle])

  const handleRun = useCallback(async () => {
    if (!mission) return
    setCodeError('')

    const activeCode = editorMode === 'blocks' ? blocksCode : code
    incrementAttempt(mission.id)

    if (editorMode === 'blocks' || lang === 'js') {
      const { strategy: playerStrategy, error } = runCodeToStrategy(activeCode)
      if (error) { setCodeError(`Ошибка: ${error}`); return }
      const result = runLocalMatch(playerStrategy, mission.opponentStrategy, 'bo1')
      applyResult(result as { rounds: RoundResult[]; winner: 0|1|2; score: [number,number] })
    } else {
      // Python / C++ / Java → backend sandbox
      try {
        const result = await api.post<{ rounds: RoundResult[]; winner: 0|1|2; score: [number,number] }>(
          '/learn/run',
          { code: activeCode, lang, missionId: mission.id },
        )
        applyResult(result)
      } catch (e) {
        setCodeError(`Ошибка сервера: ${e instanceof Error ? e.message : 'неизвестная ошибка'}`)
      }
    }
  }, [editorMode, blocksCode, code, lang, mission, incrementAttempt, applyResult])

  const handleReset = () => {
    if (animTimer.current) clearTimeout(animTimer.current)
    setPhase('coding')
    setDisplayRound(null)
    setDisplayTurn(null)
    setCodeError('')
  }

  const handleLangChange = (newLang: Lang) => {
    setLang(newLang)
    setCode(LANG_TEMPLATES[newLang] ?? '')
  }

  if (!mission) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>Миссия не найдена</p>
        <Link to="/learn">← К миссиям</Link>
      </div>
    )
  }

  const nextMission = MISSIONS.find(m => m.order === mission.order + 1)

  const showTip = (e: React.MouseEvent, text: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const left = Math.max(8, rect.left - 272)
    const top  = Math.min(rect.top, window.innerHeight - 320)
    setFloatingTip({ text, top, left })
  }
  const hideTip = () => setFloatingTip(null)

  return (
    <div className={styles.root}>
      {floatingTip && (
        <div className={styles.floatingTip} style={{ top: floatingTip.top, left: floatingTip.left }}>
          {floatingTip.text}
        </div>
      )}
      {showTutorial && !tutorialDone && (
        <TutorialOverlay
          steps={mission.tutorial}
          onDone={() => { setTutorialDone(true); setShowTutorial(false) }}
          onSkip={() => setShowTutorial(false)}
        />
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to="/learn" className={styles.back}>← Миссии</Link>
          <div className={styles.missionInfo}>
            <span className={styles.missionNum}>Миссия {mission.order}</span>
            <h2 className={styles.missionTitle}>{mission.title}</h2>
          </div>
        </div>
        <div className={styles.headerRight}>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowTutorial(true)}>
            💡 Подсказка
          </button>
          <div className={styles.vs}>
            <span>🧑‍💻 Ты</span>
            <span className={styles.vsLabel}>VS</span>
            <span>{SKIN_ICON[mission.opponentSkin]} {mission.opponentName}</span>
          </div>
        </div>
      </div>

      <div className={styles.body}>
        {/* Left — editor */}
        <div className={styles.editorPane}>
          <div className={styles.storyBox}>
            <p className={styles.storyText}>{mission.story}</p>
          </div>

          {/* Mode + language bar */}
          <div className={styles.editorModeBar}>
            <div className={styles.modeTabs}>
              <button
                className={`${styles.modeTab} ${editorMode === 'blocks' ? styles.modeTabActive : ''}`}
                onClick={() => setEditorMode('blocks')}
              >
                🧱 Блоки
              </button>
              <button
                className={`${styles.modeTab} ${editorMode === 'code' ? styles.modeTabActive : ''}`}
                onClick={() => setEditorMode('code')}
              >
                💻 Код
              </button>
            </div>
            {editorMode === 'code' && (
              <div className={styles.langTabs}>
                {(['js', 'py', 'cpp', 'java'] as Lang[]).map(l => (
                  <button
                    key={l}
                    className={`${styles.langTab} ${lang === l ? styles.langTabActive : ''}`}
                    onClick={() => handleLangChange(l)}
                    disabled={phase === 'animating'}
                  >
                    {LANG_LABELS[l]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.editorWrap}>
            {editorMode === 'blocks' ? (
              <BlockEditor
                onChange={setBlocksCode}
                showSkinSelector={false}
              />
            ) : (
              <CodeEditor
                value={code}
                language={lang === 'js' ? 'javascript' : lang === 'py' ? 'python' : lang === 'cpp' ? 'cpp' : 'java'}
                onChange={v => setCode(v ?? '')}
                readOnly={phase === 'animating'}
              />
            )}
          </div>

          {codeError && <div className={styles.codeError}>{codeError}</div>}

          <div className={styles.editorActions}>
            {phase === 'coding' && (
              <button className="btn btn-primary" onClick={handleRun} style={{ fontSize: 14 }}>
                ▶ Запустить бой
              </button>
            )}
            {phase === 'animating' && (
              <button className="btn btn-ghost" onClick={handleReset} style={{ fontSize: 13 }}>
                ⏹ Остановить
              </button>
            )}
            {phase === 'result' && (
              <div className={styles.resultActions}>
                <button className="btn btn-ghost" onClick={handleReset}>🔄 Попробовать снова</button>
                {winner === 1 && nextMission && (
                  <button className="btn btn-primary" onClick={() => navigate(`/learn/${nextMission.id}`)}>
                    Следующая миссия →
                  </button>
                )}
                {winner === 1 && !nextMission && (
                  <button className="btn btn-primary" onClick={() => navigate('/learn')}>
                    🏆 Все миссии пройдены!
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right — reference / battle */}
        <div className={styles.rightPane}>
          {phase === 'coding' && (
            <div className={styles.refPanel}>
              <div className={styles.refSection}>
                <div className={styles.refTitle}>Функция стратегии</div>
                <code className={styles.apiBlock}>
                  {editorMode === 'blocks'
                    ? '// Собери программу из блоков слева'
                    : lang === 'js'
                      ? 'function strategy(ctx) {\n  return "attack";\n}'
                      : lang === 'py'
                        ? 'def strategy(ctx):\n    return "attack"'
                        : lang === 'cpp'
                          ? 'std::string strategy(Ctx ctx) {\n  return "attack";\n}'
                          : 'public static String strategy(Ctx ctx) {\n  return "attack";\n}'
                  }
                </code>
              </div>

              {CTX_GROUPS.map(group => (
                <div key={group.title} className={styles.refSection}>
                  <div className={styles.refTitle}>{group.title}</div>
                  <div className={styles.chipGrid}>
                    {group.fields.map(f => (
                      <span key={f.name} className={styles.apiChip}
                        onMouseEnter={e => showTip(e, f.tip)} onMouseLeave={hideTip}>
                        {f.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              <div className={styles.refSection}>
                <div className={styles.refTitle}>⚔️ Действия</div>
                <div className={styles.chipGrid}>
                  {([
                    { fn: 'attack',  ru: 'Удар',      tip: '👊 12 урона, 10 стамины. Нет кулдауна.\n\nЛучше всего когда:\n• нет лучшего варианта\n• нужно сохранить стамину\n• хочешь накопить ярость\n\nПример:\nreturn "attack"; // надёжный базовый удар' },
                    { fn: 'heavy',   ru: 'Тяжёлый',   tip: '💥 28 урона, 35 стамины, КД 2 хода.\nПромахнётся если стамина < 35!\n\nЛучше всего когда:\n• стамина ≥ 35\n• враг не защищается\n• HP врага < 40 — добивай!\n\nПример:\nif (ctx.myStamina >= 35\n    && ctx.enemyHp < 40)\n  return "heavy";' },
                    { fn: 'laser',   ru: 'Лазер',     tip: '⚡ 20 урона, 20 стамины, КД 3 хода.\nРаботает с любой дистанции.\nDodge блокирует его в 50% случаев.\n\nЛучше всего когда:\n• враг ставит shield (лазер пробивает!)\n• ты далеко (far) — бонус к урону\n• кулдаун = 0\n\nПример:\nif (ctx.cooldowns.laser === 0\n    && ctx.enemyLastAction === "shield")\n  return "laser";' },
                    { fn: 'shield',  ru: 'Щит',       tip: '🛡️ Блокирует 60% входящего урона.\nВосстанавливает стамину.\n\nЛучше всего когда:\n• ждёшь heavy или special от врага\n• ярость врага ≥ 80\n• твоя стамина низкая — восстановишь\n\nПример:\nif (ctx.enemyRage >= 80) return "shield";\nif (ctx.enemyLastAction === "heavy")\n  return "shield";' },
                    { fn: 'dodge',   ru: 'Уклон',     tip: '💨 100% уклон от ближних атак.\n50% уклон от лазера.\nВосстанавливает стамину.\n\nЛучше всего когда:\n• враг часто бьёт attack/heavy\n• предсказываешь его удар\n\nПример:\nif (ctx.enemyLastAction === "attack")\n  return "dodge"; // скорее всего ударит снова\nif (ctx.predict(1) === "heavy")\n  return "dodge";' },
                    { fn: 'repair',  ru: 'Лечение',   tip: '💊 +20 HP. Нет кулдауна.\nТеряешь ход — враг бьёт бесплатно!\n\nЛучше всего когда:\n• HP < 30–35 — срочно лечись\n• враг поставил щит — он не атакует\n\nПример:\nif (ctx.myHp < 30) return "repair";\n// НЕ лечись при высоком HP — трата хода!' },
                    { fn: 'special', ru: 'Спецудар',  tip: '☄️ 50 урона! Требует ярость = 100.\nБез полной ярости — слабый удар.\n\nЛучше всего когда:\n• myRage = 100 — обязательно!\n• enemyHp < 55 — может добить сразу\n\nПример:\nif (ctx.myRage >= 100) return "special";\n// НИКОГДА не используй без 100 rage!' },
                  ] as const).map(({ fn, ru, tip }) => (
                    <span key={fn} className={`${styles.apiChip} ${styles.actionChip}`}
                      onMouseEnter={e => showTip(e, tip)} onMouseLeave={hideTip}>
                      {ACTION_ICON[fn]} {ru}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(phase === 'animating' || phase === 'result') && (
            <div className={styles.battlePane}>
              <div className={styles.statsSection}>
                <div className={styles.statsCol}>
                  <div className={styles.statsLabel}>🧑‍💻 Ты</div>
                  <StatBar value={displayTurn?.p1HpAfter ?? MAX_HP} max={MAX_HP} color="#4ade80" lowColor="#f87171" label={`${displayTurn?.p1HpAfter ?? MAX_HP} HP`} />
                  <StatBar value={displayTurn?.p1Stamina ?? MAX_STAMINA} max={MAX_STAMINA} color="#60a5fa" label={`${displayTurn?.p1Stamina ?? MAX_STAMINA} STA`} />
                  <RageBar value={displayTurn?.p1Rage ?? 0} max={MAX_RAGE} />
                </div>
                <div className={styles.statsMid}>
                  <span className={styles.scoreNum}>{score[0]}</span>
                  <span className={styles.scoreDash}>–</span>
                  <span className={styles.scoreNum}>{score[1]}</span>
                </div>
                <div className={styles.statsCol} style={{ alignItems: 'flex-end' }}>
                  <div className={styles.statsLabel}>{SKIN_ICON[mission.opponentSkin]} {mission.opponentName}</div>
                  <StatBar value={displayTurn?.p2HpAfter ?? MAX_HP} max={MAX_HP} color="#4ade80" lowColor="#f87171" label={`${displayTurn?.p2HpAfter ?? MAX_HP} HP`} flip />
                  <StatBar value={displayTurn?.p2Stamina ?? MAX_STAMINA} max={MAX_STAMINA} color="#60a5fa" label={`${displayTurn?.p2Stamina ?? MAX_STAMINA} STA`} flip />
                  <RageBar value={displayTurn?.p2Rage ?? 0} max={MAX_RAGE} flip />
                </div>
              </div>

              {displayTurn && phase === 'animating' && (
                <div className={styles.turnDisplay}>
                  <TurnCard label="Ты" action={displayTurn.p1Action} dmg={displayTurn.p1DmgTaken} heal={displayTurn.p1Heal} />
                  <span className={styles.turnVs}>⚡</span>
                  <TurnCard label={mission.opponentName} action={displayTurn.p2Action} dmg={displayTurn.p2DmgTaken} heal={displayTurn.p2Heal} />
                </div>
              )}

              <div className={styles.turnLog}>
                {rounds.flatMap(r => r.turns).slice(-10).reverse().map(t => (
                  <div key={`${t.turn}`} className={styles.logRow}>
                    <span className={styles.logTurn}>#{t.turn}</span>
                    <span className={styles.logAction}>{ACTION_ICON[t.p1Action] ?? '?'} {t.p1Action}</span>
                    {t.p2DmgTaken > 0 && <span className={styles.logDmg}>-{t.p2DmgTaken}</span>}
                    {t.p2DmgTaken === 0 && !['shield','dodge','repair'].includes(t.p1Action) && <span className={styles.logMiss}>MISS</span>}
                    <span className={styles.logVs}>|</span>
                    <span className={styles.logAction}>{ACTION_ICON[t.p2Action] ?? '?'} {t.p2Action}</span>
                    {t.p1DmgTaken > 0 && <span className={styles.logDmg}>-{t.p1DmgTaken}</span>}
                    {t.p1DmgTaken === 0 && !['shield','dodge','repair'].includes(t.p2Action) && <span className={styles.logMiss}>MISS</span>}
                  </div>
                ))}
              </div>

              {phase === 'result' && (
                <div className={`${styles.resultBanner} ${winner === 1 ? styles.bannerWin : winner === 2 ? styles.bannerLose : styles.bannerDraw}`}>
                  {winner === 1 ? '🏆 ПОБЕДА!' : winner === 2 ? '💀 ПОРАЖЕНИЕ' : '🤝 НИЧЬЯ'}
                  <div className={styles.resultSub}>
                    {winner === 1 ? 'Отличная стратегия!' : 'Измени стратегию и попробуй ещё раз!'}
                  </div>
                </div>
              )}

              {phase === 'result' && matchAnalysis && (
                <div className={styles.miniAnalysis}>
                  <div className={styles.miniAnalysisTitle}>🔬 Анализ стратегии</div>
                  <div className={styles.miniTopRow}>
                    <div className={styles.miniEffBox}>
                      <span className={styles.miniEffVal} style={{ color: '#00e5ff' }}>{matchAnalysis.p1.efficiencyScore}</span>
                      <span className={styles.miniEffLabel}>эффективность</span>
                    </div>
                    <div className={styles.miniStyleBox}>{matchAnalysis.p1.detectedStyle}</div>
                    <div className={styles.miniDmgBox}>
                      <span className={styles.miniDmgVal} style={{ color: '#f87171' }}>{matchAnalysis.p1.damageDealt}</span>
                      <span className={styles.miniEffLabel}>урона нанесено</span>
                    </div>
                  </div>
                  <div className={styles.miniActions}>
                    {matchAnalysis.p1.actions.slice(0, 5).map(a => (
                      <div key={a.action} className={styles.miniActionRow}>
                        <span className={styles.miniActionLabel} style={{ color: ACTION_COLOR[a.action] }}>{ACTION_LABEL[a.action]}</span>
                        <div className={styles.miniActionTrack}>
                          <div className={styles.miniActionFill} style={{ width: `${a.pct}%`, background: ACTION_COLOR[a.action] }} />
                        </div>
                        <span className={styles.miniActionPct}>{a.pct}%</span>
                      </div>
                    ))}
                  </div>
                  <div className={styles.miniRecs}>
                    {matchAnalysis.p1.recommendations.map((r, i) => (
                      <div key={i} className={styles.miniRecItem}>{r}</div>
                    ))}
                  </div>
                  {graphEvals.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div className={styles.miniAnalysisTitle}>🧠 Граф решений</div>
                      <DecisionGraph evals={graphEvals} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBar({ value, max, color, lowColor, label, flip }: {
  value: number; max: number; color: string; lowColor?: string; label: string; flip?: boolean
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const fill = lowColor ? (pct > 50 ? color : pct > 25 ? '#facc15' : lowColor) : color
  return (
    <div className={styles.statRow} style={{ flexDirection: flip ? 'row-reverse' : 'row' }}>
      <span className={styles.statLabel}>{label}</span>
      <div className={styles.statTrack}>
        <div className={styles.statFill} style={{ width: `${pct}%`, background: fill, marginLeft: flip ? 'auto' : undefined }} />
      </div>
    </div>
  )
}

function RageBar({ value, max, flip }: { value: number; max: number; flip?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const ready = pct >= 100
  return (
    <div className={styles.statRow} style={{ flexDirection: flip ? 'row-reverse' : 'row' }}>
      <span className={styles.statLabel} style={{ color: ready ? '#f97316' : undefined }}>
        {ready ? '☄️ RAGE!' : `${Math.round(value)} RAGE`}
      </span>
      <div className={styles.statTrack}>
        <div className={styles.statFill} style={{ width: `${pct}%`, background: ready ? '#f97316' : '#a855f7', marginLeft: flip ? 'auto' : undefined, boxShadow: ready ? '0 0 8px #f97316' : undefined }} />
      </div>
    </div>
  )
}

function TurnCard({ label, action, dmg, heal }: { label: string; action: string; dmg: number; heal: number }) {
  return (
    <div className={styles.turnCard}>
      <div className={styles.turnLabel}>{label}</div>
      <div className={styles.turnIcon}>{ACTION_ICON[action] ?? '❓'}</div>
      <div className={styles.turnAction}>{action}</div>
      {dmg > 0 && <div className={styles.turnDmg}>-{dmg} HP</div>}
      {heal > 0 && <div className={styles.turnHeal}>+{heal} HP</div>}
    </div>
  )
}
