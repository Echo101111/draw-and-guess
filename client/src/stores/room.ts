import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getSocket, connectSocket } from '@/composables/useSocket'
import { CLIENT_EVENTS, SERVER_EVENTS, type Player } from '@draw-and-guess/shared'

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
}

export const useRoomStore = defineStore('room', () => {
  const room = ref<RoomData | null>(null)
  const currentPlayerId = ref<string | null>(null)
  const currentPlayer = ref<Player | null>(null)
  const connectionState = ref<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const error = ref<string | null>(null)

  const isOwner = computed(() => {
    const player = room.value?.players.find((p) => p.id === currentPlayerId.value)
    return player?.isOwner ?? false
  })

  const players = computed(() => room.value?.players ?? [])

  const setupSocketListeners = () => {
    const socket = getSocket()

    socket.on(SERVER_EVENTS.ROOM_CREATED, (data) => {
      currentPlayerId.value = data.playerId
      connectionState.value = 'connected'
      error.value = null
    })

    socket.on(SERVER_EVENTS.ROOM_JOINED, (data) => {
      room.value = data.room
      currentPlayerId.value = data.playerId
      connectionState.value = 'connected'
      error.value = null
    })

    socket.on(SERVER_EVENTS.ROOM_ERROR, (data) => {
      error.value = data.message
      connectionState.value = 'disconnected'
    })

    socket.on(SERVER_EVENTS.ROOM_UPDATED, (data) => {
      room.value = data.room
    })

    socket.on(SERVER_EVENTS.KICKED, (data) => {
      error.value = data.reason
      room.value = null
      currentPlayerId.value = null
      connectionState.value = 'disconnected'
    })
  }

  const createRoom = (
    nickname: string,
    options?: { roomName?: string; maxPlayers?: number; password?: string }
  ) => {
    connectionState.value = 'connecting'
    error.value = null
    const socket = connectSocket()
    setupSocketListeners()
    socket.emit(CLIENT_EVENTS.CREATE_ROOM, {
      nickname,
      roomName: options?.roomName,
      maxPlayers: options?.maxPlayers,
      password: options?.password,
    })
  }

  const joinRoom = (roomCode: string, nickname: string, password?: string) => {
    connectionState.value = 'connecting'
    error.value = null
    const socket = connectSocket()
    setupSocketListeners()
    socket.emit(CLIENT_EVENTS.JOIN_ROOM, {
      roomCode,
      nickname,
      password,
    })
  }

  const leaveRoom = () => {
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit(CLIENT_EVENTS.LEAVE_ROOM)
    }
    room.value = null
    currentPlayerId.value = null
    connectionState.value = 'disconnected'
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

  return {
    room,
    currentPlayerId,
    currentPlayer,
    connectionState,
    error,
    isOwner,
    players,
    setupSocketListeners,
    createRoom,
    joinRoom,
    leaveRoom,
    kickPlayer,
    startGame,
    clearError,
  }
})