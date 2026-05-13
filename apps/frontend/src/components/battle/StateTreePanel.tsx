import { useState, useMemo } from 'react'
import type { ActionName, RoundResult } from '@robocode/shared'
import { ACTION_ICON, ACTION_LABEL, ACTION_COLOR } from '../../engine/matchAnalysis'
import styles from './StateTreePanel.module.css'

// ── Simplified damage model (mirrors engine logic, no character passives) ─────

const BASE_DMG: Record<string, number> = {
  attack: 12, heavy: 28, laser: 20, special: 50,
  combo: 12,  shield: 0, dodge: 0,  repair: 0,
}

const MELEE = new Set(['attack', 'heavy', 'combo'])

function simVs(myAct: string, hisAct: string) {
  let myDmg  = BASE_DMG[myAct]  ?? 0
  let hisDmg = BASE_DMG[hisAct] ?? 0

  if (hisAct === 'shield')                  myDmg  = Math.round(myDmg  * 0.4)
  if (hisAct === 'dodge' && MELEE.has(myAct))  myDmg  = 0
  if (myAct  === 'shield')                  hisDmg = Math.round(hisDmg * 0.4)
  if (myAct  === 'dodge' && MELEE.has(hisAct)) hisDmg = 0

  return { dmgDealt: myDmg, dmgTaken: hisDmg, net: myDmg - hisDmg }
}

const CORE: ActionName[] = [
  'attack', 'heavy', 'laser', 'shield', 'dodge', 'repair', 'special', 'combo',
]

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  rounds: RoundResult[]
  slot: 1 | 2
}

export default function StateTreePanel({ rounds, slot }: Props) {
  const allTurns = useMemo(() => rounds.flatMap(r => r.turns), [rounds])
  const [idx, setIdx] = useState(0)

  if (allTurns.length === 0) {
    return <div className={styles.empty}>Нет данных</div>
  }

  const turn      = allTurns[Math.min(idx, allTurns.length - 1)]
  const myAction  = (slot === 1 ? turn.p1Action : turn.p2Action) as ActionName
  const hisAction = (slot === 1 ? turn.p2Action : turn.p1Action) as ActionName

  const rows = CORE.map(act => {
    const { dmgDealt, dmgTaken, net } = simVs(act, hisAction)
    return { act, dmgDealt, dmgTaken, net }
  }).sort((a, b) => b.net - a.net)

  const maxDmg = Math.max(...rows.map(r => Math.max(r.dmgDealt, r.dmgTaken)), 1)

  return (
    <div className={styles.root}>

      {/* Turn slider */}
      <div className={styles.sliderRow}>
        <span className={styles.sliderLabel}>Ход {turn.turn}</span>
        <input
          type="range"
          min={0}
          max={allTurns.length - 1}
          value={idx}
          onChange={e => setIdx(Number(e.target.value))}
          className={styles.range}
        />
        <span className={styles.sliderLabel}>{allTurns.length}</span>
      </div>

      {/* Context */}
      <div className={styles.context}>
        <span>
          Враг сыграл:{' '}
          <span className={styles.hisBadge} style={{ color: ACTION_COLOR[hisAction] }}>
            {ACTION_ICON[hisAction]} {ACTION_LABEL[hisAction]}
          </span>
        </span>
        <span>
          Ты сыграл:{' '}
          <span className={styles.myBadge} style={{ color: ACTION_COLOR[myAction] }}>
            {ACTION_ICON[myAction]} {ACTION_LABEL[myAction]}
          </span>
        </span>
      </div>

      {/* Header */}
      <div className={styles.header}>
        <span>Действие</span>
        <span>Урон врагу</span>
        <span>Урон тебе</span>
        <span>Итог</span>
      </div>

      {/* Rows */}
      <div className={styles.rows}>
        {rows.map(({ act, dmgDealt, dmgTaken, net }, i) => {
          const isOptimal = i === 0
          const isChosen  = act === myAction
          const rowClass  = [
            styles.row,
            isOptimal && isChosen ? styles.rowBoth :
            isOptimal ? styles.rowOptimal :
            isChosen  ? styles.rowChosen  : '',
          ].filter(Boolean).join(' ')

          return (
            <div key={act} className={rowClass}>
              {/* Action name */}
              <span className={styles.actionName} style={{ color: ACTION_COLOR[act] }}>
                {isOptimal && <span className={styles.starBadge}>★</span>}
                {isChosen  && <span className={styles.arrowBadge}>▶</span>}
                {ACTION_ICON[act]}
                <span className={styles.actionLabel}>{ACTION_LABEL[act]}</span>
              </span>

              {/* Damage dealt bar */}
              <span className={styles.barCell}>
                <div className={styles.track}>
                  <div
                    className={styles.barGreen}
                    style={{ width: `${(dmgDealt / maxDmg) * 100}%` }}
                  />
                </div>
                <span className={styles.valGreen}>+{dmgDealt}</span>
              </span>

              {/* Damage taken bar */}
              <span className={styles.barCell}>
                <div className={styles.track}>
                  <div
                    className={styles.barRed}
                    style={{ width: `${(dmgTaken / maxDmg) * 100}%` }}
                  />
                </div>
                <span className={styles.valRed}>-{dmgTaken}</span>
              </span>

              {/* Net score */}
              <span
                className={styles.net}
                style={{ color: net > 0 ? '#4ade80' : net < 0 ? '#f87171' : '#94a3b8' }}
              >
                {net > 0 ? `+${net}` : net}
              </span>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <span><span className={styles.starBadge}>★</span> оптимальный</span>
        <span><span className={styles.arrowBadge}>▶</span> твой выбор</span>
        <span style={{ color: '#fbbf24' }}>★▶ оба совпадают</span>
      </div>
    </div>
  )
}
