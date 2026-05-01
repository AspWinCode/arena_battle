import { useState, useMemo } from 'react'
import { useBattleStore } from '../../stores/battleStore'
import { analyzeMatch, ACTION_LABEL, ACTION_COLOR } from '../../engine/matchAnalysis'
import type { HpPoint, PlayerAnalysis } from '../../engine/matchAnalysis'
import type { ActionName } from '@robocode/shared'
import styles from './ResultScreen.module.css'

const SKIN_ICONS: Record<string, string> = {
  robot: '🤖', gladiator: '⚔️', boxer: '🥊', cosmonaut: '🚀',
}

// ── HP Timeline SVG ───────────────────────────────────────────────────────────

function HpTimeline({ points, p1Color, p2Color }: {
  points: HpPoint[]
  p1Color: string
  p2Color: string
}) {
  const W = 280, H = 72, PAD = 4
  const maxTurn = Math.max(...points.map(p => p.turn), 1)

  const toX = (t: number) => PAD + (t / maxTurn) * (W - PAD * 2)
  const toY = (hp: number) => H - PAD - (hp / 100) * (H - PAD * 2)

  const path = (key: 'p1Hp' | 'p2Hp') =>
    points.map((p, i) =>
      `${i === 0 ? 'M' : 'L'} ${toX(p.turn).toFixed(1)} ${toY(p[key]).toFixed(1)}`
    ).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className={styles.timeline}>
      {/* Grid */}
      {[25, 50, 75].map(hp => (
        <line key={hp}
          x1={PAD} y1={toY(hp)} x2={W - PAD} y2={toY(hp)}
          stroke="#ffffff" strokeOpacity="0.05" strokeWidth={1}
          strokeDasharray="3 3"
        />
      ))}
      {/* 50 HP marker */}
      <line x1={PAD} y1={toY(50)} x2={W - PAD} y2={toY(50)}
        stroke="#ffffff" strokeOpacity="0.10" strokeWidth={1} />

      {/* Paths */}
      <path d={path('p1Hp')} fill="none" stroke={p1Color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={path('p2Hp')} fill="none" stroke={p2Color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* End dots */}
      {points.length > 0 && (() => {
        const last = points[points.length - 1]
        return <>
          <circle cx={toX(last.turn)} cy={toY(last.p1Hp)} r={3} fill={p1Color} />
          <circle cx={toX(last.turn)} cy={toY(last.p2Hp)} r={3} fill={p2Color} />
        </>
      })()}

      {/* Labels */}
      <text x={PAD + 2} y={10} fill="#94a3b8" fontSize={8}>100</text>
      <text x={PAD + 2} y={toY(50) + 3} fill="#94a3b8" fontSize={8}>50</text>
      <text x={PAD + 2} y={H - 2} fill="#94a3b8" fontSize={8}>0</text>
    </svg>
  )
}

// ── Action Breakdown (one player) ─────────────────────────────────────────────

function ActionBars({ analysis, flip = false }: { analysis: PlayerAnalysis; flip?: boolean }) {
  const top = analysis.actions.slice(0, 6)
  return (
    <div className={styles.actionBars}>
      {top.map(a => (
        <div key={a.action} className={`${styles.actionRow} ${flip ? styles.actionRowFlip : ''}`}>
          <span className={styles.actionLabel} style={{ color: ACTION_COLOR[a.action as ActionName] }}>
            {ACTION_LABEL[a.action as ActionName]}
          </span>
          <div className={styles.actionTrack}>
            <div
              className={styles.actionFill}
              style={{
                width: `${a.pct}%`,
                background: ACTION_COLOR[a.action as ActionName],
                float: flip ? 'right' : 'left',
              }}
            />
          </div>
          <span className={styles.actionPct}>{a.pct}%</span>
        </div>
      ))}
    </div>
  )
}

// ── Damage Stat Card ──────────────────────────────────────────────────────────

function DmgCard({ analysis, name, color }: { analysis: PlayerAnalysis; name: string; color: string }) {
  return (
    <div className={styles.dmgCard}>
      <div className={styles.dmgCardName} style={{ color }}>{name}</div>
      <div className={styles.dmgGrid}>
        <div className={styles.dmgItem}>
          <span className={styles.dmgVal} style={{ color: '#f87171' }}>{analysis.damageDealt}</span>
          <span className={styles.dmgKey}>урона нанесено</span>
        </div>
        <div className={styles.dmgItem}>
          <span className={styles.dmgVal} style={{ color: '#94a3b8' }}>{analysis.damageReceived}</span>
          <span className={styles.dmgKey}>урона получено</span>
        </div>
        <div className={styles.dmgItem}>
          <span className={styles.dmgVal} style={{ color: '#4ade80' }}>{analysis.healingDone}</span>
          <span className={styles.dmgKey}>HP восстановлено</span>
        </div>
        <div className={styles.dmgItem}>
          <span className={styles.dmgVal} style={{ color: '#fbbf24' }}>{analysis.specialCount}</span>
          <span className={styles.dmgKey}>Special активаций</span>
        </div>
      </div>
      <div className={styles.styleTag}>{analysis.detectedStyle}</div>
    </div>
  )
}

