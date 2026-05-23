import { CLIENT_EVENTS, SERVER_EVENTS } from '@draw-and-guess/shared'
import { roomManager } from '../rooms/index.js'

export function registerWebRTCHandlers(io: any, socket: any): void {
  socket.on(CLIENT_EVENTS.WEBRTC_JOIN_VOICE, () => {
    const { roomId, playerId } = socket.data
    console.log('[WebRTC 服务端] JOIN_VOICE — socketId:', socket.id, 'playerId:', playerId, 'roomId:', roomId)
    if (!roomId || !playerId) {
      console.log('[WebRTC 服务端] JOIN_VOICE 跳过: 缺少 roomId 或 playerId')
      return
    }
    const room = roomManager.getRoomById(roomId)
    if (!room) {
      console.log('[WebRTC 服务端] JOIN_VOICE 跳过: room not found for id', roomId)
      return
    }
    console.log('[WebRTC 服务端] JOIN_VOICE — room:', room.code, 'playerId:', playerId)

    socket.data.inVoiceChannel = true
    console.log('[WebRTC 服务端] 设置 inVoiceChannel = true 完成')

    // 通知房间内其他人有新玩家加入
    console.log('[WebRTC 服务端] 发送 PEER_JOINED:', playerId, '到 room:', room.code)
    socket.to(room.code).emit(SERVER_EVENTS.WEBRTC_PEER_JOINED, { playerId })

    // 收集房间内已有的语音成员（排除自己）
    const voicePeers: string[] = []
    const sockets = io.sockets.adapter.rooms.get(room.code)
    console.log('[WebRTC 服务端] room sockets count:', sockets ? sockets.size : 0)
    if (sockets) {
      for (const sid of sockets) {
        const s = io.sockets.sockets.get(sid)
        console.log('[WebRTC 服务端]   socket:', sid, 'playerId:', s?.data?.playerId, 'inVoiceChannel:', s?.data?.inVoiceChannel, 'isSelf:', s?.data?.playerId === playerId)
        if (s && s.data.inVoiceChannel && s.data.playerId !== playerId) {
          voicePeers.push(s.data.playerId)
        }
      }
    }
    console.log('[WebRTC 服务端] 发送 PEERS_LIST:', voicePeers, '到 socket', socket.id, 'playerId:', playerId)
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
    console.log('[WebRTC 服务端] OFFER relay:', 'from=', playerId, 'to=', targetId)
    io.to(targetId).emit(SERVER_EVENTS.WEBRTC_OFFER, {
      fromId: playerId,
      sdp,
    })
  })

  socket.on(CLIENT_EVENTS.WEBRTC_ANSWER, ({ targetId, sdp }: { targetId: string; sdp: any }) => {
    const { playerId } = socket.data
    if (!playerId) return
    console.log('[WebRTC 服务端] ANSWER relay:', 'from=', playerId, 'to=', targetId)
    io.to(targetId).emit(SERVER_EVENTS.WEBRTC_ANSWER, {
      fromId: playerId,
      sdp,
    })
  })

  socket.on(CLIENT_EVENTS.WEBRTC_ICE_CANDIDATE, ({ targetId, candidate }: { targetId: string; candidate: any }) => {
    const { playerId } = socket.data
    if (!playerId) return
    console.log('[WebRTC 服务端] ICE relay:', 'from=', playerId, 'to=', targetId)
    io.to(targetId).emit(SERVER_EVENTS.WEBRTC_ICE_CANDIDATE, {
      fromId: playerId,
      candidate,
    })
  })

  socket.on('disconnect', () => {
    if (socket.data.inVoiceChannel && socket.data.roomId) {
      const room = roomManager.getRoomById(socket.data.roomId)
      if (room) {
        console.log('[WebRTC 服务端] disconnect: sending PEER_LEFT for', socket.data.playerId)
        io.to(room.code).emit(SERVER_EVENTS.WEBRTC_PEER_LEFT, {
          playerId: socket.data.playerId,
        })
      }
    }
  })
}
