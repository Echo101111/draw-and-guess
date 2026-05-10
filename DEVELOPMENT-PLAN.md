# 多人你画我猜 - 细化开发步骤与漏洞检查

## 一、当前缺口识别

技术评审和 PRD 中存在以下未覆盖的内容：

| 缺口 | 影响 | 优先级 |
|------|------|--------|
| **Socket 事件清单** | 无法保证前后端事件名一致性 | 高 |
| **核心类型定义** | TypeScript 类型无文档，review 无据可查 | 高 |
| **HTTP API 规格** | 房间创建/加入的 REST 接口未定义 | 高 |
| **游戏状态机** | Lobby → Playing → GameOver 完整触发条件未列 | 中 |
| **Pinia Store 结构** | 前端状态管理边界模糊 | 中 |
| **Docker 配置** | 部署方式仅提到 Fly.io，未定义 Dockerfile | 中 |
| **词库内容** | 题目词库无具体数据 | 低（可后续补充） |
| **分享链接格式** | URL 规范未定义 | 低 |

---

## 二、SOCKET 事件规格

### 2.1 事件命名规范

```
客户端 → 服务端：c_* 前缀
服务端 → 客户端：s_* 前缀
服务端 → 特定玩家：s_*_to_self（区别于广播）
```

### 2.2 完整事件清单

**房间事件（Client → Server）**

| 事件名 | 载荷 | 说明 |
|--------|------|------|
| `c_create_room` | `{ nickname, roomName?, maxPlayers?, password? }` | 创建房间 |
| `c_join_room` | `{ roomCode, password?, nickname }` | 加入房间 |
| `c_leave_room` | `{}` | 离开房间 |
| `c_kick_player` | `{ playerId }` | 房主踢人 |
| `c_start_game` | `{}` | 房主开始游戏 |
| `c_dismiss_room` | `{}` | 房主解散房间 |

**房间事件（Server → Client）**

| 事件名 | 载荷 | 说明 |
|--------|------|------|
| `s_room_created` | `{ roomCode, roomId, playerId, isOwner }` | 创建成功 |
| `s_room_joined` | `{ room, playerId, isOwner }` | 加入成功 |
| `s_room_error` | `{ code, message }` | 错误（见 §2.4） |
| `s_room_updated` | `{ room }` | 房间状态变更（玩家进出） |
| `s_kicked` | `{ reason }` | 被踢通知 |

**游戏事件（Client → Server）**

| 事件名 | 载荷 | 说明 |
|--------|------|------|
| `c_draw_stroke` | `{ points: Point[], color, width, tool }` | 绘图事件（限流） |
| `c_clear_canvas` | `{}` | 清空画布（需确认） |
| `c_submit_answer` | `{ answer }` | 提交答案 |
| `c_chat_message` | `{ text }` | 聊天消息 |

**游戏事件（Server → Client）**

| 事件名 | 载荷 | 说明 |
|--------|------|------|
| `s_round_start` | `{ round, totalRounds, drawerId, drawerNickname, timeLeft }` | 回合开始（猜题者无题目） |
| `s_round_start_to_drawer` | `{ round, totalRounds, word, timeLeft }` | 回合开始（画师含题目） |
| `s_draw_stroke` | `{ playerId, points, color, width, tool }` | 广播绘图事件 |
| `s_canvas_cleared` | `{ by }` | 画布已清空 |
| `s_answer_result` | `{ playerId, correct, displayText, revealedWord? }` | 答案结果 |
| `s_scoreboard_update` | `{ scores: PlayerScore[] }` | 积分更新 |
| `s_timer_sync` | `{ serverTime, timeLeft }` | 计时器同步 |
| `s_round_end` | `{ word, reason }` | 回合结束 |
| `s_game_over` | `{ finalScores, winner }` | 游戏结束 |
| `s_chat_message` | `{ playerId, nickname, text, isSystem, timestamp }` | 聊天消息 |

### 2.3 错误码规格

| 错误码 | 含义 | HTTP 状态码对应 |
|--------|------|-----------------|
| `ROOM_NOT_FOUND` | 房间不存在 | 404 |
| `ROOM_FULL` | 房间已满 | 403 |
| `ROOM_PASSWORD_REQUIRED` | 需要密码 | 401 |
| `ROOM_PASSWORD_WRONG` | 密码错误 | 401 |
| `NICKNAME_TAKEN` | 昵称重复 | 409 |
| `NOT_ROOM_OWNER` | 无权操作（踢人/开始） | 403 |
| `GAME_NOT_IN_LOBBY` | 游戏已开始 | 400 |
| `RATE_LIMITED` | 触发限流 | 429 |

