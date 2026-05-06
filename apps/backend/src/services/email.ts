import nodemailer from 'nodemailer'

const enabled = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

const transporter = enabled
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: process.env.SMTP_SECURE !== 'false',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null

const FROM = process.env.SMTP_FROM ?? `"RoboCode Arena" <noreply@robocode.arena>`
const APP_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'

// ── Helpers ────────────────────────────────────────────────────────────────────

function baseHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0a0a1a;font-family:'Segoe UI',system-ui,sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="520" style="background:#1a1a35;border:1px solid #2a2a50;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #2a2a50;text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">🤖</div>
          <div style="font-size:22px;font-weight:800;background:linear-gradient(135deg,#00e5ff,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">
            RoboCode Arena
          </div>
        </td></tr>
        <tr><td style="padding:32px 40px;">${body}</td></tr>
        <tr><td style="padding:16px 40px 24px;border-top:1px solid #2a2a50;text-align:center;color:#64748b;font-size:12px;">
          © RoboCode Arena · <a href="${APP_URL}" style="color:#00e5ff;">arenabattle.ru</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

async function send(to: string, subject: string, html: string): Promise<void> {
  if (!transporter) {
    console.log(`[email] SMTP not configured — skipping send to ${to}: ${subject}`)
    return
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html })
    console.log(`[email] Sent "${subject}" → ${to}`)
  } catch (err) {
    console.error(`[email] Failed to send to ${to}:`, err)
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Отправить логин/пароль новому участнику при одобрении */
export async function sendApprovalWithCredentials(opts: {
  to: string
  playerName: string
  username: string
  password: string
  tournamentName: string
}): Promise<void> {
  const { to, playerName, username, password, tournamentName } = opts
  const html = baseHtml('Заявка одобрена — RoboCode Arena', `
    <h2 style="margin:0 0 16px;font-size:20px;color:#4ade80;">✅ Твоя заявка одобрена!</h2>
    <p style="margin:0 0 8px;">Привет, <strong>${playerName}</strong>!</p>
    <p style="margin:0 0 24px;color:#94a3b8;">Ты участвуешь в турнире <strong style="color:#e2e8f0;">${tournamentName}</strong>.</p>

    <div style="background:#12122a;border:1px solid #2a2a50;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">Данные для входа</p>
      <p style="margin:0 0 8px;">🔑 Логин: <code style="background:#0a0a1a;padding:2px 8px;border-radius:4px;color:#00e5ff;">${username}</code></p>
      <p style="margin:0;">🔒 Пароль: <code style="background:#0a0a1a;padding:2px 8px;border-radius:4px;color:#00e5ff;">${password}</code></p>
    </div>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:13px;">После входа ты увидишь свою позицию в сетке и соперника. Удачи в бою!</p>

    <a href="${APP_URL}/login" style="display:inline-block;background:#00e5ff;color:#000;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;">
      🎮 Войти в арену
    </a>
  `)
  await send(to, `✅ Заявка одобрена — ${tournamentName}`, html)
}

/** Уведомление для уже зарегистрированного пользователя */
export async function sendApprovalNotification(opts: {
  to: string
  playerName: string
  tournamentName: string
}): Promise<void> {
  const { to, playerName, tournamentName } = opts
  const html = baseHtml('Заявка одобрена — RoboCode Arena', `
    <h2 style="margin:0 0 16px;font-size:20px;color:#4ade80;">✅ Заявка одобрена!</h2>
    <p style="margin:0 0 8px;">Привет, <strong>${playerName}</strong>!</p>
    <p style="margin:0 0 24px;color:#94a3b8;">Ты участвуешь в турнире <strong style="color:#e2e8f0;">${tournamentName}</strong>.</p>
    <p style="margin:0 0 20px;color:#94a3b8;font-size:13px;">Зайди в свой аккаунт — там увидишь сетку и своего соперника.</p>
    <a href="${APP_URL}/login" style="display:inline-block;background:#00e5ff;color:#000;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;">
      🎮 Открыть арену
    </a>
  `)
  await send(to, `✅ Заявка одобрена — ${tournamentName}`, html)
}

/** Уведомление об отклонении заявки */
export async function sendRejectionNotification(opts: {
  to: string
  playerName: string
  tournamentName: string
  reason?: string
}): Promise<void> {
  const { to, playerName, tournamentName, reason } = opts
  const html = baseHtml('Заявка отклонена — RoboCode Arena', `
    <h2 style="margin:0 0 16px;font-size:20px;color:#f87171;">❌ Заявка отклонена</h2>
    <p style="margin:0 0 8px;">Привет, <strong>${playerName}</strong>.</p>
    <p style="margin:0 0 16px;color:#94a3b8;">К сожалению, твоя заявка на турнир <strong style="color:#e2e8f0;">${tournamentName}</strong> была отклонена.</p>
    ${reason ? `<p style="margin:0 0 16px;background:#1a1a35;border-left:3px solid #f87171;padding:10px 16px;border-radius:4px;font-size:13px;">📝 ${reason}</p>` : ''}
    <p style="margin:0;color:#94a3b8;font-size:13px;">Следи за новыми турнирами на платформе.</p>
  `)
  await send(to, `❌ Заявка отклонена — ${tournamentName}`, html)
}
