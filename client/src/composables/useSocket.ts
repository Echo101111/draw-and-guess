import { io, type Socket } from 'socket.io-client'
import { ref } from 'vue'
import { CLIENT_EVENTS, SERVER_EVENTS, SOCKET_RECONNECT_DELAY_MS, SOCKET_RECONNECT_DELAY_MAX_MS, SOCKET_RANDOMIZATION_FACTOR, SOCKET_CONNECT_TIMEOUT_MS, SOCKET_DISCONNECT_DELAY_MS, SOCKET_SESSION_RESTORE_TIMEOUT_MS } from '@draw-and-guess/shared'

export const connectionState = ref<'connected' | 'disconnected' | 'reconnecting'>('disconnected')
export const reconnectAttempt = ref(0)

let socket: Socket | null = null
let serverUrl = import.meta.env.VITE_SERVER_URL || window.location.origin
let disconnectTimer: ReturnType<typeof setTimeout> | null = null

const SESSION_KEY = 'dag-session'
const NICKNAME_KEY = 'dag-nickname'

export interface StoredSession {
  roomName: string
  playerId: string
  nickname: string
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(serverUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: SOCKET_RECONNECT_DELAY_MS,
      reconnectionDelayMax: SOCKET_RECONNECT_DELAY_MAX_MS,
      randomizationFactor: SOCKET_RANDOMIZATION_FACTOR,
      timeout: SOCKET_CONNECT_TIMEOUT_MS,
    })
    socket.on('connect', () => {
      if (disconnectTimer) { clearTimeout(disconnectTimer); disconnectTimer = null }
      connectionState.value = 'connected'
      reconnectAttempt.value = 0
      restoreSession()
    })
    socket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason)
      if (disconnectTimer) clearTimeout(disconnectTimer)
      disconnectTimer = setTimeout(() => {
        if (!socket?.connected) {
          connectionState.value = 'disconnected'
        }
      }, SOCKET_DISCONNECT_DELAY_MS)
    })
    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message)
    })
    socket.on('reconnect_attempt', (attempt) => {
      connectionState.value = 'reconnecting'
      reconnectAttempt.value = attempt
    })
    socket.io.on('reconnect_failed', () => {
      if (disconnectTimer) { clearTimeout(disconnectTimer); disconnectTimer = null }
      connectionState.value = 'disconnected'
    })
  }
  return socket
}

export function connectSocket(url?: string): Socket {
  if (url) {
    serverUrl = url
  }
  const s = getSocket()
  if (!s.connected) {
    s.connect()
  }
  return s
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect()
  }
}

export function waitForConnection(timeoutMs = SOCKET_CONNECT_TIMEOUT_MS): Promise<void> {
  const s = getSocket()
  if (s.connected) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      s.off('connect', onConnect)
      reject(new Error('连接超时'))
    }, timeoutMs)
    const onConnect = () => {
      clearTimeout(timer)
      resolve()
    }
    s.once('connect', onConnect)
  })
}

export function saveSession(roomName: string, playerId: string, nickname: string): void {
  const session: StoredSession = { roomName, playerId, nickname }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function getStoredSession(): StoredSession | null {
  try {
    const s = localStorage.getItem(SESSION_KEY)
    return s ? JSON.parse(s) : null
  } catch {
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export function saveNickname(nickname: string): void {
  localStorage.setItem(NICKNAME_KEY, nickname)
}

export function loadNickname(): string {
  return localStorage.getItem(NICKNAME_KEY) ?? ''
}

export function restoreSession(): Promise<boolean> {
  const session = getStoredSession()
  if (session && socket?.connected) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        clearSession(); resolve(false)
      }, SOCKET_SESSION_RESTORE_TIMEOUT_MS)
      socket!.once(SERVER_EVENTS.SESSION_RESTORED, () => {
        clearTimeout(timer); resolve(true)
      })
      socket!.once(SERVER_EVENTS.ROOM_ERROR, () => {
        clearTimeout(timer); clearSession(); resolve(false)
      })
      socket!.emit(CLIENT_EVENTS.RESTORE_SESSION, {
        roomName: session.roomName,
        playerId: session.playerId,
      })
    })
  }
  return Promise.resolve(false)
}
