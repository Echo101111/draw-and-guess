import { ref, shallowRef } from 'vue'
import { getSocket } from './useSocket'
import { SERVER_EVENTS, CLIENT_EVENTS, WEBRTC_FFT_SIZE, WEBRTC_VAD_THRESHOLD, WEBRTC_VAD_INTERVAL_MS, WEBRTC_RECONNECT_DELAY_MS } from '@draw-and-guess/shared'

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

const _isMuted = ref(false)
const _isDeafened = ref(false)
const _isVoiceActive = ref(false)
const _isForceMuted = ref(false)
const _isPttActive = ref(false)
const _speakingPeers = shallowRef(new Set<string>())
const _peerCount = ref(0)
const _micError = ref('')
const _connectionQuality = ref<'good' | 'poor' | 'disconnected'>('disconnected')
let _localStream: MediaStream | null = null
const _peerConnections = new Map<string, RTCPeerConnection>()
const _analyserNodes = new Map<string, { analyser: AnalyserNode; dataArray: Uint8Array; interval: number; audioContext: AudioContext }>()
let _signalingSetup = false
let _voiceInitialized = false
interface PendingEvent {
  type: 'offer' | 'peer_joined'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
}
const _pendingEvents: PendingEvent[] = []

const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: { ideal: true },
    noiseSuppression: { ideal: true },
    autoGainControl: { ideal: true },
  },
}

function applyMuteState(): void {
  const effectiveMuted = !_isPttActive.value && (_isForceMuted.value || _isMuted.value)
  const audioTracks = _localStream?.getAudioTracks() ?? []
  for (const track of audioTracks) {
    track.enabled = !effectiveMuted
  }
}

