import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useRoomStore } from '@/stores/room'
import { useCanvasStore } from '@/stores/canvas'
import { getSocket } from '@/composables/useSocket'
import { CLIENT_EVENTS, SERVER_EVENTS, type ChatMessage, type Point } from '@draw-and-guess/shared'

interface DrawerInfo {
  id: string
  nickname: string
}

interface ScoreEntry {
  playerId: string
  nickname: string
  score: number
  rank: number
}

interface RoundStartPayload {
  round: number
  totalRounds: number
  timeLeft: number
  drawer: DrawerInfo
  wordLength?: number
  wordCategory?: string
}

interface RoundStartToDrawerPayload {
  round: number
  totalRounds: number
  timeLeft: number
  word: string
  wordLength?: number
  wordCategory?: string
}

export const useGameStore = defineStore('game', () => {
  const state = ref<'idle' | 'playing' | 'round_end' | 'game_over'>('idle')
  const currentRound = ref(0)
  const totalRounds = ref(10)
  const timeLeft = ref(0)
  const totalTime = ref(90)
  const myRole = ref<'drawer' | 'guesser' | 'spectator'>('spectator')
  const scores = ref<ScoreEntry[]>([])
  const chatMessages = ref<ChatMessage[]>([])
  const hasGuessedCorrectly = ref(false)
  const currentWord = ref<string | null>(null)
  const currentDrawer = ref<DrawerInfo | null>(null)
  const strokes = ref<Array<{ playerId: string; points: Point[]; color: string; width: number; tool: string; strokeSeq?: number }>>([])
  const wordLength = ref(0)
  const wordCategory = ref<string | undefined>(undefined)
  const recentGuessers = ref<Array<{ playerId: string; nickname: string }>>([])

  const transitionData = ref<{
    word: string
    reason: string
    round: number
    totalRounds: number
    nextDrawer: DrawerInfo | null
  } | null>(null)

  const isMyTurn = computed(() => myRole.value === 'drawer')
  const canSubmitAnswer = computed(() => myRole.value === 'guesser' && !hasGuessedCorrectly.value && state.value === 'playing')
  const drawerNickname = computed(() => currentDrawer.value?.nickname ?? '')
  const wordPlaceholders = computed(() => {
    const len = wordLength.value
    if (len <= 0) return ''
    return `${len}个字`
  })
  const showCategoryHint = computed(() => {
    return !!wordCategory.value && state.value === 'playing'
  })

  let timerInterval: ReturnType<typeof setInterval> | null = null

  function startLocalTimer() {
    stopLocalTimer()
    timerInterval = setInterval(() => {
      if (timeLeft.value > 0) {
        timeLeft.value--
      }
    }, 1000)
  }

  function stopLocalTimer() {
    if (timerInterval !== null) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  function setupSocketListeners() {
    const socket = getSocket()
    const roomStore = useRoomStore()
    if (!socket) return

    socket.off(SERVER_EVENTS.ROUND_START)
    socket.on(SERVER_EVENTS.ROUND_START, (data: RoundStartPayload) => {
      state.value = 'playing'
      transitionData.value = null
      currentRound.value = data.round
      totalRounds.value = data.totalRounds
      timeLeft.value = data.timeLeft
      totalTime.value = data.timeLeft
      currentDrawer.value = data.drawer
      strokes.value = []
      useCanvasStore().clearCanvas()
      hasGuessedCorrectly.value = false
      wordLength.value = data.wordLength ?? 0
      wordCategory.value = data.wordCategory ?? undefined
      recentGuessers.value = []
      startLocalTimer()

      if (data.drawer.id === roomStore.currentPlayerId) {
        myRole.value = 'drawer'
      } else {
        myRole.value = 'guesser'
      }
    })

    socket.off(SERVER_EVENTS.ROUND_START_TO_DRAWER)
    socket.on(SERVER_EVENTS.ROUND_START_TO_DRAWER, (data: RoundStartToDrawerPayload) => {
      state.value = 'playing'
      transitionData.value = null
      currentRound.value = data.round
      totalRounds.value = data.totalRounds
      timeLeft.value = data.timeLeft
      totalTime.value = data.timeLeft
      currentWord.value = data.word
      wordLength.value = data.wordLength ?? data.word.length
      wordCategory.value = data.wordCategory ?? undefined
      strokes.value = []
      useCanvasStore().clearCanvas()
      hasGuessedCorrectly.value = false
      recentGuessers.value = []
      myRole.value = 'drawer'
      startLocalTimer()
    })

    socket.off(SERVER_EVENTS.DRAW_STROKE)
    socket.on(SERVER_EVENTS.DRAW_STROKE, (data: { playerId: string; points: Point[]; color: string; width: number; tool: string; strokeSeq?: number }) => {
      if (data.playerId === roomStore.currentPlayerId && !(data as { full?: boolean }).full) return
      const existing = data.strokeSeq !== undefined ? strokes.value.find(s => s.strokeSeq === data.strokeSeq) : undefined
      if (existing) {
        existing.points.push(...data.points)
        strokes.value = [...strokes.value]
      } else {
        strokes.value.push(data)
      }
    })

    socket.off(SERVER_EVENTS.CANVAS_CLEARED)
    socket.on(SERVER_EVENTS.CANVAS_CLEARED, () => {
      strokes.value = []
      useCanvasStore().clearCanvas()
    })

    socket.off(SERVER_EVENTS.ANSWER_RESULT)
    socket.on(SERVER_EVENTS.ANSWER_RESULT, (data: { playerId: string; nickname: string; correct: boolean }) => {
      if (data.correct) {
        if (data.playerId === roomStore.currentPlayerId) {
          hasGuessedCorrectly.value = true
        }
        if (!recentGuessers.value.some((g) => g.playerId === data.playerId)) {
          recentGuessers.value.push({ playerId: data.playerId, nickname: data.nickname })
        }
        addSystemMessage(`${data.nickname} 猜对了！`)
      }
    })

    socket.off(SERVER_EVENTS.SCOREBOARD_UPDATE)
    socket.on(SERVER_EVENTS.SCOREBOARD_UPDATE, (data: { scores: ScoreEntry[] }) => {
      scores.value = data.scores
    })

    socket.off(SERVER_EVENTS.TIMER_SYNC)
    socket.on(SERVER_EVENTS.TIMER_SYNC, (data: { timeLeft: number }) => {
      timeLeft.value = data.timeLeft
    })

    socket.off(SERVER_EVENTS.ROUND_END)
    socket.on(SERVER_EVENTS.ROUND_END, (data: { word: string; reason: string; round?: number; totalRounds?: number; nextDrawer?: DrawerInfo | null }) => {
      state.value = 'round_end'
      stopLocalTimer()
      strokes.value = []
      useCanvasStore().clearCanvas()
      transitionData.value = {
        word: data.word,
        reason: data.reason,
        round: data.round ?? currentRound.value,
        totalRounds: data.totalRounds ?? totalRounds.value,
        nextDrawer: data.nextDrawer ?? null,
      }
      addSystemMessage(`本轮结束，答案是：${data.word}`)
      if (data.reason === 'timeout') {
        addSystemMessage('时间到！')
      } else if (data.reason === 'all_guessed') {
        addSystemMessage('所有人都猜对了！')
      }
    })

    socket.off(SERVER_EVENTS.GAME_OVER)
    socket.on(SERVER_EVENTS.GAME_OVER, (data: { roomId: string; finalScores: ScoreEntry[]; winner: string | null }) => {
      state.value = 'game_over'
      stopLocalTimer()
      scores.value = data.finalScores
      if (data.winner) {
        addSystemMessage(`游戏结束！获胜者：${data.winner}`)
      }
    })

    socket.off(SERVER_EVENTS.CHAT_MESSAGE)
    socket.on(SERVER_EVENTS.CHAT_MESSAGE, (data: { playerId: string; nickname: string; text: string; isSystem: boolean; timestamp: number }) => {
      chatMessages.value.push({
        id: `${data.timestamp}-${data.playerId}`,
        playerId: data.playerId,
        nickname: data.nickname,
        text: data.text,
        isSystem: data.isSystem,
        timestamp: data.timestamp,
      })
    })
  }

  let sysMsgSeq = 0
  function addSystemMessage(text: string) {
    chatMessages.value.push({
      id: `sys-${Date.now()}-${++sysMsgSeq}`,
      playerId: null,
      nickname: null,
      text,
      isSystem: true,
      timestamp: Date.now(),
    })
  }

  function submitAnswer(answer: string) {
    if (!canSubmitAnswer.value) return
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit(CLIENT_EVENTS.SUBMIT_ANSWER, { answer })
    }
  }

  function sendChat(text: string) {
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit(CLIENT_EVENTS.CHAT_MESSAGE, { text })
    }
  }

  function drawStroke(points: Point[], color: string, width: number, tool: string, strokeSeq?: number) {
    if (!isMyTurn.value) return
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit(CLIENT_EVENTS.DRAW_STROKE, { points, color, width, tool, strokeSeq })
    }
  }

  function clearCanvas() {
    if (!isMyTurn.value) return
    strokes.value = []
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit(CLIENT_EVENTS.CLEAR_CANVAS)
    }
  }

  function addCompletedStroke(points: Point[], color: string, width: number, tool: string) {
    const roomStore = useRoomStore()
    if (!roomStore.currentPlayerId) return
    strokes.value.push({
      playerId: roomStore.currentPlayerId,
      points,
      color,
      width,
      tool,
    })
  }

  function resetGame() {
    stopLocalTimer()
    state.value = 'idle'
    currentRound.value = 0
    timeLeft.value = 0
    totalTime.value = 90
    myRole.value = 'spectator'
    scores.value = []
    hasGuessedCorrectly.value = false
    currentWord.value = null
    currentDrawer.value = null
    strokes.value = []
    chatMessages.value = []
    transitionData.value = null
    wordLength.value = 0
    wordCategory.value = undefined
    recentGuessers.value = []
  }

  return {
    state,
    currentRound,
    totalRounds,
    timeLeft,
    totalTime,
    myRole,
    scores,
    chatMessages,
    hasGuessedCorrectly,
    currentWord,
    currentDrawer,
    strokes,
    transitionData,
    isMyTurn,
    canSubmitAnswer,
    drawerNickname,
    wordLength,
    wordCategory,
    wordPlaceholders,
    showCategoryHint,
    recentGuessers,
    setupSocketListeners,
    submitAnswer,
    sendChat,
    drawStroke,
    clearCanvas,
    addCompletedStroke,
    resetGame,
  }
})
