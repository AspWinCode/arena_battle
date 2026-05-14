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
      { name: 'ctx.myHp',           tip: '❤️ Твои очки жизни (от 0 до 100).\nЕсли меньше 30 — лучше вылечись!\nПример: if (ctx.myHp < 30) return "repair";' },
      { name: 'ctx.myMaxHp',        tip: '❤️ Сколько HP у тебя максимум.\nОбычно 100, но зависит от персонажа.' },
      { name: 'ctx.myStamina',      tip: '⚡ Твоя выносливость (от 0 до 100).\nБез неё сильные удары слабее.\n• attack тратит 10\n• heavy тратит 35\n• laser тратит 25\nПример: if (ctx.myStamina < 35) return "attack";' },
      { name: 'ctx.myRage',         tip: '🔥 Твоя ярость (от 0 до 100).\nКопится когда получаешь удары.\nКогда 100 — жми special, он будет супер мощным!\nПример: if (ctx.myRage >= 100) return "special";' },
      { name: 'ctx.myLastAction',   tip: '↩️ Что ты делал в прошлом ходу.\nМожет быть "attack", "heavy", "dodge" и т.д.\nПример: if (ctx.myLastAction === "shield") return "attack";' },
      { name: 'ctx.myRepeatCount',  tip: '🔁 Сколько раз подряд ты делаешь одно и то же.\nПосле 2 повторов — штраф к урону.\nСтарайся чередовать приёмы!\nПример: if (ctx.myRepeatCount >= 2) return "heavy";' },
      { name: 'ctx.myPosition',     tip: '📍 Твоя позиция на арене.\n"close" — вплотную (удары сильнее)\n"mid"   — середина\n"far"   — далеко (лазер сильнее)' },
    ],
  },
  {
    title: '🤖 Враг',
    fields: [
      { name: 'ctx.enemyHp',         tip: '💀 Очки жизни врага (от 0 до 100).\nЕсли меньше 25 — добей его тяжёлым ударом!\nПример: if (ctx.enemyHp < 25) return "heavy";' },
      { name: 'ctx.enemyMaxHp',       tip: '💀 Максимальный HP врага.' },
      { name: 'ctx.enemyStamina',     tip: '⚡ Выносливость врага.\nЕсли 0 — его удары намного слабее.\nМожно смело атаковать!\nПример: if (ctx.enemyStamina < 20) return "attack";' },
      { name: 'ctx.enemyRage',        tip: '🔥 Ярость врага.\nЕсли больше 80 — он скоро применит special!\nЛучше защититься.\nПример: if (ctx.enemyRage >= 80) return "shield";' },
      { name: 'ctx.enemyLastAction',  tip: '👁️ Что враг делал в прошлом ходу.\nСамое важное поле — предсказывай врага!\nПример: if (ctx.enemyLastAction === "laser") return "dodge";' },
      { name: 'ctx.enemyPosition',    tip: '📍 Позиция врага на арене.\n"close" — рядом\n"mid"   — середина\n"far"   — далеко' },
    ],
  },
  {
    title: '⏱️ Перезарядка',
    fields: [
      { name: 'ctx.cooldowns.heavy',   tip: '⏱️ Сколько ходов нельзя использовать heavy.\n0 — можно использовать прямо сейчас!\nПример: if (ctx.cooldowns.heavy === 0) return "heavy";' },
      { name: 'ctx.cooldowns.laser',   tip: '⏱️ Сколько ходов нельзя использовать laser.\n0 — готов к использованию.' },
      { name: 'ctx.cooldowns.shield',  tip: '⏱️ Сколько ходов нельзя использовать shield.\n0 — готов к использованию.' },
      { name: 'ctx.cooldowns.dodge',   tip: '⏱️ Сколько ходов нельзя использовать dodge.\n0 — готов к использованию.' },
      { name: 'ctx.cooldowns.repair',  tip: '⏱️ Сколько ходов нельзя использовать repair.\n0 — готов к использованию.' },
      { name: 'ctx.cooldowns.special', tip: '⏱️ Сколько ходов нельзя использовать special.\n0 — готов к использованию.' },
    ],
  },
  {
    title: '🎮 Бой',
    fields: [
      { name: 'ctx.turn',              tip: '🔢 Номер текущего хода (от 1 до 20).\nЕсли у обоих есть HP — после 20 ходов ничья.\nПример: if (ctx.turn > 15) return "heavy"; // давай дожимай!' },
      { name: 'ctx.distanceModifier',  tip: '📏 Бонус к урону от расстояния.\nОбычно около 1.0 — чаще всего можно игнорировать.' },
    ],
  },
  {
    title: '📜 История ходов',
    fields: [
      { name: 'ctx.myHistory',        tip: '📋 Список всех твоих ударов за раунд.\nНапример ["attack","attack","heavy"]\nПример: ctx.myHistory.length — сколько ходов сыграно.' },
      { name: 'ctx.enemyHistory',     tip: '📋 Список всех ударов врага.\nМожно найти его любимый приём!\nПример: ctx.enemyHistory.filter(a => a === "heavy").length' },
      { name: 'ctx.damageLog',        tip: '💥 Сколько урона ты нанёс на каждом ходу.\nНапример [12, 0, 18, 0]' },
      { name: 'ctx.damageTakenLog',   tip: '🩸 Сколько урона ты получил на каждом ходу.' },
      { name: 'ctx.myHpLog',          tip: '❤️ Твой HP после каждого хода.\nНапример [100, 88, 88, 70]' },
      { name: 'ctx.enemyHpLog',       tip: '💀 HP врага после каждого хода.' },
    ],
  },
  {
    title: '📊 Статистика врага',
    fields: [
      { name: 'ctx.enemyFrequency',   tip: '📊 Как часто враг использует каждый удар.\nНапример: { attack: 5, heavy: 2 }\nПример: if (ctx.enemyFrequency["heavy"] > 3) return "shield";' },
      { name: 'ctx.enemyPhase',       tip: '🎯 Стадия боя врага по его HP.\n"early" — у него много HP\n"mid"   — половина\n"late"  — мало, будет отчаянным!' },
      { name: 'ctx.enemyTrend',       tip: '📈 Стиль игры врага прямо сейчас.\n"aggressive" — атакует без остановки\n"defensive"  — в основном защищается\n"mixed"      — чередует' },
    ],
  },
  {
    title: '🧠 Для продвинутых',
    fields: [
      { name: 'ctx.simulate(a,b)',    tip: '🔮 Предсказывает что случится если ты сделаешь удар "a", а враг — "b".\nВозвращает: { myHpAfter, enemyHpAfter }\nПример:\nconst r = ctx.simulate("heavy","shield");\nif (r.enemyHpAfter < 10) return "heavy";' },
      { name: 'ctx.bestAction()',     tip: '🏆 Автоматически считает лучший удар.\nПросто вызови — и получи совет!\nПример: return ctx.bestAction();' },
      { name: 'ctx.predict(n)',       tip: '🔮 Угадывает следующий удар врага.\nВозвращает строку, например "heavy".\nПример:\nif (ctx.predict(1) === "laser") return "dodge";' },
    ],
  },
]

type Phase = 'coding' | 'animating' | 'result'
type EditorMode = 'blocks' | 'code'

export default function LearningBattlePage() {
  const { missionId } = useParams<{ missionId: string }>()
  const navigate = useNavigate()
  const { completesMission, incrementAttempt } = useLearnStore()
  const recordBattle = useDailyStore(s => s.recordBattle)

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

  return (
    <div className={styles.root}>
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
                      <span key={f.name} className={styles.apiChip} data-tip={f.tip}>
                        {f.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              <div className={styles.refSection}>
                <div className={styles.refTitle}>⚔️ Действия</div>
                <div className={styles.chipGrid}>
                  {(['attack', 'heavy', 'laser', 'shield', 'dodge', 'repair', 'special'] as const).map(fn => (
                    <span key={fn} className={`${styles.apiChip} ${styles.actionChip}`}>
                      {ACTION_ICON[fn]} {fn}
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
