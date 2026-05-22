import { SERVER_EVENTS } from '@draw-and-guess/shared'
import { roomManager } from '../rooms/index.js'
import { getRandomSpyPair, type SpyWordPair } from '../data/spy-words.js'
import type { SpyPlayer, SpyPhase, SpyGameConfig, SpyDescription, SpyVoteResult, SpyGameState } from '@draw-and-guess/shared'

const DEFAULT_CONFIG: SpyGameConfig = {
  totalRounds: 5,
  descriptionTime: 30,
  voteTime: 20,
}

const SCORE_CIVILIAN_WIN = 100
const SCORE_SPY_SURVIVE_ROUND = 50
const SCORE_SPY_WIN = 200
const WORD_REVEAL_DURATION_MS = 3000
const ROUND_TRANSITION_MS = 3000

interface SpyRoundData {
  pair: SpyWordPair
  spyPlayerId: string
}

interface GameData {
  state: SpyGameState
  config: SpyGameConfig
  usedIndices: Set<number>
  descriptions: SpyDescription[]
  votes: Map<string, string | null>
  roundEnding: boolean
}

export class SpyGameManager {
  private games = new Map<string, GameData>()
  private timers = new Map<string, NodeJS.Timeout>()
  private roundData = new Map<string, SpyRoundData>()

  getGameSnapshot(roomId: string): SpyGameState | null {
    return this.games.get(roomId)?.state ?? null
  }

  getGameConfig(roomId: string): SpyGameConfig {
    return this.games.get(roomId)?.config ?? { ...DEFAULT_CONFIG }
  }

  updateGameConfig(roomId: string, config: Partial<SpyGameConfig>): void {
    const data = this.games.get(roomId)
    if (!data) {
      const newData: GameData = {
        state: this.createEmptyState(roomId),
        config: { ...DEFAULT_CONFIG, ...config },
        usedIndices: new Set(),
        descriptions: [],
        votes: new Map(),
        roundEnding: false,
      }
      this.games.set(roomId, newData)
      return
    }
    Object.assign(data.config, config)
  }

  resetGame(roomId: string): void {
    this.clearTimers(roomId)
    this.games.delete(roomId)
    this.roundData.delete(roomId)
  }

  startRound(roomId: string): boolean {
    const room = roomManager.getRoomById(roomId)
    if (!room || room.state !== 'playing' || room.gameType !== 'spy') return false

    const data = this.games.get(roomId)
    if (!data) return false

    const state = data.state
    state.phase = 'word_distribution'
    state.round = room.currentRound
    state.totalRounds = data.config.totalRounds
    state.winner = null
    state.currentSpeakerIndex = 0
    data.descriptions = []
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
    if (activePlayers.length < 2) {
      this.endGame(roomId)
      return false
    }

    const spyIndex = Math.floor(Math.random() * activePlayers.length)
    let spyId = activePlayers[spyIndex].id

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
      }
    })

    data.state.players = spyPlayer
    data.state.civilianWord = pair.civilian
    data.state.spyWord = pair.spy
    this.roundData.set(roomId, { pair, spyPlayerId: spyId })

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
      this.startVoting(roomId)
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

    setTimeout(() => {
      this.checkRoundEnd(roomId)
    }, ROUND_TRANSITION_MS)
  }

  private checkRoundEnd(roomId: string): void {
    const room = roomManager.getRoomById(roomId)
    if (!room) return

    const data = this.games.get(roomId)
    if (!data) return

    const spy = data.state.players.find(p => p.isSpy)
    if (!spy) {
      this.endGame(roomId)
      return
    }

    const io = this.getIO()

    if (!spy.isAlive) {
      data.state.winner = 'civilian'
      for (const p of data.state.players) {
        if (!p.isSpy && p.isAlive) {
          p.score += SCORE_CIVILIAN_WIN
        }
      }
      if (io) {
        io.to(room.code).emit(SERVER_EVENTS.SPY_ROUND_RESULT, {
          eliminated: spy.id,
          reason: '卧底被发现！平民获胜',
        })
      }
      this.endGame(roomId)
      return
    }

    const aliveCount = data.state.players.filter(p => p.isAlive).length
    if (aliveCount <= 3) {
      data.state.winner = 'spy'
      spy.score += SCORE_SPY_WIN
      for (const p of data.state.players) {
        if (!p.isSpy && p.isAlive) {
          p.score += Math.max(0, SCORE_CIVILIAN_WIN - 20)
        }
      }
      if (io) {
        io.to(room.code).emit(SERVER_EVENTS.SPY_ROUND_RESULT, {
          eliminated: null,
          reason: '卧底存活到最后！卧底获胜',
        })
      }
      this.endGame(roomId)
      return
    }

    if (room.currentRound >= data.config.totalRounds) {
      data.state.winner = 'spy'
      spy.score += SCORE_SPY_WIN
      if (io) {
        io.to(room.code).emit(SERVER_EVENTS.SPY_ROUND_RESULT, {
          eliminated: null,
          reason: '达到最大轮数！卧底获胜',
        })
      }
      this.endGame(roomId)
      return
    }

    spy.score += SCORE_SPY_SURVIVE_ROUND

    if (io) {
      io.to(room.code).emit(SERVER_EVENTS.SPY_ROUND_RESULT, {
        eliminated: null,
        reason: '回合结束，进入下一轮',
      })
    }

    data.state.phase = 'round_end'
    data.roundEnding = false

    setTimeout(() => {
      room.currentRound++
      this.startRound(roomId)
    }, ROUND_TRANSITION_MS)
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

    const io = this.getIO()
    if (io) {
      io.to(room.code).emit(SERVER_EVENTS.SPY_GAME_OVER, {
        roomId,
        winner: data.state.winner,
        finalScores,
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
      civilianWord: '',
      spyWord: '',
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

    const alivePlayers = data.state.players.filter(p => p.isAlive)
    if (alivePlayers.length <= 1 || (player?.isSpy && alivePlayers.length <= 2)) {
      this.endGame(roomId)
    }
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
    return (global as any).io
  }
}

export const spyGameManager = new SpyGameManager()
