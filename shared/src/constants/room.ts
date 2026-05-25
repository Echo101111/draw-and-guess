import type { GameType } from '../types.js'

export const NICKNAME_MAX_LENGTH = 10
export const ROOM_NAME_MAX_LENGTH = 20
export const PASSWORD_MIN_LENGTH = 4
export const PASSWORD_MAX_LENGTH = 100
export const DEFAULT_MAX_PLAYERS = 50
export const RECONNECT_TIMEOUT_MS = 60_000
export const ROOM_DISMISS_TIMEOUT_MS = 30_000
export const BCRYPT_ROUNDS = 6
export const AVATAR_COUNT = 50
export const DEFAULT_GAME_TYPE: GameType = 'draw'
