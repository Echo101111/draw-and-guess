import { SERVER_EVENTS } from '@draw-and-guess/shared'
import { roomManager } from '../rooms/index.js'
import { getRandomWord, getDifficultyForRound, getWordCategory, CATEGORY_DISPLAY_NAMES } from '../data/words.js'
import type { Room, Player, Point, SensitivityLevel, Stroke } from '@draw-and-guess/shared'

const SCORE_BASE = 100
const SCORE_DRAWER_BONUS = 50

interface RoundTimer {
  roomId: string
  timer: NodeJS.Timeout
  syncTimer: NodeJS.Timeout
}

export class GameManager {
  private roundTimers = new Map<string, RoundTimer>()
  private strokeHistory = new Map<string, Stroke[]>()
  private usedWords = new Map<string, Set<string>>()
  private currentDrawerId = new Map<string, string>()
  private lastDrawTime = new Map<string, number>()
  private static readonly DRAW_RATE_LIMIT_MS = 8 // ~125 events/s per player

  startRound(roomId: string): boolean {
    const room = roomManager.getRoomById(roomId)
    if (!room || room.state !== 'playing') return false

    const drawer = this.selectNextDrawer(room)
    if (!drawer) {
      this.endGame(roomId)
      return false
    }

    const sensitivityLevel: SensitivityLevel = room.players.length < 4 ? 'safe' : 'moderate'
    const difficulties = getDifficultyForRound(room.currentRound, room.totalRounds)
    const word = getRandomWord(this.getUsedWords(roomId), undefined, sensitivityLevel, difficulties)
    if (!word) {
      console.log(`[Round] startRound failed: no word available for room=${roomId}`)
      this.endGame(roomId)
      return false
    }

    this.getUsedWords(roomId).add(word)
    room.currentWord = word
    room.roundStartTime = Date.now()

    const wordCategory = getWordCategory(word)
    const wordCategoryName = wordCategory ? CATEGORY_DISPLAY_NAMES[wordCategory] : undefined

    const drawerData = {
      id: drawer.id,
      nickname: drawer.nickname,
      isOwner: drawer.isOwner,
      score: drawer.score,
      hasGuessedCorrectly: drawer.hasGuessedCorrectly,
    }

    const guesserData = room.players
      .filter((p) => p.id !== drawer.id)
      .map((p) => ({
        id: p.id,
        nickname: p.nickname,
        isOwner: p.isOwner,
        score: p.score,
        hasGuessedCorrectly: p.hasGuessedCorrectly,
      }))

    room.players.forEach((p) => {
      p.hasGuessedCorrectly = false
    })

    this.strokeHistory.set(roomId, [])
    this.currentDrawerId.set(roomId, drawer.id)

    console.log(`[Round] startRound room=${roomId} drawer=${drawer.nickname}(${drawer.id.slice(0,8)}) currentDrawerId=${drawer.id.slice(0,8)} round=${room.currentRound}`)

    const io = this.getIO()
    if (!io) return false

    io.to(drawer.id).emit(SERVER_EVENTS.ROUND_START_TO_DRAWER, {
      round: room.currentRound,
      totalRounds: room.totalRounds,
      word,
      timeLeft: room.roundDuration,
      wordCategory: wordCategoryName,
    })

    io.to(room.code).emit(SERVER_EVENTS.ROUND_START, {
      round: room.currentRound,
      totalRounds: room.totalRounds,
      drawer: drawerData,
      guessers: guesserData,
      timeLeft: room.roundDuration,
      wordLength: word.length,
      wordCategory: wordCategoryName,
    })

    this.startTimer(roomId, room.roundDuration)
    return true
  }

