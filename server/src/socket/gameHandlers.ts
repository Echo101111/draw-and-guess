import { CLIENT_EVENTS, SERVER_EVENTS } from '@draw-and-guess/shared'
import { gameManager } from '../game/index.js'
import { roomManager } from '../rooms/index.js'

const lastChatTime = new Map<string, number>()
const CHAT_COOLDOWN = 1000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerGameHandlers(io: any, socket: any): void {
  socket.on(CLIENT_EVENTS.SUBMIT_ANSWER, ({ answer }: { answer: string }) => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return

    if (!answer || !answer.trim()) return

    const result = gameManager.submitAnswer(roomId, playerId, answer)
    if (result.correct) {
      socket.emit(SERVER_EVENTS.ANSWER_RESULT, {
        playerId,
        nickname: '',
        correct: true,
        displayText: '你猜对了！',
      })
    }
  })

  socket.on(CLIENT_EVENTS.DRAW_STROKE, ({ points, color, width, tool }: { points: { x: number; y: number }[]; color: string; width: number; tool: string }) => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return

    gameManager.handleDrawStroke(roomId, playerId, points, color, width, tool)
  })

  socket.on(CLIENT_EVENTS.CLEAR_CANVAS, () => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return

    gameManager.clearCanvas(roomId, playerId)
  })

  socket.on(CLIENT_EVENTS.CHAT_MESSAGE, ({ text }: { text: string }) => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return

    if (!text || !text.trim()) return

    const now = Date.now()
    const lastTime = lastChatTime.get(playerId) ?? 0
    if (now - lastTime < CHAT_COOLDOWN) {
      return
    }
    lastChatTime.set(playerId, now)

    const room = roomManager.getRoomById(roomId)
    if (!room) return

    const player = room.players.find((p) => p.id === playerId)
    const nickname = player?.nickname ?? '玩家'

    io.to(room.code).emit(SERVER_EVENTS.CHAT_MESSAGE, {
      playerId,
      nickname,
      text: text.trim().slice(0, 200),
      isSystem: false,
      timestamp: now,
    })
  })

  socket.on(CLIENT_EVENTS.DISMISS_ROOM, () => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return

    const room = roomManager.getRoomById(roomId)
    if (!room) return

    const player = room.players.find((p) => p.id === playerId)
    if (!player?.isOwner) return

    roomManager.dismissRoom(roomId)
    io.to(room.code).emit(SERVER_EVENTS.KICKED, { reason: '房间已解散' })
  })
}

export { lastChatTime, CHAT_COOLDOWN }