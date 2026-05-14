import { Link } from 'react-router-dom'
import { CHARACTER_STATS } from '@robocode/shared'
import { useCharacterThumbs } from '../hooks/useCharacterThumbs'
import { getPortraitUrl } from '../hooks/usePortraits'
import { useUserStore } from '../stores/userStore'
import styles from './LandingPage.module.css'

export default function LandingPage() {
  const thumbs = useCharacterThumbs()
  const { user } = useUserStore()
  const charEntries = Object.entries(CHARACTER_STATS)
  const rowA = charEntries
  const rowB = [...charEntries].reverse()
  const rowC = [...charEntries.slice(5), ...charEntries.slice(0, 5)]
  return (
    <div className={styles.page}>

      {/* ── Navbar ──────────────────────────────────────────────────── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.navLogo}>
            <img src="/logo.png" alt="CodeFighters" className={styles.navLogoImg} />
          </div>
          <div className={styles.navLinks}>
            <Link to="/tournaments" className={styles.navLink}>Турниры</Link>
            <Link to="/leaderboard" className={styles.navLink}>Рейтинг</Link>
            <Link to="/learn"       className={styles.navLink}>Обучение</Link>
            {user ? (
              <>
                <span className={styles.navLink} style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  {user.avatar?.startsWith('data:') || user.avatar?.startsWith('/')
                    ? <img src={user.avatar} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', verticalAlign: 'middle', marginRight: 6 }} alt="" />
                    : <span style={{ marginRight: 4 }}>{user.avatar}</span>}
                  {user.displayName}
                </span>
                <Link to="/profile" className={`btn btn-primary ${styles.navBtn}`}>В игру</Link>
              </>
            ) : (
              <>
                <Link to="/login"    className={styles.navLink}>Войти</Link>
                <Link to="/register" className={`btn btn-primary ${styles.navBtn}`}>Начать бесплатно</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden>
          <div className={styles.heroGrid} />
          <div className={styles.glow1} />
          <div className={styles.glow2} />
          <img src="/logo.png" className={styles.logoBgImg} aria-hidden />
        </div>

        <div className={styles.container}>
          <div className={styles.heroInner}>

            {/* Left */}
            <div className={styles.heroLeft}>
              <div className={styles.badge}>
                <span className={styles.badgeDot} />
                Программируй · Сражайся · Побеждай
              </div>

              <h1 className={styles.heroTitle}>
                Боевая арена<br />
                <span className={styles.heroGrad}>для программистов</span>
              </h1>

              <p className={styles.heroSub}>
                Пиши стратегии на Python или JavaScript, отправляй своего бойца
                в реальный бой и побеждай соперников. Идеально для тех, кто хочет
                учиться программируя, а не решая задачки.
              </p>

              <div className={styles.heroCta}>
                <Link to="/join"     className={`btn btn-primary ${styles.ctaMain}`}>⚔️ Начать бой</Link>
                <Link to="/demo"     className={`btn btn-ghost  ${styles.ctaGhost}`}>🎮 Демо без регистрации</Link>
              </div>

              <div className={styles.heroStats}>
                <Stat num="16"  label="персонажей" />
                <div className={styles.statDiv} />
                <Stat num="7"   label="действий" />
                <div className={styles.statDiv} />
                <Stat num="3"   label="языка" />
                <div className={styles.statDiv} />
                <Stat num="∞"   label="тактик" />
              </div>
            </div>

            {/* Right — arena preview */}
            <div className={styles.heroRight}>
              <div className={styles.arenaCard}>
                <div className={styles.arenaHead}>
                  <span className={styles.roundPill}>РАУНД 2</span>
                  <div className={styles.score}>
                    <span className={styles.scoreWin}>1</span>
                    <span className={styles.scoreSep}>–</span>
                    <span>0</span>
                  </div>
                </div>
                <div className={styles.fighters}>
                  <FighterPreview name="Скорпион" skin="🦂" hp={78} maxHp={90}  />
                  <div className={styles.vsChip}>VS</div>
                  <FighterPreview name="Ниндзя"   skin="🥷" hp={31} maxHp={75} flip />
                </div>
                <div className={styles.logWrap}>
                  <LogRow turn={9} p1="🦂 Удар"     p2="💨 Уклон" note="Захват! P2 −10HP" hot />
                  <LogRow turn={8} p1="⚡ Лазер"    p2="🛡 Щит"   note="P2 −8HP" />
                  <LogRow turn={7} p1="💥 Тяжёлый"  p2="💥 Тяжёлый" note="P1 −17HP | P2 −17HP" />
                </div>
              </div>

              <div className={styles.codeSnippet}>
                <div className={styles.snippetDots}><span/><span/><span/></div>
                <pre className={styles.snippetPre} dangerouslySetInnerHTML={{ __html:
`<span class="ck">def</span> <span class="cf">strategy</span>(ctx):
  <span class="cc"># Уклоняемся от захвата Скорпиона</span>
  <span class="ck">if</span> ctx.my_rage <span class="co">&gt;=</span> <span class="cn">100</span>:
    <span class="ck">return</span> <span class="cs">'special'</span>
  <span class="ck">if</span> ctx.my_hp <span class="co">&lt;</span> <span class="cn">25</span>:
    <span class="ck">return</span> <span class="cs">'repair'</span>
  <span class="ck">return</span> <span class="cs">'laser'</span>`
                }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Characters ──────────────────────────────────────────────── */}
      <section className={styles.chars}>
        <div className={styles.container}>
          <div className={styles.charsHead}>
            <div>
              <div className={styles.sectionLabel}>16 уникальных персонажей</div>
              <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Выбери своего бойца</h2>
            </div>
            <Link to="/join" className={`btn btn-ghost ${styles.charsLink}`}>Все персонажи →</Link>
          </div>
        </div>

        <div className={styles.charsMosaic}>
          <div className={styles.charsVignette} aria-hidden />
          {([
            { list: rowA, rev: false, cls: styles.rowTall },
            { list: rowB, rev: true,  cls: styles.rowShort },
            { list: rowC, rev: false, cls: styles.rowMid },
          ] as const).map(({ list, rev, cls }, ri) => {
            const doubled = [...list, ...list]
            return (
              <div key={ri} className={`${styles.marqueeRow} ${rev ? styles.marqueeRev : ''} ${cls}`}>
                {doubled.map(([id, ch], i) => (
                  <div
                    key={`${id}-${i}`}
                    className={styles.charCard}
                    style={{ '--cc': ch.color } as React.CSSProperties}
                  >
                    {(() => {
                      const portrait = getPortraitUrl(id)
                      const src = portrait ?? thumbs[id]
                      return src
                        ? <img src={src} className={`${styles.charCardImg} ${portrait ? styles.charCardPortrait : ''}`} alt={ch.name} />
                        : <div className={styles.charCardFallback}><span className={styles.charCardEmoji}>{ch.icon}</span></div>
                    })()}
                    <div className={styles.charCardOverlay}>
                      <span className={styles.charCardName}>◉ {ch.name}</span>
                      <span className={styles.charCardTag}>{ch.tagline}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section className={styles.features}>
        <div className={styles.container}>
          <div className={styles.sectionLabel}>Возможности</div>
          <h2 className={styles.sectionTitle}>Всё для роста юного программиста</h2>
          <div className={styles.featGrid}>
            {[
              { icon: '⚔️', title: 'Реальные бои',           accent: '#00e5ff', desc: 'Пишешь стратегию — бот идёт в бой. Видишь каждый ход: атаки, уклоны, урон в реальном времени.' },
              { icon: '🧠', title: 'Учись программируя',      accent: '#a855f7', desc: 'Миссии от новичка до профи: блочный редактор → Python → продвинутые алгоритмы. Прогресс через победы.' },
              { icon: '🏆', title: 'Турниры',                 accent: '#d97706', desc: 'Официальные турниры с сеткой bo3/bo5. Обновляй стратегию между раундами — побеждает лучший алгоритм.' },
              { icon: '🎭', title: '16 персонажей',           accent: '#f43f5e', desc: 'У каждого уникальная механика: яд, контратаки, уклонения, бусидо, захват. Стратегия зависит от выбора.' },
              { icon: '⚡', title: '3 языка',                 accent: '#22c55e', desc: 'JavaScript, Python или блочный редактор. Переключайся по мере роста — прогресс сохраняется.' },
              { icon: '🔁', title: 'Спарринг',                accent: '#60a5fa', desc: 'Тестируй стратегии без соперника. Запускай бои локально, экспериментируй и оттачивай алгоритм.' },
            ].map(f => (
              <div key={f.title} className={styles.featCard} style={{ '--fa': f.accent } as React.CSSProperties}>
                <div className={styles.featIcon}>{f.icon}</div>
                <h3 className={styles.featTitle}>{f.title}</h3>
                <p className={styles.featDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────── */}
      <section className={styles.how}>
        <div className={styles.container}>
          <div className={styles.sectionLabel}>Как это работает</div>
          <h2 className={styles.sectionTitle}>От кода до победы — 3 шага</h2>

          <div className={styles.steps}>
            <Step num="01" icon="✍️" title="Пишешь стратегию"
              desc="Открываешь редактор и пишешь функцию strategy(ctx). Она вызывается каждый ход и возвращает действие: attack, heavy, shield, dodge..." />
            <div className={styles.stepArrow}>→</div>
            <Step num="02" icon="🚀" title="Жмёшь «Готов к бою»"
              desc="Код компилируется в песочнице. Если ошибка — видишь её сразу. Если ок — твой боец выходит на арену." />
            <div className={styles.stepArrow}>→</div>
            <Step num="03" icon="📊" title="Анализируешь и улучшаешь"
              desc="Бой идёт ход за ходом. Видишь HP, ярость, действия. После раунда — правишь тактику и снова в бой." />
          </div>

          <div className={styles.actionsRow}>
            <div className={styles.actionsLabel}>7 действий</div>
            <div className={styles.actions}>
              {[
                { icon: '👊', label: 'attack',  desc: '12 урона' },
                { icon: '💥', label: 'heavy',   desc: '28 урона' },
                { icon: '⚡', label: 'laser',   desc: '20 урона' },
                { icon: '🛡', label: 'shield',  desc: '60% блок' },
                { icon: '💨', label: 'dodge',   desc: 'уклон' },
                { icon: '💊', label: 'repair',  desc: '+20 HP' },
                { icon: '☄️', label: 'special', desc: '50 урона' },
              ].map(a => (
                <div key={a.label} className={styles.action}>
                  <span className={styles.actionIcon}>{a.icon}</span>
                  <code className={styles.actionLabel}>{a.label}</code>
                  <span className={styles.actionDesc}>{a.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Code example ────────────────────────────────────────────── */}
      <section className={styles.codeSection}>
        <div className={styles.container}>
          <div className={styles.codeSplit}>
            <div className={styles.codeLeft}>
              <div className={styles.sectionLabel}>Пример стратегии</div>
              <h2 className={styles.sectionTitle}>Это и есть программирование</h2>
              <p className={styles.codeDesc}>
                Стратегия — обычная функция. Получаешь контекст боя и возвращаешь действие.
                Чем умнее алгоритм — тем выше шанс победить.
              </p>
              <div className={styles.ctxList}>
                {[
                  ['ctx.my_hp',              'текущее HP'],
                  ['ctx.my_rage',            'ярость 0–100'],
                  ['ctx.enemy_last_action',  'последнее действие врага'],
                  ['ctx.cooldowns',          'кулдауны действий'],
                  ['ctx.my_position',        'close / mid / far'],
                ].map(([k, v]) => (
                  <div key={k} className={styles.ctxRow}>
                    <code className={styles.ctxKey}>{k}</code>
                    <span className={styles.ctxVal}>{v}</span>
                  </div>
                ))}
              </div>
              <Link to="/join" className={`btn btn-primary ${styles.codeBtn}`}>⚔️ Попробовать</Link>
            </div>

            <div className={styles.codeRight}>
              <div className={styles.codeWin}>
                <div className={styles.codeWinBar}>
                  <div className={styles.winDots}><span/><span/><span/></div>
                  <span className={styles.winLang}>Python</span>
                </div>
                <pre className={styles.codePre}><code dangerouslySetInnerHTML={{ __html:
`<span class="ck">def</span> <span class="cf">strategy</span>(ctx):
    <span class="cc"># Спецудар при накоплении ярости</span>
    <span class="ck">if</span> ctx.my_rage <span class="co">&gt;=</span> <span class="cn">100</span>:
        <span class="ck">return</span> <span class="cs">'special'</span>

    <span class="cc"># Лечимся при низком HP</span>
    <span class="ck">if</span> ctx.my_hp <span class="co">&lt;</span> <span class="cn">30</span>:
        <span class="ck">return</span> <span class="cs">'repair'</span>

    <span class="cc"># Уклоняемся от лазера</span>
    <span class="ck">if</span> ctx.enemy_last_action <span class="co">==</span> <span class="cs">'laser'</span>:
        <span class="ck">return</span> <span class="cs">'dodge'</span>

    <span class="cc"># Добиваем слабого врага</span>
    <span class="ck">if</span> ctx.enemy_hp <span class="co">&lt;</span> <span class="cn">25</span>:
        <span class="ck">return</span> <span class="cs">'heavy'</span>

    <span class="ck">return</span> <span class="cs">'attack'</span>`
                }} /></pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaGlow} />
        <div className={styles.container}>
          <div className={styles.ctaInner}>
            <h2 className={styles.ctaTitle}>Готов к первому бою?</h2>
            <p className={styles.ctaSub}>
              Это бесплатно. Напиши первую стратегию и отправь своего бойца на арену прямо сейчас.
            </p>
            <div className={styles.ctaBtns}>
              <Link to="/join"     className={`btn btn-primary ${styles.ctaBig}`}>⚔️ Начать бой</Link>
              <Link to="/demo"     className={`btn btn-ghost  ${styles.ctaBig}`}>🎮 Демо без кода</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerInner}>
            <div className={styles.footerLogo}>
              <img src="/logo.png" alt="CodeFighters" className={styles.footerLogoImg} />
            </div>
            <div className={styles.footerLinks}>
              <Link to="/tournaments">Турниры</Link>
              <Link to="/leaderboard">Рейтинг</Link>
              <Link to="/learn">Обучение</Link>
              <Link to="/join">В бой</Link>
            </div>
            <div className={styles.footerCopy}>© 2026 CodeFighters</div>
          </div>
        </div>
      </footer>

    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Stat({ num, label }: { num: string; label: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statNum}>{num}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

function FighterPreview({ name, skin, hp, maxHp, flip }: {
  name: string; skin: string; hp: number; maxHp: number; flip?: boolean
}) {
  const pct = (hp / maxHp) * 100
  const color = pct > 50 ? '#4ade80' : pct > 25 ? '#facc15' : '#f87171'
  return (
    <div className={styles.fighter} style={{ alignItems: flip ? 'flex-end' : 'flex-start' }}>
      <span className={styles.fighterSkin}>{skin}</span>
      <span className={styles.fighterName}>{name}</span>
      <div className={styles.hpTrack}>
        <div className={styles.hpFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={styles.hpNum}>{hp} HP</span>
    </div>
  )
}

function LogRow({ turn, p1, p2, note, hot }: {
  turn: number; p1: string; p2: string; note: string; hot?: boolean
}) {
  return (
    <div className={`${styles.logRow} ${hot ? styles.logHot : ''}`}>
      <span className={styles.logTurn}>#{turn}</span>
      <span className={styles.logAct}>{p1}</span>
      <span className={styles.logVs}>·</span>
      <span className={styles.logAct}>{p2}</span>
      <span className={styles.logNote}>{note}</span>
    </div>
  )
}

function Step({ num, icon, title, desc }: { num: string; icon: string; title: string; desc: string }) {
  return (
    <div className={styles.step}>
      <div className={styles.stepNum}>{num}</div>
      <div className={styles.stepIcon}>{icon}</div>
      <h3 className={styles.stepTitle}>{title}</h3>
      <p className={styles.stepDesc}>{desc}</p>
    </div>
  )
}
