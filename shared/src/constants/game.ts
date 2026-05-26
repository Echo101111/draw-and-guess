// ===== Game Types =====
export const GAME_TYPE_DRAW = 'draw'
export const GAME_TYPE_SPY = 'spy'

// ===== Draw Game =====
export const SCORE_BASE = 100
export const SCORE_DRAWER_BONUS = 50
export const DRAW_MIN_PLAYERS = 2
export const WORD_SELECTION_TIMEOUT_MS = 30000
export const ROUND_TRANSITION_MS = 3000
export const DRAW_RATE_LIMIT_MS = 8
export const ANSWER_COOLDOWN_MS = 200
export const CHAT_COOLDOWN_MS = 1000
export const PRUNE_INTERVAL_MS = 300_000
export const WORD_SELECTION_OPTIONS_COUNT = 5
export const WORD_SELECTION_MAX_ATTEMPTS = 50
export const DEFAULT_ROUND_DURATION = 90
export const DEFAULT_TOTAL_ROUNDS = 10

// ===== Spy Game =====
export const SPY_MIN_PLAYERS = 4
export const SPY_DEFAULT_DESCRIPTION_TIME = 30
export const SPY_DEFAULT_VOTE_TIME = 20
export const SPY_DESCRIBE_CYCLES = 3
export const SPY_DESCRIPTION_MAX_LENGTH = 100
export const SCORE_CIVILIAN_WIN = 100
export const SCORE_SPY_WIN = 200
export const SCORE_SPY_SURVIVE_ROUND = 50
export const WORD_REVEAL_DURATION_MS = 3000
export const SPY_ROUND_TRANSITION_MS = 3000
export const DISCUSSION_TIME_BASE = 15
export const DISCUSSION_TIME_PER_PLAYER = 10
export const SPY_ALIVE_WIN_THRESHOLD = 3

// ===== Word Validation =====
export const WORD_MAX_LENGTH = 20
export const WORD_BATCH_MAX = 20
export const WORD_ERROR_TRUNCATE = 10

// ===== Spy Consolation =====
export const SPY_CIVILIAN_CONSOLATION = 20

// ===== Rounds Per Player =====
export const DEFAULT_ROUNDS_PER_PLAYER = 2
export const MAX_ROUNDS_PER_PLAYER = 5

// ===== Chat =====
export const CHAT_MESSAGE_MAX_LENGTH = 200
export const CHAT_MESSAGE_LIMIT = 500
export const CHAT_MESSAGE_KEEP = 300
