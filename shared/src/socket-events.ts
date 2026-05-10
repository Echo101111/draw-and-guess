// Client → Server events
export const CLIENT_EVENTS = {
  CREATE_ROOM: 'c_create_room',
  JOIN_ROOM: 'c_join_room',
  LEAVE_ROOM: 'c_leave_room',
  KICK_PLAYER: 'c_kick_player',
  START_GAME: 'c_start_game',
  DISMISS_ROOM: 'c_dismiss_room',
  DRAW_STROKE: 'c_draw_stroke',
  CLEAR_CANVAS: 'c_clear_canvas',
  SUBMIT_ANSWER: 'c_submit_answer',
  CHAT_MESSAGE: 'c_chat_message',
  RESTORE_SESSION: 'c_restore_session',
  JOIN_AS_SPECTATOR: 'c_join_as_spectator',
} as const

// Server → Client events
export const SERVER_EVENTS = {
  ROOM_CREATED: 's_room_created',
  ROOM_JOINED: 's_room_joined',
  ROOM_ERROR: 's_room_error',
  ROOM_UPDATED: 's_room_updated',
  KICKED: 's_kicked',
  ROUND_START: 's_round_start',
  ROUND_START_TO_DRAWER: 's_round_start_to_drawer',
  DRAW_STROKE: 's_draw_stroke',
  CANVAS_CLEARED: 's_canvas_cleared',
  ANSWER_RESULT: 's_answer_result',
  SCOREBOARD_UPDATE: 's_scoreboard_update',
  TIMER_SYNC: 's_timer_sync',
  ROUND_END: 's_round_end',
  GAME_OVER: 's_game_over',
  CHAT_MESSAGE: 's_chat_message',
  SESSION_RESTORED: 's_session_restored',
  SPECTATOR_JOINED: 's_spectator_joined',
} as const

export type ClientToServerEvents = typeof CLIENT_EVENTS
export type ServerToClientEvents = typeof SERVER_EVENTS
