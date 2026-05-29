import { SERVER_EVENTS, SPY_MIN_PLAYERS, SCORE_CIVILIAN_WIN, SCORE_SPY_WIN, SCORE_SPY_SURVIVE_ROUND, WORD_REVEAL_DURATION_MS, SPY_ROUND_TRANSITION_MS, SPY_DESCRIPTION_MAX_LENGTH, SPY_ALIVE_WIN_THRESHOLD, SPY_DESCRIBE_CYCLES, DISCUSSION_TIME_BASE, DISCUSSION_TIME_PER_PLAYER, SPY_DEFAULT_DESCRIPTION_TIME, SPY_DEFAULT_VOTE_TIME, SPY_CIVILIAN_CONSOLATION, SPY_TIE_BREAK_MAX_ROUNDS, SPY_TIE_BREAK_DESCRIPTION_TIME, SPY_DEFAULT_BLANK_COUNT, SPY_MAX_BLANK_COUNT, SPY_MIN_PLAYERS_WITH_BLANK, SCORE_BLANK_WIN } from '@draw-and-guess/shared'
import { roomManager } from '../rooms/index.js'
import { getRandomSpyPair, type SpyWordPair } from '../data/spy-words.js'
import type { SpyPlayer, SpyPhase, SpyGameConfig, SpyDescription, SpyVoteResult, SpyGameState, SpyRole } from '@draw-and-guess/shared'

export { SPY_MIN_PLAYERS }

const DEFAULT_CONFIG: SpyGameConfig = {
  totalRounds: 7,
  descriptionTime: SPY_DEFAULT_DESCRIPTION_TIME,
  voteTime: SPY_DEFAULT_VOTE_TIME,
  blankCount: SPY_DEFAULT_BLANK_COUNT,
}

interface EliminationResult {
  round: number
  eliminatedName: string | null
  voteCount: number
  totalVotes: number
  votes: Array<{ voterName: string; targetName: string }>
}

interface GameData {
  state: SpyGameState
  config: SpyGameConfig
  usedIndices: Set<number>
  descriptions: SpyDescription[]
  votes: Map<string, string | null>
  roundEnding: boolean
  gameSpyId: string
  gameEliminationRound: number
  describeCycle: number
  roundResults: EliminationResult[]
  discussionTimeBase: number
  tieBreakCount: number
  tieBreakPlayers: string[]
  tieBreakSpeakerIds: string[]
}

export class SpyGameManager {
  private games = new Map<string, GameData>()
  private timers = new Map<string, NodeJS.Timeout>()
  private gameConfigs = new Map<string, SpyGameConfig>()

  getGameSnapshot(roomId: string): SpyGameState | null {
    return this.games.get(roomId)?.state ?? null
  }

  getGameConfig(roomId: string): SpyGameConfig {
    const existing = this.gameConfigs.get(roomId)
    if (existing) return { ...existing }
    const data = this.games.get(roomId)
    if (data) {
      this.gameConfigs.set(roomId, { ...data.config })
      return { ...data.config }
    }
    return { ...DEFAULT_CONFIG }
  }

  updateGameConfig(roomId: string, config: Partial<SpyGameConfig>): void {
    const current = this.getGameConfig(roomId)
    const merged = { ...current, ...config }
    this.gameConfigs.set(roomId, merged)
    const data = this.games.get(roomId)
    if (data) {
      Object.assign(data.config, merged)
    }
  }

  resetGame(roomId: string): void {
    this.clearTimers(roomId)
    this.games.delete(roomId)
  }

  startRound(roomId: string): boolean {
    const room = roomManager.getRoomById(roomId)
    if (!room || room.state !== 'playing' || room.gameType !== 'spy') return false

    // Only initialize game data on first round
    let data = this.games.get(roomId)
    if (data) return false // Subsequent rounds are handled by advanceSpeaker

    const config = this.getGameConfig(roomId)
    room.currentRound = 1
    data = {
      state: this.createEmptyState(roomId),
      config,
      usedIndices: new Set(),
      descriptions: [],
      votes: new Map(),
      roundEnding: false,
      gameSpyId: '',
      gameEliminationRound: 1,
      describeCycle: 1,
      roundResults: [],
      discussionTimeBase: 0,
      tieBreakCount: 0,
      tieBreakPlayers: [],
      tieBreakSpeakerIds: [],
    }
    this.games.set(roomId, data)

    const state = data.state
    state.round = data.gameEliminationRound
    state.totalRounds = data.config.totalRounds
    state.winner = null
    state.currentSpeakerIndex = 0
    data.votes.clear()
    data.roundEnding = false

    const pair = getRandomSpyPair(data.usedIndices)
    if (!pair) {
      data.usedIndices.clear()
      const retry = getRandomSpyPair(data.usedIndices)
      if (!retry) {
        this.endGame(roomId)
        return false
      }
      return this.distributeWords(roomId, retry)
    }

    return this.distributeWords(roomId, pair)
  }

