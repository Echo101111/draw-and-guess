import { io, type Socket } from 'socket.io-client'
import { CLIENT_EVENTS } from '@draw-and-guess/shared'

let socket: Socket | null = null
let serverUrl = 'http://localhost:3000'

const SESSION_KEY = 'dag-session'

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
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
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

export function restoreSession(): void {
  const session = getStoredSession()
  if (session && socket) {
    socket.emit(CLIENT_EVENTS.RESTORE_SESSION, {
      roomName: session.roomName,
      playerId: session.playerId,
    })
  }
}