### 2.4 事件频率限制规则

| 事件 | 客户端限制 | 服务端限制 |
|------|-----------|-----------|
| `c_draw_stroke` | 60fps（16ms），每帧最多1次 | 每玩家 120条/秒，超出丢弃 |
| `c_submit_answer` | 无客户端限制 | 每玩家 1次/3秒（同答案），超出返回 `RATE_LIMITED` |
| `c_chat_message` | 无客户端限制 | 每玩家 1次/秒，超出返回 `RATE_LIMITED` |

---

## 三、核心类型定义（server/shared/types.ts）

```typescript
// 玩家
interface Player {
  id: string          // UUID
  nickname: string    // 1-10字符
  sessionId: string   // Socket session，用于断线重连
  isOwner: boolean
  score: number
  hasGuessedCorrectly: boolean  // 本回合是否已猜对
  joinedAt: number    // timestamp，进入顺序用于分配画师
  lastActiveAt: number
}

// 房间状态
type RoomState = 'lobby' | 'playing' | 'gameover'

interface Room {
  id: string          // UUID（不同于 roomCode）
  code: string       // 6位展示码（不暴露 UUID）
  name: string
  password: string    // 空字符串表示无密码
  state: RoomState
  maxPlayers: number
  players: Map<string, Player>  // key = playerId
  drawerQueue: string[]  // 可作画玩家队列（画师轮换）
  currentDrawerId: string | null
  currentWord: string | null
  currentRound: number
  totalRounds: number
  roundStartTime: number | null
  roundDuration: number  // 秒
  usedWords: Set<string>  // 本局已用词
}

// 绘图描边
interface Stroke {
  playerId: string
  points: Point[]
  color: string      // hex
  width: number      // px
  tool: 'brush' | 'eraser'
}

interface Point {
  x: number
  y: number
}

// 聊天消息
interface ChatMessage {
  id: string
  playerId: string | null  // null = 系统消息
  nickname: string | null
  text: string
  isSystem: boolean
  timestamp: number
}

// 游戏结果
interface GameResult {
  roomId: string
  finalScores: PlayerScore[]
  winner: string | null
}

interface PlayerScore {
  playerId: string
  nickname: string
  score: number
  rank: number
}
```

---

## 四、HTTP API 规格（可选，补充 Socket）

> 主要逻辑通过 Socket.io，但以下接口需要 HTTP 支持（WebSocket 无法处理的情况）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/room/:code` | 查询房间是否存在（不暴露密码） |
| `GET` | `/api/words/random` | 服务端选词（画师题目） |

---

## 五、游戏状态机（完整定义）

```
                    ┌─────────────┐
                    │   (无房间)   │
                    └──────┬──────┘
                           │ c_create_room
                           ▼
                    ┌─────────────┐
              ┌────►│    Lobby     │◄──────────┐
              │     │  (等待加入)  │            │
              │     └──────┬───────┘            │
              │            │ c_start_game      │
              │            │ (需 ≥2人)         │
              │            ▼                   │
              │     ┌─────────────┐             │
              │     │   Playing   │             │
              │     │  (游戏进行)  │             │
              │     │ 回合循环中    │             │
              │     └──────┬───────┘             │
              │            │ 最后一轮结束        │
              │            ▼                     │
              │     ┌─────────────┐             │
              └─────│  GameOver   │────────────┘
                    │   (结算)     │ c_leave_room
                    └─────────────┘ (或所有人离开)
```

**状态转移条件：**

| 起点 | 终点 | 触发条件 |
|------|------|---------|
| (无) | Lobby | c_create_room 成功 |
| Lobby | Playing | c_start_game + 玩家数 ≥ 2 |
| Playing | GameOver | 当前轮 == 总轮数 |
| Playing | Playing | 当前轮 < 总轮数，自动进入下一轮 |
| GameOver | Lobby | 游戏结束后玩家留在此房间 |
| Lobby/Playing/GameOver | (删除) | 最后一人离开后 30 秒 |

---

## 六、Pinia Store 结构（client）

```typescript
// stores/room.ts
export const useRoomStore = defineStore('room', () => {
  const room = ref<Room | null>(null)
  const currentPlayer = ref<Player | null>(null)
  const connectionState = ref<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const error = ref<string | null>(null)

  // actions: createRoom, joinRoom, leaveRoom, kickPlayer, startGame
})