  private distributeWords(roomId: string, pair: SpyWordPair): boolean {
    const room = roomManager.getRoomById(roomId)
    if (!room) return false

    const data = this.games.get(roomId)
    if (!data) return false

    const activePlayers = room.players.filter(p => p.sessionId)
    if (activePlayers.length < SPY_MIN_PLAYERS) {
      this.endGame(roomId)
      return false
    }

    // 1. 随机选择卧底
    const spyIndex = Math.floor(Math.random() * activePlayers.length)
    const spyId = activePlayers[spyIndex].id
    data.gameSpyId = spyId

    // 2. 随机选择白板（从非卧底玩家中）
    const blankCount = Math.min(data.config.blankCount, SPY_MAX_BLANK_COUNT)
    const blankIds = new Set<string>()
    if (activePlayers.length >= SPY_MIN_PLAYERS_WITH_BLANK && blankCount > 0) {
      while (blankIds.size < blankCount) {
        const idx = Math.floor(Math.random() * activePlayers.length)
        const playerId = activePlayers[idx].id
        if (playerId !== spyId) {
          blankIds.add(playerId)
        }
      }
    }

    // 3. 构建玩家数组
    const spyPlayers: SpyPlayer[] = room.players.map(p => {
      const isActive = !!p.sessionId
      const isSpy = isActive && p.id === spyId
      const isBlank = isActive && blankIds.has(p.id)
      const role: SpyRole = isSpy ? 'spy' : (isBlank ? 'blank' : 'civilian')

      return {
        id: p.id,
        nickname: p.nickname,
        isOwner: p.isOwner,
        isAlive: isActive,
        isSpy,
        role,
        word: isBlank ? '' : (isSpy ? pair.spy : pair.civilian),
        description: '',
        voteTarget: null,
        voteCount: 0,
        score: p.score,
        sessionId: p.sessionId,
        avatar: p.avatar,
      }
    })

    data.state.players = spyPlayers
    data.state.civilianWord = pair.civilian
    data.state.spyWord = pair.spy

    // 4. 私信发送角色和词语
    const io = this.getIO()
    if (io) {
      for (const p of spyPlayers) {
        if (!p.isAlive) continue
        io.to(p.id).emit(SERVER_EVENTS.SPY_WORD_ASSIGNED, {
          word: p.word,
          isSpy: p.isSpy,
          isBlank: p.role === 'blank',
          role: p.role,
        })
      }
      io.to(room.code).emit(SERVER_EVENTS.SPY_PHASE_CHANGE, {
        phase: 'word_distribution' as SpyPhase,
        round: room.currentRound,
        totalRounds: data.config.totalRounds,
        players: this.getPublicPlayers(roomId),
      })
    }

    this.clearTimers(roomId)
    const timer = setTimeout(() => {
      this.startDescribing(roomId)
    }, WORD_REVEAL_DURATION_MS)
    this.timers.set(roomId, timer)

    return true
  }

  private startDescribing(roomId: string): void {
    const room = roomManager.getRoomById(roomId)
    if (!room) return

    const data = this.games.get(roomId)
    if (!data || data.roundEnding) return

    const alivePlayers = data.state.players.filter(p => p.isAlive)
    if (alivePlayers.length <= 1) {
      this.endGame(roomId)
      return
    }

    data.state.phase = 'describing'
    data.state.currentSpeakerIndex = 0

    const io = this.getIO()
    if (io) {
      io.to(room.code).emit(SERVER_EVENTS.SPY_PHASE_CHANGE, {
        phase: 'describing' as SpyPhase,
        round: data.gameEliminationRound,
        totalRounds: data.config.totalRounds,
        describeCycle: data.describeCycle,
        players: this.getPublicPlayers(roomId),
      })
    }

    this.advanceSpeaker(roomId)
  }

  private advanceSpeaker(roomId: string): void {
    const room = roomManager.getRoomById(roomId)
    if (!room) return

    const data = this.games.get(roomId)
    if (!data || data.roundEnding) return

    const alivePlayers = data.state.players.filter(p => p.isAlive)
    const idx = data.state.currentSpeakerIndex

    if (idx >= alivePlayers.length) {
      if (data.describeCycle < SPY_DESCRIBE_CYCLES) {
        data.describeCycle++
        data.state.currentSpeakerIndex = 0
        this.startDescribing(roomId)
      } else {
        this.startDiscussion(roomId)
      }
      return
    }

    const speaker = alivePlayers[idx]

    const now = Date.now()
    data.state.phaseStartTime = now

    const io = this.getIO()
    if (io) {
      io.to(room.code).emit(SERVER_EVENTS.SPY_SPEAKER_TURN, {
        playerId: speaker.id,
        nickname: speaker.nickname,
        timeLeft: data.config.descriptionTime,
        phaseStartTime: now,
      })
    }

    this.clearTimers(roomId)
    const timer = setTimeout(() => {
      data.state.currentSpeakerIndex++
      this.advanceSpeaker(roomId)
    }, data.config.descriptionTime * 1000)
    this.timers.set(roomId, timer)
  }

