import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null
let serverUrl = 'http://localhost:3000'

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