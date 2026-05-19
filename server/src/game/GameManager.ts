import { SERVER_EVENTS } from '@draw-and-guess/shared'
import { roomManager } from '../rooms/index.js'
import { getWordCategory, CATEGORY_DISPLAY_NAMES, WORD_CATEGORIES, WORDS } from '../data/words.js'
import { matchAnswer } from '../data/wordIndex.js'
import { getAllCustomWordEntries } from '../data/customWordBank.js'
import type { Room, Player, Point, Stroke, CustomWord } from '@draw-and-guess/shared'
import type { WordCategory } from '../data/words.js'

const SCORE_BASE = 100
const SCORE_DRAWER_BONUS = 50
const WORD_SELECTION_TIMEOUT_MS = 30000

interface RoundTimer {
  roomId: string
  timer: NodeJS.Timeout
  syncTimer: NodeJS.Timeout
  remaining: number
}

interface WordOption {
  word: string
  category?: string
}

interface PendingSelection {
  drawerId: string
  options: WordOption[]
}

export class GameManager {
  private roundTimers = new Map<string, RoundTimer>()
  private nextRoundTimers = new Map<string, NodeJS.Timeout>()
  private strokeHistory = new Map<string, Stroke[]>()
  private strokeSeqIndex = new Map<string, Map<string, Stroke>>()
  private usedWords = new Map<string, Set<string>>()
  private currentDrawerId = new Map<string, string>()
  private lastDrawTime = new Map<string, number>()
  private lastAnswerTime = new Map<string, number>()
  private customWordOrder = new Map<string, CustomWord[]>()
  private undoneStrokes = new Map<string, Set<string>>()
  private pendingWordSelection = new Map<string, PendingSelection>()
  private wordSelectionTimers = new Map<string, NodeJS.Timeout>()
  private static readonly DRAW_RATE_LIMIT_MS = 8
  private static readonly ANSWER_COOLDOWN_MS = 200
  private pruneTimer: NodeJS.Timeout | null = null

  constructor() {
    this.pruneTimer = setInterval(() => this.prune(), 300_000) // 每5分钟清理
  }