  private startDiscussion(roomId: string): void {
    const room = roomManager.getRoomById(roomId)
    if (!room) return

    const data = this.games.get(roomId)
    if (!data || data.roundEnding) return

    data.state.phase = 'discussion'
    data.state.currentSpeakerIndex = 0
    data.state.phaseStartTime = Date.now()

    const timeLeft = Math.max(DISCUSSION_TIME_BASE, data.state.players.filter(p => p.isAlive).length * DISCUSSION_TIME_PER_PLAYER)
    data.discussionTimeBase = timeLeft

    const io = this.getIO()
    if (io) {
      io.to(room.code).emit(SERVER_EVENTS.SPY_PHASE_CHANGE, {
        phase: 'discussion' as SpyPhase,
        round: data.gameEliminationRound,
        totalRounds: data.config.totalRounds,
        timeLeft,
        phaseStartTime: Date.now(),
        describeCycle: data.describeCycle,
        players: this.getPublicPlayers(roomId),
      })
    }

    this.clearTimers(roomId)
    const timer = setTimeout(() => {
      this.startVoting(roomId)
    }, timeLeft * 1000)
    this.timers.set(roomId, timer)
  }

  submitDescription(roomId: string, playerId: string, text: string): { success: boolean; error?: string } {
    const room = roomManager.getRoomById(roomId)
    if (!room) return { success: false, error: '房间不存在' }

    const data = this.games.get(roomId)
    if (!data) return { success: false, error: '游戏未开始' }
    if (data.state.phase !== 'describing') return { success: false, error: '当前不是描述阶段' }
    if (data.roundEnding) return { success: false, error: '回合已结束' }

    const alivePlayers = data.state.players.filter(p => p.isAlive)
    const idx = data.state.currentSpeakerIndex
    if (idx >= alivePlayers.length) return { success: false, error: '描述已结束' }

    const currentSpeaker = alivePlayers[idx]
    if (currentSpeaker.id !== playerId) return { success: false, error: '还没轮到你描述' }

    const trimmed = text.trim()
    if (!trimmed || trimmed.length > SPY_DESCRIPTION_MAX_LENGTH) return { success: false, error: `描述需在1-${SPY_DESCRIPTION_MAX_LENGTH}字之间` }

    const descriptor: SpyDescription = {
      playerId,
      nickname: currentSpeaker.nickname,
      text: trimmed,
      round: room.currentRound,
      timestamp: Date.now(),
    }

    data.descriptions.push(descriptor)
    const player = data.state.players.find(p => p.id === playerId)
    if (player) player.description = trimmed

    const io = this.getIO()
    if (io) {
      io.to(room.code).emit(SERVER_EVENTS.SPY_DESCRIPTION, descriptor)
    }

    data.state.currentSpeakerIndex++
    this.clearTimers(roomId)
    this.advanceSpeaker(roomId)

    return { success: true }
  }

  private startVoting(roomId: string): void {
    const room = roomManager.getRoomById(roomId)
    if (!room) return

    const data = this.games.get(roomId)
    if (!data || data.roundEnding) return

    data.state.phase = 'voting'
    data.state.phaseStartTime = Date.now()
    data.votes.clear()

    for (const p of data.state.players) {
      if (p.isAlive) p.voteTarget = null
      p.voteCount = 0
    }

    const io = this.getIO()
    if (io) {
      io.to(room.code).emit(SERVER_EVENTS.SPY_PHASE_CHANGE, {
        phase: 'voting' as SpyPhase,
        round: data.gameEliminationRound,
        totalRounds: data.config.totalRounds,
        timeLeft: data.config.voteTime,
        phaseStartTime: Date.now(),
        describeCycle: data.describeCycle,
        players: this.getPublicPlayers(roomId),
      })
    }

    this.clearTimers(roomId)
    const timer = setTimeout(() => {
      this.resolveVoting(roomId)
    }, data.config.voteTime * 1000)
    this.timers.set(roomId, timer)
  }