  submitAnswer(roomId: string, playerId: string, answer: string): { correct: boolean; score?: number } {
    const room = roomManager.getRoomById(roomId)
    if (!room || room.state !== 'playing') {
      return { correct: false }
    }

    const player = room.players.find((p) => p.id === playerId)
    if (!player || player.hasGuessedCorrectly) {
      return { correct: false }
    }

    if (!room.currentWord || !room.roundStartTime) {
      return { correct: false }
    }

    const normalizedAnswer = answer.trim().toLowerCase()
    const normalizedWord = room.currentWord.toLowerCase()

    if (normalizedAnswer !== normalizedWord) {
      return { correct: false }
    }

    player.hasGuessedCorrectly = true

    const elapsed = (Date.now() - room.roundStartTime) / 1000
    const timeBonus = Math.floor(SCORE_BASE * (1 - elapsed / room.roundDuration))
    const totalScore = SCORE_BASE + Math.max(0, timeBonus)

    player.score += totalScore

    const drawerId = this.currentDrawerId.get(roomId)
    const drawer = drawerId ? room.players.find((p) => p.id === drawerId) : undefined
    if (drawer) {
      drawer.score += SCORE_DRAWER_BONUS
    }

    const io = this.getIO()
    if (io) {
      io.to(room.code).emit(SERVER_EVENTS.ANSWER_RESULT, {
        playerId,
        nickname: player.nickname,
        correct: true,
        displayText: '猜对了！',
      })

      io.to(room.code).emit(SERVER_EVENTS.SCOREBOARD_UPDATE, {
        scores: this.getScoreboard(room),
      })
    }

    const allGuessed = room.players
      .filter((p) => p.id !== drawer?.id)
      .every((p) => p.hasGuessedCorrectly)

    if (allGuessed && drawer) {
      this.endRound(roomId, 'all_guessed')
    }

    return { correct: true, score: totalScore }
  }

  handleDrawStroke(roomId: string, playerId: string, socketId: string, points: Point[], color: string, width: number, tool: string): void {
    const room = roomManager.getRoomById(roomId)
    if (!room || room.state !== 'playing') {
      console.log(`[Draw] REJECT: room=${roomId} state=${room?.state} noplayer=${!room}`)
      return
    }

    const drawerId = this.currentDrawerId.get(roomId)
    if (!drawerId || drawerId !== playerId) {
      console.log(`[Draw] REJECT: playerId=${playerId} drawerId=${drawerId} players=[${room.players.map(p => `${p.nickname}(${p.id.slice(0,6)})`).join(',')}]`)
      return
    }

    // Rate limiting: ~125 events/s per player
    const now = Date.now()
    const lastTime = this.lastDrawTime.get(playerId) ?? 0
    if (now - lastTime < GameManager.DRAW_RATE_LIMIT_MS) {
      console.log(`[Draw] RATE_LIMIT: playerId=${playerId.slice(0,8)}`)
      return
    }
    this.lastDrawTime.set(playerId, now)

    const strokeEvent: Stroke = { playerId, points, color, width, tool: tool as 'brush' | 'eraser' }
    const roomStrokes = this.strokeHistory.get(roomId) ?? []
    roomStrokes.push(strokeEvent)
    this.strokeHistory.set(roomId, roomStrokes)

    const io = this.getIO()
    if (io) {
      // 排除画师自己，避免同一笔画被重复添加到 gameStore.strokes
      io.except(socketId).to(room.code).emit(SERVER_EVENTS.DRAW_STROKE, {
        playerId,
        points,
        color,
        width,
        tool,
      })
    }
  }

  clearCanvas(roomId: string, playerId: string): boolean {
    const room = roomManager.getRoomById(roomId)
    if (!room) return false

    const drawerId = this.currentDrawerId.get(roomId)
    if (!drawerId || drawerId !== playerId) return false

    this.strokeHistory.set(roomId, [])

    const io = this.getIO()
    if (io) {
      // 需要通知所有玩家（包括画师）以触发 gameStore.strokes 清空和画布重新渲染
      io.to(room.code).emit(SERVER_EVENTS.CANVAS_CLEARED, {
        by: playerId,
      })
    }

    return true
  }