  destroy(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer)
      this.pruneTimer = null
    }
  }

  startRound(roomId: string): boolean {
    const room = roomManager.getRoomById(roomId)
    if (!room || room.state !== 'playing') return false

    this.clearWordSelection(roomId)

    const drawer = this.selectNextDrawer(room)
    if (!drawer) {
      this.endGame(roomId)
      return false
    }

    const io = this.getIO()
    if (!io) return false

    room.players.forEach((p) => {
      p.hasGuessedCorrectly = false
      p.isSpectator = false
      const socketId = roomManager.getPlayerSocketId(p.id)
      if (socketId) {
        const socket = io.sockets.sockets.get(socketId)
        if (socket) {
          delete socket.data.isSpectator
        }
      }
    })

    this.strokeHistory.set(roomId, [])
    this.strokeSeqIndex.delete(roomId)
    this.undoneStrokes.delete(roomId)
    this.roundEnding.delete(roomId)
    this.currentDrawerId.set(roomId, drawer.id)

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

    // 自定义词库：直接选一个词开始，不走 5 选 1
    if (room.wordConfig.customWords.length > 0) {
      return this.startCustomRound(room, drawer, drawerData, guesserData)
    }

    // 默认词库：5 选 1
    return this.startSelectionRound(room, drawer, drawerData, guesserData)
  }

  private startCustomRound(room: Room, drawer: Player, drawerData: object, guesserData: object): boolean {
    if (!this.customWordOrder.has(room.id)) {
      const shuffled = [...room.wordConfig.customWords]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      this.customWordOrder.set(room.id, shuffled)
    }
    const order = this.customWordOrder.get(room.id)!
    const idx = room.currentRound - 1
    if (idx >= order.length) {
      this.endGame(room.id)
      return false
    }
    const entry = order[idx]
    const word = entry.word
    const wordCategoryName = CATEGORY_DISPLAY_NAMES[entry.category as WordCategory] ?? (entry.category || undefined)

    room.currentWord = word
    room.roundStartTime = Date.now()

    const io = this.getIO()
    if (io) {
      io.to(drawer.id).emit(SERVER_EVENTS.ROUND_START_TO_DRAWER, {
        round: room.currentRound,
        totalRounds: room.totalRounds,
        word,
        timeLeft: room.roundDuration,
        wordLength: word.length,
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
    }

    this.startTimer(room.id, room.roundDuration)
    return true
  }

  private startSelectionRound(room: Room, drawer: Player, drawerData: object, guesserData: object): boolean {
    const io = this.getIO()
    if (!io) return false

    const options = this.selectWordOptions(room)
    this.pendingWordSelection.set(room.id, { drawerId: drawer.id, options })

    io.to(drawer.id).emit(SERVER_EVENTS.WORD_SELECTION, {
      options: options.map((o) => ({ word: o.word, category: o.category })),
      round: room.currentRound,
      totalRounds: room.totalRounds,
      drawer: drawerData,
      guessers: guesserData,
    })

    io.to(room.code).except(drawer.id).emit(SERVER_EVENTS.WORD_SELECTING, {
      round: room.currentRound,
      totalRounds: room.totalRounds,
      drawer: drawerData,
      guessers: guesserData,
    })

    const selectionTimer = setTimeout(() => {
      if (!this.pendingWordSelection.has(room.id)) return
      this.handleWordSelection(room.id, drawer.id, options[0].word)
    }, WORD_SELECTION_TIMEOUT_MS)
    this.wordSelectionTimers.set(room.id, selectionTimer)

    return true
  }

  handleWordSelection(roomId: string, playerId: string, selectedWord: string): boolean {
    const pending = this.pendingWordSelection.get(roomId)
    if (!pending) return false
    if (pending.drawerId !== playerId) return false
    if (!pending.options.some((o) => o.word === selectedWord)) return false

    this.clearWordSelection(roomId)

    const room = roomManager.getRoomById(roomId)
    if (!room || room.state !== 'playing') return false

    room.currentWord = selectedWord
    room.roundStartTime = Date.now()

    const drawerId = this.currentDrawerId.get(roomId)
    const drawer = drawerId ? room.players.find((p) => p.id === drawerId) : undefined
    const wc = getWordCategory(selectedWord)
    const wordCategoryName = wc ? CATEGORY_DISPLAY_NAMES[wc] : undefined

    const drawerData = {
      id: drawerId ?? '',
      nickname: drawer?.nickname ?? '',
      isOwner: drawer?.isOwner ?? false,
      score: drawer?.score ?? 0,
      hasGuessedCorrectly: drawer?.hasGuessedCorrectly ?? false,
    }

    const guesserData = room.players
      .filter((p) => p.id !== drawerId)
      .map((p) => ({
        id: p.id,
        nickname: p.nickname,
        isOwner: p.isOwner,
        score: p.score,
        hasGuessedCorrectly: p.hasGuessedCorrectly,
      }))

    const io = this.getIO()
    if (io) {
      io.to(drawerId!).emit(SERVER_EVENTS.ROUND_START_TO_DRAWER, {
        round: room.currentRound,
        totalRounds: room.totalRounds,
        word: selectedWord,
        timeLeft: room.roundDuration,
        wordLength: selectedWord.length,
        wordCategory: wordCategoryName,
      })

      io.to(room.code).emit(SERVER_EVENTS.ROUND_START, {
        round: room.currentRound,
        totalRounds: room.totalRounds,
        drawer: drawerData,
        guessers: guesserData,
        timeLeft: room.roundDuration,
        wordLength: selectedWord.length,
        wordCategory: wordCategoryName,
      })
    }

    this.startTimer(roomId, room.roundDuration)
    return true
  }

  private clearWordSelection(roomId: string): void {
    this.pendingWordSelection.delete(roomId)
    const st = this.wordSelectionTimers.get(roomId)
    if (st) {
      clearTimeout(st)
      this.wordSelectionTimers.delete(roomId)
    }
  }

  private selectWordOptions(room: Room): WordOption[] {
    const used = this.getUsedWords(room.id)

    const enabledCategories = room.wordConfig.enabledCategories?.length
      ? room.wordConfig.enabledCategories
      : WORD_CATEGORIES

    const enabledCustomCats = room.wordConfig.enabledCustomCategories ?? []

    // Phase 1: 房主自定义词汇（仅限启用的自定义分类）
    const perRoomCustom = enabledCustomCats.length > 0
      ? room.wordConfig.customWords.filter(w => enabledCustomCats.includes(w.category))
      : room.wordConfig.customWords

    if (perRoomCustom.length > 0) {
      if (!this.customWordOrder.has(room.id)) {
        const shuffled = [...perRoomCustom]
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        this.customWordOrder.set(room.id, shuffled)
      }
      const order = this.customWordOrder.get(room.id)!
      const startIdx = room.currentRound - 1
      const options: WordOption[] = []
      for (let i = startIdx; i < order.length && options.length < 5; i++) {
        const entry = order[i]
        if (!used.has(entry.word)) {
          options.push({ word: entry.word, category: entry.category })
          used.add(entry.word)
        }
      }
      if (options.length > 0) return options
    }

    // Phase 2: 内置词库 + 全局贡献词（按启用的分类）
    const categories = [...enabledCategories]
    for (let i = categories.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [categories[i], categories[j]] = [categories[j], categories[i]]
    }

    const options: WordOption[] = []

    // 收集全局贡献词（按启用的自定义分类过滤）
    const allGlobalCustomWords = getAllCustomWordEntries()
    const globalCustomPool = enabledCustomCats.length > 0
      ? allGlobalCustomWords.filter(e => enabledCustomCats.includes(e.category))
      : []

    let attempts = 0
    while (options.length < 5 && attempts < 50) {
      attempts++
      for (const cat of categories) {
        if (options.length >= 5) break
        const catWords = WORDS[cat]
        if (!catWords) continue
        const available = catWords.filter((e) => !used.has(e.word))
        if (available.length === 0) continue
        const idx = Math.floor(Math.random() * available.length)
        const entry = available[idx]
        if (!options.some((o) => o.word === entry.word)) {
          options.push({ word: entry.word, category: CATEGORY_DISPLAY_NAMES[cat] })
          used.add(entry.word)
        }
      }
      // 每轮内置分类选词后，也加入一个全局贡献词候选
      if (globalCustomPool.length > 0 && options.length < 5) {
        const availCustom = globalCustomPool.filter(e => !used.has(e.word))
        if (availCustom.length > 0) {
          const idx = Math.floor(Math.random() * availCustom.length)
          const entry = availCustom[idx]
          if (!options.some((o) => o.word === entry.word)) {
            options.push({ word: entry.word, category: entry.category })
            used.add(entry.word)
          }
        }
      }
    }

    // 保底：从已启用的内置分类里选
    while (options.length < 5) {
      const allEnabled = enabledCategories.flatMap(c => WORDS[c] ?? [])
      const available = allEnabled.filter(e => !used.has(e.word))
      if (available.length === 0) break
      const idx = Math.floor(Math.random() * available.length)
      const entry = available[idx]
      if (!options.some((o) => o.word === entry.word)) {
        const cat = getWordCategory(entry.word)
        options.push({ word: entry.word, category: cat ? CATEGORY_DISPLAY_NAMES[cat] : undefined })
        used.add(entry.word)
      }
    }
    // 保底：从全局贡献词里选
    while (options.length < 5 && globalCustomPool.length > 0) {
      const available = globalCustomPool.filter(e => !used.has(e.word))
      if (available.length === 0) break
      const idx = Math.floor(Math.random() * available.length)
      const entry = available[idx]
      if (!options.some((o) => o.word === entry.word)) {
        options.push({ word: entry.word, category: entry.category })
        used.add(entry.word)
      }
    }

    return options
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

    // 自定义词库房间：房主只能当画师或观战，不能猜题
    if (room.wordConfig.customWords.length > 0 && player.isOwner) {
      return { correct: false }
    }

    if (!room.currentWord || !room.roundStartTime) {
      return { correct: false }
    }

    const now = Date.now()
    const lastAns = this.lastAnswerTime.get(playerId) ?? 0
    if (now - lastAns < GameManager.ANSWER_COOLDOWN_MS) {
      return { correct: false }
    }
    this.lastAnswerTime.set(playerId, now)

    if (!matchAnswer(answer, room.currentWord, room.wordConfig.looseMatching)) {
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

  handleDrawStroke(roomId: string, playerId: string, _socketId: string, points: Point[], color: string, width: number, tool: string, strokeSeq?: number, skipRateLimit?: boolean): void {
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

    // 拒绝已撤销的笔画增量
    if (strokeSeq !== undefined) {
      const undone = this.undoneStrokes.get(roomId)
      if (undone?.has(`${playerId}:${strokeSeq}`)) {
        return
      }
    }

    // Rate limiting: per-(playerId:strokeSeq) ~125 events/s
    if (!skipRateLimit) {
      const rateKey = strokeSeq !== undefined ? `${playerId}:${strokeSeq}` : playerId
      const now = Date.now()
      const lastTime = this.lastDrawTime.get(rateKey) ?? 0
      if (now - lastTime < GameManager.DRAW_RATE_LIMIT_MS) {
        console.log(`[Draw] RATE_LIMIT: key=${rateKey.slice(0,14)}`)
        return
      }
      this.lastDrawTime.set(rateKey, now)
    }

    const roomStrokes = this.strokeHistory.get(roomId) ?? []
    let existing: Stroke | undefined
    if (strokeSeq !== undefined) {
      const idx = this.strokeSeqIndex.get(roomId)
      existing = idx?.get(`${playerId}:${strokeSeq}`)
    }
    if (existing) {
      existing.points.push(...points)
    } else {
      const newStroke: Stroke = { playerId, points, color, width, tool: tool as 'brush' | 'eraser', strokeSeq }
      roomStrokes.push(newStroke)
      if (strokeSeq !== undefined) {
        let idx = this.strokeSeqIndex.get(roomId)
        if (!idx) { idx = new Map(); this.strokeSeqIndex.set(roomId, idx) }
        idx.set(`${playerId}:${strokeSeq}`, newStroke)
      }
    }
    this.strokeHistory.set(roomId, roomStrokes)

    const io = this.getIO()
    if (io) {
      io.to(room.code).emit(SERVER_EVENTS.DRAW_STROKE, {
        playerId,
        points,
        color,
        width,
        tool,
        strokeSeq,
      })
      if (strokeSeq !== undefined) {
        io.to(playerId).emit(SERVER_EVENTS.ACK_STROKE, {
          strokeSeq,
          pointCount: points.length,
        })
      }
    }
  }

  undoStroke(roomId: string, playerId: string): boolean {
    const room = roomManager.getRoomById(roomId)
    if (!room || room.state !== 'playing') return false

    const drawerId = this.currentDrawerId.get(roomId)
    if (!drawerId || drawerId !== playerId) return false

    const strokes = this.strokeHistory.get(roomId)
    if (!strokes || strokes.length === 0) return false

    let removedIdx = -1
    let removedStroke: Stroke | undefined
    for (let i = strokes.length - 1; i >= 0; i--) {
      if (strokes[i].playerId === playerId) {
        removedStroke = strokes[i]
        removedIdx = i
        break
      }
    }
    if (!removedStroke) return false

    strokes.splice(removedIdx, 1)

    // 标记已撤销，阻止延迟增量点
    if (removedStroke.strokeSeq !== undefined) {
      const key = `${playerId}:${removedStroke.strokeSeq}`
      let undone = this.undoneStrokes.get(roomId)
      if (!undone) { undone = new Set(); this.undoneStrokes.set(roomId, undone) }
      undone.add(key)
      // 清理 strokeSeqIndex
      this.strokeSeqIndex.get(roomId)?.delete(key)
    }

    const io = this.getIO()
    if (io) {
      io.to(room.code).emit(SERVER_EVENTS.STROKE_UNDONE, {
        playerId,
        strokeSeq: removedStroke.strokeSeq,
      })
    }

    return true
  }

  resyncStrokes(roomId: string, playerId: string, strokes: Array<{ points: Point[]; color: string; width: number; tool: string; strokeSeq?: number }>): void {
    const room = roomManager.getRoomById(roomId)
    if (!room) return

    const roomStrokes = this.strokeHistory.get(roomId) ?? []
    let idx = this.strokeSeqIndex.get(roomId)
    for (const s of strokes) {
      const key = s.strokeSeq !== undefined ? `${playerId}:${s.strokeSeq}` : undefined
      const existing = key ? idx?.get(key) : undefined
      if (existing) {
        existing.points.push(...s.points)
      } else {
        const ns: Stroke = { playerId, points: s.points, color: s.color, width: s.width, tool: s.tool as 'brush' | 'eraser', strokeSeq: s.strokeSeq }
        roomStrokes.push(ns)
        if (key) {
          if (!idx) { idx = new Map(); this.strokeSeqIndex.set(roomId, idx) }
          idx.set(key, ns)
        }
      }
    }
    this.strokeHistory.set(roomId, roomStrokes)
  }

  clearCanvas(roomId: string, playerId: string, socketId: string): boolean {
    const room = roomManager.getRoomById(roomId)
    if (!room) return false

    const drawerId = this.currentDrawerId.get(roomId)
    if (!drawerId || drawerId !== playerId) return false

    this.strokeHistory.set(roomId, [])

    const io = this.getIO()
    if (io) {
      io.except(socketId).to(room.code).emit(SERVER_EVENTS.CANVAS_CLEARED, {
        by: playerId,
      })
    }

    return true
  }

  private roundEnding = new Set<string>()

  endRound(roomId: string, reason: 'timeout' | 'all_guessed'): void {
    if (this.roundEnding.has(roomId)) return
    this.roundEnding.add(roomId)

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
    const existing = this.nextRoundTimers.get(roomId)
    if (existing) clearTimeout(existing)
    this.nextRoundTimers.set(roomId, setTimeout(() => {
      this.nextRoundTimers.delete(roomId)
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
    }, 3000))
  }

  endGame(roomId: string): boolean {
    this.clearTimer(roomId)

    const room = roomManager.getRoomById(roomId)
    if (!room) return false

    room.state = 'gameover'
    room.wordConfig.customWords = []
    this.clearNextRoundTimer(roomId)
    this.clearWordSelection(roomId)
    this.usedWords.delete(roomId)
    this.strokeHistory.delete(roomId)
    this.strokeSeqIndex.delete(roomId)
    this.undoneStrokes.delete(roomId)
    this.roundEnding.delete(roomId)
    this.currentDrawerId.delete(roomId)
    this.customWordOrder.delete(roomId)
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
      // Sync cleared customWords to clients so the word config modal shows accurate state
      io.to(room.code).emit(SERVER_EVENTS.WORD_CONFIG_UPDATED, { wordConfig: room.wordConfig })
    }

    return true
  }

  resetGame(roomId: string): void {
    this.clearTimer(roomId)
    this.clearNextRoundTimer(roomId)
    this.clearWordSelection(roomId)
    this.usedWords.delete(roomId)
    this.strokeHistory.delete(roomId)
    this.strokeSeqIndex.delete(roomId)
    this.undoneStrokes.delete(roomId)
    this.roundEnding.delete(roomId)
    this.currentDrawerId.delete(roomId)
    this.customWordOrder.delete(roomId)
    this.cleanupPlayerTimestamps(roomId)
    roomManager.resetGameState(roomId)
  }

  private cleanupPlayerTimestamps(roomId: string): void {
    const room = roomManager.getRoomById(roomId)
    if (!room) return
    for (const player of room.players) {
      this.removePlayerTimestamps(player.id)
    }
  }

  removePlayerTimestamps(playerId: string): void {
    for (const key of this.lastDrawTime.keys()) {
      if (key === playerId || key.startsWith(playerId + ':')) {
        this.lastDrawTime.delete(key)
      }
    }
    this.lastAnswerTime.delete(playerId)
  }

  private prune(): void {
    const activePlayers = new Set<string>()
    for (const room of roomManager.getAllRooms()) {
      for (const p of room.players) {
        activePlayers.add(p.id)
      }
    }
    for (const key of this.lastDrawTime.keys()) {
      const colonIdx = key.indexOf(':')
      const pid = colonIdx >= 0 ? key.slice(0, colonIdx) : key
      if (!activePlayers.has(pid)) this.lastDrawTime.delete(key)
    }
    for (const key of this.lastAnswerTime.keys()) {
      if (!activePlayers.has(key)) this.lastAnswerTime.delete(key)
    }
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

    // 轮转查找下一个在线玩家（sessionId 非空 = 在线）
    const prevIndex = players.findIndex((p) => p.id === prevDrawerId)
    const startIndex = prevIndex === -1 ? 0 : (prevIndex + 1) % players.length
    for (let i = 0; i < players.length; i++) {
      const idx = (startIndex + i) % players.length
      if (players[idx].sessionId) return players[idx]
    }
    return null
  }

  private startTimer(roomId: string, duration: number): void {
    this.clearTimer(roomId)
    const room = roomManager.getRoomById(roomId)
    if (!room) return

    const roundTimer: RoundTimer = {
      roomId,
      timer: null as unknown as NodeJS.Timeout,
      syncTimer: null as unknown as NodeJS.Timeout,
      remaining: duration,
    }

    roundTimer.syncTimer = setInterval(() => {
      const io = this.getIO()
      if (io && room) {
        io.to(room.code).emit(SERVER_EVENTS.TIMER_SYNC, {
          timeLeft: roundTimer.remaining,
        })
      }
    }, 5000)

    roundTimer.timer = setInterval(() => {
      roundTimer.remaining--
      if (roundTimer.remaining <= 0) {
        this.clearTimer(roomId)
        this.endRound(roomId, 'timeout')
      }
    }, 1000)

    this.roundTimers.set(roomId, roundTimer)
  }

  private clearTimer(roomId: string): void {
    const t = this.roundTimers.get(roomId)
    if (t) {
      clearInterval(t.timer)
      clearInterval(t.syncTimer)
      this.roundTimers.delete(roomId)
    }
  }

  private clearNextRoundTimer(roomId: string): void {
    const t = this.nextRoundTimers.get(roomId)
    if (t) {
      clearTimeout(t)
      this.nextRoundTimers.delete(roomId)
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
    this.sendStrokesToPlayer(roomId, playerId)
  }

  sendGameStateSnapshot(roomId: string, playerId: string): void {
    // 如果有待选词状态，重发选词弹窗（兜底客户端导航延迟导致的事件丢失）
    if (this.resendWordSelection(roomId, playerId)) return

    const room = roomManager.getRoomById(roomId)
    if (!room || room.state !== 'playing') return

    const drawerId = this.currentDrawerId.get(roomId)
    const timer = this.roundTimers.get(roomId)
    const timeLeft = timer ? timer.remaining : 0

    const io = this.getIO()
    if (!io) return

    const drawerPlayer = drawerId ? room.players.find(p => p.id === drawerId) : undefined

    const wordCategory = room.currentWord ? getWordCategory(room.currentWord) : undefined
    const wordCategoryName = wordCategory && CATEGORY_DISPLAY_NAMES[wordCategory]
      ? CATEGORY_DISPLAY_NAMES[wordCategory]
      : undefined

    io.to(playerId).emit(SERVER_EVENTS.GAME_STATE_SNAPSHOT, {
      currentRound: room.currentRound,
      totalRounds: room.totalRounds,
      totalTime: room.roundDuration,
      timeLeft,
      drawer: drawerPlayer ? { id: drawerPlayer.id, nickname: drawerPlayer.nickname } : null,
      strokes: this.strokeHistory.get(roomId) ?? [],
      scores: room.players.map(p => ({
        playerId: p.id,
        nickname: p.nickname,
        score: p.score,
      })),
      currentWord: drawerId && playerId === drawerId ? room.currentWord : undefined,
      wordLength: room.currentWord?.length ?? 0,
      wordCategory: wordCategoryName,
    })
  }

  /**
   * 重发待选词给指定玩家，用于兜底客户端导航延迟导致的事件丢失。
   * 返回 true 表示有待选词并已重发，false 表示无待选词。
   */
  resendWordSelection(roomId: string, playerId: string): boolean {
    const pending = this.pendingWordSelection.get(roomId)
    if (!pending) return false

    const io = this.getIO()
    if (!io) return false

    const room = roomManager.getRoomById(roomId)
    if (!room || room.state !== 'playing') return false

    const drawer = room.players.find((p) => p.id === pending.drawerId)
    if (!drawer) return false

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

    if (playerId === pending.drawerId) {
      io.to(playerId).emit(SERVER_EVENTS.WORD_SELECTION, {
        options: pending.options.map((o) => ({ word: o.word, category: o.category })),
        round: room.currentRound,
        totalRounds: room.totalRounds,
        drawer: drawerData,
        guessers: guesserData,
      })
    } else {
      io.to(playerId).emit(SERVER_EVENTS.WORD_SELECTING, {
        round: room.currentRound,
        totalRounds: room.totalRounds,
        drawer: drawerData,
        guessers: guesserData,
      })
    }
    return true
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

    this.sendStrokesToPlayer(roomId, playerId)
  }

  /**
   * 发送通用游戏快照（积分榜、计时器），
   * 供 sendSpectatorSnapshot 和 restorePlayerState 复用。
   * 返回剩余秒数，失败返回 null。
   */
  private sendStrokesToPlayer(roomId: string, playerId: string): void {
    const allStrokes = this.getStrokes(roomId)
    if (allStrokes.length === 0) return
    const io = this.getIO()
    if (!io) return
    io.to(playerId).emit(SERVER_EVENTS.DRAW_STROKE, { allStrokes: true, strokes: allStrokes })
  }

  private emitGameSnapshot(roomId: string, playerId: string): number | null {
    const room = roomManager.getRoomById(roomId)
    if (!room) return null
    const io = this.getIO()
    if (!io) return null

    if (!room.roundStartTime && room.currentRound > 0) {
      io.to(playerId).emit(SERVER_EVENTS.SCOREBOARD_UPDATE, {
        scores: this.getScoreboard(room),
      })
      return null
    }

    const elapsed = room.roundStartTime
      ? Math.floor((Date.now() - room.roundStartTime) / 1000)
      : 0
    const timeLeft = Math.max(0, room.roundDuration - elapsed)

    io.to(playerId).emit(SERVER_EVENTS.SCOREBOARD_UPDATE, {
      scores: this.getScoreboard(room),
    })

    io.to(playerId).emit(SERVER_EVENTS.TIMER_SYNC, { timeLeft })

    return timeLeft
  }

  private getIO() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (global as any).io
  }
}

export const gameManager = new GameManager()