import { ref } from 'vue'
import { getSocket } from './useSocket'
import { SERVER_EVENTS, CLIENT_EVENTS } from '@draw-and-guess/shared'

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

export function useWebRTC() {
  const isMuted = ref(false)
  const isDeafened = ref(false)
  const isVoiceActive = ref(false)
  const speakingPeers = ref<Set<string>>(new Set())
  const peerCount = ref(0)

  let localStream: MediaStream | null = null
  const peerConnections = new Map<string, RTCPeerConnection>()
  const analyserNodes = new Map<string, { analyser: AnalyserNode; dataArray: Uint8Array; interval: number }>()

  async function joinVoice(): Promise<void> {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      isVoiceActive.value = true
      peerCount.value = 0

      const socket = getSocket()
      if (socket?.connected) {
        socket.emit(CLIENT_EVENTS.WEBRTC_JOIN_VOICE)
      }
    } catch (e) {
      console.warn('[WebRTC] Microphone access denied:', e)
    }
  }

  function leaveVoice(): void {
    destroyPeers()
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop())
      localStream = null
    }
    isVoiceActive.value = false
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit(CLIENT_EVENTS.WEBRTC_LEAVE_VOICE)
    }
  }

  function toggleMute(): void {
    isMuted.value = !isMuted.value
    const audioTracks = localStream?.getAudioTracks() ?? []
    for (const track of audioTracks) {
      track.enabled = !isMuted.value
    }
  }

  function toggleDeafen(): void {
    isDeafened.value = !isDeafened.value
    for (const pc of peerConnections.values()) {
      const receivers = pc.getReceivers()
      for (const r of receivers) {
        if (r.track) r.track.enabled = !isDeafened.value
      }
    }
  }

  async function handlePeerJoined(playerId: string): Promise<void> {
    if (peerConnections.has(playerId)) return
    await createPeerConnection(playerId, true)
  }

  function handlePeerLeft(playerId: string): void {
    const pc = peerConnections.get(playerId)
    if (pc) {
      pc.close()
      peerConnections.delete(playerId)
    }
    cleanupAnalyser(playerId)
    const sp = new Set(speakingPeers.value)
    sp.delete(playerId)
    speakingPeers.value = sp
    peerCount.value = peerConnections.size
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
    const pc = peerConnections.get(fromId)
    if (!pc) return
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
    } catch (e) {
      console.error('[WebRTC] handleAnswer error:', e)
    }
  }

  function handleIceCandidate(fromId: string, candidate: RTCIceCandidateInit): void {
    const pc = peerConnections.get(fromId)
    if (!pc) return
    pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {
      console.error('[WebRTC] addIceCandidate error:', e)
    })
  }

  async function createPeerConnection(targetId: string, isInitiator: boolean): Promise<RTCPeerConnection> {
    const pc = new RTCPeerConnection(ICE_SERVERS)
    peerConnections.set(targetId, pc)
    peerCount.value = peerConnections.size

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
        peerConnections.delete(targetId)
        peerCount.value = peerConnections.size
        cleanupAnalyser(targetId)
      }
    }

    if (localStream) {
      for (const track of localStream.getAudioTracks()) {
        pc.addTrack(track, localStream)
      }
    }

    if (isInitiator) {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      const socket = getSocket()
      socket?.emit(CLIENT_EVENTS.WEBRTC_OFFER, {
        targetId,
        sdp: pc.localDescription,
      })
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

      const sp = new Set(speakingPeers.value)
      if (avg > 15) {
        sp.add(playerId)
      } else {
        sp.delete(playerId)
      }
      speakingPeers.value = sp
    }, 200)

    analyserNodes.set(playerId, { analyser, dataArray, interval })
  }

  function cleanupAnalyser(playerId: string): void {
    const entry = analyserNodes.get(playerId)
    if (entry) {
      clearInterval(entry.interval)
      analyserNodes.delete(playerId)
    }
  }

  function destroyPeers(): void {
    for (const pc of peerConnections.values()) {
      pc.close()
    }
    peerConnections.clear()
    for (const [id] of analyserNodes) {
      cleanupAnalyser(id)
    }
    speakingPeers.value = new Set()
    peerCount.value = 0
  }

  function setupSignaling(): void {
    const socket = getSocket()

    socket.off(SERVER_EVENTS.WEBRTC_PEER_JOINED)
    socket.on(SERVER_EVENTS.WEBRTC_PEER_JOINED, (data: { playerId: string }) => {
      handlePeerJoined(data.playerId)
    })

    socket.off(SERVER_EVENTS.WEBRTC_PEER_LEFT)
    socket.on(SERVER_EVENTS.WEBRTC_PEER_LEFT, (data: { playerId: string }) => {
      handlePeerLeft(data.playerId)
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
    const socket = getSocket()
    if (!socket) return
    ;[
      SERVER_EVENTS.WEBRTC_PEER_JOINED,
      SERVER_EVENTS.WEBRTC_PEER_LEFT,
      SERVER_EVENTS.WEBRTC_OFFER,
      SERVER_EVENTS.WEBRTC_ANSWER,
      SERVER_EVENTS.WEBRTC_ICE_CANDIDATE,
    ].forEach(evt => socket.off(evt))
  }

  return {
    isMuted,
    isDeafened,
    isVoiceActive,
    speakingPeers,
    peerCount,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    setupSignaling,
    teardownSignaling,
    destroyPeers,
  }
}