  endRound(roomId: string, reason: 'timeout' | 'all_guessed'): void {
    const timer = this.roundTimers.get(roomId)
    if (timer) {
      clearInterval(timer.timer)
      clearInterval(timer.syncTimer)
      this.roundTimers.delete(roomId)
    }

    const room = roomManager.getRoomById(roomId)
    if (!room) return

    // 预选下一位画师，用于切换动画展示
    const nextDrawer = this.selectNextDrawer(room)

    const io = this.getIO()
    if (io) {
      io.to(room.code).emit(SERVER_EVENTS.ROUND_END, {
        word: room.currentWord ?? '',
        reason,
        round: room.currentRound,
        totalRounds: room.totalRounds,
        nextDrawer: nextDrawer
          ? { id: nextDrawer.id, nickname: nextDrawer.nickname }
          : null,
      })
    }

    // Auto-start next round after 3 seconds
    setTimeout(() => {
      const updatedRoom = roomManager.getRoomById(roomId)
      if (!updatedRoom || updatedRoom.state !== 'playing') return

      updatedRoom.currentRound++
      updatedRoom.currentWord = null
      updatedRoom.roundStartTime = null

      if (updatedRoom.currentRound > updatedRoom.totalRounds) {
        this.endGame(roomId)
        return
      }

      this.startRound(roomId)
    }, 3000)
  }

  endGame(roomId: string): boolean {
    this.clearTimer(roomId)

    const room = roomManager.getRoomById(roomId)
    if (!room) return false

    room.state = 'gameover'
    this.usedWords.delete(roomId)
    this.strokeHistory.delete(roomId)
    this.cleanupPlayerTimestamps(roomId)

    const scores = this.getScoreboard(room)
    const winner = scores.length > 0 ? scores[0].nickname : null

    const io = this.getIO()
    if (io) {
      io.to(room.code).emit(SERVER_EVENTS.GAME_OVER, {
        roomId,
        finalScores: scores,
        winner,
      })
    }

    return true
  }

  resetGame(roomId: string): void {
    this.clearTimer(roomId)
    this.usedWords.delete(roomId)
    this.strokeHistory.delete(roomId)
    this.currentDrawerId.delete(roomId)
    this.cleanupPlayerTimestamps(roomId)
    roomManager.resetGameState(roomId)
  }

  private cleanupPlayerTimestamps(roomId: string): void {
    const room = roomManager.getRoomById(roomId)
    if (!room) return
    for (const player of room.players) {
      this.lastDrawTime.delete(player.id)
    }
  }

  removePlayerTimestamps(playerId: string): void {
    this.lastDrawTime.delete(playerId)
  }

  getScoreboard(room: Room) {
    return room.players
      .map((p) => ({
        playerId: p.id,
        nickname: p.nickname,
        score: p.score,
      }))
      .sort((a, b) => b.score - a.score)
      .map((s, i) => ({ ...s, rank: i + 1 }))
  }

  private selectNextDrawer(room: Room): Player | null {
    if (room.players.length === 0) return null

    const players = room.players
    const prevDrawerId = this.currentDrawerId.get(room.id)

    // 按顺序轮转：上一轮画师的下一个玩家成为本轮画师
    const prevIndex = players.findIndex((p) => p.id === prevDrawerId)
    const nextIndex = prevIndex === -1 ? 0 : (prevIndex + 1) % players.length

    return players[nextIndex] ?? null
  }

  private startTimer(roomId: string, duration: number): void {
    this.clearTimer(roomId)

    let remaining = duration
    const room = roomManager.getRoomById(roomId)

    const syncTimer = setInterval(() => {
      const io = this.getIO()
      if (io && room) {
      io.to(room.code).emit(SERVER_EVENTS.TIMER_SYNC, {
        timeLeft: remaining,
      })
      }
    }, 5000)

    const timer = setInterval(() => {
      remaining--
      if (remaining <= 0) {
        this.clearTimer(roomId)
        this.endRound(roomId, 'timeout')
      }
    }, 1000)

    this.roundTimers.set(roomId, { roomId, timer, syncTimer })
  }