// stores/game.ts
export const useGameStore = defineStore('game', () => {
  const state = ref<'idle' | 'playing' | 'round_end' | 'game_over'>('idle')
  const currentRound = ref(0)
  const timeLeft = ref(0)
  const myRole = ref<'drawer' | 'guesser' | 'spectator'>('spectator')
  const scores = ref<PlayerScore[]>([])
  const chatMessages = ref<ChatMessage[]>([])
  const hasGuessedCorrectly = ref(false)

  // actions: submitAnswer, sendChat, clearCanvas（drawer）
})

// stores/canvas.ts
export const useCanvasStore = defineStore('canvas', () => {
  const strokes = ref<Stroke[]>([])
  const tool = ref<'brush' | 'eraser'>('brush')
  const color = ref('#000000')
  const width = ref(4)

  // actions: addStroke, clearCanvas
})
```

---

## 七、Docker 配置规格

```dockerfile
# server/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml
version: '3.9'
services:
  server:
    build: ./server
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## 八、完整开发步骤（细化版）

### Phase 0：项目初始化（1-2 小时）

**目标：** 跑通前后端基础链路，无业务逻辑

- [ ] 初始化 Monorepo（pnpm workspaces）
  - `server/` - Node.js + Express + TypeScript
  - `client/` - Vue 3 + Vite + TypeScript
  - `shared/` - 共享类型定义
- [ ] `shared/types.ts` - 写入所有核心类型（Player, Room, Stroke, ChatMessage, 错误码）
- [ ] `shared/socket-events.ts` - 写入所有事件名常量（防止硬编码字符串）
- [ ] 服务端：Express 启动 + Socket.io 初始化，/health 路由
- [ ] 客户端：Vue Router 安装，页面骨架（Home, Lobby, Game）
- [ ] 配置 ESLint + Prettier
- [ ] `tsc --noEmit` 通过
- [ ] **Review 检查项**：类型定义完整性、目录结构符合 §11.2

---

### Phase 1：房间系统（4-6 小时）

**目标：** 能创建房间、加入房间、Lobby 展示玩家列表

**服务端：**
- [ ] `server/src/rooms.ts` - RoomManager 类，Map 存储房间
- [ ] `c_create_room` 事件处理：生成 6 位 roomCode，检查碰撞
- [ ] `c_join_room` 事件处理：验证密码、人数、昵称重复
- [ ] `c_leave_room` 事件处理：玩家移除、房主转移逻辑
- [ ] `c_kick_player` 事件处理（仅房主）
- [ ] `s_room_updated` 广播（玩家进出时）
- [ ] 房间解散定时器（最后一人离开后 30 秒）
- [ ] **Review**：边界情况（满员、密码错、昵称重复）覆盖完整

**客户端：**
- [ ] `pages/HomePage.vue` - 输入昵称 + 创建/加入房间
- [ ] `pages/LobbyPage.vue` - 房间信息 + 玩家列表 + 开始按钮（房主）
- [ ] `useSocket.ts` - Socket 连接封装，store 中调用
- [ ] `stores/room.ts` - 实现 room store
- [ ] **Review**：Socket 事件名与 shared/socket-events.ts 一致

---

### Phase 2：游戏流程（8-12 小时）

**目标：** 完整回合循环（选词 → 作画 → 答题 → 结算 → 下一轮）

**服务端：**
- [ ] `server/src/game/GameManager.ts` - 游戏逻辑核心类
- [ ] 词库数据 `server/src/data/words.ts` - 至少 200 条词
- [ ] `c_start_game` - 初始化游戏，分配第一轮画师
- [ ] `s_round_start` / `s_round_start_to_drawer` - 差异化推送题目
- [ ] `c_submit_answer` - 服务端验证答案（trim + toLowerCase）
- [ ] 计分公式实现（基础分 + 时间奖励）
- [ ] `s_answer_result` - 广播结果（猜题者不知道自己是否正确，仅服务器告知）
- [ ] `s_scoreboard_update` - 实时积分推送
- [ ] `s_timer_sync` - 服务器权威时间推送（每 5 秒一次）
- [ ] 回合结束条件：超时 / 全部猜对
- [ ] 画师轮换逻辑（按 joinedAt 顺序，跳过已画过的人）
- [ ] **Review**：计分公式验证（边界：0秒猜对、90秒猜对）、游戏状态机完整性

