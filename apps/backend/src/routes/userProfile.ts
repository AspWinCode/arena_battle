import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../db/client.js'

// ── Achievements ──────────────────────────────────────────────────────────────

interface Achievement {
  id: string
  icon: string
  title: string
  description: string
  unlocked: boolean
}

interface Stats {
  sessionsPlayed: number
  sessionsWon: number
  winRate: number
  battlesPlayed: number
  langsUsed: string[]
  tournamentsEntered: number
  tournamentsWon: number
  favoriteSkin: string
  favoritelang: string
}

async function calcStats(userId: string): Promise<Stats> {
  const players = await prisma.player.findMany({
    where: { userId },
    include: {
      session: {
        include: { battles: true },
      },
    },
  })

  let sessionsWon = 0
  let battlesPlayed = 0
  const langs: Record<string, number> = {}
  const skins: Record<string, number> = {}

  for (const p of players) {
    battlesPlayed += p.session.battles.length
    const myWins = p.session.battles.filter(b => b.winner === p.slot).length
    const opponentWins = p.session.battles.filter(b => b.winner !== p.slot && b.winner !== 0).length
    if (myWins > opponentWins) sessionsWon++
    if (p.lang) langs[p.lang] = (langs[p.lang] ?? 0) + 1
    skins[p.skin] = (skins[p.skin] ?? 0) + 1
  }

  const tournamentsEntered = await prisma.tournamentApplication.count({
    where: { userId, status: 'APPROVED' },
  })

  // Count tournament wins: approved apps that are linked to a won final match
  const tournamentsWon = await prisma.tournamentMatch.count({
    where: {
      winner: { userId },
      // Final match = highest round in their tournament
      round: { gte: 2 }, // at least semifinals
    },
  })

  const favoriteLang = Object.entries(langs).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'js'
  const favoriteSkin = Object.entries(skins).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'robot'

  return {
    sessionsPlayed: players.length,
    sessionsWon,
    winRate: players.length ? Math.round((sessionsWon / players.length) * 100) : 0,
    battlesPlayed,
    langsUsed: Object.keys(langs),
    tournamentsEntered,
    tournamentsWon,
    favoriteSkin,
    favoritelang: favoriteLang,
  }
}

function buildAchievements(stats: Stats): Achievement[] {
  return [
    {
      id: 'first_battle',
      icon: '🥊', title: 'Первый бой', description: 'Сыграй свой первый матч',
      unlocked: stats.sessionsPlayed >= 1,
    },
    {
      id: 'first_win',
      icon: '🏅', title: 'Первая победа', description: 'Одержи первую победу',
      unlocked: stats.sessionsWon >= 1,
    },
    {
      id: 'veteran',
      icon: '⚔️', title: 'Ветеран', description: 'Сыграй 10 матчей',
      unlocked: stats.sessionsPlayed >= 10,
    },
    {
      id: 'legend',
      icon: '👑', title: 'Легенда', description: 'Сыграй 50 матчей',
      unlocked: stats.sessionsPlayed >= 50,
    },
    {
      id: 'sharpshooter',
      icon: '🎯', title: 'Снайпер', description: 'Выиграй 70%+ матчей (мин. 5)',
      unlocked: stats.sessionsPlayed >= 5 && stats.winRate >= 70,
    },
    {
      id: 'polyglot',
      icon: '💻', title: 'Полиглот', description: 'Используй 3 разных языка',
      unlocked: stats.langsUsed.length >= 3,
    },
    {
      id: 'tournament_player',
      icon: '🏟️', title: 'Турнирный игрок', description: 'Участвуй в турнире',
      unlocked: stats.tournamentsEntered >= 1,
    },
    {
      id: 'champion',
      icon: '🏆', title: 'Чемпион', description: 'Выиграй турнир',
      unlocked: stats.tournamentsWon >= 1,
    },
    {
      id: 'dedication',
      icon: '🔥', title: 'Преданность', description: 'Сыграй 3 матча подряд (любые)',
      unlocked: stats.sessionsPlayed >= 3,
    },
    {
      id: 'all_four',
      icon: '🎭', title: 'Коллекционер', description: 'Сыграй за всех 4 персонажей',
      unlocked: false, // needs skin variety check — set later
    },
  ]
}

// ── Routes ────────────────────────────────────────────────────────────────────

