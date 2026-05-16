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

    try {
      const result = gameManager.submitAnswer(roomId, playerId, answer)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(global as any).metrics.answersSubmitted++
      if (result.correct) {
        socket.emit(SERVER_EVENTS.ANSWER_RESULT, {
          playerId,
          nickname: '',
          correct: true,
          displayText: '你猜对了！',
        })
      }
    } catch (err) {
      console.error('[SubmitAnswer] Error:', err)
    }
  })

  socket.on(CLIENT_EVENTS.DRAW_STROKE, ({ points, color, width, tool, strokeSeq }: { points: { x: number; y: number }[]; color: string; width: number; tool: string; strokeSeq: number }) => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return

    try {
      const start = Date.now()
      gameManager.handleDrawStroke(roomId, playerId, socket.id, points, color, width, tool, strokeSeq)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = (global as any).metrics
      m.strokesReceived++
      m.lastStrokeLatency = Date.now() - start
      m.avgStrokeLatency = (m.avgStrokeLatency * (m.strokesReceived - 1) + m.lastStrokeLatency) / m.strokesReceived
    } catch (err) {
      console.error('[DrawStroke] Error:', err)
    }
  })

  socket.on(CLIENT_EVENTS.CLEAR_CANVAS, () => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return

    try {
      gameManager.clearCanvas(roomId, playerId, socket.id)
    } catch (err) {
      console.error('[ClearCanvas] Error:', err)
    }
  })

  socket.on(CLIENT_EVENTS.CHAT_MESSAGE, ({ text }: { text: string }) => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return

    if (!text || !text.trim()) return

    try {
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
    } catch (err) {
      console.error('[ChatMessage] Error:', err)
    }
  })

  socket.on(CLIENT_EVENTS.DISMISS_ROOM, () => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return

    try {
      const room = roomManager.getRoomById(roomId)
      if (!room) return

      const player = room.players.find((p) => p.id === playerId)
      if (!player?.isOwner) return

      roomManager.dismissRoom(roomId)
      io.to(room.code).emit(SERVER_EVENTS.KICKED, { reason: '房间已解散' })
    } catch (err) {
      console.error('[DismissRoom] Error:', err)
    }
  })

  socket.on(CLIENT_EVENTS.UNDO_STROKE, () => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return
    gameManager.undoStroke(roomId, playerId)
  })

  socket.on(CLIENT_EVENTS.REQUEST_GAME_STATE, () => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return
    gameManager.sendGameStateSnapshot(roomId, playerId)
  })

  socket.on(CLIENT_EVENTS.RESYNC_STROKES, ({ strokes }: { strokes: Array<{ strokeSeq?: number; points: Array<{ x: number; y: number }>; color: string; width: number; tool: string }> }) => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return
    gameManager.resyncStrokes(roomId, playerId, strokes)
  })
}

export { lastChatTime, CHAT_COOLDOWN }