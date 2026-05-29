import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useRoomStore } from '@/stores/room'
import { getSocket } from '@/composables/useSocket'
import { CLIENT_EVENTS, SERVER_EVENTS, CHAT_MESSAGE_LIMIT, CHAT_MESSAGE_KEEP, TIMER_RECALC_INTERVAL_MS, type ChatMessage } from '@draw-and-guess/shared'
import type { SpyPhase, SpyPlayer, SpyDescription, SpyVoteResult, SpyGameState } from '@draw-and-guess/shared'

interface ScoreEntry {
  playerId: string
  nickname: string
  score: number
  rank: number
}
interface VoteDetail {
  voterId: string
  voterName: string
  targetId: string
  targetName: string
}
interface EliminationResult {
  round: number
  eliminatedName: string | null
  voteCount: number
  totalVotes: number
  votes: Array<{ voterName: string; targetName: string }>
}
interface SpeakerInfo {
  playerId: string
  nickname: string
}

export const useSpyStore = defineStore('spy', () => {
  const phase = ref<SpyPhase>('idle')
  const round = ref(0)
  const totalRounds = ref(5)
  const players = ref<SpyPlayer[]>([])
  const myWord = ref('')
  const isSpy = ref(false)

  const currentSpeaker = ref<SpeakerInfo | null>(null)
  const descriptions = ref<SpyDescription[]>([])
  const hasDescribed = ref(false)
  const hasVoted = ref(false)
  const canDescribe = ref(false)

  const voteResult = ref<SpyVoteResult | null>(null)
  const winner = ref<'civilian' | 'spy' | null>(null)
  const scores = ref<ScoreEntry[]>([])
  const timeLeft = ref(0)
  const chatMessages = ref<ChatMessage[]>([])
  const lastEliminated = ref<string | null>(null)
  const roundEndReason = ref('')
  const votedCount = ref(0)
  const totalVoters = ref(0)
  const civilianWord = ref('')
  const spyWord = ref('')
  const voteTimeMax = ref(0)
  const voteDetails = ref<VoteDetail[]>([])
  const roundResults = ref<EliminationResult[]>([])
  const gameEliminationRound = ref(0)
  const describeCycle = ref(0)
  const phaseStartTime = ref<number | null>(null)
  const totalTimeForPhase = ref(0)

  const alivePlayers = computed(() => players.value.filter(p => p.isAlive))
  const aliveCount = computed(() => players.value.filter(p => p.isAlive).length)
  const eliminatedPlayers = computed(() => players.value.filter(p => !p.isAlive))
  const isMyTurnToSpeak = computed(() =>
    currentSpeaker.value?.playerId === useRoomStore().currentPlayerId
  )
  const currentSpeakerNickname = computed(() => currentSpeaker.value?.nickname ?? '')

  let localTimer: ReturnType<typeof setInterval> | null = null

  function calculateTimeLeft(): number {
    if (!phaseStartTime.value || totalTimeForPhase.value <= 0) return timeLeft.value
    const elapsed = (Date.now() - phaseStartTime.value) / 1000
    return Math.floor(Math.max(0, totalTimeForPhase.value - elapsed))
  }

  function startDisplayTimer() {
    stopDisplayTimer()
    timeLeft.value = calculateTimeLeft()
    localTimer = setInterval(() => {
      timeLeft.value = calculateTimeLeft()
    }, TIMER_RECALC_INTERVAL_MS)
  }

  function stopDisplayTimer() {
    if (localTimer !== null) {
      clearInterval(localTimer)
      localTimer = null
    }
  }

  function setupSocketListeners() {
    const socket = getSocket()
    const roomStore = useRoomStore()
    if (!socket) return

    socket.off(SERVER_EVENTS.SPY_WORD_ASSIGNED)
    socket.on(SERVER_EVENTS.SPY_WORD_ASSIGNED, (data: { word: string; isSpy: boolean }) => {
      myWord.value = data.word
      isSpy.value = data.isSpy
      phase.value = 'word_distribution'
    })

    socket.off(SERVER_EVENTS.SPY_PHASE_CHANGE)
    socket.on(SERVER_EVENTS.SPY_PHASE_CHANGE, (data: {
      phase: SpyPhase; round?: number; totalRounds?: number; timeLeft?: number;
      phaseStartTime?: number;
      describeCycle?: number;
      players?: Array<{
        id: string; nickname: string; isOwner: boolean; isAlive: boolean;
        description: string; voteTarget: string | null; voteCount: number; score: number; avatar: number;
      }>;
    }) => {
      phase.value = data.phase
      if (data.phase !== 'describing') {
        currentSpeaker.value = null
      }
      if (data.round !== undefined) {
        const prevRound = round.value
        round.value = data.round
        gameEliminationRound.value = data.round
        // 新淘汰局 → 清除旧描述
        if (data.phase === 'describing' && data.round !== prevRound) {
          descriptions.value = []
          hasDescribed.value = false
        }
      }
      if (data.totalRounds !== undefined) totalRounds.value = data.totalRounds
      if (data.timeLeft !== undefined) {
        timeLeft.value = data.timeLeft
        totalTimeForPhase.value = data.timeLeft
        phaseStartTime.value = data.phaseStartTime ?? null
        startDisplayTimer()
      }
      if (data.describeCycle !== undefined) describeCycle.value = data.describeCycle
      if (data.players && data.players.length > 0) {
        const selfId = roomStore.currentPlayerId
        players.value = data.players.map(p => ({
          id: p.id,
          nickname: p.nickname,
          isOwner: p.isOwner,
          isAlive: p.isAlive,
          isSpy: p.id === selfId ? isSpy.value : false,
          word: p.id === selfId ? myWord.value : '',
          description: p.description ?? '',
          voteTarget: p.voteTarget ?? null,
          voteCount: p.voteCount,
          score: p.score,
          sessionId: '',
          avatar: p.avatar ?? 0,
        }))
      }
      if (data.phase === 'voting' && data.timeLeft) {
        voteTimeMax.value = data.timeLeft
      }
      // 仅在真正的阶段切换时（携带 round 字段）重置状态
      // broadcastPublicPlayers 不携带 round，不应重置
      if (data.round !== undefined) {
        if (data.phase === 'voting') {
          hasVoted.value = false
          voteResult.value = null
        }
      }
    })

    socket.off(SERVER_EVENTS.SPY_SPEAKER_TURN)
    socket.on(SERVER_EVENTS.SPY_SPEAKER_TURN, (data: {
      playerId: string; nickname: string; timeLeft: number; phaseStartTime?: number
    }) => {
      currentSpeaker.value = { playerId: data.playerId, nickname: data.nickname }
      timeLeft.value = data.timeLeft
      totalTimeForPhase.value = data.timeLeft
      phaseStartTime.value = data.phaseStartTime ?? null
      canDescribe.value = data.playerId === roomStore.currentPlayerId
      startDisplayTimer()
    })

    socket.off(SERVER_EVENTS.SPY_DESCRIPTION)
    socket.on(SERVER_EVENTS.SPY_DESCRIPTION, (data: SpyDescription) => {
      descriptions.value = [...descriptions.value, data]
      if (data.playerId === roomStore.currentPlayerId) {
        hasDescribed.value = true
        canDescribe.value = false
      }
    })

    socket.off(SERVER_EVENTS.SPY_VOTE_RESULT)
    socket.on(SERVER_EVENTS.SPY_VOTE_RESULT, (data: SpyVoteResult) => {
      voteResult.value = data
      lastEliminated.value = data.eliminated
      stopDisplayTimer()
      phase.value = 'reveal'
      if (data.eliminated) {
        const p = players.value.find(pl => pl.id === data.eliminated)
        if (p) p.isAlive = false
      }
    })

    socket.off(SERVER_EVENTS.SPY_VOTE_PROGRESS)
    socket.on(SERVER_EVENTS.SPY_VOTE_PROGRESS, (data: {
      voted: number; total: number
    }) => {
      votedCount.value = data.voted
      totalVoters.value = data.total
    })

    socket.off(SERVER_EVENTS.SPY_ROUND_RESULT)
    socket.on(SERVER_EVENTS.SPY_ROUND_RESULT, (data: {
      eliminated: string | null; reason: string
      civilianWord?: string; spyWord?: string
    }) => {
      phase.value = 'round_end'
      lastEliminated.value = data.eliminated
      roundEndReason.value = data.reason
      if (data.civilianWord) civilianWord.value = data.civilianWord
      if (data.spyWord) spyWord.value = data.spyWord
    })

    socket.off(SERVER_EVENTS.SPY_GAME_OVER)
    socket.on(SERVER_EVENTS.SPY_GAME_OVER, (data: {
      roomId: string; winner: 'civilian' | 'spy' | null; finalScores: ScoreEntry[]
      civilianWord?: string; spyWord?: string
      players?: Array<{
        id: string; nickname: string; isOwner: boolean; isAlive: boolean
        isSpy: boolean; score: number; avatar: number
      }>
      voteDetails?: VoteDetail[]
      roundResults?: EliminationResult[]
    }) => {
      phase.value = 'game_over'
      winner.value = data.winner
      scores.value = data.finalScores
      if (data.civilianWord) civilianWord.value = data.civilianWord
      if (data.spyWord) spyWord.value = data.spyWord
      if (data.roundResults) roundResults.value = data.roundResults
      if (data.players) {
        players.value = data.players.map(p => ({
          id: p.id,
          nickname: p.nickname,
          isOwner: p.isOwner,
          isAlive: p.isAlive,
          isSpy: p.isSpy,
          score: p.score,
          avatar: p.avatar,
          word: '',
          description: '',
          voteTarget: null,
          voteCount: 0,
          sessionId: '',
        }))
      }
      if (data.voteDetails) {
        voteDetails.value = data.voteDetails
      }
      stopDisplayTimer()
    })

    socket.off(SERVER_EVENTS.SPY_GAME_STATE_SNAPSHOT)
    socket.on(SERVER_EVENTS.SPY_GAME_STATE_SNAPSHOT, (data: SpyGameState) => {
      phase.value = data.phase
      round.value = data.round
      gameEliminationRound.value = data.round
      totalRounds.value = data.totalRounds
      players.value = data.players
      phaseStartTime.value = data.phaseStartTime ?? null
      totalTimeForPhase.value = data.totalTime ?? 0

      // 直接使用服务器计算的 timeLeft
      if (data.phase === 'describing' || data.phase === 'discussion') {
        timeLeft.value = data.descriptionTimeLeft
      } else if (data.phase === 'voting') {
        timeLeft.value = data.voteTimeLeft
      }

      if (data.players.length > 0) {
        const me = data.players.find(p => p.id === roomStore.currentPlayerId)
        if (me) {
          myWord.value = me.word
          isSpy.value = me.isSpy
        }
      }
      // 如果有 phaseStartTime 和 totalTime，恢复倒计时
      if (data.phaseStartTime && data.totalTime && data.totalTime > 0) {
        startDisplayTimer()
      }
    })

    socket.off(SERVER_EVENTS.SPY_GAME_CONFIG_UPDATED)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on(SERVER_EVENTS.SPY_GAME_CONFIG_UPDATED, (data: any) => {
      if (data.config) {
        totalRounds.value = data.config.totalRounds
      }
    })

    socket.off(SERVER_EVENTS.CHAT_MESSAGE)
    socket.on(SERVER_EVENTS.CHAT_MESSAGE, (data: ChatMessage) => {
      chatMessages.value.push(data)
      if (chatMessages.value.length > CHAT_MESSAGE_LIMIT) {
        chatMessages.value = chatMessages.value.slice(-CHAT_MESSAGE_KEEP)
      }
    })
  }

  function teardownSocketListeners() {
    const socket = getSocket()
    if (!socket) return
    ;[
      SERVER_EVENTS.SPY_WORD_ASSIGNED,
      SERVER_EVENTS.SPY_PHASE_CHANGE,
      SERVER_EVENTS.SPY_SPEAKER_TURN,
      SERVER_EVENTS.SPY_DESCRIPTION,
      SERVER_EVENTS.SPY_VOTE_RESULT,
      SERVER_EVENTS.SPY_ROUND_RESULT,
      SERVER_EVENTS.SPY_GAME_OVER,
      SERVER_EVENTS.SPY_VOTE_PROGRESS,
      SERVER_EVENTS.SPY_GAME_STATE_SNAPSHOT,
      SERVER_EVENTS.SPY_GAME_CONFIG_UPDATED,
      SERVER_EVENTS.CHAT_MESSAGE,
    ].forEach(evt => socket.off(evt))
  }

  function submitDescription(text: string) {
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit(CLIENT_EVENTS.SPY_SUBMIT_DESCRIPTION, { text })
    }
  }

  function vote(targetId: string) {
    if (hasVoted.value) return
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit(CLIENT_EVENTS.SPY_VOTE, { targetId })
    }
    hasVoted.value = true
  }

  function readyNextRound() {
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit(CLIENT_EVENTS.SPY_READY_NEXT_ROUND)
    }
  }

  function sendChat(text: string) {
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit(CLIENT_EVENTS.CHAT_MESSAGE, { text })
    }
  }

  function resetGame() {
    stopDisplayTimer()
    phase.value = 'idle'
    round.value = 0
    players.value = []
    myWord.value = ''
    isSpy.value = false
    currentSpeaker.value = null
    descriptions.value = []
    hasDescribed.value = false
    hasVoted.value = false
    canDescribe.value = false
    voteResult.value = null
    winner.value = null
    scores.value = []
    timeLeft.value = 0
    phaseStartTime.value = null
    totalTimeForPhase.value = 0
    chatMessages.value = []
    lastEliminated.value = null
    votedCount.value = 0
    totalVoters.value = 0
    civilianWord.value = ''
    spyWord.value = ''
    voteTimeMax.value = 0
    voteDetails.value = []
    roundResults.value = []
    gameEliminationRound.value = 0
    describeCycle.value = 0
    roundEndReason.value = ''
  }

  return {
    phase, round, totalRounds, players, myWord, isSpy,
    currentSpeaker, descriptions, hasDescribed, hasVoted, canDescribe,
    voteResult, winner, scores, timeLeft, chatMessages, lastEliminated, roundEndReason,
    votedCount, totalVoters, civilianWord, spyWord, voteTimeMax,
    alivePlayers, aliveCount, eliminatedPlayers, isMyTurnToSpeak, currentSpeakerNickname, voteDetails, roundResults,
    gameEliminationRound, describeCycle, phaseStartTime, totalTimeForPhase,
    setupSocketListeners, teardownSocketListeners,
    submitDescription, vote, readyNextRound, sendChat, resetGame,
  }
})
