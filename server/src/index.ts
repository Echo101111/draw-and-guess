import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { config } from './config.js'
import { healthRouter } from './routes/health.js'
import { registerRoomHandlers } from './socket/index.js'

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
})

app.use(express.json())
app.use('/health', healthRouter)

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`)

  registerRoomHandlers(io, socket)

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`)
  })
})

httpServer.listen(config.port, () => {
  console.log(`[Server] Running on port ${config.port} (${config.nodeEnv})`)
})