---
name: socket-debug
description: 调试 draw-and-guess 项目的 Socket.io 通信问题。追踪事件流、检查房间成员关系、诊断重连和画布同步问题。当用户遇到实时通信问题、事件未触发、画布不同步、连接断开等情况时使用。
---

## Socket.io 事件架构

### 事件常量

客户端和服务端统一使用 `shared/src/socket-events.ts` 中的 `CLIENT_EVENTS` 和 `SERVER_EVENTS` 常量，禁止硬编码字符串。

### 事件流追踪

常见调试场景及检查点：

**房间事件流：**
```
c_create_room → s_room_created
c_join_room → s_room_joined
c_leave_room → s_room_updated
c_start_game → s_room_updated + s_round_start
c_restore_session → s_session_restored
```

**游戏事件流：**
```
s_round_start (guessers) / s_round_start_to_drawer (drawer)
c_draw_stroke → s_draw_stroke (广播排除画师本人)
c_submit_answer → s_answer_result
c_chat_message → s_chat_message
→ s_round_end → (3s后) s_round_start
→ s_game_over
```

### 服务端 handler 模式

所有 handler 注册在 `server/src/socket/roomHandlers.ts` 和 `gameHandlers.ts` 中。

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function registerHandlers(io: any, socket: any): void {
  socket.on(CLIENT_EVENTS.CREATE_ROOM, async ({ nickname, roomName, ... }) => {
    // ...
    socket.join(room.code)   // 房间广播通道
    socket.join(player.id)   // 私信通道
  })
}
```

每个玩家的 socket 必须加入两个房间：
- `room.code`（房间名）— 广播通道
- `player.id`（玩家 ID）— 私信通道（画师接收词汇）

必须在 `CREATE_ROOM`、`JOIN_ROOM`、`RESTORE_SESSION` 三个 handler 中都调用 `socket.join(player.id)`。

### 客户端 listener 模式

Pinia store 中注册 socket 监听器时必须先 `off` 再 `on`：

```typescript
function setupSocketListeners() {
  const socket = getSocket()
  if (!socket) return
  
  socket.off(SERVER_EVENTS.ROUND_START)
  socket.on(SERVER_EVENTS.ROUND_START, (data) => { ... })
  
  // 每个事件都是先 off 再 on
}
```

路由切换（lobby → game）会导致组件重新挂载、store 重新初始化，可能重复绑监听器。必须检查每个 listener 是否都有对应的 `off`。

### 全局 io 访问

服务端 `server/src/index.ts` 中通过 `(global as any).io = io` 暴露给 GameManager：

```typescript
// GameManager 中获取 io
private getIO() {
  return (global as any).io
}
```

如果 `s_round_start_to_drawer` 未发送到画师，检查 `io.to(player.id)` 是否找到正确的 socket 房间。

### 节流机制

- **客户端发送**：`EMIT_INTERVAL = 16ms`（约 60fps），`GameCanvas.vue` 中 `handleMouseMove` 和 `handleTouchMove` 控制
- **服务端接收**：GameManager 限制 120 events/second/player
- **strokeSeq**：每一笔（mouseDown → mouseUp）一个自增序号，服务端据此合并同笔画的连续 points

### 常见问题排查

| 症状 | 排查点 |
|------|--------|
| 画师看到自己笔画重复 | 检查 `socket.broadcast.to(room.code)` 是否排除了画师本人 |
| 猜题者看不到画 | 检查 `strokes` 数组同步、`s_draw_stroke` 事件是否广播 |
| 画师收不到词汇 | 检查 `socket.join(player.id)` 是否在 JOIN 时执行 |
| 重连后无响应 | 检查 `c_restore_session` → `s_session_restored` 链路 |
| 某些玩家离线无反应 | 检查 `disconnect` 事件的 `startDisconnectTimer` |
| 事件触发了但 UI 无反应 | 检查 Pinia store 中对应的 `socket.on()` 是否先 `off` 了 |
| 定时器不准 | 检查服务端 `s_timer_sync` 和客户端 `startLocalTimer` 的关系 |

### 调试技巧

1. 在 `server/src/socket/` handler 中添加 `console.log` 打印事件名和关键 payload
2. 检查 `io.sockets.adapter.rooms` 查看当前 socket.io 房间成员
3. 在 client 的 `useSocket.ts` 中监听 `connect_error`、`disconnect` 诊断连接问题
4. 确认 `CLIENT_URL`（默认 `http://localhost:5173`）与 CORS 配置一致
5. 用 `socket.eventNames()` 检查 socket 实例上已注册的所有事件名
