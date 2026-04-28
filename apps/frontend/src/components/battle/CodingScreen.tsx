import { useState } from 'react'
import type { Lang } from '@robocode/shared'
import { useBattleStore } from '../../stores/battleStore'
import CodeEditor from '../CodeEditor/CodeEditor'
import styles from './CodingScreen.module.css'

const LANG_LABELS: Record<Lang, string> = {
  js: 'JavaScript', py: 'Python', cpp: 'C++', java: 'Java', auto: 'Auto',
}

const DEFAULT_TEMPLATES: Record<string, string> = {
  js: `// JavaScript — функция вызывается каждый раунд
// enemy: { hp, lastAction, shieldActive, cooldowns }
// Вызови нужное действие и верни его:

function onRoundStart(enemy) {
  if (enemy.hp < 30) {
    return combo();
  }
  if (enemy.lastAction === 'laser') {
    return dodge('roll');
  }
  if (enemy.shieldActive) {
    return dodge('left');
  }
  return attack('hook');
}`,

  py: `# Python — функция вызывается каждый раунд
# enemy: объект с полями hp, last_action, shield_active, cooldowns

def on_round_start(enemy):
    if enemy.hp < 30:
        return combo()
    if enemy.last_action == 'laser':
        return dodge('roll')
    if enemy.shield_active:
        return dodge('left')
    return attack('hook')`,

  cpp: `// C++ — функция вызывается каждый раунд
Action onRoundStart(Enemy& enemy) {
    if (enemy.hp < 30) {
        return combo();
    }
    if (enemy.lastAction == "laser") {
        return dodge("roll");
    }
    return attack("hook");
}`,

  java: `// Java — метод вызывается каждый раунд
public static Object onRoundStart(Enemy enemy) {
    if (enemy.hp < 30) {
        return combo();
    }
    if (enemy.lastAction.equals("laser")) {
        return dodge("roll");
    }
    return attack("hook");
}`,
}

export default function CodingScreen({ onReady }: { onReady: (code: string, lang: Lang) => void }) {
  const sessionLevel = useBattleStore(s => s.sessionLevel)
  const timeLeft = useBattleStore(s => s.timeLeft)
  const code = useBattleStore(s => s.code)
  const lang = useBattleStore(s => s.lang)
  const setCode = useBattleStore(s => s.setCode)
  const setLang = useBattleStore(s => s.setLang)
  const slot = useBattleStore(s => s.slot)
  const p1 = useBattleStore(s => s.p1)
  const p2 = useBattleStore(s => s.p2)
  const myInfo = slot === 1 ? p1 : p2
  const opponentInfo = slot === 1 ? p2 : p1

  const [submitted, setSubmitted] = useState(false)

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
    return <div className={styles.root}>Блочный редактор (в разработке)</div>
  }

  return (
    <div className={styles.root}>
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
        <span className={styles.apiTitle}>API:</span>
        {['attack(type)', 'laser(power)', 'shield(dur)', 'dodge(dir)', 'combo()', 'repair(amt)'].map(fn => (
          <code key={fn} className={styles.apiChip}>{fn}</code>
        ))}
        <span className={styles.apiSep}>|</span>
        <span className={styles.apiTitle}>enemy:</span>
        {['enemy.hp', 'enemy.lastAction', 'enemy.shieldActive'].map(p => (
          <code key={p} className={styles.apiChip}>{p}</code>
        ))}
      </div>
    </div>
  )
}