  vote(roomId: string, voterId: string, targetId: string): { success: boolean; error?: string } {
    const room = roomManager.getRoomById(roomId)
    if (!room) return { success: false, error: '房间不存在' }

    const data = this.games.get(roomId)
    if (!data) return { success: false, error: '游戏未开始' }
    if (data.state.phase !== 'voting') return { success: false, error: '当前不是投票阶段' }
    if (data.roundEnding) return { success: false, error: '回合已结束' }

    const voter = data.state.players.find(p => p.id === voterId)
    if (!voter || !voter.isAlive) return { success: false, error: '你不在游戏中' }
    if (voterId === targetId) return { success: false, error: '不能投给自己' }

    const target = data.state.players.find(p => p.id === targetId)
    if (!target || !target.isAlive) return { success: false, error: '目标玩家不存在' }

    // During tie-break voting, restrict to tie players only
    if (data.tieBreakPlayers.length > 0 && !data.tieBreakPlayers.includes(targetId)) {
      return { success: false, error: '加赛只能投平票玩家' }
    }

    data.votes.set(voterId, targetId)
    voter.voteTarget = targetId

    const alivePlayers = data.state.players.filter(p => p.isAlive)
    const votedCount = Array.from(data.votes.keys()).length

    // broadcast vote progress
    const io = this.getIO()
    if (io) {
      io.to(room.code).emit(SERVER_EVENTS.SPY_VOTE_PROGRESS, {
        voted: votedCount,
        total: alivePlayers.length,
      })
    }

    if (votedCount >= alivePlayers.length) {
      this.clearTimers(roomId)
      this.resolveVoting(roomId)
    }

    return { success: true }
  }

  private resolveVoting(roomId: string): void {
    const room = roomManager.getRoomById(roomId)
    if (!room) return

    const data = this.games.get(roomId)
    if (!data || data.roundEnding) return
    data.roundEnding = true

    this.clearTimers(roomId)

    const voteCounts = new Map<string, number>()
    for (const targetId of data.votes.values()) {
      if (targetId) {
        voteCounts.set(targetId, (voteCounts.get(targetId) ?? 0) + 1)
      }
    }

    let maxVotes = 0
    let eliminated: string | null = null
    let isTie = false

    for (const [id, count] of voteCounts) {
      if (count > maxVotes) {
        maxVotes = count
        eliminated = id
        isTie = false
      } else if (count === maxVotes) {
        isTie = true
      }
    }

    if (isTie || maxVotes === 0) {
      this.handleTieVoting(roomId, voteCounts, maxVotes)
      return
    }

    const voteEntries = Array.from(data.votes.entries()).map(([voterId, targetId]) => ({
      voterId,
      targetId: targetId ?? null,
    }))

    const voteResult: SpyVoteResult = {
      round: room.currentRound,
      votes: voteEntries,
      eliminated,
      civilianWord: data.state.civilianWord,
      spyWord: data.state.spyWord,
    }

    // Record round result before marking eliminated dead
    const aliveBeforeVote = data.state.players.filter(p => p.isAlive).length
    const eliminatedPlayer = eliminated ? data.state.players.find(p => p.id === eliminated) ?? null : null
    if (eliminatedPlayer) {
      eliminatedPlayer.isAlive = false
    }

    // Record round result for end-game timeline
    data.roundResults.push({
      round: data.gameEliminationRound,
      eliminatedName: eliminatedPlayer?.nickname ?? null,
      voteCount: maxVotes,
      totalVotes: aliveBeforeVote,
      votes: Array.from(data.votes.entries()).map(([voterId, targetId]) => {
        const voter = data.state.players.find(p => p.id === voterId)
        const target = data.state.players.find(p => p.id === targetId)
        return {
          voterName: voter?.nickname ?? 'Unknown',
          targetName: target?.nickname ?? '弃权',
        }
      }),
    })

    const io = this.getIO()
    if (io) {
      io.to(room.code).emit(SERVER_EVENTS.SPY_VOTE_RESULT, voteResult)
    }
    this.broadcastPublicPlayers(roomId)

    setTimeout(() => {
      this.checkRoundEnd(roomId)
    }, SPY_ROUND_TRANSITION_MS)
  }