**客户端：**
- [ ] `components/GameCanvas.vue` - Fabric.js 画布
- [ ] `components/Toolbar.vue` - 工具栏（颜色、粗细、清空）
- [ ] `components/AnswerInput.vue` - 答案输入框（仅猜题者可见）
- [ ] `components/Scoreboard.vue` - 积分榜
- [ ] `components/ChatPanel.vue` - 聊天 + 系统消息
- [ ] `components/Timer.vue` - 倒计时显示
- [ ] 客户端绘图限流（16ms/次）
- [ ] `stores/game.ts` - 游戏状态 store
- [ ] **Review**：Canvas 操作仅画师可写，猜题者只读

---

### Phase 3：完善与稳定性（6-8 小时）

**目标：** 断线重连、观战者模式、敏感词过滤、更多工具

**断线重连：**
- [ ] 服务端：连接时分配 sessionId，存于 Player
- [ ] 服务端：Socket.io disconnect 事件处理，60 秒内保留玩家数据
- [ ] 客户端：页面刷新重连，携带 sessionId
- [ ] 服务端：重连后恢复玩家到原房间
- [ ] `s_room_reconnected` - 推送当前房间状态（含画布当前内容）

**观战者模式：**
- [ ] 服务端：游戏开始后加入的玩家 role = 'spectator'
- [ ] 客户端：观战者看到只读画布 + 无答案框 + "观战中" 提示
- [ ] 观战者可在游戏结束后选择加入下一局

**聊天与工具：**
- [ ] `c_chat_message` 限流（1条/秒）
- [ ] 敏感词黑名单过滤（简单 replace）
- [ ] 橡皮擦工具（等价白笔）
- [ ] 清空画布（弹出确认对话框）
- [ ] 颜色预设 12 色 + 自定义颜色选择器

**稳定性：**
- [ ] 服务端 `uncaughtException` / `unhandledRejection` 捕获
- [ ] 客户端 Socket.io reconnect 状态提示
- [ ] `server/src/db/` - SQLite 持久化框架（V2 预留，结构先建）

**Review（Phase 3 整体）：**
- [ ] 所有 socket 事件与 shared/socket-events.ts 对齐
- [ ] 敏感词过滤逻辑存在
- [ ] 断线 60 秒重连测试通过
- [ ] 观战者无法提交答案（服务端验证）

---

### Phase 4：部署与优化（2-3 小时）

**目标：** 跑通 Fly.io 部署，通过压力测试

- [ ] `server/Dockerfile` + `docker-compose.yml`
- [ ] Fly.io 部署脚本（fly.toml）
- [ ] `/api/health` 端点（健康检查）
- [ ] 50人模拟压力测试脚本
- [ ] 性能验证：画布同步 < 100ms，消息吞吐满足要求
- [ ] **Review**：Dockerfile 最小化、Secrets 管理（无硬编码）

---

## 九、技术方案漏洞检查清单

| 检查项 | 结果 | 说明 |
|--------|------|------|
| Socket 事件规格 | ✅ 补充完成 | 2.2 节完整事件清单 |
| 核心类型定义 | ✅ 补充完成 | 第 3 节 shared/types.ts |
| 游戏状态机 | ✅ 补充完成 | 第 5 节，完整转移条件 |
| Pinia Store 结构 | ✅ 补充完成 | 第 6 节，3 个 store 边界 |
| Docker 配置 | ✅ 补充完成 | 第 7 节 |
| 错误码规格 | ✅ 补充完成 | 2.3 节 |
| HTTP API 规格 | ✅ 补充完成 | 第 4 节 |
| 词库内容 | ⚠️ 待建 | server/data/words.ts，Phase 2 实施时创建 |
| 分享链接格式 | ✅ 已覆盖（PRD §2） | URL 含 roomCode |
| 限流机制 | ✅ 补充完成 | 2.4 节 |
| 观战者隔离 | ✅ 已覆盖（PRD §3.4） | 题目不推送、答案框不显示 |

**结论：技术方案无重大遗漏，Phase 0-4 步骤可执行。**

---

*本文档为细化开发计划，补充了技术评审未覆盖的细节。与 PRD.md 共享 §11 的代码规范。*