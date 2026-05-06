import { Link } from 'react-router-dom'
import styles from './LandingPage.module.css'

export default function LandingPage() {
  return (
    <div className={styles.page}>
      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <span className={styles.navLogoIcon}>⚔️</span>
          <span className={styles.navLogoText}>Arena<span className={styles.navLogoAccent}>Battle</span></span>
        </div>
        <div className={styles.navLinks}>
          <Link to="/tournaments" className={styles.navLink}>Турниры</Link>
          <Link to="/leaderboard" className={styles.navLink}>Рейтинг</Link>
          <Link to="/learn"       className={styles.navLink}>Обучение</Link>
          <Link to="/login"    className={`${styles.navLink} ${styles.navLinkBtn}`}>Войти</Link>
          <Link to="/register" className={`btn btn-primary ${styles.navRegBtn}`}>Начать бесплатно</Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className={styles.hero}>
        {/* Animated background grid */}
        <div className={styles.heroBg} aria-hidden>
          <div className={styles.heroGrid} />
          <div className={styles.heroGlow1} />
          <div className={styles.heroGlow2} />
          <div className={styles.heroGlow3} />
          {/* Floating orbs */}
          <div className={`${styles.orb} ${styles.orb1}`} />
          <div className={`${styles.orb} ${styles.orb2}`} />
          <div className={`${styles.orb} ${styles.orb3}`} />
        </div>

        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} />
            Программируй. Сражайся. Побеждай.
          </div>

          <h1 className={styles.heroTitle}>
            Боевая арена
            <br />
            <span className={styles.heroTitleAccent}>для программистов</span>
          </h1>

          <p className={styles.heroSubtitle}>
            Пиши стратегии на Python или JavaScript, отправляй своего робота
            в бой и побеждай соперников в реальном времени.
            Идеально для детей и подростков, которые хотят учиться программируя.
          </p>

          <div className={styles.heroCta}>
            <Link to="/join" className={`btn btn-primary ${styles.heroCtaPrimary}`}>
              ⚔️ Начать бой
            </Link>
            <Link to="/learn" className={`btn btn-ghost ${styles.heroCtaSecondary}`}>
              📚 Как программировать
            </Link>
          </div>

          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>7</span>
              <span className={styles.heroStatLabel}>действий</span>
            </div>
            <div className={styles.heroStatDiv} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>3</span>
              <span className={styles.heroStatLabel}>языка</span>
            </div>
            <div className={styles.heroStatDiv} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>∞</span>
              <span className={styles.heroStatLabel}>тактик</span>
            </div>
          </div>
        </div>

        {/* Hero arena preview */}
        <div className={styles.heroArena}>
          <div className={styles.arenaCard}>
            <div className={styles.arenaCardHeader}>
              <span className={styles.roundBadge}>РАУНД 2</span>
              <div className={styles.arenaScore}>
                <span className={styles.arenaScoreWin}>1</span>
                <span className={styles.arenaScoreSep}>–</span>
                <span>0</span>
              </div>
            </div>
            <div className={styles.arenaFighters}>
              <Fighter name="ТТТ" skin="⚔️" hp={78} maxHp={100} side="left"  />
              <div className={styles.vsLabel}>VS</div>
              <Fighter name="bb"  skin="🤖" hp={34} maxHp={100} side="right" />
            </div>
            <div className={styles.arenaLog}>
              <LogLine turn={8} p1="💥 Тяжёлый" p2="🛡 Щит"    result="P2 -4HP" />
              <LogLine turn={7} p1="👊 Удар"    p2="👊 Удар"    result="P2 -8HP ▲ | P1 -8HP ▲" latest />
            </div>
          </div>

          {/* Code snippet floating card */}
          <div className={styles.codeCard}>
            <div className={styles.codeCardDots}>
              <span /><span /><span />
            </div>
            <pre className={styles.codeCardPre}>{`<span class="${styles.kwKw}">def</span> <span class="${styles.kwFn}">strategy</span>(ctx):
  <span class="${styles.kwKw}">if</span> ctx.my_rage <span class="${styles.kwOp}">&gt;=</span> <span class="${styles.kwNum}">100</span>:
    <span class="${styles.kwKw}">return</span> <span class="${styles.kwStr}">'special'</span>
  <span class="${styles.kwKw}">if</span> ctx.enemy_hp <span class="${styles.kwOp}">&lt;</span> <span class="${styles.kwNum}">30</span>:
    <span class="${styles.kwKw}">return</span> <span class="${styles.kwStr}">'heavy'</span>
  <span class="${styles.kwKw}">return</span> <span class="${styles.kwStr}">'attack'</span>`}</pre>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section className={styles.features}>
        <div className={styles.sectionLabel}>Возможности платформы</div>
        <h2 className={styles.sectionTitle}>Всё для роста юного программиста</h2>

        <div className={styles.featureGrid}>
          <FeatureCard
            icon="⚔️"
            title="Реальные бои"
            desc="Пишешь стратегию — твой робот идёт в бой немедленно. Видишь каждый ход: атаки, уклоны, урон в реальном времени."
            accent="cyan"
          />
          <FeatureCard
            icon="🧠"
            title="Учись программируя"
            desc="Миссии от новичка до профи: блочный редактор → Python → продвинутые алгоритмы. Прогресс — через победы, не скучные задачи."
            accent="purple"
          />
          <FeatureCard
            icon="🏆"
            title="Турниры"
            desc="Участвуй в официальных турнирах с сеткой bo3/bo5. Обновляй стратегию между раундами — побеждает лучший алгоритм."
            accent="gold"
          />
          <FeatureCard
            icon="📊"
            title="Рейтинг и прогресс"
            desc="Таблица лидеров, статистика боёв, история стратегий. Видишь, что работает, а что нет — и становишься лучше."
            accent="green"
          />
          <FeatureCard
            icon="⚡"
            title="3 языка программирования"
            desc="JavaScript, Python или блочный визуальный редактор. Переключайся по мере роста навыков без потери прогресса."
            accent="cyan"
          />
          <FeatureCard
            icon="🔁"
            title="Спарринг с собой"
            desc="Тестируй стратегии без соперника. Запускай бои в одиночку, экспериментируй и оттачивай алгоритм до совершенства."
            accent="purple"
          />
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section className={styles.how}>
        <div className={styles.sectionLabel}>Как это работает</div>
        <h2 className={styles.sectionTitle}>От кода до победы за 3 шага</h2>

        <div className={styles.howSteps}>
          <HowStep
            num="01"
            icon="✍️"
            title="Пишешь стратегию"
            desc="Открываешь редактор и пишешь функцию strategy(ctx). Она вызывается каждый ход и возвращает действие: attack, heavy, shield, dodge..."
          />
          <div className={styles.howArrow}>→</div>
          <HowStep
            num="02"
            icon="🚀"
            title="Жмёшь «Готов к бою»"
            desc="Твой код компилируется в безопасной песочнице. Если ошибка — видишь её сразу. Если всё ок — ждёшь соперника."
          />
          <div className={styles.howArrow}>→</div>
          <HowStep
            num="03"
            icon="🏆"
            title="Смотришь и анализируешь"
            desc="Бой проходит автоматически, ход за ходом. Видишь лог, HP, ярость. После раунда — обновляешь тактику и снова в бой."
          />
        </div>

        {/* Actions grid */}
        <div className={styles.actionsBlock}>
          <div className={styles.actionsTitle}>7 действий для победы</div>
          <div className={styles.actionsGrid}>
            {[
              { key: 'attack',  label: 'Удар',     icon: '👊', desc: 'Базовая атака' },
              { key: 'heavy',   label: 'Тяжёлый',  icon: '💥', desc: '+урон, но нужна выносливость' },
              { key: 'laser',   label: 'Лазер',    icon: '⚡', desc: 'Дальнобойный, точный' },
              { key: 'shield',  label: 'Щит',      icon: '🛡', desc: 'Блокирует 60% урона' },
              { key: 'dodge',   label: 'Уклон',    icon: '💨', desc: 'Полностью уходит от удара' },
              { key: 'repair',  label: 'Ремонт',   icon: '💚', desc: 'Восстанавливает HP' },
              { key: 'special', label: 'Спешл',    icon: '☄️', desc: 'RAGE-удар, нужна ярость 100' },
            ].map(a => (
              <div key={a.key} className={styles.actionChip}>
                <span className={styles.actionChipIcon}>{a.icon}</span>
                <span className={styles.actionChipLabel}>{a.label}</span>
                <span className={styles.actionChipDesc}>{a.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Code example ───────────────────────────────────────── */}
      <section className={styles.codeSection}>
        <div className={styles.codeSectionLeft}>
          <div className={styles.sectionLabel}>Пример кода</div>
          <h2 className={styles.sectionTitle}>Это и есть программирование</h2>
          <p className={styles.codeSectionDesc}>
            Стратегия — это обычная функция. Ты получаешь контекст боя
            и возвращаешь действие. Чем умнее алгоритм — тем выше шанс победить.
          </p>
          <ul className={styles.codeSectionList}>
            <li>📍 <code>ctx.my_hp</code> — текущий HP</li>
            <li>💢 <code>ctx.my_rage</code> — накопленная ярость (0–100)</li>
            <li>👁 <code>ctx.enemy_last_action</code> — последнее действие врага</li>
            <li>⏱ <code>ctx.cooldowns</code> — кулдауны твоих действий</li>
            <li>📍 <code>ctx.my_position</code> — позиция: close / mid / far</li>
          </ul>
          <Link to="/join" className={`btn btn-primary ${styles.codeCtaBtn}`}>
            ⚔️ Попробовать сейчас
          </Link>
        </div>
        <div className={styles.codeSectionRight}>
          <div className={styles.bigCodeCard}>
            <div className={styles.bigCodeHeader}>
              <div className={styles.codeCardDots2}><span/><span/><span/></div>
              <span className={styles.bigCodeLang}>Python</span>
            </div>
            <pre className={styles.bigCodePre}><code dangerouslySetInnerHTML={{ __html: `<span class="ck">def</span> <span class="cf">strategy</span>(ctx):
    <span class="cc"># Используем ярость при накоплении</span>
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

    <span class="ck">return</span> <span class="cs">'attack'</span>` }} /></pre>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section className={styles.cta}>
        <div className={styles.ctaGlow} />
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>Готов к первому бою?</h2>
          <p className={styles.ctaSubtitle}>
            Присоединяйся — это бесплатно. Напиши первую стратегию и отправь своего робота в бой прямо сейчас.
          </p>
          <div className={styles.ctaBtns}>
            <Link to="/join"     className={`btn btn-primary ${styles.ctaBtnMain}`}>⚔️ Начать бой</Link>
            <Link to="/register" className={`btn btn-ghost  ${styles.ctaBtnSec}`}>Создать аккаунт</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
          <span>⚔️</span>
          <span>ArenaBattle</span>
        </div>
        <div className={styles.footerLinks}>
          <Link to="/tournaments">Турниры</Link>
          <Link to="/leaderboard">Рейтинг</Link>
          <Link to="/learn">Обучение</Link>
          <Link to="/join">Войти в бой</Link>
        </div>
        <div className={styles.footerCopy}>© 2025 ArenaBattle</div>
      </footer>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Fighter({ name, skin, hp, maxHp, side }: { name: string; skin: string; hp: number; maxHp: number; side: 'left' | 'right' }) {
  const pct = (hp / maxHp) * 100
  const color = pct > 50 ? '#4ade80' : pct > 25 ? '#facc15' : '#f87171'
  return (
    <div className={`${styles.fighter} ${side === 'right' ? styles.fighterRight : ''}`}>
      <div className={styles.fighterSkin}>{skin}</div>
      <div className={styles.fighterName}>{name}</div>
      <div className={styles.fighterHpTrack}>
        <div className={styles.fighterHpFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className={styles.fighterHpNum}>{hp} HP</div>
    </div>
  )
}

function LogLine({ turn, p1, p2, result, latest }: { turn: number; p1: string; p2: string; result: string; latest?: boolean }) {
  return (
    <div className={`${styles.logLine} ${latest ? styles.logLineLatest : ''}`}>
      <span className={styles.logLineTurn}>Ход {turn}</span>
      <span>{p1}</span>
      <span className={styles.logLineVs}>vs</span>
      <span>{p2}</span>
      <span className={styles.logLineResult}>{result}</span>
    </div>
  )
}

function FeatureCard({ icon, title, desc, accent }: { icon: string; title: string; desc: string; accent: string }) {
  return (
    <div className={`${styles.featureCard} ${styles[`featureCard_${accent}`]}`}>
      <div className={styles.featureIcon}>{icon}</div>
      <h3 className={styles.featureTitle}>{title}</h3>
      <p className={styles.featureDesc}>{desc}</p>
    </div>
  )
}

function HowStep({ num, icon, title, desc }: { num: string; icon: string; title: string; desc: string }) {
  return (
    <div className={styles.howStep}>
      <div className={styles.howStepNum}>{num}</div>
      <div className={styles.howStepIcon}>{icon}</div>
      <h3 className={styles.howStepTitle}>{title}</h3>
      <p className={styles.howStepDesc}>{desc}</p>
    </div>
  )
}
