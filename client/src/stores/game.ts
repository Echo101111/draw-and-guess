import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PlayerScore, ChatMessage } from '@draw-and-guess/shared'

export const useGameStore = defineStore('game', () => {
  const state = ref<'idle' | 'playing' | 'round_end' | 'game_over'>('idle')
  const currentRound = ref(0)
  const timeLeft = ref(0)
  const myRole = ref<'drawer' | 'guesser' | 'spectator'>('spectator')
  const scores = ref<PlayerScore[]>([])
  const chatMessages = ref<ChatMessage[]>([])
  const hasGuessedCorrectly = ref(false)

  // Phase 0: 只定义结构，不实现业务逻辑
  // 后续 Phase 实现: submitAnswer, sendChat, clearCanvas（drawer）

  return {
    state,
    currentRound,
    timeLeft,
    myRole,
    scores,
    chatMessages,
    hasGuessedCorrectly,
  }
})