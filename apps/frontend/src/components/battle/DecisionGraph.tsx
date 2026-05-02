import { useState } from 'react'
import type { TurnEval, TurnRating } from '../../engine/matchAnalysis'
import { ACTION_ICON, ACTION_LABEL, ACTION_COLOR } from '../../engine/matchAnalysis'
import styles from './DecisionGraph.module.css'

const RATING_COLOR: Record<TurnRating, string> = {
  good: '#4ade80',
  ok:   '#fbbf24',
  bad:  '#f87171',
}

const RATING_LABEL: Record<TurnRating, string> = {
  good: 'Отлично',
  ok:   'Нейтрально',
  bad:  'Ошибка',
}

const RATING_ICON: Record<TurnRating, string> = {
  good: '✅',
  ok:   '🟡',
  bad:  '❌',
}

export default function DecisionGraph({ evals }: { evals: TurnEval[] }) {
  const [selected, setSelected] = useState<TurnEval | null>(null)

  if (!evals.length) {
    return <div className={styles.empty}>Нет данных для анализа</div>
  }

  const goodCount = evals.filter(e => e.rating === 'good').length
  const badCount  = evals.filter(e => e.rating === 'bad').length
  const okCount   = evals.filter(e => e.rating === 'ok').length
  const score     = Math.round((goodCount / evals.length) * 100)

  return (
    <div className={styles.root}>
      {/* Summary row */}
      <div className={styles.summary}>
        <span style={{ color: RATING_COLOR.good }}>✅ {goodCount} отл.</span>
        <span style={{ color: RATING_COLOR.ok }}>🟡 {okCount} норм.</span>
        <span style={{ color: RATING_COLOR.bad }}>❌ {badCount} ош.</span>
        <span className={styles.scoreChip} style={{ color: score >= 60 ? RATING_COLOR.good : score >= 35 ? RATING_COLOR.ok : RATING_COLOR.bad }}>
          {score}% качество
        </span>
      </div>

      {/* Node row */}
      <div className={styles.nodesWrap}>
        <div className={styles.nodes}>
          {evals.map(ev => (
            <button
              key={ev.turn}
              className={`${styles.node} ${selected?.turn === ev.turn ? styles.nodeSelected : ''}`}
              style={{ '--rc': RATING_COLOR[ev.rating] } as React.CSSProperties}
              onClick={() => setSelected(selected?.turn === ev.turn ? null : ev)}
              aria-label={`Ход ${ev.turn}: ${ev.rating}`}
            >
              <span className={styles.nodeIcon}>{ACTION_ICON[ev.action]}</span>
              <span className={styles.nodeTurn}>{ev.turn}</span>
            </button>
          ))}
        </div>

        {/* Connector rail */}
        <div className={styles.rail}>
          {evals.map((ev, i) => (
            <div key={ev.turn} className={styles.railCell}>
              <div className={styles.dot} style={{ background: RATING_COLOR[ev.rating] }} />
              {i < evals.length - 1 && <div className={styles.railLine} />}
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selected ? (
        <div
          className={styles.detail}
          style={{ '--dc': RATING_COLOR[selected.rating] } as React.CSSProperties}
        >
          <div className={styles.detailHeader}>
            <span className={styles.detailTurnNum}>Ход {selected.turn}</span>
            <span className={styles.detailAction} style={{ color: ACTION_COLOR[selected.action] }}>
              {ACTION_ICON[selected.action]} {ACTION_LABEL[selected.action]}
            </span>
            <span className={styles.detailRating} style={{ color: RATING_COLOR[selected.rating] }}>
              {RATING_ICON[selected.rating]} {RATING_LABEL[selected.rating]}
            </span>
          </div>
          <div className={styles.detailReason}>{selected.reason}</div>
          <div className={styles.detailStats}>
            <div className={styles.detailStat}>
              <span className={styles.detailStatVal} style={{ color: '#f87171' }}>
                {selected.dmgDealt}
              </span>
              <span className={styles.detailStatKey}>урон</span>
            </div>
            <div className={styles.detailStat}>
              <span className={styles.detailStatVal} style={{ color: '#94a3b8' }}>
                {selected.dmgTaken}
              </span>
              <span className={styles.detailStatKey}>получено</span>
            </div>
            <div className={styles.detailStat}>
              <span className={styles.detailStatVal} style={{ color: '#fbbf24' }}>
                {selected.staminaBefore}
              </span>
              <span className={styles.detailStatKey}>stamina</span>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.hint}>
          👆 Нажми на ход чтобы увидеть анализ решения
        </div>
      )}

      {/* Legend */}
      <div className={styles.legend}>
        {(['good', 'ok', 'bad'] as TurnRating[]).map(r => (
          <span key={r} className={styles.legendItem} style={{ color: RATING_COLOR[r] }}>
            ● {RATING_LABEL[r]}
          </span>
        ))}
      </div>
    </div>
  )
}
