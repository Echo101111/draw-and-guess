import express from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { config, APP_VERSION } from './config.js'
import { healthRouter } from './routes/health.js'
import { wordsRouter } from './routes/words.js'
import { adminRouter } from './routes/admin.js'
import { feedbackRouter } from './routes/feedback.js'
import { turnRouter } from './routes/turn.js'
import { registerRoomHandlers, registerDrawGameHandlers, registerSpyGameHandlers, registerWebRTCHandlers } from './socket/index.js'
import { drawGameManager } from './game/index.js'
import { spyGameManager } from './game/SpyGameManager.js'
import { roomManager } from './rooms/index.js'
import { setupRedis } from './redis.js'
import { clearChatCooldown } from './socket/drawGameHandlers.js'

const app = express()
const httpServer = createServer(app)

const metrics = {
  connections: 0,
  disconnections: 0,
  roomsCreated: 0,
  strokesReceived: 0,
  answersSubmitted: 0,
  errors: 0,
  avgStrokeLatency: 0,
  lastStrokeLatency: 0,
}

const corsOrigin = process.env.CLIENT_URL?.split(',').map(s => s.trim()) ?? ['http://localhost:5173']

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || corsOrigin.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    methods: ['GET', 'POST'],
  },
  connectTimeout: 15000,
  pingTimeout: 35000,
  pingInterval: 15000,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).io = io
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).metrics = metrics

setupRedis(io).catch((err) => {
  console.warn('[Server] Redis setup failed, continuing in single-node mode:', err instanceof Error ? err.message : String(err))
})

// 房间解散时清理游戏数据
roomManager.onDismissed((roomId) => {
  drawGameManager.resetGame(roomId)
  spyGameManager.resetGame(roomId)
})

// 玩家被移除时清理 per-player 状态；若移除的是画师则结束当前轮
roomManager.onPlayerRemoved((playerId, roomId) => {
  drawGameManager.removePlayerTimestamps(playerId)
  spyGameManager.handlePlayerDisconnect(roomId, playerId)
  clearChatCooldown(playerId)
  const drawerId = drawGameManager.getCurrentDrawerId(roomId)
  if (drawerId === playerId) {
    drawGameManager.clearCurrentDrawerId(roomId)
    drawGameManager.endRound(roomId, 'timeout')
  }
})

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use('/health', healthRouter)
app.use('/api/words', wordsRouter)
app.use('/admin', adminRouter)
app.use('/api/feedback', feedbackRouter)
app.use('/api', turnRouter)

io.on('connection', (socket) => {
  metrics.connections++
  console.log(`[Socket] Client connected: ${socket.id}`)

  registerRoomHandlers(io, socket)
  registerDrawGameHandlers(io, socket)
  registerSpyGameHandlers(io, socket)
  registerWebRTCHandlers(io, socket)

  socket.on('disconnect', () => {
    metrics.disconnections++
    console.log(`[Socket] Client disconnected: ${socket.id}`)
  })
})

httpServer.listen(config.port, () => {
  console.log(`[Server] v${APP_VERSION} Running on port ${config.port} (${config.nodeEnv})`)
})

export { io }