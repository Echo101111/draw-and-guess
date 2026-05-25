import { CLIENT_EVENTS, SERVER_EVENTS, GAME_TYPE_SPY } from '@draw-and-guess/shared'
import { spyGameManager } from '../game/SpyGameManager.js'
import { roomManager } from '../rooms/index.js'
import type { SpyGameConfig } from '@draw-and-guess/shared'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerSpyGameHandlers(io: any, socket: any): void {
  socket.on(CLIENT_EVENTS.SPY_SUBMIT_DESCRIPTION, ({ text }: { text: string }) => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return

    const result = spyGameManager.submitDescription(roomId, playerId, text)
    if (!result.success) {
      socket.emit(SERVER_EVENTS.ROOM_ERROR, {
        code: 'SPY_ERROR',
        message: result.error ?? '操作失败',
      })
    }
  })

  socket.on(CLIENT_EVENTS.SPY_VOTE, ({ targetId }: { targetId: string }) => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return

    const result = spyGameManager.vote(roomId, playerId, targetId)
    if (!result.success) {
      socket.emit(SERVER_EVENTS.ROOM_ERROR, {
        code: 'SPY_ERROR',
        message: result.error ?? '投票失败',
      })
    }
  })

  socket.on(CLIENT_EVENTS.SPY_READY_NEXT_ROUND, () => {
    const { roomId } = socket.data
    if (!roomId) return
    spyGameManager.startRound(roomId)
  })

  socket.on(CLIENT_EVENTS.SPY_UPDATE_CONFIG, ({ config }: { config: Partial<SpyGameConfig> }) => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return

    const room = roomManager.getRoomById(roomId)
    if (!room) return

    const player = room.players.find(p => p.id === playerId)
    if (!player?.isOwner) return

    spyGameManager.updateGameConfig(roomId, config)
    io.to(room.code).emit(SERVER_EVENTS.SPY_GAME_CONFIG_UPDATED, {
      config: spyGameManager.getGameConfig(roomId),
    })
  })

  socket.on(CLIENT_EVENTS.REQUEST_GAME_STATE, () => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return

    const room = roomManager.getRoomById(roomId)
    if (!room || room.gameType !== GAME_TYPE_SPY) return

    spyGameManager.sendGameStateSnapshot(roomId, playerId)
  })

  socket.on('disconnect', () => {
    const { roomId, playerId, isSpectator } = socket.data
    if (!roomId || !playerId || isSpectator) return

    const room = roomManager.getRoomById(roomId)
    if (!room || room.gameType !== GAME_TYPE_SPY) return

    spyGameManager.handlePlayerDisconnect(roomId, playerId)
  })
}