  private handleTieVoting(roomId: string, voteCounts: Map<string, number>, maxVotes: number): void {
    const data = this.games.get(roomId)
    if (!data) return

    const tiePlayers = Array.from(voteCounts.entries())
      .filter(([_, count]) => count === maxVotes && maxVotes > 0)
      .map(([id, _]) => id)

    // If maxVotes === 0 (all abstained), treat all alive as tie players
    if (tiePlayers.length === 0) {
      for (const p of data.state.players) {
        if (p.isAlive) tiePlayers.push(p.id)
      }
    }

    const aliveCount = data.state.players.filter(p => p.isAlive).length
    const spyInTie = tiePlayers.includes(data.gameSpyId)

    const spy = data.state.players.find(p => p.role === 'spy')

    // === 决策矩阵 ===
    // 存活  W1(≤3)  卧底在平票中  加赛后存活≤3(W3)  处理方式
    // ≤3    触发     -            -             卧底直接获胜
    // 4     -        不在         3(触发W3)      卧底直接获胜
    // 4     -        在           3              正常加赛（有机会淘汰卧底）
    // 5+    -        任意         -             正常加赛

    // W1: 存活≤3 → 卧底直接获胜（无需加赛，加赛后最多剩2人）
    if (aliveCount <= SPY_ALIVE_WIN_THRESHOLD) {
      if (spy) {
        data.state.winner = 'spy'
        spy.score += SCORE_SPY_WIN
        for (const p of data.state.players) {
          if (p.role !== 'spy' && p.isAlive) p.score += Math.max(0, SCORE_CIVILIAN_WIN - SPY_CIVILIAN_CONSOLATION)
        }
        this.emitRoundResult(roomId, `存活仅剩 ${aliveCount} 人且平票！卧底获胜`, true)
      }
      return
    }

    // W3: 卧底不在平票中，且加赛淘汰一人后存活≤3 → 卧底直接获胜
    if (!spyInTie && aliveCount - 1 <= SPY_ALIVE_WIN_THRESHOLD) {
      if (spy) {
        data.state.winner = 'spy'
        spy.score += SCORE_SPY_WIN
        for (const p of data.state.players) {
          if (p.role !== 'spy' && p.isAlive) p.score += Math.max(0, SCORE_CIVILIAN_WIN - SPY_CIVILIAN_CONSOLATION)
        }
        this.emitRoundResult(roomId, '平票且卧底不在候选中，卧底获胜', true)
      }
      return
    }

    // 正常加赛（最多 SPY_TIE_BREAK_MAX_ROUNDS 轮）
    if (data.tieBreakCount < SPY_TIE_BREAK_MAX_ROUNDS) {
      data.tieBreakCount++
      data.tieBreakPlayers = tiePlayers
      data.roundEnding = false

      const voteEntries = Array.from(data.votes.entries()).map(([voterId, targetId]) => ({
        voterId,
        targetId: targetId ?? null,
      }))

      const room = roomManager.getRoomById(roomId)
      const io = this.getIO()
      if (io && room) {
        io.to(room.code).emit(SERVER_EVENTS.SPY_VOTE_RESULT, {
          round: room.currentRound,
          votes: voteEntries,
          eliminated: null,
          isTie: true,
          tiePlayers,
          tieBreakCount: data.tieBreakCount,
        })
      }

      setTimeout(() => {
        this.startTieBreak(roomId)
      }, 3000)
      return
    }

    // Tie-break exhausted: no one eliminated, record and continue
    const voteEntries = Array.from(data.votes.entries()).map(([voterId, targetId]) => ({
      voterId,
      targetId: targetId ?? null,
    }))

    const room = roomManager.getRoomById(roomId)
    const aliveBeforeVote = data.state.players.filter(p => p.isAlive).length

    data.roundResults.push({
      round: data.gameEliminationRound,
      eliminatedName: null,
      voteCount: maxVotes,
      totalVotes: aliveBeforeVote,
      votes: Array.from(data.votes.entries()).map(([voterId, targetId]) => {
        const voter = data.state.players.find(p => p.id === voterId)
        const target = data.state.players.find(p => p.id === targetId)
        return {
          voterName: voter?.nickname ?? 'Unknown',
          targetName: target?.nickname ?? '弃权',
        }
      }),
    })

    const voteResult: SpyVoteResult = {
      round: room?.currentRound ?? data.gameEliminationRound,
      votes: voteEntries,
      eliminated: null,
      civilianWord: data.state.civilianWord,
      spyWord: data.state.spyWord,
    }

    const io = this.getIO()
    if (io && room) {
      io.to(room.code).emit(SERVER_EVENTS.SPY_VOTE_RESULT, voteResult)
    }
    this.broadcastPublicPlayers(roomId)

    setTimeout(() => {
      this.checkRoundEnd(roomId)
    }, SPY_ROUND_TRANSITION_MS)
  }

