import { ref, shallowRef } from 'vue'
import { getSocket } from './useSocket'
import { SERVER_EVENTS, CLIENT_EVENTS } from '@draw-and-guess/shared'

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

// Singleton state — shared across all calls to useWebRTC()
const _isMuted = ref(false)
const _isDeafened = ref(false)
const _isVoiceActive = ref(false)
const _speakingPeers = shallowRef(new Set<string>())
const _peerCount = ref(0)
const _micError = ref('')
let _localStream: MediaStream | null = null
const _peerConnections = new Map<string, RTCPeerConnection>()
const _analyserNodes = new Map<string, { analyser: AnalyserNode; dataArray: Uint8Array; interval: number }>()
let _signalingSetup = false

export function useWebRTC() {
  async function joinVoice(): Promise<void> {
    try {
      _localStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      _isVoiceActive.value = true
      _micError.value = ''
      _peerCount.value = 0

      const socket = getSocket()
      if (socket?.connected) {
        socket.emit(CLIENT_EVENTS.WEBRTC_JOIN_VOICE)
      }
    } catch (e) {
      console.warn('[WebRTC] Microphone access denied:', e)
      const err = e as DOMException
      if (err.name === 'NotAllowedError') {
        _micError.value = '麦克风权限被拒绝。请点击浏览器地址栏左侧的🔒或⚠️图标，找到「麦克风」设为「允许」，然后刷新页面重试。'
      } else if (err.name === 'NotFoundError') {
        _micError.value = '未检测到麦克风。请确认麦克风已连接，或在系统设置中检查输入设备。'
      } else if (err.name === 'NotReadableError') {
        _micError.value = '麦克风被其他应用占用。请关闭其他使用麦克风的程序后重试。'
      } else {
        _micError.value = '无法访问麦克风，请检查浏览器权限和系统音频设置。'
      }
    }
  }

  function leaveVoice(): void {
    destroyPeers()
    if (_localStream) {
      _localStream.getTracks().forEach(t => t.stop())
      _localStream = null
    }
    _isVoiceActive.value = false
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit(CLIENT_EVENTS.WEBRTC_LEAVE_VOICE)
    }
  }

  function toggleMute(): void {
    _isMuted.value = !_isMuted.value
    const audioTracks = _localStream?.getAudioTracks() ?? []
    for (const track of audioTracks) {
      track.enabled = !_isMuted.value
    }
  }

  function toggleDeafen(): void {
    _isDeafened.value = !_isDeafened.value
    for (const pc of _peerConnections.values()) {
      const receivers = pc.getReceivers()
      for (const r of receivers) {
        if (r.track) r.track.enabled = !_isDeafened.value
      }
    }
  }

  function clearMicError(): void {
    _micError.value = ''
  }

  async function handlePeerJoined(playerId: string): Promise<void> {
    if (_peerConnections.has(playerId)) return
    await createPeerConnection(playerId, true)
  }

  function handlePeerLeft(playerId: string): void {
    const pc = _peerConnections.get(playerId)
    if (pc) {
      pc.close()
      _peerConnections.delete(playerId)
    }
    cleanupAnalyser(playerId)
    const sp = new Set(_speakingPeers.value)
    sp.delete(playerId)
    _speakingPeers.value = sp
    _peerCount.value = _peerConnections.size
  }

  async function handleOffer(fromId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const pc = await createPeerConnection(fromId, false)
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      const socket = getSocket()
      socket?.emit(CLIENT_EVENTS.WEBRTC_ANSWER, {
        targetId: fromId,
        sdp: pc.localDescription,
      })
    } catch (e) {
      console.error('[WebRTC] handleOffer error:', e)
    }
  }

  async function handleAnswer(fromId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const pc = _peerConnections.get(fromId)
    if (!pc) return
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
    } catch (e) {
      console.error('[WebRTC] handleAnswer error:', e)
    }
  }

  function handleIceCandidate(fromId: string, candidate: RTCIceCandidateInit): void {
    const pc = _peerConnections.get(fromId)
    if (!pc) return
    pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {
      console.error('[WebRTC] addIceCandidate error:', e)
    })
  }

  async function createPeerConnection(targetId: string, isInitiator: boolean): Promise<RTCPeerConnection> {
    const pc = new RTCPeerConnection(ICE_SERVERS)
    _peerConnections.set(targetId, pc)
    _peerCount.value = _peerConnections.size

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket()
        socket?.emit(CLIENT_EVENTS.WEBRTC_ICE_CANDIDATE, {
          targetId,
          candidate: event.candidate,
        })
      }
    }

    pc.ontrack = (event) => {
      if (event.streams.length > 0) {
        const remoteStream = event.streams[0]
        setupAnalyser(targetId, remoteStream)
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        _peerConnections.delete(targetId)
        _peerCount.value = _peerConnections.size
        cleanupAnalyser(targetId)
      }
    }

    if (_localStream) {
      for (const track of _localStream.getAudioTracks()) {
        pc.addTrack(track, _localStream)
      }
    }

    if (isInitiator) {
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        const socket = getSocket()
        socket?.emit(CLIENT_EVENTS.WEBRTC_OFFER, {
          targetId,
          sdp: pc.localDescription,
        })
      } catch (e) {
        console.error('[WebRTC] createOffer error:', e)
      }
    }

    return pc
  }

  function setupAnalyser(playerId: string, stream: MediaStream): void {
    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    source.connect(analyser)

    const interval = window.setInterval(() => {
      analyser.getByteFrequencyData(dataArray)
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length

      const sp = new Set(_speakingPeers.value)
      if (avg > 15) {
        sp.add(playerId)
      } else {
        sp.delete(playerId)
      }
      _speakingPeers.value = sp
    }, 200)

    _analyserNodes.set(playerId, { analyser, dataArray, interval })
  }

  function cleanupAnalyser(playerId: string): void {
    const entry = _analyserNodes.get(playerId)
    if (entry) {
      clearInterval(entry.interval)
      _analyserNodes.delete(playerId)
    }
  }

  function destroyPeers(): void {
    for (const pc of _peerConnections.values()) {
      pc.close()
    }
    _peerConnections.clear()
    for (const [id] of _analyserNodes) {
      cleanupAnalyser(id)
    }
    _speakingPeers.value = new Set()
    _peerCount.value = 0
  }

  function setupSignaling(): void {
    if (_signalingSetup) return
    _signalingSetup = true

    const socket = getSocket()

    socket.off(SERVER_EVENTS.WEBRTC_PEER_JOINED)
    socket.on(SERVER_EVENTS.WEBRTC_PEER_JOINED, (data: { playerId: string }) => {
      handlePeerJoined(data.playerId)
    })

    socket.off(SERVER_EVENTS.WEBRTC_PEER_LEFT)
    socket.on(SERVER_EVENTS.WEBRTC_PEER_LEFT, (data: { playerId: string }) => {
      handlePeerLeft(data.playerId)
    })

    socket.off(SERVER_EVENTS.WEBRTC_PEERS_LIST)
    socket.on(SERVER_EVENTS.WEBRTC_PEERS_LIST, async (data: { peers: string[] }) => {
      for (const pid of data.peers) {
        await handlePeerJoined(pid)
      }
    })

    socket.off(SERVER_EVENTS.WEBRTC_OFFER)
    socket.on(SERVER_EVENTS.WEBRTC_OFFER, (data: { fromId: string; sdp: RTCSessionDescriptionInit }) => {
      handleOffer(data.fromId, data.sdp)
    })

    socket.off(SERVER_EVENTS.WEBRTC_ANSWER)
    socket.on(SERVER_EVENTS.WEBRTC_ANSWER, (data: { fromId: string; sdp: RTCSessionDescriptionInit }) => {
      handleAnswer(data.fromId, data.sdp)
    })

    socket.off(SERVER_EVENTS.WEBRTC_ICE_CANDIDATE)
    socket.on(SERVER_EVENTS.WEBRTC_ICE_CANDIDATE, (data: { fromId: string; candidate: RTCIceCandidateInit }) => {
      handleIceCandidate(data.fromId, data.candidate)
    })
  }

  function teardownSignaling(): void {
    _signalingSetup = false
    const socket = getSocket()
    if (!socket) return
    ;[
      SERVER_EVENTS.WEBRTC_PEER_JOINED,
      SERVER_EVENTS.WEBRTC_PEER_LEFT,
      SERVER_EVENTS.WEBRTC_PEERS_LIST,
      SERVER_EVENTS.WEBRTC_OFFER,
      SERVER_EVENTS.WEBRTC_ANSWER,
      SERVER_EVENTS.WEBRTC_ICE_CANDIDATE,
    ].forEach(evt => socket.off(evt))
  }

  function destroy(): void {
    destroyPeers()
    if (_localStream) {
      _localStream.getTracks().forEach(t => t.stop())
      _localStream = null
    }
    teardownSignaling()
  }

  return {
    isMuted: _isMuted,
    isDeafened: _isDeafened,
    isVoiceActive: _isVoiceActive,
    speakingPeers: _speakingPeers,
    peerCount: _peerCount,
    micError: _micError,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    clearMicError,
    setupSignaling,
    teardownSignaling,
    destroyPeers,
    destroy,
  }
}
