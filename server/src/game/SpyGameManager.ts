import { SERVER_EVENTS, SPY_MIN_PLAYERS, SCORE_CIVILIAN_WIN, SCORE_SPY_WIN, SCORE_SPY_SURVIVE_ROUND, WORD_REVEAL_DURATION_MS, SPY_ROUND_TRANSITION_MS, SPY_DESCRIPTION_MAX_LENGTH, SPY_ALIVE_WIN_THRESHOLD, SPY_DESCRIBE_CYCLES, DISCUSSION_TIME_BASE, DISCUSSION_TIME_PER_PLAYER, SPY_DEFAULT_DESCRIPTION_TIME, SPY_DEFAULT_VOTE_TIME, SPY_CIVILIAN_CONSOLATION } from '@draw-and-guess/shared'
import { roomManager } from '../rooms/index.js'
import { getRandomSpyPair, type SpyWordPair } from '../data/spy-words.js'
import type { SpyPlayer, SpyPhase, SpyGameConfig, SpyDescription, SpyVoteResult, SpyGameState } from '@draw-and-guess/shared'

export { SPY_MIN_PLAYERS }

const DEFAULT_CONFIG: SpyGameConfig = {
  totalRounds: 7,
  descriptionTime: SPY_DEFAULT_DESCRIPTION_TIME,
  voteTime: SPY_DEFAULT_VOTE_TIME,
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

    const spyIndex = Math.floor(Math.random() * activePlayers.length)
    const spyId = activePlayers[spyIndex].id
    data.gameSpyId = spyId

    const spyPlayer: SpyPlayer[] = room.players.map(p => {
      const isActive = !!p.sessionId
      const isSpy = isActive && p.id === spyId
      return {
        id: p.id,
        nickname: p.nickname,
        isOwner: p.isOwner,
        isAlive: isActive,
        isSpy,
        word: isSpy ? pair.spy : pair.civilian,
        description: '',
        voteTarget: null,
        voteCount: 0,
        score: p.score,
        sessionId: p.sessionId,
        avatar: p.avatar,
      }
    })

    data.state.players = spyPlayer
    data.state.civilianWord = pair.civilian
    data.state.spyWord = pair.spy

    const io = this.getIO()
    if (io) {
      for (const p of spyPlayer) {
        if (!p.isAlive) continue
        io.to(p.id).emit(SERVER_EVENTS.SPY_WORD_ASSIGNED, {
          word: p.word,
          isSpy: p.isSpy,
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
      eliminated = null
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

  private checkRoundEnd(roomId: string): void {
    const data = this.games.get(roomId)
    if (!data) return

    const spy = data.state.players.find(p => p.id === data.gameSpyId)
    if (!spy) { this.endGame(roomId); return }

    // 条件1：卧底被投票淘汰
    if (!spy.isAlive) {
      data.state.winner = 'civilian'
      for (const p of data.state.players) {
        if (!p.isSpy && p.isAlive) p.score += SCORE_CIVILIAN_WIN
      }
      this.emitRoundResult(roomId, '卧底已被淘汰！平民获胜', true)
      return
    }

    const aliveCount = data.state.players.filter(p => p.isAlive).length

    // 条件2：存活人数 ≤ 3
    if (aliveCount <= SPY_ALIVE_WIN_THRESHOLD) {
      data.state.winner = 'spy'
      spy.score += SCORE_SPY_WIN
      for (const p of data.state.players) {
        if (!p.isSpy && p.isAlive) p.score += Math.max(0, SCORE_CIVILIAN_WIN - SPY_CIVILIAN_CONSOLATION)
      }
      this.emitRoundResult(roomId, `存活仅剩 ${aliveCount} 人！卧底获胜`, true)
      return
    }

    // 条件3：达到最大淘汰局数
    if (data.gameEliminationRound >= data.config.totalRounds) {
      data.state.winner = 'spy'
      spy.score += SCORE_SPY_WIN
      for (const p of data.state.players) {
        if (!p.isSpy && p.isAlive) p.score += Math.max(0, SCORE_CIVILIAN_WIN - SPY_CIVILIAN_CONSOLATION)
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

  private startNextEliminationRound(roomId: string): void {
    const data = this.games.get(roomId)
    if (!data || data.roundEnding) return

    data.gameEliminationRound++
    data.describeCycle = 1
    data.descriptions = []
    data.roundEnding = false
    data.state.currentSpeakerIndex = 0

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
    }

    io.to(playerId).emit(SERVER_EVENTS.SPY_GAME_STATE_SNAPSHOT, snapshot)
  }

  handlePlayerDisconnect(roomId: string, playerId: string): void {
    const data = this.games.get(roomId)
    if (!data) return

    const player = data.state.players.find(p => p.id === playerId)
    if (!player || !player.isAlive) return

    // 检查断线玩家是否是当前发言者
    const isCurrentSpeaker = data.state.phase === 'describing' && (() => {
      const alive = data.state.players.filter(p => p.isAlive)
      const idx = data.state.currentSpeakerIndex
      return idx < alive.length && alive[idx]?.id === playerId
    })()

    player.isAlive = false

    // Bug 3: 当前发言者断线 → 立即推进到下一位
    if (isCurrentSpeaker) {
      this.clearTimers(roomId)
      this.advanceSpeaker(roomId)
      // advanceSpeaker 内部已 broadcastPublicPlayers
      // 继续检查胜负条件
    } else {
      // Bug 2: 修正 currentSpeakerIndex
      if (data.state.phase === 'describing') {
        const disconPos = data.state.players.findIndex(p => p.id === playerId)
        const aliveBefore = data.state.players.filter((p, i) => p.isAlive && i < disconPos).length
        if (aliveBefore <= data.state.currentSpeakerIndex) {
          data.state.currentSpeakerIndex--
        }
      }
      this.broadcastPublicPlayers(roomId)
    }

    if (player.isSpy) {
      data.state.winner = 'civilian'
      for (const p of data.state.players) {
        if (!p.isSpy && p.isAlive) {
          p.score += SCORE_CIVILIAN_WIN
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
