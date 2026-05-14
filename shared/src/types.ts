// === Player ===
export interface Player {
  id: string
  nickname: string
  sessionId: string
  isOwner: boolean
  score: number
  hasGuessedCorrectly: boolean
  joinedAt: number
  lastActiveAt: number
}

// === Room ===
export type RoomState = 'lobby' | 'playing' | 'gameover'

export interface Room {
  id: string
  code: string
  name: string
  password: string
  state: RoomState
  maxPlayers: number
  players: Player[]
  currentWord: string | null
  currentRound: number
  totalRounds: number
  roundStartTime: number | null
  roundDuration: number
}

// === Drawing ===
export interface Point {
  x: number
  y: number
}

export interface Stroke {
  playerId: string
  points: Point[]
  color: string
  width: number
  tool: 'brush' | 'eraser'
  strokeSeq?: number
}

// === Chat ===
export interface ChatMessage {
  id: string
  playerId: string | null
  nickname: string | null
  text: string
  isSystem: boolean
  timestamp: number
}

// === Game ===
export interface PlayerScore {
  playerId: string
  nickname: string
  score: number
  rank: number
}

export interface GameResult {
  roomId: string
  finalScores: PlayerScore[]
  winner: string | null
}

// === Error ===
export enum ErrorCode {
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  ROOM_FULL = 'ROOM_FULL',
  ROOM_PASSWORD_REQUIRED = 'ROOM_PASSWORD_REQUIRED',
  ROOM_PASSWORD_WRONG = 'ROOM_PASSWORD_WRONG',
  NICKNAME_TAKEN = 'NICKNAME_TAKEN',
  NOT_ROOM_OWNER = 'NOT_ROOM_OWNER',
  GAME_NOT_IN_LOBBY = 'GAME_NOT_IN_LOBBY',
  RATE_LIMITED = 'RATE_LIMITED',
}

export interface RoomErrorPayload {
  code: ErrorCode
  message: string
}

// === Word Sensitivity ===
export type SensitivityLevel = 'safe' | 'moderate'