  private checkRoundEnd(roomId: string): void {
    const data = this.games.get(roomId)
    if (!data) return

    const spy = data.state.players.find(p => p.role === 'spy')
    if (!spy) { this.endGame(roomId); return }

    const aliveCount = data.state.players.filter(p => p.isAlive).length

    // 条件1：卧底被投票淘汰
    if (!spy.isAlive) {
      // 检查白板是否猜对
      const blanks = data.state.players.filter(p => p.role === 'blank' && p.isAlive)
      const blankGuessedSpy = blanks.some(b => {
        const vote = data.votes.get(b.id)
        return vote === spy.id
      })

      if (blankGuessedSpy && blanks.length > 0) {
        // 白板猜对，白板获胜
        data.state.winner = 'blank'
        for (const b of blanks) {
          if (data.votes.get(b.id) === spy.id) {
            b.score += SCORE_BLANK_WIN
          }
        }
        // 平民获得安慰分
        for (const p of data.state.players) {
          if (p.role === 'civilian' && p.isAlive) {
            p.score += SPY_CIVILIAN_CONSOLATION
          }
        }
        this.emitRoundResult(roomId, '白板猜出卧底！白板获胜', true)
      } else {
        // 白板没猜对或没有白板，平民获胜
        data.state.winner = 'civilian'
        for (const p of data.state.players) {
          if (p.role === 'civilian' && p.isAlive) {
            p.score += SCORE_CIVILIAN_WIN
          }
        }
        // 白板获得安慰分
        for (const b of blanks) {
          b.score += SPY_CIVILIAN_CONSOLATION
        }
        this.emitRoundResult(roomId, '卧底已被淘汰！平民获胜', true)
      }
      return
    }

    // 条件2：存活人数 ≤ 3
    if (aliveCount <= SPY_ALIVE_WIN_THRESHOLD) {
      data.state.winner = 'spy'
      spy.score += SCORE_SPY_WIN
      // 平民和白板安慰分
      for (const p of data.state.players) {
        if (p.role !== 'spy' && p.isAlive) {
          p.score += Math.max(0, SCORE_CIVILIAN_WIN - SPY_CIVILIAN_CONSOLATION)
        }
      }
      this.emitRoundResult(roomId, `存活仅剩 ${aliveCount} 人！卧底获胜`, true)
      return
    }

    // 条件3：达到最大淘汰局数
    if (data.gameEliminationRound >= data.config.totalRounds) {
      data.state.winner = 'spy'
      spy.score += SCORE_SPY_WIN
      for (const p of data.state.players) {
        if (p.role !== 'spy' && p.isAlive) {
          p.score += Math.max(0, SCORE_CIVILIAN_WIN - SPY_CIVILIAN_CONSOLATION)
        }
      }
      this.emitRoundResult(roomId, '达到最大局数！卧底获胜', true)
      return
    }

    // 卧底生存奖励
    spy.score += SCORE_SPY_SURVIVE_ROUND

    // 进入下一淘汰局
    this.emitRoundResult(roomId, `进入下一局（剩余 ${aliveCount} 人）`, false)
  }

  private emitRoundResult(roomId: string, reason: string, gameOver: boolean): void {
    const data = this.games.get(roomId)
    if (!data) return

    const room = roomManager.getRoomById(roomId)
    if (!room) return

    const io = this.getIO()
    if (io) {
      io.to(room.code).emit(SERVER_EVENTS.SPY_ROUND_RESULT, {
        eliminated: null,
        reason,
        civilianWord: data.state.civilianWord,
        spyWord: data.state.spyWord,
      })
    }

    data.state.phase = 'round_end'

    if (gameOver) {
      setTimeout(() => this.endGame(roomId), SPY_ROUND_TRANSITION_MS)
    } else {
      data.roundEnding = false
      setTimeout(() => this.startNextEliminationRound(roomId), SPY_ROUND_TRANSITION_MS)
    }
  }

  private startTieBreak(roomId: string): void {
    const data = this.games.get(roomId)
    if (!data) return

    data.state.phase = 'tie_break'
    data.state.currentSpeakerIndex = 0
    data.tieBreakSpeakerIds = [...data.tieBreakPlayers]

    // Reset descriptions for tie-break players
    for (const p of data.state.players) {
      if (data.tieBreakPlayers.includes(p.id)) {
        p.description = ''
      }
    }

    const room = roomManager.getRoomById(roomId)
    const io = this.getIO()
    if (io && room) {
      io.to(room.code).emit(SERVER_EVENTS.SPY_TIE_BREAK, {
        phase: 'tie_break',
        tieBreakCount: data.tieBreakCount,
        tiePlayers: data.tieBreakPlayers.map(id => {
          const p = data.state.players.find(pl => pl.id === id)
          return { id, nickname: p?.nickname ?? 'Unknown' }
        }),
      })
    }

    this.advanceTieBreakSpeaker(roomId)
  }

  private advanceTieBreakSpeaker(roomId: string): void {
    const data = this.games.get(roomId)
    if (!data || data.roundEnding) return

    const idx = data.state.currentSpeakerIndex
    if (idx >= data.tieBreakSpeakerIds.length) {
      this.startTieBreakVoting(roomId)
      return
    }

    const speakerId = data.tieBreakSpeakerIds[idx]
    const speaker = data.state.players.find(p => p.id === speakerId)
    if (!speaker || !speaker.isAlive) {
      data.state.currentSpeakerIndex++
      this.advanceTieBreakSpeaker(roomId)
      return
    }

    const now = Date.now()
    data.state.phaseStartTime = now

    const room = roomManager.getRoomById(roomId)
    const io = this.getIO()
    if (io && room) {
      io.to(room.code).emit(SERVER_EVENTS.SPY_SPEAKER_TURN, {
        playerId: speaker.id,
        nickname: speaker.nickname,
        timeLeft: SPY_TIE_BREAK_DESCRIPTION_TIME,
        phaseStartTime: now,
      })
    }

    this.clearTimers(roomId)
    const timer = setTimeout(() => {
      data.state.currentSpeakerIndex++
      this.advanceTieBreakSpeaker(roomId)
    }, SPY_TIE_BREAK_DESCRIPTION_TIME * 1000)
    this.timers.set(roomId, timer)
  }

