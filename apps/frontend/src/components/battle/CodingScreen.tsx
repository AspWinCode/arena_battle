import { useState, useEffect } from 'react'
import type { Lang } from '@robocode/shared'
import { useBattleStore } from '../../stores/battleStore'
import CodeEditor from '../CodeEditor/CodeEditor'
import BlockEditor from '../BlockEditor/BlockEditor'
import styles from './CodingScreen.module.css'

const LANG_LABELS: Record<Lang, string> = {
  js: 'JavaScript', py: 'Python', cpp: 'C++', java: 'Java', auto: 'Auto',
}

const DEFAULT_TEMPLATES: Record<string, string> = {
  js: `// JavaScript strategy — вызывается каждый ход
// ctx: { myHp, myStamina, myRage, enemyHp, enemyStamina, enemyRage,
//        myLastAction, enemyLastAction, cooldowns, myPosition,
//        enemyPosition, distanceModifier, myRepeatCount, turn }
// Верни строку: 'attack'|'heavy'|'laser'|'shield'|'dodge'|'repair'|'special'

function strategy(ctx) {
  if (ctx.myRage >= 100) return 'special';
  if (ctx.myHp < 30) return 'repair';
  if (ctx.enemyLastAction === 'laser') return 'dodge';
  if (ctx.enemyHp < 25) return 'heavy';
  if (ctx.cooldowns.heavy === 0 && ctx.myStamina >= 35) return 'heavy';
  return 'attack';
}`,

  py: `# Python strategy — вызывается каждый ход
# ctx.my_hp, ctx.my_stamina, ctx.my_rage
# ctx.enemy_hp, ctx.enemy_stamina, ctx.enemy_rage
# ctx.my_last_action, ctx.enemy_last_action
# ctx.cooldowns  — dict: 'heavy', 'laser', 'shield', 'dodge', 'repair', 'special'
# ctx.my_position, ctx.enemy_position  ('close'|'mid'|'far')
# ctx.distance_modifier, ctx.my_repeat_count, ctx.turn
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
    if ctx.cooldowns['heavy'] == 0 and ctx.my_stamina >= 35:
        return 'heavy'
    return 'attack'`,

  cpp: `// C++ strategy (coming soon)
// Return one of: attack heavy laser shield dodge repair special
std::string strategy(const Ctx& ctx) {
    if (ctx.myRage >= 100) return "special";
    if (ctx.myHp < 30) return "repair";
    if (ctx.enemyLastAction == "laser") return "dodge";
    return "attack";
}`,

  java: `// Java strategy (coming soon)
// Return one of: attack heavy laser shield dodge repair special
public static String strategy(Ctx ctx) {
    if (ctx.myRage >= 100) return "special";
    if (ctx.myHp < 30) return "repair";
    if ("laser".equals(ctx.enemyLastAction)) return "dodge";
    return "attack";
}`,
}

interface InterRoundInfo {
  score: [number, number]
  nextRound: number
}

