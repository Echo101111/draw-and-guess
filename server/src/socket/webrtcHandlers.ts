import { CLIENT_EVENTS, SERVER_EVENTS } from '@draw-and-guess/shared'
import { roomManager } from '../rooms/index.js'

export function registerWebRTCHandlers(io: any, socket: any): void {
  socket.on(CLIENT_EVENTS.WEBRTC_JOIN_VOICE, () => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return
    const room = roomManager.getRoomById(roomId)
    if (!room) return
    socket.data.inVoiceChannel = true

    // 通知房间内其他人有新玩家加入
    socket.to(room.code).emit(SERVER_EVENTS.WEBRTC_PEER_JOINED, { playerId })

    // 收集房间内已有的语音成员（排除自己）
    const voicePeers: string[] = []
    const sockets = io.sockets.adapter.rooms.get(room.code)
    if (sockets) {
      for (const sid of sockets) {
        const s = io.sockets.sockets.get(sid)
        if (s && s.data.inVoiceChannel && s.data.playerId !== playerId) {
          voicePeers.push(s.data.playerId)
        }
      }
    }
    socket.emit(SERVER_EVENTS.WEBRTC_PEERS_LIST, { peers: voicePeers })
  })

  socket.on(CLIENT_EVENTS.WEBRTC_LEAVE_VOICE, () => {
    const { roomId, playerId } = socket.data
    if (!roomId || !playerId) return
    const room = roomManager.getRoomById(roomId)
    if (!room) return
    socket.data.inVoiceChannel = false
    socket.to(room.code).emit(SERVER_EVENTS.WEBRTC_PEER_LEFT, { playerId })
  })

  socket.on(CLIENT_EVENTS.WEBRTC_OFFER, ({ targetId, sdp }: { targetId: string; sdp: any }) => {
    const { playerId } = socket.data
    if (!playerId) return
    io.to(targetId).emit(SERVER_EVENTS.WEBRTC_OFFER, {
      fromId: playerId,
      sdp,
    })
  })

  socket.on(CLIENT_EVENTS.WEBRTC_ANSWER, ({ targetId, sdp }: { targetId: string; sdp: any }) => {
    const { playerId } = socket.data
    if (!playerId) return
    io.to(targetId).emit(SERVER_EVENTS.WEBRTC_ANSWER, {
      fromId: playerId,
      sdp,
    })
  })

  socket.on(CLIENT_EVENTS.WEBRTC_ICE_CANDIDATE, ({ targetId, candidate }: { targetId: string; candidate: any }) => {
    const { playerId } = socket.data
    if (!playerId) return
    io.to(targetId).emit(SERVER_EVENTS.WEBRTC_ICE_CANDIDATE, {
      fromId: playerId,
      candidate,
    })
  })

  socket.on('disconnect', () => {
    if (socket.data.inVoiceChannel && socket.data.roomId) {
      const room = roomManager.getRoomById(socket.data.roomId)
      if (room) {
        io.to(room.code).emit(SERVER_EVENTS.WEBRTC_PEER_LEFT, {
          playerId: socket.data.playerId,
        })
      }
    }
  })
}