  private clearTimer(roomId: string): void {
    const t = this.roundTimers.get(roomId)
    if (t) {
      clearInterval(t.timer)
      clearInterval(t.syncTimer)
      this.roundTimers.delete(roomId)
    }
  }

  private getUsedWords(roomId: string): Set<string> {
    if (!this.usedWords.has(roomId)) {
      this.usedWords.set(roomId, new Set())
    }
    return this.usedWords.get(roomId)!
  }

  getStrokes(roomId: string): Stroke[] {
    return this.strokeHistory.get(roomId) ?? []
  }

  getCurrentDrawerId(roomId: string): string | undefined {
    return this.currentDrawerId.get(roomId)
  }

  /**
   * 为中途加入的玩家发送游戏快照（笔画、积分、计时器），
   * 不发送 ROUND_START，客户端 myRole 保持 'spectator'，
   * 下一轮 ROUND_START 广播时自动转为正式参与者。
   */
  sendSpectatorSnapshot(roomId: string, playerId: string): void {
    this.emitGameSnapshot(roomId, playerId)
  }

  restorePlayerState(roomId: string, playerId: string): void {
    const room = roomManager.getRoomById(roomId)
    if (!room || room.state !== 'playing') return

    const drawerId = this.currentDrawerId.get(roomId)
    if (!drawerId) return

    const drawer = room.players.find((p) => p.id === drawerId)
    if (!drawer) return

    const isDrawer = playerId === drawerId
    const timeLeft = this.emitGameSnapshot(roomId, playerId)
    if (timeLeft === null) return

    // 词语分类
    const wordCategory = room.currentWord ? getWordCategory(room.currentWord) : undefined
    const wordCategoryName = wordCategory && CATEGORY_DISPLAY_NAMES[wordCategory]
      ? CATEGORY_DISPLAY_NAMES[wordCategory]
      : undefined

    if (isDrawer) {
      const io = this.getIO()
      if (io) {
        io.to(playerId).emit(SERVER_EVENTS.ROUND_START_TO_DRAWER, {
          round: room.currentRound,
          totalRounds: room.totalRounds,
          word: room.currentWord ?? '',
          timeLeft,
          wordLength: room.currentWord?.length ?? 0,
          wordCategory: wordCategoryName,
        })
      }
    }

    const io = this.getIO()
    if (io) {
      io.to(playerId).emit(SERVER_EVENTS.ROUND_START, {
        round: room.currentRound,
        totalRounds: room.totalRounds,
        drawer: {
          id: drawer.id,
          nickname: drawer.nickname,
          isOwner: drawer.isOwner,
          score: drawer.score,
          hasGuessedCorrectly: drawer.hasGuessedCorrectly,
        },
        timeLeft,
        wordLength: room.currentWord?.length ?? 0,
        wordCategory: wordCategoryName,
      })
    }
  }

  /**
   * 发送通用游戏快照（积分榜、已有笔画、计时器），
   * 供 sendSpectatorSnapshot 和 restorePlayerState 复用。
   * 返回剩余秒数，失败返回 null。
   */
  private emitGameSnapshot(roomId: string, playerId: string): number | null {
    const room = roomManager.getRoomById(roomId)
    if (!room) return null
    const io = this.getIO()
    if (!io) return null

    const elapsed = room.roundStartTime
      ? Math.floor((Date.now() - room.roundStartTime) / 1000)
      : 0
    const timeLeft = Math.max(0, room.roundDuration - elapsed)

    io.to(playerId).emit(SERVER_EVENTS.SCOREBOARD_UPDATE, {
      scores: this.getScoreboard(room),
    })

    for (const stroke of this.getStrokes(roomId)) {
      io.to(playerId).emit(SERVER_EVENTS.DRAW_STROKE, stroke)
    }

    io.to(playerId).emit(SERVER_EVENTS.TIMER_SYNC, { timeLeft })

    return timeLeft
  }

  private getIO() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (global as any).io
  }
}

export const gameManager = new GameManager()