import { ref, shallowRef } from 'vue'
import { getSocket } from './useSocket'
import { useRoomStore } from '@/stores/room'
import { SERVER_EVENTS, CLIENT_EVENTS, WEBRTC_FFT_SIZE, WEBRTC_VAD_THRESHOLD, WEBRTC_VAD_INTERVAL_MS, WEBRTC_RECONNECT_DELAY_MS, WEBRTC_ICE_TIMEOUT_MS, WEBRTC_ICE_MAX_RETRIES } from '@draw-and-guess/shared'

let _turnConfig: RTCIceServer[] = []

const _isMuted = ref(false)
const _isDeafened = ref(false)
const _isVoiceActive = ref(false)
const _isForceMuted = ref(false)
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
  type: 'offer' | 'peer_joined' | 'ice_candidate'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
}
const _pendingEvents: PendingEvent[] = []
let _sharedAudioContext: AudioContext | null = null
const _iceTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
const _retryCounts = new Map<string, number>()
const _remoteAudioElements = new Map<string, HTMLAudioElement>()
const _pendingIceCandidates: { fromId: string; candidate: RTCIceCandidateInit }[] = []

const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: { ideal: true },
    noiseSuppression: { ideal: true },
    autoGainControl: { ideal: true },
  },
}

function applyMuteState(): void {
  const effectiveMuted = _isForceMuted.value || _isMuted.value
  const audioTracks = _localStream?.getAudioTracks() ?? []
  for (const track of audioTracks) {
    track.enabled = !effectiveMuted
  }
}