  private startTieBreakVoting(roomId: string): void {
    const room = roomManager.getRoomById(roomId)
    if (!room) return

    const data = this.games.get(roomId)
    if (!data) return

    data.state.phase = 'voting'
    data.state.phaseStartTime = Date.now()
    data.votes.clear()

    for (const p of data.state.players) {
      if (p.isAlive) p.voteTarget = null
      p.voteCount = 0
    }

    const io = this.getIO()
    if (io) {
      io.to(room.code).emit(SERVER_EVENTS.SPY_PHASE_CHANGE, {
        phase: 'voting' as SpyPhase,
        round: data.gameEliminationRound,
        totalRounds: data.config.totalRounds,
        timeLeft: data.config.voteTime,
        phaseStartTime: Date.now(),
        describeCycle: data.describeCycle,
        players: this.getPublicPlayers(roomId),
        isTieBreak: true,
        tieBreakPlayers: data.tieBreakPlayers,
      })
    }

    this.clearTimers(roomId)
    const timer = setTimeout(() => {
      this.resolveVoting(roomId)
    }, data.config.voteTime * 1000)
    this.timers.set(roomId, timer)
  }

  private startNextEliminationRound(roomId: string): void {
    const data = this.games.get(roomId)
    if (!data || data.roundEnding) return

    data.gameEliminationRound++
    data.describeCycle = 1
    data.descriptions = []
    data.roundEnding = false
    data.state.currentSpeakerIndex = 0
    data.tieBreakCount = 0
    data.tieBreakPlayers = []
    data.tieBreakSpeakerIds = []

    for (const p of data.state.players) {
      if (p.isAlive) p.description = ''
    }

    const room = roomManager.getRoomById(roomId)
    if (room) room.currentRound = data.gameEliminationRound

    this.startDescribing(roomId)
  }

  endGame(roomId: string): void {
    this.clearTimers(roomId)

    const room = roomManager.getRoomById(roomId)
    if (!room) return

    const data = this.games.get(roomId)
    if (!data) return

    data.state.phase = 'game_over'

    const finalScores = data.state.players
      .map(p => ({
        playerId: p.id,
        nickname: p.nickname,
        score: p.score,
      }))
      .sort((a, b) => b.score - a.score)
      .map((s, i) => ({ ...s, rank: i + 1 }))

    room.state = 'gameover'
    roomManager.updateRoomActivity(roomId)

    const voteDetails = Array.from(data.votes.entries())
      .filter(([, targetId]) => targetId !== null)
      .map(([voterId, targetId]) => {
        const voter = data.state.players.find(p => p.id === voterId)
        const target = data.state.players.find(p => p.id === targetId)
        return {
          voterId,
          voterName: voter?.nickname ?? 'Unknown',
          targetId: targetId!,
          targetName: target?.nickname ?? 'Unknown',
        }
      })

    const io = this.getIO()
    if (io) {
      io.to(room.code).emit(SERVER_EVENTS.SPY_GAME_OVER, {
        roomId,
        winner: data.state.winner,
        finalScores,
        civilianWord: data.state.civilianWord,
        spyWord: data.state.spyWord,
        players: data.state.players.map(p => ({
          id: p.id,
          nickname: p.nickname,
          isOwner: p.isOwner,
          isAlive: p.isAlive,
          isSpy: p.isSpy,
          role: p.role,
          score: p.score,
          avatar: p.avatar,
        })),
        voteDetails,
        roundResults: data.roundResults,
      })
    }
  }

  sendGameStateSnapshot(roomId: string, playerId: string): void {
    const data = this.games.get(roomId)
    if (!data) return

    const io = this.getIO()
    if (!io) return

    const state = data.state
    const phaseStartTime = state.phaseStartTime ?? 0
    const elapsed = phaseStartTime ? Math.floor((Date.now() - phaseStartTime) / 1000) : 0

    let descriptionTimeLeft = 0
    let voteTimeLeft = 0
    let totalTime = 0

    if (state.phase === 'describing') {
      totalTime = data.config.descriptionTime
      descriptionTimeLeft = Math.max(0, totalTime - elapsed)
    } else if (state.phase === 'discussion') {
      totalTime = data.discussionTimeBase
      descriptionTimeLeft = Math.max(0, totalTime - elapsed)
    } else if (state.phase === 'voting') {
      totalTime = data.config.voteTime
      voteTimeLeft = Math.max(0, totalTime - elapsed)
    } else if (state.phase === 'tie_break') {
      totalTime = SPY_TIE_BREAK_DESCRIPTION_TIME
      descriptionTimeLeft = Math.max(0, totalTime - elapsed)
    }

    const snapshot: SpyGameState = {
      phase: state.phase,
      round: data.gameEliminationRound,
      totalRounds: data.config.totalRounds,
      currentSpeakerIndex: state.currentSpeakerIndex,
      players: state.players.map(p => ({
        ...p,
        word: p.id === playerId ? p.word : '',
      })),
      civilianWord: (state.phase === 'round_end' || state.phase === 'game_over') ? state.civilianWord : '',
      spyWord: (state.phase === 'round_end' || state.phase === 'game_over') ? state.spyWord : '',
      descriptionTimeLeft,
      voteTimeLeft,
      totalTime,
      winner: state.winner,
      describeCycle: data.describeCycle,
      phaseStartTime: state.phaseStartTime,
      tieBreakCount: data.tieBreakCount,
      tieBreakPlayers: data.tieBreakCount > 0 ? data.tieBreakPlayers : undefined,
    }

    io.to(playerId).emit(SERVER_EVENTS.SPY_GAME_STATE_SNAPSHOT, snapshot)
  }

