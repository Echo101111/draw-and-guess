import { Router, type Router as ExpressRouter } from 'express'
import { roomManager } from '../rooms/index.js'

interface HealthStatus {
  status: 'ok' | 'degraded'
  timestamp: number
  uptime: number
  rooms: number
  players: number
}

const startTime = Date.now()

export const healthRouter: ExpressRouter = Router()

healthRouter.get('/', (_req, res) => {
  const rooms = roomManager.getAllRooms()

  const status: HealthStatus = {
    status: 'ok',
    timestamp: Date.now(),
    uptime: Date.now() - startTime,
    rooms: rooms.length,
    players: rooms.reduce((sum, r) => sum + r.players.length, 0),
  }

  res.json(status)
})

healthRouter.get('/live', (_req, res) => {
  res.json({ alive: true })
})

healthRouter.get('/ready', (_req, res) => {
  res.json({ ready: true })
})
