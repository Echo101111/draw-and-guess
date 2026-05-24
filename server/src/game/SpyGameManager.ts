import { SERVER_EVENTS } from '@draw-and-guess/shared'
import { roomManager } from '../rooms/index.js'
import { getRandomSpyPair, type SpyWordPair } from '../data/spy-words.js'
import type { SpyPlayer, SpyPhase, SpyGameConfig, SpyDescription, SpyVoteResult, SpyGameState } from '@draw-and-guess/shared'

export const SPY_MIN_PLAYERS = 2

const DEFAULT_CONFIG: SpyGameConfig = {
  totalRounds: 3,
  descriptionTime: 30,
  voteTime: 20,
}

const SCORE_CIVILIAN_WIN = 100
const SCORE_SPY_WIN = 200
const WORD_REVEAL_DURATION_MS = 3000
const ROUND_TRANSITION_MS = 3000

interface GameData {
  state: SpyGameState
  config: SpyGameConfig
  usedIndices: Set<number>
  descriptions: SpyDescription[]
  votes: Map<string, string | null>
  roundEnding: boolean
  gameSpyId: string
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
    }
    this.games.set(roomId, data)

    const state = data.state
    state.round = room.currentRound
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
        round: room.currentRound,
        totalRounds: data.config.totalRounds,
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
      // All players have described this round
      if (room.currentRound < data.config.totalRounds) {
        room.currentRound++
        this.startDescribing(roomId)
      } else {
        this.startDiscussion(roomId)
      }
      return
    }

    const speaker = alivePlayers[idx]

    const io = this.getIO()
    if (io) {
      io.to(room.code).emit(SERVER_EVENTS.SPY_SPEAKER_TURN, {
        playerId: speaker.id,
        nickname: speaker.nickname,
        timeLeft: data.config.descriptionTime,
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

    const timeLeft = Math.max(15, data.state.players.filter(p => p.isAlive).length * 10)

    const io = this.getIO()
    if (io) {
      io.to(room.code).emit(SERVER_EVENTS.SPY_PHASE_CHANGE, {
        phase: 'discussion' as SpyPhase,
        round: room.currentRound,
        totalRounds: data.config.totalRounds,
        timeLeft,
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
    if (!trimmed || trimmed.length > 100) return { success: false, error: '描述需在1-100字之间' }

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
    data.votes.clear()

    for (const p of data.state.players) {
      if (p.isAlive) p.voteTarget = null
      p.voteCount = 0
    }

    const io = this.getIO()
    if (io) {
      io.to(room.code).emit(SERVER_EVENTS.SPY_PHASE_CHANGE, {
        phase: 'voting' as SpyPhase,
        round: room.currentRound,
        totalRounds: data.config.totalRounds,
        timeLeft: data.config.voteTime,
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

    if (eliminated) {
      const target = data.state.players.find(p => p.id === eliminated)
      if (target) {
        target.isAlive = false
      }
    }

    const io = this.getIO()
    if (io) {
      io.to(room.code).emit(SERVER_EVENTS.SPY_VOTE_RESULT, voteResult)
    }
    this.broadcastPublicPlayers(roomId)

    setTimeout(() => {
      this.checkRoundEnd(roomId)
    }, ROUND_TRANSITION_MS)
  }

  private checkRoundEnd(roomId: string): void {
    const data = this.games.get(roomId)
    if (!data) return

    const spy = data.state.players.find(p => p.id === data.gameSpyId)
    if (!spy) {
      this.endGame(roomId)
      return
    }

    if (!spy.isAlive) {
      data.state.winner = 'civilian'
      for (const p of data.state.players) {
        if (!p.isSpy && p.isAlive) {
          p.score += SCORE_CIVILIAN_WIN
        }
      }
    } else {
      data.state.winner = 'spy'
      spy.score += SCORE_SPY_WIN
      for (const p of data.state.players) {
        if (!p.isSpy && p.isAlive) {
          p.score += Math.max(0, SCORE_CIVILIAN_WIN - 20)
        }
      }
    }

    this.endGame(roomId)
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
      })
    }
  }

  sendGameStateSnapshot(roomId: string, playerId: string): void {
    const data = this.games.get(roomId)
    if (!data) return

    const io = this.getIO()
    if (!io) return

    const state = data.state
    const snapshot: SpyGameState = {
      phase: state.phase,
      round: state.round,
      totalRounds: state.totalRounds,
      currentSpeakerIndex: state.currentSpeakerIndex,
      players: state.players.map(p => ({
        ...p,
        word: p.id === playerId ? p.word : '',
      })),
      civilianWord: (state.phase === 'round_end' || state.phase === 'game_over') ? state.civilianWord : '',
      spyWord: (state.phase === 'round_end' || state.phase === 'game_over') ? state.spyWord : '',
      descriptionTimeLeft: 0,
      voteTimeLeft: 0,
      winner: state.winner,
    }

    io.to(playerId).emit(SERVER_EVENTS.SPY_GAME_STATE_SNAPSHOT, snapshot)
  }

  handlePlayerDisconnect(roomId: string, playerId: string): void {
    const data = this.games.get(roomId)
    if (!data) return

    const player = data.state.players.find(p => p.id === playerId)
    if (player) {
      player.isAlive = false
    }
    this.broadcastPublicPlayers(roomId)

    if (player?.isSpy) {
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
    const io = this.getIO()
    if (!io) return
    io.to(room.code).emit(SERVER_EVENTS.SPY_PHASE_CHANGE, {
      phase: this.games.get(roomId)?.state.phase ?? 'idle',
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