  handlePlayerDisconnect(roomId: string, playerId: string): void {
    const data = this.games.get(roomId)
    if (!data) return

    const player = data.state.players.find(p => p.id === playerId)
    if (!player || !player.isAlive) return

    // 检查断线玩家是否是当前发言者（覆盖 describing 和 tie_break 阶段）
    const isCurrentSpeaker = (data.state.phase === 'describing' || data.state.phase === 'tie_break') && (() => {
      if (data.state.phase === 'tie_break') {
        const idx = data.state.currentSpeakerIndex
        return idx < data.tieBreakSpeakerIds.length && data.tieBreakSpeakerIds[idx] === playerId
      }
      const alive = data.state.players.filter(p => p.isAlive)
      const idx = data.state.currentSpeakerIndex
      return idx < alive.length && alive[idx]?.id === playerId
    })()

    player.isAlive = false

    // Bug 3: 当前发言者断线 → 立即推进到下一位
    if (isCurrentSpeaker) {
      this.clearTimers(roomId)
      if (data.state.phase === 'tie_break') {
        data.state.currentSpeakerIndex++
        this.advanceTieBreakSpeaker(roomId)
      } else {
        this.advanceSpeaker(roomId)
      }
    } else {
      // Bug 2: 修正 currentSpeakerIndex（不适用于 tie_break，其索引指向 tieBreakSpeakerIds）
      if (data.state.phase === 'describing') {
        const disconPos = data.state.players.findIndex(p => p.id === playerId)
        const aliveBefore = data.state.players.filter((p, i) => p.isAlive && i < disconPos).length
        if (aliveBefore <= data.state.currentSpeakerIndex) {
          data.state.currentSpeakerIndex--
        }
      }
      this.broadcastPublicPlayers(roomId)
    }

    // 卧底断线 → 平民获胜
    if (player.role === 'spy') {
      data.state.winner = 'civilian'
      for (const p of data.state.players) {
        if (p.role === 'civilian' && p.isAlive) {
          p.score += SCORE_CIVILIAN_WIN
        }
      }
      // 白板安慰分
      for (const p of data.state.players) {
        if (p.role === 'blank' && p.isAlive) {
          p.score += SPY_CIVILIAN_CONSOLATION
        }
      }
      this.endGame(roomId)
      return
    }

    const alivePlayers = data.state.players.filter(p => p.isAlive)
    if (alivePlayers.length <= 1) {
      this.endGame(roomId)
    }
  }

  private getPublicPlayers(roomId: string): Array<{
    id: string; nickname: string; isOwner: boolean; isAlive: boolean;
    description: string; voteTarget: string | null; voteCount: number; score: number; avatar: number;
  }> {
    const data = this.games.get(roomId)
    if (!data) return []
    return data.state.players.map(p => ({
      id: p.id, nickname: p.nickname, isOwner: p.isOwner, isAlive: p.isAlive,
      description: p.description, voteTarget: p.voteTarget, voteCount: p.voteCount, score: p.score, avatar: p.avatar,
    }))
  }

  private broadcastPublicPlayers(roomId: string): void {
    const players = this.getPublicPlayers(roomId)
    if (players.length === 0) return
    const room = roomManager.getRoomById(roomId)
    if (!room) return
    const data = this.games.get(roomId)
    const io = this.getIO()
    if (!io) return
    io.to(room.code).emit(SERVER_EVENTS.SPY_PHASE_CHANGE, {
      phase: data?.state.phase ?? 'idle',
      describeCycle: data?.describeCycle,
      players,
    })
  }

  private createEmptyState(_roomId: string): SpyGameState {
    return {
      phase: 'idle',
      round: 0,
      totalRounds: DEFAULT_CONFIG.totalRounds,
      currentSpeakerIndex: 0,
      players: [],
      civilianWord: '',
      spyWord: '',
      descriptionTimeLeft: 0,
      voteTimeLeft: 0,
      winner: null,
      phaseStartTime: undefined,
    }
  }

  private clearTimers(roomId: string): void {
    const t = this.timers.get(roomId)
    if (t) {
      clearTimeout(t)
      this.timers.delete(roomId)
    }
  }

  private getIO() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (global as any).io
  }
}

export const spyGameManager = new SpyGameManager()
