import { prisma } from '../db/client.js'

export type NotificationType =
  | 'challenge_received'
  | 'challenge_accepted'
  | 'challenge_declined'
  | 'match_found'
  | 'season_end'
  | 'tournament_win'
  | 'clan_war_started'
  | 'clan_war_ended'

export async function createNotification(
  userId: string,
  type: NotificationType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any = {},
) {
  return prisma.notification.create({
    data: { userId, type, payload },
  })
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } })
}