export default function CodingScreen({
  onReady,
  interRound,
}: {
  onReady: (code: string, lang: Lang) => void
  interRound?: InterRoundInfo
}) {
  const sessionLevel = useBattleStore(s => s.sessionLevel)
  const timeLeft = useBattleStore(s => s.timeLeft)
  const code = useBattleStore(s => s.code)
  const lang = useBattleStore(s => s.lang)
  const setCode = useBattleStore(s => s.setCode)
  const setLang = useBattleStore(s => s.setLang)
  const slot = useBattleStore(s => s.slot)
  const p1 = useBattleStore(s => s.p1)
  const p2 = useBattleStore(s => s.p2)
  const compileError = useBattleStore(s => s.compileError)
  const myInfo = slot === 1 ? p1 : p2
  const opponentInfo = slot === 1 ? p2 : p1

  const [submitted, setSubmitted] = useState(false)

  // If a compile error arrives, reset submitted so user can fix code
  useEffect(() => {
    if (compileError) setSubmitted(false)
  }, [compileError])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const isUrgent = timeLeft < 60

  const handleReady = () => {
    if (!currentCode.trim()) return
    setSubmitted(true)
    onReady(currentCode, lang)
  }

  const currentCode = code || DEFAULT_TEMPLATES[lang] || ''

  if (sessionLevel === 'blocks') {
    return (
      <div className={styles.root} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {interRound && (
          <InterRoundBanner score={interRound.score} nextRound={interRound.nextRound} />
        )}
        {/* Header (same as text editor) */}
        <div className={styles.header}>
          <div className={styles.players}>
            <span>{myInfo?.skin === 'robot' ? '🤖' : myInfo?.skin === 'gladiator' ? '⚔️' : myInfo?.skin === 'boxer' ? '🥊' : '🚀'} {myInfo?.name ?? 'Ты'}</span>
            <span className={styles.vs}>VS</span>
            <span>{opponentInfo ? `${opponentInfo.skin === 'robot' ? '🤖' : opponentInfo.skin === 'gladiator' ? '⚔️' : opponentInfo.skin === 'boxer' ? '🥊' : '🚀'} ${opponentInfo.name}` : '⏳ Ожидание...'}</span>
          </div>
          <div className={`${styles.timer} ${isUrgent ? styles.timerUrgent : ''}`}>
            ⏱ {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
          <div className={styles.actions}>
            <button
              className={`btn btn-primary ${styles.readyBtn}`}
              onClick={handleReady}
              disabled={submitted || !currentCode.trim()}
            >
              {submitted ? (
                <>✅ {opponentInfo?.ready ? 'Оба готовы!' : 'Ожидаем противника...'}</>
              ) : (
                '⚔️ ГОТОВ К БОЮ'
              )}
            </button>
          </div>
        </div>
        {/* Compile error banner */}
        {compileError && <CompileErrorBanner message={compileError} />}
        {/* Block Editor fills remaining space */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <BlockEditor
            onChange={v => setCode(v)}
            skin={myInfo?.skin ?? 'robot'}
            onSkinChange={() => {}}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      {interRound && (
        <InterRoundBanner score={interRound.score} nextRound={interRound.nextRound} />
      )}
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.players}>
          <span>{myInfo?.skin === 'robot' ? '🤖' : myInfo?.skin === 'gladiator' ? '⚔️' : myInfo?.skin === 'boxer' ? '🥊' : '🚀'} {myInfo?.name ?? 'Ты'}</span>
          <span className={styles.vs}>VS</span>
          <span>{opponentInfo ? `${opponentInfo.skin === 'robot' ? '🤖' : opponentInfo.skin === 'gladiator' ? '⚔️' : opponentInfo.skin === 'boxer' ? '🥊' : '🚀'} ${opponentInfo.name}` : '⏳ Ожидание...'}</span>
        </div>

        <div className={`${styles.timer} ${isUrgent ? styles.timerUrgent : ''}`}>
          ⏱ {minutes}:{seconds.toString().padStart(2, '0')}
        </div>

        <div className={styles.actions}>
          <select
            className={styles.langSelect}
            value={lang}
            onChange={e => {
              setLang(e.target.value as Lang)
              setCode('')
            }}
            disabled={submitted}
          >
            {(['js', 'py', 'cpp', 'java'] as Lang[]).map(l => (
              <option key={l} value={l}>{LANG_LABELS[l]}</option>
            ))}
          </select>

          <button
            className={`btn btn-primary ${styles.readyBtn}`}
            onClick={handleReady}
            disabled={submitted}
          >
            {submitted ? (
              <>✅ {opponentInfo?.ready ? 'Оба готовы!' : 'Ожидаем противника...'}</>
            ) : (
              '⚔️ ГОТОВ К БОЮ'
            )}
          </button>
        </div>
      </div>

      {/* Compile error banner */}
      {compileError && <CompileErrorBanner message={compileError} />}

      {/* Editor */}
      <div className={styles.editorWrap}>
        <CodeEditor
          value={currentCode}
          language={lang === 'py' ? 'python' : lang === 'cpp' ? 'cpp' : lang === 'java' ? 'java' : 'javascript'}
          onChange={v => setCode(v ?? '')}
          readOnly={submitted}
        />
      </div>

      {/* API Reference */}
      <div className={styles.apiRef}>
        <span className={styles.apiTitle}>actions:</span>
        {['attack', 'heavy', 'laser', 'shield', 'dodge', 'repair', 'special'].map(fn => (
          <code key={fn} className={styles.apiChip}>{fn}</code>
        ))}
        <span className={styles.apiSep}>|</span>
        <span className={styles.apiTitle}>ctx:</span>
        {['myHp', 'myStamina', 'myRage', 'enemyHp', 'cooldowns', 'myPosition', 'distanceModifier'].map(p => (
          <code key={p} className={styles.apiChip}>{p}</code>
        ))}
      </div>
    </div>
  )
}

function InterRoundBanner({ score, nextRound }: { score: [number, number]; nextRound: number }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(124,58,237,.15), rgba(0,229,255,.1))',
      borderBottom: '1px solid rgba(124,58,237,.3)',
      padding: '10px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 20,
    }}>
      <span style={{ fontSize: 18, fontWeight: 900, color: '#a78bfa' }}>
        ⚔️ Раунд {nextRound - 1} завершён
      </span>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(0,0,0,.3)', borderRadius: 8, padding: '4px 16px',
        fontSize: 20, fontWeight: 900,
      }}>
        <span style={{ color: score[0] > score[1] ? '#4ade80' : '#e2e8f0' }}>{score[0]}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>:</span>
        <span style={{ color: score[1] > score[0] ? '#4ade80' : '#e2e8f0' }}>{score[1]}</span>
      </div>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        → Обнови стратегию и нажми <strong style={{ color: '#e2e8f0' }}>«Готов к бою»</strong>
      </span>
    </div>
  )
}

function CompileErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      background: 'rgba(239,68,68,.15)',
      borderBottom: '1px solid rgba(239,68,68,.4)',
      padding: '10px 24px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>❌</span>
      <div>
        <div style={{ fontWeight: 700, color: '#f87171', marginBottom: 4 }}>
          Ошибка компиляции — исправь код и нажми «Готов к бою» снова
        </div>
        <pre style={{
          margin: 0, fontSize: 12, color: '#fca5a5',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          fontFamily: 'monospace',
        }}>{message}</pre>
      </div>
    </div>
  )
}
