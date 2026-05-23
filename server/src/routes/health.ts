import { Router, type Router as ExpressRouter } from 'express'
import { roomManager } from '../rooms/index.js'
import { APP_VERSION } from '../config.js'

interface RoomSummary {
  name: string
  gameType: 'draw' | 'spy'
  state: string
  playerCount: number
}

interface HealthStatus {
  status: 'ok' | 'degraded'
  version: string
  timestamp: number
  uptime: number
  rooms: number
  players: number
  roomList: RoomSummary[]
  metrics: {
    connections: number
    disconnections: number
    roomsCreated: number
    strokesTotal: number
    answersTotal: number
    errors: number
    avgStrokeLatencyMs: number
    lastStrokeLatencyMs: number
  }
  memory: {
    heapUsedMB: number
    rssMB: number
  }
}

const startTime = Date.now()

export const healthRouter: ExpressRouter = Router()

healthRouter.get('/', (_req, res) => {
  const rooms = roomManager.getAllRooms()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (global as any).metrics ?? {}

  const status: HealthStatus = {
    status: 'ok',
    version: APP_VERSION,
    timestamp: Date.now(),
    uptime: Date.now() - startTime,
    rooms: rooms.length,
    players: rooms.reduce((sum, r) => sum + r.players.length, 0),
    roomList: rooms.map(r => ({
      name: r.name,
      gameType: r.gameType,
      state: r.state,
      playerCount: r.players.length,
    })),
    metrics: {
      connections: m.connections ?? 0,
      disconnections: m.disconnections ?? 0,
      roomsCreated: m.roomsCreated ?? 0,
      strokesTotal: m.strokesReceived ?? 0,
      answersTotal: m.answersSubmitted ?? 0,
      errors: m.errors ?? 0,
      avgStrokeLatencyMs: Math.round(m.avgStrokeLatency ?? 0),
      lastStrokeLatencyMs: m.lastStrokeLatency ?? 0,
    },
    memory: {
      heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  }

  res.json(status)
})

healthRouter.get('/live', (_req, res) => {
  res.json({ alive: true })
})

healthRouter.get('/ready', (_req, res) => {
  res.json({ ready: true })
})
