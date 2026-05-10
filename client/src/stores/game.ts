import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
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

export const useGameStore = defineStore('game', () => {
  const state = ref<'idle' | 'playing' | 'round_end' | 'game_over'>('idle')
  const currentRound = ref(0)
  const totalRounds = ref(10)
  const timeLeft = ref(0)
  const myRole = ref<'drawer' | 'guesser' | 'spectator'>('spectator')
  const scores = ref<ScoreEntry[]>([])
  const chatMessages = ref<ChatMessage[]>([])
  const hasGuessedCorrectly = ref(false)
  const currentWord = ref<string | null>(null)
  const currentDrawer = ref<DrawerInfo | null>(null)
  const strokes = ref<Array<{ playerId: string; points: Point[]; color: string; width: number; tool: string }>>([])

  const isMyTurn = computed(() => myRole.value === 'drawer')
  const canSubmitAnswer = computed(() => myRole.value === 'guesser' && !hasGuessedCorrectly.value && state.value === 'playing')
  const drawerNickname = computed(() => currentDrawer.value?.nickname ?? '')

  function setupSocketListeners() {
    const socket = getSocket()
    if (!socket) return

    socket.on(SERVER_EVENTS.ROUND_START, (data) => {
      state.value = 'playing'
      currentRound.value = data.round
      totalRounds.value = data.totalRounds
      timeLeft.value = data.timeLeft
      currentDrawer.value = data.drawer
      strokes.value = []
      hasGuessedCorrectly.value = false

      const myPlayerId = getSocket().id
      if (data.drawer.id === myPlayerId) {
        myRole.value = 'drawer'
      } else {
        myRole.value = 'guesser'
      }
    })

    socket.on(SERVER_EVENTS.ROUND_START_TO_DRAWER, (data) => {
      state.value = 'playing'
      currentRound.value = data.round
      totalRounds.value = data.totalRounds
      timeLeft.value = data.timeLeft
      currentWord.value = data.word
      strokes.value = []
      hasGuessedCorrectly.value = false
      myRole.value = 'drawer'
    })

    socket.on(SERVER_EVENTS.DRAW_STROKE, (data) => {
      strokes.value.push(data)
    })

    socket.on(SERVER_EVENTS.CANVAS_CLEARED, () => {
      strokes.value = []
    })

    socket.on(SERVER_EVENTS.ANSWER_RESULT, (data) => {
      if (data.correct) {
        const socket = getSocket()
        if (data.playerId === socket.id) {
          hasGuessedCorrectly.value = true
        }
        addSystemMessage(`${data.nickname} 猜对了！`)
      }
    })

    socket.on(SERVER_EVENTS.SCOREBOARD_UPDATE, (data) => {
      scores.value = data.scores
    })

    socket.on(SERVER_EVENTS.TIMER_SYNC, (data) => {
      timeLeft.value = data.timeLeft
    })

    socket.on(SERVER_EVENTS.ROUND_END, (data) => {
      state.value = 'round_end'
      addSystemMessage(`本轮结束，答案是：${data.word}`)
      if (data.reason === 'timeout') {
        addSystemMessage('时间到！')
      } else if (data.reason === 'all_guessed') {
        addSystemMessage('所有人都猜对了！')
      }
    })

    socket.on(SERVER_EVENTS.GAME_OVER, (data) => {
      state.value = 'game_over'
      scores.value = data.finalScores
      if (data.winner) {
        addSystemMessage(`游戏结束！获胜者：${data.winner}`)
      }
    })

    socket.on(SERVER_EVENTS.CHAT_MESSAGE, (data) => {
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

  function addSystemMessage(text: string) {
    chatMessages.value.push({
      id: `sys-${Date.now()}`,
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

  function drawStroke(points: Point[], color: string, width: number, tool: string) {
    if (!isMyTurn.value) return
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit(CLIENT_EVENTS.DRAW_STROKE, { points, color, width, tool })
    }
  }

  function clearCanvas() {
    if (!isMyTurn.value) return
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit(CLIENT_EVENTS.CLEAR_CANVAS)
    }
  }

  function resetGame() {
    state.value = 'idle'
    currentRound.value = 0
    timeLeft.value = 0
    myRole.value = 'spectator'
    scores.value = []
    hasGuessedCorrectly.value = false
    currentWord.value = null
    currentDrawer.value = null
    strokes.value = []
    chatMessages.value = []
  }

  return {
    state,
    currentRound,
    totalRounds,
    timeLeft,
    myRole,
    scores,
    chatMessages,
    hasGuessedCorrectly,
    currentWord,
    currentDrawer,
    strokes,
    isMyTurn,
    canSubmitAnswer,
    drawerNickname,
    setupSocketListeners,
    submitAnswer,
    sendChat,
    drawStroke,
    clearCanvas,
    resetGame,
  }
})