export const userProfileRoutes: FastifyPluginAsync = async (fastify) => {
  // Public profile by username
  fastify.get<{ Params: { username: string } }>('/:username', async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: {
        id: true, username: true, displayName: true, avatar: true, bio: true,
        preferredLang: true, preferredSkin: true, experienceLevel: true,
        programmingYears: true, createdAt: true,
        _count: { select: { players: true, applications: true } },
      },
    })
    if (!user) return reply.status(404).send({ error: 'Пользователь не найден' })

    const stats = await calcStats(user.id)
    const achievements = buildAchievements(stats)

    // Recent sessions for public profile (last 5)
    const recentPlayers = await prisma.player.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        session: {
          select: {
            id: true, name: true, status: true, createdAt: true,
            battles: { select: { winner: true, round: true } },
          },
        },
      },
    })

    const recentSessions = recentPlayers.map(p => {
      const myWins = p.session.battles.filter(b => b.winner === p.slot).length
      const opWins = p.session.battles.filter(b => b.winner !== p.slot && b.winner !== 0).length
      return {
        sessionId: p.session.id,
        sessionName: p.session.name,
        slot: p.slot,
        lang: p.lang,
        skin: p.skin,
        won: myWins > opWins,
        score: [myWins, opWins],
        playedAt: p.session.createdAt,
      }
    })

    return reply.send({ user, stats, achievements, recentSessions })
  })

  // Own full profile (private — includes email)
  fastify.get('/~me/full', async (req, reply) => {
    let payload: { userId: string; type: string }
    try {
      payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user) return reply.status(404).send({ error: 'Not found' })

    const stats = await calcStats(user.id)
    const achievements = buildAchievements(stats)
    // include streak/xp fields from DB in safeUser below

    // Recent sessions
    const recentPlayers = await prisma.player.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        session: {
          select: {
            id: true, name: true, status: true, createdAt: true,
            battles: { select: { winner: true, round: true } },
          },
        },
      },
    })

    const recentSessions = recentPlayers.map(p => {
      const myWins = p.session.battles.filter(b => b.winner === p.slot).length
      const opWins = p.session.battles.filter(b => b.winner !== p.slot && b.winner !== 0).length
      return {
        sessionId: p.session.id,
        sessionName: p.session.name,
        slot: p.slot,
        lang: p.lang,
        skin: p.skin,
        won: myWins > opWins,
        score: [myWins, opWins],
        playedAt: p.session.createdAt,
      }
    })

    // Tournament applications
    const applications = await prisma.tournamentApplication.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      include: { tournament: { select: { id: true, name: true, status: true, startDate: true } } },
    })

    const { passwordHash: _, ...safeUser } = user
    return reply.send({ user: safeUser, stats, achievements, recentSessions, applications })
  })

  // Update streak/XP stats for authenticated user
  fastify.patch('/~me/stats', async (req, reply) => {
    let payload: { userId: string; type: string }
    try {
      payload = await req.jwtVerify<{ userId: string; type: string }>()
      if (payload.type !== 'user') throw new Error()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const body = req.body as {
      currentStreak?: number
      bestStreak?: number
      totalXp?: number
      totalWins?: number
      totalBattles?: number
      lastWinDate?: string
    }

    const data: Record<string, number | string> = {}
    if (body.currentStreak !== undefined) data.currentStreak = body.currentStreak
    if (body.bestStreak    !== undefined) data.bestStreak    = body.bestStreak
    if (body.totalXp       !== undefined) data.totalXp       = body.totalXp
    if (body.totalWins     !== undefined) data.totalWins     = body.totalWins
    if (body.totalBattles  !== undefined) data.totalBattles  = body.totalBattles
    if (body.lastWinDate   !== undefined) data.lastWinDate   = body.lastWinDate

    const user = await prisma.user.update({
      where: { id: payload.userId },
      data,
      select: {
        id: true, currentStreak: true, bestStreak: true,
        totalXp: true, totalWins: true, totalBattles: true, lastWinDate: true,
      },
    })
    return reply.send(user)
  })

  // Global leaderboard — top 20 users by wins
  fastify.get('/leaderboard', async (_req, reply) => {
    // Find all users who have at least one Player linked
    const usersWithPlayers = await prisma.user.findMany({
      where: { players: { some: {} } },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatar: true,
        bestStreak: true,
        currentStreak: true,
        players: {
          select: {
            slot: true,
            session: {
              select: { battles: { select: { winner: true } } },
            },
          },
        },
      },
    })

    const ranked = usersWithPlayers.map(u => {
      let wins  = 0
      let total = 0
      for (const p of u.players) {
        total++
        const myWins  = p.session.battles.filter(b => b.winner === p.slot).length
        const oppWins = p.session.battles.filter(b => b.winner !== p.slot && b.winner !== 0).length
        if (myWins > oppWins) wins++
      }
      const winRate = total > 0 ? Math.round((wins / total) * 100) : 0
      return {
        username: u.username, displayName: u.displayName, avatar: u.avatar,
        wins, total, winRate,
        bestStreak: u.bestStreak, currentStreak: u.currentStreak,
      }
    })

    ranked.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate)

    const top20 = ranked.slice(0, 20).map((entry, i) => ({ rank: i + 1, ...entry }))
    return reply.send(top20)
  })
}
