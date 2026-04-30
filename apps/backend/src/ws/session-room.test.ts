import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionRoom } from './session-room.js'

// Mock Prisma so tests don't need a DB
vi.mock('../db/client.js', () => ({
  prisma: {
    session: {
      update: vi.fn().mockResolvedValue({}),
    },
    player: {
      updateMany: vi.fn().mockResolvedValue({}),
    },
    battle: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

// Mock sandbox so tests run instantly
vi.mock('../sandbox/sandbox-service.js', () => ({
  runInSandbox: vi.fn().mockResolvedValue({
    primary: 'attack',
    lowHp: 'combo',
    onHit: 'dodge',
    style: 'Standard',
    position: 'mid',
  }),
}))

interface MockSocket {
  readyState: number
  messages: string[]
  send(data: string): void
  on(event: string, listener: (...args: unknown[]) => void): void
  emit(event: string, ...args: unknown[]): void
}

function makeMockSocket(): MockSocket {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
  const socket: MockSocket = {
    readyState: 1,
    messages: [],
    send(data) { this.messages.push(data) },
    on(event, listener) {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(listener)
    },
    emit(event, ...args) {
      listeners[event]?.forEach(l => l(...args))
    },
  }
  return socket
}

function lastMsg(socket: MockSocket) {
  const raw = socket.messages[socket.messages.length - 1]
  return raw ? JSON.parse(raw) : null
}

function msgs(socket: MockSocket) {
  return socket.messages.map(m => JSON.parse(m))
}

describe('SessionRoom', () => {
  let room: SessionRoom

  beforeEach(() => {
    room = new SessionRoom('test-session-1', 'code', 'js', 'bo1', 2, ['robot', 'gladiator', 'boxer', 'cosmonaut'])
  })

  it('sends connected message when player joins', () => {
    const ws = makeMockSocket()
    room.addPlayer(ws, 1, 'Alice', 'robot')

    const connected = msgs(ws).find(m => m.type === 'connected')
    expect(connected).toBeDefined()
    expect(connected.payload.slot).toBe(1)
    expect(connected.payload.sessionLevel).toBe('code')
  })

  it('broadcasts lobby_update when player joins', () => {
    const ws1 = makeMockSocket()
    const ws2 = makeMockSocket()

    room.addPlayer(ws1, 1, 'Alice', 'robot')
    room.addPlayer(ws2, 2, 'Bob', 'gladiator')

    const update = msgs(ws1).find(m => m.type === 'lobby_update' && m.payload.p2 !== null)
    expect(update).toBeDefined()
    expect(update.payload.p2.name).toBe('Bob')
  })

  it('broadcasts coding_start when both players join', () => {
    const ws1 = makeMockSocket()
    const ws2 = makeMockSocket()

    room.addPlayer(ws1, 1, 'Alice', 'robot')
    room.addPlayer(ws2, 2, 'Bob', 'gladiator')

    const coding = msgs(ws1).find(m => m.type === 'coding_start')
    expect(coding).toBeDefined()
    expect(coding.payload.timeLimit).toBeGreaterThan(0)
  })

  it('marks player ready and reflects in lobby_update', () => {
    const ws1 = makeMockSocket()
    const ws2 = makeMockSocket()

    room.addPlayer(ws1, 1, 'Alice', 'robot')
    room.addPlayer(ws2, 2, 'Bob', 'gladiator')

    ws1.messages = []
    room.handleReady(1, 'attack();', 'js')

    const update = msgs(ws1).find(m => m.type === 'lobby_update')
    expect(update).toBeDefined()
    expect(update.payload.p1.ready).toBe(true)
    expect(update.payload.p2.ready).toBe(false)
  })

  it('observer receives lobby_update snapshot on connect', () => {
    const ws1 = makeMockSocket()
    room.addPlayer(ws1, 1, 'Alice', 'robot')

    const obs = makeMockSocket()
    room.addObserver(obs)

    const update = msgs(obs).find(m => m.type === 'lobby_update')
    expect(update).toBeDefined()
    expect(update.payload.p1.name).toBe('Alice')
    expect(update.payload.p2).toBeNull()
  })

  it('observer receives all broadcasts after attaching', () => {
    const ws1 = makeMockSocket()
    const ws2 = makeMockSocket()
    const obs = makeMockSocket()

    room.addObserver(obs)
    room.addPlayer(ws1, 1, 'Alice', 'robot')
    room.addPlayer(ws2, 2, 'Bob', 'gladiator')

    const types = msgs(obs).map((m: { type: string }) => m.type)
    expect(types).toContain('lobby_update')
    expect(types).toContain('coding_start')
  })

  it('removeObserver stops further delivery', () => {
    const ws1 = makeMockSocket()
    const obs = makeMockSocket()

    room.addObserver(obs)
    room.addPlayer(ws1, 1, 'Alice', 'robot')

    const countBefore = obs.messages.length
    room.removeObserver(obs)

    const ws2 = makeMockSocket()
    room.addPlayer(ws2, 2, 'Bob', 'gladiator')

    expect(obs.messages.length).toBe(countBefore)
  })

  it('sends error to remaining player on disconnect', () => {
    const ws1 = makeMockSocket()
    const ws2 = makeMockSocket()

    room.addPlayer(ws1, 1, 'Alice', 'robot')
    room.addPlayer(ws2, 2, 'Bob', 'gladiator')

    ws2.messages = []
    room.handleDisconnect(1)

    const err = msgs(ws2).find(m => m.type === 'error')
    expect(err).toBeDefined()
    expect(err.payload.code).toBe('OPPONENT_DISCONNECTED')
  })

  it('starts battle when both players send ready', async () => {
    vi.useFakeTimers()

    const ws1 = makeMockSocket()
    const ws2 = makeMockSocket()

    room.addPlayer(ws1, 1, 'Alice', 'robot')
    room.addPlayer(ws2, 2, 'Bob', 'gladiator')

    room.handleReady(1, 'attack();', 'js')
    room.handleReady(2, 'shield();', 'js')

    // Let sandbox compile (microtasks) resolve, then advance all sleeps in the battle loop
    await vi.runAllTimersAsync()

    vi.useRealTimers()

    const types1 = msgs(ws1).map((m: { type: string }) => m.type)
    expect(types1).toContain('compile_status')
    expect(types1).toContain('battle_start')
    expect(types1).toContain('match_end')
  }, 15_000)
})
