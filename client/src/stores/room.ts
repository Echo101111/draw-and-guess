import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getSocket, connectSocket, saveSession, clearSession, waitForConnection } from '@/composables/useSocket'
import { CLIENT_EVENTS, SERVER_EVENTS } from '@draw-and-guess/shared'
import type { RoomWordConfig } from '@draw-and-guess/shared'

interface RoomPlayer {
  id: string
  nickname: string
  isOwner: boolean
  score: number
  hasGuessedCorrectly: boolean
}

interface RoomData {
  id: string
  code: string
  name: string
  state: string
  maxPlayers: number
  players: RoomPlayer[]
  currentRound: number
  totalRounds: number
  wordConfig: RoomWordConfig
}

export const useRoomStore = defineStore('room', () => {
  const room = ref<RoomData | null>(null)
  const currentPlayerId = ref<string | null>(null)
  const connectionState = ref<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const error = ref<string | null>(null)
  const isSpectator = ref(false)

  const isOwner = computed(() => {
    const player = room.value?.players.find((p) => p.id === currentPlayerId.value)
    return player?.isOwner ?? false
  })

  const players = computed(() => room.value?.players ?? [])

  const roomName = computed(() => room.value?.code ?? '')

  const setupSocketListeners = () => {
    const socket = getSocket()

    socket.off(SERVER_EVENTS.ROOM_CREATED)
    socket.on(SERVER_EVENTS.ROOM_CREATED, (data) => {
      if (data.room) {
        room.value = data.room
      } else {
        room.value = {
          id: data.roomId,
          code: data.roomCode,
          name: '',
          state: 'lobby',
          maxPlayers: 50,
          players: [],
          currentRound: 0,
          totalRounds: 10,
          wordConfig: {
            customWords: [],
            looseMatching: false,
          },
        }
      }
      currentPlayerId.value = data.playerId
      connectionState.value = 'connected'
      error.value = null
    })

    socket.off(SERVER_EVENTS.ROOM_JOINED)
    socket.on(SERVER_EVENTS.ROOM_JOINED, (data) => {
      room.value = data.room
      currentPlayerId.value = data.playerId
      connectionState.value = 'connected'
      error.value = null
    })

    socket.off(SERVER_EVENTS.ROOM_ERROR)
    socket.on(SERVER_EVENTS.ROOM_ERROR, (data) => {
      error.value = data.message
      connectionState.value = 'disconnected'
    })

    socket.off(SERVER_EVENTS.ROOM_UPDATED)
    socket.on(SERVER_EVENTS.ROOM_UPDATED, (data) => {
      room.value = data.room
    })

    socket.off(SERVER_EVENTS.KICKED)
    socket.on(SERVER_EVENTS.KICKED, (data) => {
      error.value = data.reason
      room.value = null
      currentPlayerId.value = null
      connectionState.value = 'disconnected'
      clearSession()
    })

    socket.off(SERVER_EVENTS.SESSION_RESTORED)
    socket.on(SERVER_EVENTS.SESSION_RESTORED, (data) => {
      room.value = data.room
      currentPlayerId.value = data.playerId
      connectionState.value = 'connected'
      error.value = null
      isSpectator.value = false
      // 游戏进行中 → 请求完整游戏快照（兜底 ROUND_START 丢失）
      if (data.room?.state === 'playing') {
        getSocket()?.emit(CLIENT_EVENTS.REQUEST_GAME_STATE)
      }
    })

    socket.off(SERVER_EVENTS.SPECTATOR_JOINED)
    socket.on(SERVER_EVENTS.SPECTATOR_JOINED, (data) => {
      room.value = data.room
      currentPlayerId.value = `spectator-${data.room.code}`
      connectionState.value = 'connected'
      error.value = null
      isSpectator.value = true
    })

    socket.off(SERVER_EVENTS.WORD_CONFIG_UPDATED)
    socket.on(SERVER_EVENTS.WORD_CONFIG_UPDATED, (data: { wordConfig: RoomWordConfig }) => {
      if (room.value) {
        room.value.wordConfig = data.wordConfig
      }
    })
  }

  function waitForResponse(roomEvent: string, timeoutMs = 15000): Promise<void> {
    return new Promise((resolve) => {
      const socket = getSocket()
      const timer = setTimeout(() => {
        cleanup()
        if (!room.value) {
          error.value = '服务器无响应，请稍后重试'
          connectionState.value = 'disconnected'
        }
        resolve()
      }, timeoutMs)
      const onResponse = () => { cleanup(); resolve() }
      const cleanup = () => {
        clearTimeout(timer)
        socket.off(roomEvent, onResponse)
        socket.off(SERVER_EVENTS.ROOM_ERROR, onResponse)
      }
      socket.once(roomEvent, onResponse)
      socket.once(SERVER_EVENTS.ROOM_ERROR, onResponse)
    })
  }

  const createRoom = async (
    nickname: string,
    options?: { roomName?: string; maxPlayers?: number; password?: string; wordConfig?: RoomWordConfig }
  ) => {
    connectionState.value = 'connecting'
    error.value = null
    const socket = connectSocket()
    setupSocketListeners()
    clearSession()
    try {
      await waitForConnection()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '连接失败'
      error.value = `${msg}，请检查网络后重试`
      connectionState.value = 'disconnected'
      return
    }
    socket.once(SERVER_EVENTS.ROOM_CREATED, (data) => {
      saveSession(data.roomCode, data.playerId, nickname)
    })
    socket.emit(CLIENT_EVENTS.CREATE_ROOM, {
      nickname,
      roomName: options?.roomName,
      maxPlayers: options?.maxPlayers,
      password: options?.password,
      wordConfig: options?.wordConfig,
    })
    await waitForResponse(SERVER_EVENTS.ROOM_CREATED)
  }

  const joinRoom = async (roomName: string, nickname: string, password?: string) => {
    connectionState.value = 'connecting'
    error.value = null
    const socket = connectSocket()
    setupSocketListeners()
    clearSession()
    try {
      await waitForConnection()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '连接失败'
      error.value = `${msg}，请检查网络后重试`
      connectionState.value = 'disconnected'
      return
    }
    socket.once(SERVER_EVENTS.ROOM_JOINED, (data) => {
      saveSession(data.room.code, data.playerId, nickname)
    })
    socket.emit(CLIENT_EVENTS.JOIN_ROOM, {
      roomName,
      nickname,
      password,
    })
    await waitForResponse(SERVER_EVENTS.ROOM_JOINED)
  }

  const joinAsSpectator = async (roomName: string, password?: string) => {
    connectionState.value = 'connecting'
    error.value = null
    const socket = connectSocket()
    setupSocketListeners()
    try {
      await waitForConnection()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '连接失败'
      error.value = `${msg}，请检查网络后重试`
      connectionState.value = 'disconnected'
      return
    }
    socket.emit(CLIENT_EVENTS.JOIN_AS_SPECTATOR, { roomName, password })
    await waitForResponse(SERVER_EVENTS.SPECTATOR_JOINED)
  }

  const leaveRoom = () => {
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit(CLIENT_EVENTS.LEAVE_ROOM)
    }
    room.value = null
    currentPlayerId.value = null
    connectionState.value = 'disconnected'
    isSpectator.value = false
    clearSession()
  }

  const kickPlayer = (playerId: string) => {
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit(CLIENT_EVENTS.KICK_PLAYER, { playerId })
    }
  }

  const startGame = () => {
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit(CLIENT_EVENTS.START_GAME)
    }
  }

  const clearError = () => {
    error.value = null
  }

  const updateWordConfig = (updates: Partial<RoomWordConfig>) => {
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit(CLIENT_EVENTS.UPDATE_WORD_CONFIG, { wordConfig: updates })
    }
  }

  return {
    room,
    currentPlayerId,
    connectionState,
    error,
    isOwner,
    isSpectator,
    players,
    roomName,
    setupSocketListeners,
    createRoom,
    joinRoom,
    joinAsSpectator,
    leaveRoom,
    kickPlayer,
    startGame,
    clearError,
    updateWordConfig,
  }
})
