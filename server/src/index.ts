import express from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { config, APP_VERSION } from './config.js'
import { healthRouter } from './routes/health.js'
import { registerRoomHandlers } from './socket/index.js'
import { registerGameHandlers } from './socket/gameHandlers.js'
import { gameManager } from './game/index.js'
import { roomManager } from './rooms/index.js'

const app = express()
const httpServer = createServer(app)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).io = null

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).io = io

// 房间解散时清理游戏数据
roomManager.onDismissed((roomId) => {
  gameManager.resetGame(roomId)
})

// 玩家被移除时清理 per-player 状态
roomManager.onPlayerRemoved((playerId) => {
  gameManager.removePlayerTimestamps(playerId)
})

app.use(express.json())
app.use('/health', healthRouter)

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`)

  registerRoomHandlers(io, socket)
  registerGameHandlers(io, socket)

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`)
  })
})

httpServer.listen(config.port, () => {
  console.log(`[Server] v${APP_VERSION} Running on port ${config.port} (${config.nodeEnv})`)
})

export { io }