export function useWebRTC() {
  async function joinVoice(): Promise<void> {
    try {
      destroyPeers()
      _isForceMuted.value = false
      _isPttActive.value = false

      _localStream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS)
      _isVoiceActive.value = true
      _micError.value = ''
      _peerCount.value = 0

      for (const track of _localStream.getAudioTracks()) {
        track.onended = () => {
          _micError.value = '麦克风设备已断开，请检查连接后重试'
        }
      }

      // 处理 getUserMedia 期间积压的信令事件（此时 _localStream 已就绪）
      _voiceInitialized = true
      const backlog = _pendingEvents.splice(0)
      for (const evt of backlog) {
        if (evt.type === 'peer_joined') {
          handlePeerJoined((evt.data as { playerId: string }).playerId)
        } else if (evt.type === 'offer') {
          const d = evt.data as { fromId: string; sdp: RTCSessionDescriptionInit }
          handleOffer(d.fromId, d.sdp)
        }
      }

      const socket = getSocket()
      if (socket?.connected) {
        socket.emit(CLIENT_EVENTS.WEBRTC_JOIN_VOICE)
      }
    } catch (e) {
      _isVoiceActive.value = false
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
    _isForceMuted.value = false
    _isPttActive.value = false
    destroyPeers()
    if (_localStream) {
      _localStream.getTracks().forEach(t => {
        t.onended = null
        t.stop()
      })
      _localStream = null
    }
    _isVoiceActive.value = false
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit(CLIENT_EVENTS.WEBRTC_LEAVE_VOICE)
    }
  }

  function toggleMute(): void {
    if (_isForceMuted.value) return
    _isMuted.value = !_isMuted.value
    applyMuteState()
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

  function forceMute(): void {
    _isPttActive.value = false
    _isForceMuted.value = true
    applyMuteState()
  }

  function forceUnmute(): void {
    _isForceMuted.value = false
    applyMuteState()
  }

  function startPtt(): void {
    _isPttActive.value = true
    applyMuteState()
  }

  function stopPtt(): void {
    _isPttActive.value = false
    applyMuteState()
  }

  function setMuted(val: boolean): void {
    if (_isForceMuted.value) return
    _isMuted.value = val
    applyMuteState()
  }

  async function handlePeerJoined(playerId: string): Promise<void> {
    if (_peerConnections.has(playerId)) return
    const myId = (getSocket() as any)?.data?.playerId ?? ''
    const isInitiator = myId < playerId
    await createPeerConnection(playerId, isInitiator)
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
    updateConnectionQuality()
  }

  async function handleOffer(fromId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    console.log('[WebRTC] <-- OFFER from:', fromId, 'SDP type:', sdp.type)
    const pc = await createPeerConnection(fromId, false)
    console.log('[WebRTC] handleOffer: PC created for', fromId, 'state:', pc.signalingState, 'iceState:', pc.iceConnectionState)
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      console.log('[WebRTC] handleOffer: setRemoteDescription OK for', fromId)
      const answer = await pc.createAnswer()
      console.log('[WebRTC] handleOffer: createAnswer OK for', fromId)
      await pc.setLocalDescription(answer)
      console.log('[WebRTC] handleOffer: setLocalDescription OK — sending ANSWER to', fromId)
      const socket = getSocket()
      socket?.emit(CLIENT_EVENTS.WEBRTC_ANSWER, {
        targetId: fromId,
        sdp: pc.localDescription,
      })
    } catch (e) {
      console.error('[WebRTC] handleOffer ERROR for', fromId, ':', e)
    }
  }

  async function handleAnswer(fromId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const pc = _peerConnections.get(fromId)
    if (!pc) {
      console.warn('[WebRTC] handleAnswer: NO PC found for', fromId, '— ignoring')
      return
    }
    console.log('[WebRTC] <-- ANSWER from:', fromId, 'PC state:', pc.signalingState, pc.connectionState)
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      console.log('[WebRTC] handleAnswer: setRemoteDescription OK for', fromId, 'new state:', pc.connectionState)
    } catch (e) {
      console.error('[WebRTC] handleAnswer ERROR for', fromId, ':', e, 'state:', pc.signalingState)
    }
  }

  function handleIceCandidate(fromId: string, candidate: RTCIceCandidateInit): void {
    const pc = _peerConnections.get(fromId)
    if (!pc) return
    pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {
      console.error('[WebRTC] addIceCandidate error:', e)
    })
  }

  function updateConnectionQuality(): void {
    const size = _peerConnections.size
    if (size === 0) {
      _connectionQuality.value = 'disconnected'
      return
    }
    let failedCount = 0
    let connectedCount = 0
    for (const pc of _peerConnections.values()) {
      const state = pc.connectionState
      if (state === 'connected') connectedCount++
      if (state === 'failed' || state === 'disconnected') failedCount++
    }
    if (failedCount === size) {
      _connectionQuality.value = 'disconnected'
    } else if (failedCount > 0 || connectedCount < size) {
      _connectionQuality.value = 'poor'
    } else {
      _connectionQuality.value = 'good'
    }
  }

  async function createPeerConnection(targetId: string, isInitiator: boolean): Promise<RTCPeerConnection> {
    const old = _peerConnections.get(targetId)
    if (old) {
      console.log('[WebRTC] createPeerConnection:', targetId, 'closing old PC')
      old.close()
      cleanupAnalyser(targetId)
    }
    console.log('[WebRTC] createPeerConnection:', targetId, 'isInitiator:', isInitiator, 'total peers:', _peerConnections.size + 1)
    const pc = new RTCPeerConnection(ICE_SERVERS)
    _peerConnections.set(targetId, pc)
    _peerCount.value = _peerConnections.size

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] icecandidate for', targetId, 'type:', event.candidate.type, 'addr:', event.candidate.address)
        const socket = getSocket()
        socket?.emit(CLIENT_EVENTS.WEBRTC_ICE_CANDIDATE, {
          targetId,
          candidate: event.candidate,
        })
      }
    }

    pc.ontrack = (event) => {
      console.log('[WebRTC] ontrack from:', targetId, 'streams:', event.streams.length)
      if (event.streams.length > 0) {
        const remoteStream = event.streams[0]
        console.log('[WebRTC] ontrack: got audio track, active:', remoteStream.getAudioTracks()[0]?.enabled)
        const audioEl = document.createElement('audio')
        audioEl.srcObject = remoteStream
        audioEl.autoplay = true
        audioEl.setAttribute('playsinline', 'true')
        document.body.appendChild(audioEl)
        audioEl.play().catch(e => console.warn('[WebRTC] autoplay blocked:', e))
        setupAnalyser(targetId, remoteStream)
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (_peerConnections.get(targetId) !== pc) return
      console.log('[WebRTC] iceState:', targetId, pc.iceConnectionState)
    }

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] onconnectionstatechange:', targetId, pc.connectionState, '(isCurrent:', _peerConnections.get(targetId) === pc, ')')
      // Guard: only act if this PC is still the current one in the map
      if (_peerConnections.get(targetId) !== pc) {
        console.log('[WebRTC] onconnectionstatechange SKIP:', targetId, pc.connectionState, '(stale PC)')
        return
      }
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        _peerConnections.delete(targetId)
        _peerCount.value = _peerConnections.size
        cleanupAnalyser(targetId)
        if (_isPttActive.value && _peerConnections.size === 0) {
          _isPttActive.value = false
          applyMuteState()
        }
      }
      updateConnectionQuality()
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
    if (audioContext.state === 'suspended') {
      audioContext.resume()
    }
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = WEBRTC_FFT_SIZE
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    source.connect(analyser)

    const interval = window.setInterval(() => {
      analyser.getByteFrequencyData(dataArray)
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length

      const sp = new Set(_speakingPeers.value)
      if (avg > WEBRTC_VAD_THRESHOLD) {
        sp.add(playerId)
      } else {
        sp.delete(playerId)
      }
      _speakingPeers.value = sp
    }, WEBRTC_VAD_INTERVAL_MS)
 
     _analyserNodes.set(playerId, { analyser, dataArray, interval, audioContext })
  }

  function cleanupAnalyser(playerId: string): void {
    const entry = _analyserNodes.get(playerId)
    if (entry) {
      clearInterval(entry.interval)
      entry.audioContext.close()
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
    _connectionQuality.value = 'disconnected'
  }

  function handleSocketReconnect(): void {
    if (_isVoiceActive.value) {
      destroyPeers()
      setTimeout(() => {
        const sock = getSocket()
        if (sock?.connected) {
          sock.emit(CLIENT_EVENTS.WEBRTC_JOIN_VOICE)
        }
      }, WEBRTC_RECONNECT_DELAY_MS)
    }
  }

  function setupSignaling(): void {
    if (_signalingSetup) return
    _signalingSetup = true

    const socket = getSocket()
    console.log('[WebRTC] setupSignaling — registering listeners on socket:', socket?.id)

    socket.off('connect', handleSocketReconnect)
    socket.on('connect', handleSocketReconnect)

    socket.off(SERVER_EVENTS.WEBRTC_PEER_JOINED)
    socket.on(SERVER_EVENTS.WEBRTC_PEER_JOINED, (data: { playerId: string }) => {
      if (!_voiceInitialized) {
        _pendingEvents.push({ type: 'peer_joined', data })
        return
      }
      console.log('[WebRTC] <-- PEER_JOINED:', data.playerId)
      handlePeerJoined(data.playerId)
    })

    socket.off(SERVER_EVENTS.WEBRTC_PEER_LEFT)
    socket.on(SERVER_EVENTS.WEBRTC_PEER_LEFT, (data: { playerId: string }) => {
      handlePeerLeft(data.playerId)
    })

    socket.off(SERVER_EVENTS.WEBRTC_PEERS_LIST)
    socket.on(SERVER_EVENTS.WEBRTC_PEERS_LIST, async (data: { peers: string[] }) => {
      console.log('[WebRTC] <-- PEERS_LIST:', data.peers)
      for (const pid of data.peers) {
        await handlePeerJoined(pid)
      }
    })

    socket.off(SERVER_EVENTS.WEBRTC_OFFER)
    socket.on(SERVER_EVENTS.WEBRTC_OFFER, (data: { fromId: string; sdp: RTCSessionDescriptionInit }) => {
      if (!_voiceInitialized) {
        _pendingEvents.push({ type: 'offer', data })
        return
      }
      console.log('[WebRTC] <-- OFFER from:', data.fromId, 'SDP type:', data.sdp.type)
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
    socket.off('connect', handleSocketReconnect)
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
      _localStream.getTracks().forEach(t => {
        t.onended = null
        t.stop()
      })
      _localStream = null
    }
    _isForceMuted.value = false
    _isPttActive.value = false
    teardownSignaling()
  }

  return {
    isMuted: _isMuted,
    isDeafened: _isDeafened,
    isVoiceActive: _isVoiceActive,
    isForceMuted: _isForceMuted,
    isPttActive: _isPttActive,
    speakingPeers: _speakingPeers,
    peerCount: _peerCount,
    micError: _micError,
    connectionQuality: _connectionQuality,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    clearMicError,
    forceMute,
    forceUnmute,
    startPtt,
    stopPtt,
    setMuted,
    setupSignaling,
    teardownSignaling,
    destroyPeers,
    destroy,
  }
}