export function useWebRTC() {
  // 临时启用音频轨道，执行操作后恢复原状态
  // 确保 createOffer/createAnswer 生成的 SDP 包含有效的音频 m-line
  async function withEnabledAudioTracks<T>(fn: () => Promise<T>): Promise<T> {
    const tracksToReenable: MediaStreamTrack[] = []
    for (const track of _localStream?.getAudioTracks() ?? []) {
      if (!track.enabled) {
        track.enabled = true
        tracksToReenable.push(track)
      }
    }
    try {
      return await fn()
    } finally {
      for (const track of tracksToReenable) {
        track.enabled = false
      }
    }
  }

  async function joinVoice(): Promise<void> {
    try {
      // 每次加入语音都拉取最新的 TURN 凭证（凭证有效期 12h）
      try {
        const res = await fetch('/api/turn-config')
        const data = await res.json()
        if (data.url) {
          _turnConfig = [{ urls: data.url, username: data.username, credential: data.credential }]
        }
      } catch {
        console.warn('[WebRTC] 获取 TURN 配置失败，降级为仅 STUN')
      }

      destroyPeers()
      _isForceMuted.value = false

      if (!_sharedAudioContext || _sharedAudioContext.state === 'closed') {
        _sharedAudioContext = new AudioContext()
        _sharedAudioContext.onstatechange = () => {
          if (_sharedAudioContext?.state === 'suspended') {
            _sharedAudioContext.resume()
          }
        }
      }
      if (_sharedAudioContext.state === 'suspended') {
        await _sharedAudioContext.resume()
      }

      _localStream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS)
      _isMuted.value = true
      applyMuteState()
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
        } else if (evt.type === 'ice_candidate') {
          const d = evt.data as { fromId: string; candidate: RTCIceCandidateInit }
          handleIceCandidate(d.fromId, d.candidate)
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

  function resolveIceServers(): RTCConfiguration {
    const servers: RTCIceServer[] = []
    // TURN 前置，ICE 优先分配 relay candidate
    if (_turnConfig.length > 0) {
      servers.push(..._turnConfig)
    }
    const stunServer = import.meta.env.VITE_STUN_SERVER || 'stun:101.34.215.101:3478'
    servers.push(
      { urls: stunServer },
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    )
    return {
      iceServers: servers,
      iceCandidatePoolSize: 10,
    }
  }

  function leaveVoice(): void {
    _isForceMuted.value = false
    destroyPeers()
    if (_localStream) {
      _localStream.getTracks().forEach(t => {
        t.onended = null
        t.stop()
      })
      _localStream = null
    }
    if (_sharedAudioContext && _sharedAudioContext.state !== 'closed') {
      _sharedAudioContext.close()
      _sharedAudioContext = null
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
    _isForceMuted.value = true
    applyMuteState()
  }

  function forceUnmute(): void {
    _isForceMuted.value = false
    applyMuteState()
  }

  function setMuted(val: boolean): void {
    if (_isForceMuted.value) return
    _isMuted.value = val
    applyMuteState()
  }

  async function handlePeerJoined(playerId: string): Promise<void> {
    if (_peerConnections.has(playerId)) return
    const myId = useRoomStore().currentPlayerId ?? ''
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
    cleanupRemoteAudio(playerId)
    const t = _iceTimeouts.get(playerId)
    if (t) {
      clearTimeout(t)
      _iceTimeouts.delete(playerId)
    }
    _retryCounts.delete(playerId)
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
      flushPendingIceCandidates(fromId)

      // Fix B: setRemoteDescription 后可能新增 transceiver，再次修正 direction
      for (const t of pc.getTransceivers()) {
        if (t.receiver?.track?.kind === 'audio' && t.direction !== 'sendrecv') {
          t.direction = 'sendrecv'
        }
      }

      // Fix A: 确保 createAnswer 时音频轨道 enabled
      await withEnabledAudioTracks(async () => {
        const answer = await pc.createAnswer()
        console.log('[WebRTC] handleOffer: createAnswer OK for', fromId)
        await pc.setLocalDescription(answer)
        console.log('[WebRTC] handleOffer: setLocalDescription OK — sending ANSWER to', fromId)
        const socket = getSocket()
        socket?.emit(CLIENT_EVENTS.WEBRTC_ANSWER, {
          targetId: fromId,
          sdp: pc.localDescription,
        })
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
      flushPendingIceCandidates(fromId)
    } catch (e) {
      console.error('[WebRTC] handleAnswer ERROR for', fromId, ':', e, 'state:', pc.signalingState)
    }
  }

  function handleIceCandidate(fromId: string, candidate: RTCIceCandidateInit): void {
    const pc = _peerConnections.get(fromId)
    if (!pc) return
    if (pc.remoteDescription !== null) {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {
        console.error('[WebRTC] addIceCandidate error:', e)
      })
    } else {
      _pendingIceCandidates.push({ fromId, candidate })
    }
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
    const pc = new RTCPeerConnection(resolveIceServers())
    _peerConnections.set(targetId, pc)
    _peerCount.value = _peerConnections.size

    const _iceCandidateStats: Record<string, number> = {}

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const type = event.candidate.type ?? 'unknown'
        _iceCandidateStats[type] = (_iceCandidateStats[type] || 0) + 1
        console.log('[WebRTC] icecandidate for', targetId, 'type:', type)

        const socket = getSocket()
        socket?.emit(CLIENT_EVENTS.WEBRTC_ICE_CANDIDATE, {
          targetId,
          candidate: event.candidate,
        })
      } else {
        console.log('[WebRTC] ICE gathering done for', targetId, 'stats:', JSON.stringify(_iceCandidateStats))
      }
    }

    pc.onicecandidateerror = (event) => {
      console.error('[WebRTC] icecandidate error for', targetId, ':', event.errorCode, event.errorText, 'url:', event.url)
    }

    pc.ontrack = (event) => {
      console.log('[WebRTC] ontrack from:', targetId, 'streams:', event.streams.length)
      const remoteStream = event.streams[0] || (event.track ? new MediaStream([event.track]) : null)
      if (remoteStream) {
        console.log('[WebRTC] ontrack: got audio track, active:', remoteStream.getAudioTracks()[0]?.enabled)
        setupAnalyser(targetId, remoteStream)
        setupRemoteAudio(targetId, remoteStream)
      } else {
        console.warn('[WebRTC] ontrack: no stream or track for', targetId)
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (_peerConnections.get(targetId) !== pc) return
      console.log('[WebRTC] iceState:', targetId, pc.iceConnectionState)
      if (pc.iceConnectionState === 'failed') {
        console.warn('[WebRTC] ICE连接失败，触发重试:', targetId)
        pc.close()
        _peerConnections.delete(targetId)
        _peerCount.value = _peerConnections.size
        cleanupAnalyser(targetId)
        cleanupRemoteAudio(targetId)
        const t = _iceTimeouts.get(targetId)
        if (t) {
          clearTimeout(t)
          _iceTimeouts.delete(targetId)
        }
        const retryCount = _retryCounts.get(targetId) ?? 0
        if (retryCount < WEBRTC_ICE_MAX_RETRIES) {
          _retryCounts.set(targetId, retryCount + 1)
          const delay = Math.min(3000 * Math.pow(2, retryCount), 15000)
          console.warn('[WebRTC] 连接失败，', delay / 1000, '秒后重试 (第', retryCount + 1, '次)')
          const retryTimer = setTimeout(() => {
            if (_isVoiceActive.value && !_peerConnections.has(targetId)) {
              handlePeerJoined(targetId)
            }
          }, delay)
          _iceTimeouts.set(targetId, retryTimer)
        } else {
          console.error('[WebRTC] 连接失败次数达到上限，停止重试:', targetId)
        }
        updateConnectionQuality()
      }
    }

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] onconnectionstatechange:', targetId, pc.connectionState, '(isCurrent:', _peerConnections.get(targetId) === pc, ')')
      if (_peerConnections.get(targetId) !== pc) {
        console.log('[WebRTC] onconnectionstatechange SKIP:', targetId, pc.connectionState, '(stale PC)')
        return
      }
      if (pc.connectionState === 'connected') {
        const t = _iceTimeouts.get(targetId)
        if (t) {
          clearTimeout(t)
          _iceTimeouts.delete(targetId)
        }
        _retryCounts.delete(targetId)
      }
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        pc.close()
        _peerConnections.delete(targetId)
        _peerCount.value = _peerConnections.size
        cleanupAnalyser(targetId)
        cleanupRemoteAudio(targetId)
        const t = _iceTimeouts.get(targetId)
        if (t) {
          clearTimeout(t)
          _iceTimeouts.delete(targetId)
        }
        const retryCount = _retryCounts.get(targetId) ?? 0
        if (retryCount < WEBRTC_ICE_MAX_RETRIES) {
          _retryCounts.set(targetId, retryCount + 1)
          const delay = Math.min(3000 * Math.pow(2, retryCount), 15000)
          console.warn('[WebRTC] 连接失败，', delay / 1000, '秒后重试 (第', retryCount + 1, '次)')
          const retryTimer = setTimeout(() => {
            if (_isVoiceActive.value && !_peerConnections.has(targetId)) {
              handlePeerJoined(targetId)
            }
          }, delay)
          _iceTimeouts.set(targetId, retryTimer)
        } else {
          console.error('[WebRTC] 连接失败次数达到上限，停止重试:', targetId)
        }
      }
      updateConnectionQuality()
    }

    const iceTimeout = setTimeout(() => {
      if (_peerConnections.get(targetId) !== pc) return
      if (pc.connectionState !== 'connected') {
        console.warn('[WebRTC] ICE 连接超时:', targetId)
        pc.close()
        _peerConnections.delete(targetId)
        _peerCount.value = _peerConnections.size
        cleanupAnalyser(targetId)
        cleanupRemoteAudio(targetId)
        _iceTimeouts.delete(targetId)
        updateConnectionQuality()
        const retryCount = _retryCounts.get(targetId) ?? 0
        if (retryCount < WEBRTC_ICE_MAX_RETRIES) {
          _retryCounts.set(targetId, retryCount + 1)
          if (_isVoiceActive.value) {
            handlePeerJoined(targetId)
          }
        } else {
          console.error('[WebRTC] ICE超时重试次数达到上限，停止重试:', targetId)
        }
      }
    }, WEBRTC_ICE_TIMEOUT_MS)
    _iceTimeouts.set(targetId, iceTimeout)

    if (_localStream) {
      for (const track of _localStream.getAudioTracks()) {
        pc.addTrack(track, _localStream)
      }
    }

    // Fix B: 强制音频 transceiver direction = sendrecv
    // Safari 可能在 addTrack(track.enabled=false) 时就把 direction 设为 recvonly
    for (const t of pc.getTransceivers()) {
      if (t.sender?.track?.kind === 'audio' && t.direction !== 'sendrecv') {
        t.direction = 'sendrecv'
      }
    }

    if (isInitiator) {
      try {
        // Fix A: 确保 createOffer 时音频轨道 enabled，生成正确的 SDP
        await withEnabledAudioTracks(async () => {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          const socket = getSocket()
          socket?.emit(CLIENT_EVENTS.WEBRTC_OFFER, {
            targetId,
            sdp: pc.localDescription,
          })
        })
      } catch (e) {
        console.error('[WebRTC] createOffer error:', e)
      }
    }

    return pc
  }

  function setupAnalyser(playerId: string, stream: MediaStream): void {
    if (!_sharedAudioContext || _sharedAudioContext.state === 'closed') return
    const audioContext = _sharedAudioContext
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = WEBRTC_FFT_SIZE
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    source.connect(analyser)
    // 不连接到 destination：音频由 <audio> 元素播放，AnalyserNode 只做 VAD 检测，避免双音频

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
      entry.analyser.disconnect()
      _analyserNodes.delete(playerId)
    }
  }

  function setupRemoteAudio(playerId: string, stream: MediaStream): void {
    cleanupRemoteAudio(playerId)
    const audio = document.createElement('audio')
    audio.srcObject = stream
    audio.autoplay = true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(audio as any).playsInline = true
    audio.id = `remote-audio-${playerId}`
    audio.style.display = 'none'
    document.body.appendChild(audio)
    _remoteAudioElements.set(playerId, audio)
    console.log('[WebRTC] 远程音频元素已创建:', playerId)
  }

  function cleanupRemoteAudio(playerId: string): void {
    const audio = _remoteAudioElements.get(playerId)
    if (audio) {
      audio.srcObject = null
      audio.remove()
      _remoteAudioElements.delete(playerId)
    }
  }

  function flushPendingIceCandidates(fromId: string): void {
    const pc = _peerConnections.get(fromId)
    if (!pc || pc.remoteDescription === null) return
    for (let i = _pendingIceCandidates.length - 1; i >= 0; i--) {
      if (_pendingIceCandidates[i].fromId === fromId) {
        const { candidate } = _pendingIceCandidates.splice(i, 1)[0]
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {
          console.error('[WebRTC] addIceCandidate error (delayed):', e)
        })
      }
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
    for (const [id] of _remoteAudioElements) {
      cleanupRemoteAudio(id)
    }
    for (const [, t] of _iceTimeouts) {
      clearTimeout(t)
    }
    _iceTimeouts.clear()
    _retryCounts.clear()
    _pendingIceCandidates.length = 0
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
    if (!socket) {
      _signalingSetup = false
      return
    }
    console.log('[WebRTC] setupSignaling — registering listeners on socket:', socket.id)

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
    socket.on(SERVER_EVENTS.WEBRTC_PEERS_LIST, (data: { peers: string[] }) => {
      console.log('[WebRTC] <-- PEERS_LIST:', data.peers)
      for (const pid of data.peers) {
        handlePeerJoined(pid)
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
      if (!_voiceInitialized) {
        _pendingEvents.push({ type: 'ice_candidate', data })
        return
      }
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
    teardownSignaling()
  }

  return {
    isMuted: _isMuted,
    isDeafened: _isDeafened,
    isVoiceActive: _isVoiceActive,
    isForceMuted: _isForceMuted,
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
    setMuted,
    setupSignaling,
    teardownSignaling,
    destroyPeers,
    destroy,
  }
}