// ── Efficiency Ring ───────────────────────────────────────────────────────────

function EfficiencyRing({ score, color }: { score: number; color: string }) {
  const R = 28, C = 2 * Math.PI * R
  const filled = (score / 100) * C
  return (
    <div className={styles.ring}>
      <svg width={72} height={72} viewBox="0 0 72 72">
        <circle cx={36} cy={36} r={R} fill="none" stroke="#1e2035" strokeWidth={7} />
        <circle cx={36} cy={36} r={R} fill="none"
          stroke={color} strokeWidth={7}
          strokeDasharray={`${filled} ${C}`}
          strokeDashoffset={C / 4}
          strokeLinecap="round"
        />
        <text x={36} y={40} textAnchor="middle" fill={color} fontSize={15} fontWeight={800}>
          {score}
        </text>
      </svg>
      <div className={styles.ringLabel}>эффективность</div>
    </div>
  )
}

// ── Recommendations ───────────────────────────────────────────────────────────

function Recs({ recs, color }: { recs: string[]; color: string }) {
  return (
    <div className={styles.recs}>
      <div className={styles.recsTitle} style={{ color }}>Рекомендации</div>
      {recs.map((r, i) => (
        <div key={i} className={styles.recItem}>{r}</div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ResultScreen({ onPlayAgain }: { onPlayAgain: () => void }) {
  const p1             = useBattleStore(s => s.p1)
  const p2             = useBattleStore(s => s.p2)
  const matchWinner    = useBattleStore(s => s.matchWinner)
  const score          = useBattleStore(s => s.score)
  const completedRounds = useBattleStore(s => s.completedRounds)
  const slot           = useBattleStore(s => s.slot)

  const [tab, setTab] = useState<'result' | 'analysis'>('result')

  const analysis = useMemo(() => analyzeMatch(completedRounds), [completedRounds])

  const isWinner     = matchWinner !== null && matchWinner !== 0 && matchWinner === slot
  const isDraw       = matchWinner === 0
  const winnerPlayer = matchWinner === 1 ? p1 : matchWinner === 2 ? p2 : null

  const P1_COLOR = '#00e5ff'
  const P2_COLOR = '#f87171'

  return (
    <div className={styles.root}>
      <div className={styles.bg} />

      <div className={styles.container}>
        {/* Result badge */}
        <div className={`${styles.resultBadge} ${isWinner ? styles.win : isDraw ? styles.draw : styles.loss}`}>
          {isDraw ? '🤝 НИЧЬЯ' : isWinner ? '🏆 ПОБЕДА!' : '💀 ПОРАЖЕНИЕ'}
        </div>

        {!isDraw && winnerPlayer && (
          <div className={styles.winner}>
            <div className={styles.winnerIcon}>{SKIN_ICONS[winnerPlayer.skin ?? 'robot']}</div>
            <div className={styles.winnerName}>{winnerPlayer.name}</div>
            <div className={styles.winnerLabel}>победил в матче</div>
          </div>
        )}

        {/* Score */}
        <div className={styles.scoreRow}>
          <div className={styles.scorePlayer}>
            <span>{SKIN_ICONS[p1?.skin ?? 'robot']}</span>
            <span style={{ color: P1_COLOR }}>{p1?.name ?? 'P1'}</span>
          </div>
          <div className={styles.scoreBig}>
            <span className={matchWinner === 1 ? styles.scoreWin : ''}>{score[0]}</span>
            <span className={styles.scoreDash}>–</span>
            <span className={matchWinner === 2 ? styles.scoreWin : ''}>{score[1]}</span>
          </div>
          <div className={`${styles.scorePlayer} ${styles.scoreRight}`}>
            <span style={{ color: P2_COLOR }}>{p2?.name ?? 'P2'}</span>
            <span>{SKIN_ICONS[p2?.skin ?? 'robot']}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'result' ? styles.tabActive : ''}`}
            onClick={() => setTab('result')}
          >
            📊 Итог
          </button>
          <button
            className={`${styles.tab} ${tab === 'analysis' ? styles.tabActive : ''}`}
            onClick={() => setTab('analysis')}
          >
            🔬 Анализ
          </button>
        </div>

        {/* ── TAB: ИТОГ ─────────────────────────────────────────── */}
        {tab === 'result' && (
          <>
            {/* Rounds breakdown */}
            <div className={styles.rounds}>
              <div className={styles.roundsTitle}>Раунды</div>
              <div className={styles.roundsList}>
                {completedRounds.map(r => (
                  <div key={r.round} className={styles.roundRow}>
                    <span className={styles.roundLabel}>Раунд {r.round}</span>
                    <div className={styles.roundBars}>
                      <div
                        className={`${styles.roundBar} ${r.winner === 1 ? styles.roundBarWin : ''}`}
                        style={{ width: `${(r.p1Hp / 100) * 100}%`, background: r.winner === 1 ? P1_COLOR : undefined }}
                      />
                    </div>
                    <span className={`${styles.roundHp} ${r.winner === 1 ? styles.roundWinLabel : ''}`}
                      style={{ color: r.winner === 1 ? P1_COLOR : undefined }}>
                      {r.p1Hp} HP
                    </span>
                    <span className={styles.roundVs}>vs</span>
                    <span className={`${styles.roundHp} ${r.winner === 2 ? styles.roundWinLabel : ''}`}
                      style={{ color: r.winner === 2 ? P2_COLOR : undefined }}>
                      {r.p2Hp} HP
                    </span>
                    <div className={styles.roundBars}>
                      <div
                        className={`${styles.roundBar} ${styles.roundBarRight} ${r.winner === 2 ? styles.roundBarWin : ''}`}
                        style={{ width: `${(r.p2Hp / 100) * 100}%`, background: r.winner === 2 ? P2_COLOR : undefined }}
                      />
                    </div>
                    <span className={styles.roundWinner}>
                      {r.winner === 0 ? '🤝' : r.winner === 1 ? `🏆 ${p1?.name}` : `🏆 ${p2?.name}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick stats */}
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statValue}>{analysis.totalTurns}</span>
                <span className={styles.statLabel}>Ходов</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{analysis.totalDamage}</span>
                <span className={styles.statLabel}>Суммарный урон</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>{completedRounds.length}</span>
                <span className={styles.statLabel}>Раундов</span>
              </div>
            </div>
          </>
        )}

        {/* ── TAB: АНАЛИЗ ───────────────────────────────────────── */}
        {tab === 'analysis' && (
          <>
            {/* HP Timelines */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>📈 HP по ходам</div>
              <div className={styles.timelines}>
                {analysis.hpTimeline.map((pts, i) => (
                  <div key={i} className={styles.timelineWrap}>
                    <div className={styles.timelineLabel}>Раунд {i + 1}</div>
                    <HpTimeline points={pts} p1Color={P1_COLOR} p2Color={P2_COLOR} />
                    <div className={styles.timelineLegend}>
                      <span style={{ color: P1_COLOR }}>● {p1?.name ?? 'P1'}</span>
                      <span style={{ color: P2_COLOR }}>● {p2?.name ?? 'P2'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Efficiency */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>⚡ Эффективность</div>
              <div className={styles.effRow}>
                <div className={styles.effPlayer}>
                  <span style={{ color: P1_COLOR, fontWeight: 700 }}>{p1?.name ?? 'P1'}</span>
                  <EfficiencyRing score={analysis.p1.efficiencyScore} color={P1_COLOR} />
                </div>
                <div className={styles.effDivider} />
                <div className={styles.effPlayer}>
                  <span style={{ color: P2_COLOR, fontWeight: 700 }}>{p2?.name ?? 'P2'}</span>
                  <EfficiencyRing score={analysis.p2.efficiencyScore} color={P2_COLOR} />
                </div>
              </div>
            </div>

            {/* Action breakdown */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>🎮 Действия</div>
              <div className={styles.actionSplit}>
                <div className={styles.actionCol}>
                  <div className={styles.actionColName} style={{ color: P1_COLOR }}>{p1?.name ?? 'P1'}</div>
                  <ActionBars analysis={analysis.p1} />
                </div>
                <div className={styles.actionDivider} />
                <div className={styles.actionCol}>
                  <div className={styles.actionColName} style={{ color: P2_COLOR }}>{p2?.name ?? 'P2'}</div>
                  <ActionBars analysis={analysis.p2} flip />
                </div>
              </div>
            </div>

            {/* Damage cards */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>💥 Статистика урона</div>
              <div className={styles.dmgRow}>
                <DmgCard analysis={analysis.p1} name={p1?.name ?? 'P1'} color={P1_COLOR} />
                <DmgCard analysis={analysis.p2} name={p2?.name ?? 'P2'} color={P2_COLOR} />
              </div>
            </div>

            {/* Recommendations */}
            <div className={styles.recsRow}>
              <Recs recs={analysis.p1.recommendations} color={P1_COLOR} />
              <Recs recs={analysis.p2.recommendations} color={P2_COLOR} />
            </div>
          </>
        )}

        <button className={`btn btn-primary ${styles.btn}`} onClick={onPlayAgain}>
          ⚔️ Сыграть снова
        </button>
      </div>
    </div>
  )
}
