# Changelog

## 2.1.1 — 2026-05-14

- Fix: 修复 doLeave() 顺序问题，确保先发送 c_leave_room 再断开 socket
- Fix: endRound 的 setTimeout 记录 ID，避免房间重建后竞态污染状态
- Fix: 画师断线时结束本轮（之前只移除玩家，轮次空跑 90s）
- Fix: socket 创建/加入新房间前先离开旧频道，防止数据泄漏
- Fix: emitStroke 改为增量发送，避免每次发送完整笔画造成网络浪费和渲染重叠
- Fix: handleMouseDown 初始化 lastEmitTime，避免首帧发射微小笔画
- Fix: 密码长度校验 (4-100字符)，昵称大小写不敏感检查
- Fix: 词库耗尽时 endGame 而非静默挂起，发送 gameover 事件
- Fix: startRound 先检查 io 再改状态，避免部分状态残留
- Fix: 服务端提交答案限流 (200ms)，防止恶意刷屏
- Fix: handleDisconnectTimeout O(n*m)→O(1) 通过 playerToRoomId 索引
- Fix: leaveRoom 只使用 room.code 做 socket.leave，保持一致性
- Fix: 删除 never called 的 nextRound 方法
- Fix: 添加路由守卫，未入房间时拦截 lobby/game 路由
- Fix: 系统消息 ID 加序列号防碰撞
- Fix: JOIN_AS_SPECTATOR 的 bcrypt.compare 包 try/catch
- Fix: 画图期间 resize 推迟到笔画结束，避免坐标归一化错位
- Fix: gameStore 不再直接依赖 canvasStore（解耦）
- Fix: canvas 远程笔画增量渲染，避免每帧全量重绘 (O(n²)→O(n))
- Perf: 词库敏感词过滤 O(n²)→O(1)，利用已有 wordToCategory 索引
- Perf: CHANGELOG.md 改为懒加载，减少首屏 JS 体积
- Perf: restoreSession 移除冗余 ROOM_UPDATED 广播
- Chore: 新建 client/Dockerfile 和 nginx.conf，修复构建缺 tsconfig
- Chore: Docker CMD 改为轮询 nginx 就绪后启动，修复 sleep 2 竞态
- Chore: port 解析 NaN 防御，非全局 env 兜底
- Chore: HomePage 定时器在 unmount 时清理
- Chore: 添加 Socket.io connect_error/disconnect 监听器
- Chore: vue app.errorHandler 配置
- Chore: clipboard 非 HTTPS 回退
- Chore: Chat/Answer 输入 trim 提前
- Chore: TypeScript 版本统一 5.9.3, ESLint 环境精简, Vite fs 权限收紧

## 2.1.0 — 2026-05-14

- Fix: 移除游戏结束后 15 秒自动重启逻辑，改为房主手动操作
- Fix: 修复开发环境 Socket.io 连接失败的问题（Vite 代理缺失）
- Fix: 添加服务端绘图限流（~125 事件/秒/玩家），防止恶意刷笔画
- Fix: 修复 leaveRoom 返回语义错误（kicked → removed）
- Fix: 移除 room store 中未使用的 currentPlayer 字段
- Fix: 修复玩家退出/断线时 lastChatTime、lastDrawTime 内存泄漏
- Fix: 移除词库 nature 类别中重复的"石头"
- Fix: 修复 iOS 刘海遮挡倒计时的问题，优化安全区域适配
- Perf: Canvas 增量渲染优化，绘图帧仅更新当前笔画而非全量重绘
- Chore: 新建 client/Dockerfile 和 nginx.conf，修复 docker-compose 构建

## 2.0.2 — 2026-05-13

- Feat: 更新日志弹窗样式重设计，Feat/Fix 改为中文标签
- Fix: 修复更新日志按钮在部分环境下无法显示的问题
- Fix: 猜词提示从 `_` 占位符改为直接显示`x个字`，更直观
- Fix: 移动端顶部被刘海遮挡、底部留白的问题，适配安全区域
- Fix: 移动端倒计时被浏览器顶部工具栏遮挡的问题，统一由 header 处理安全区域

## 2.0.1 — 2026-05-13

- Feat: 游戏进行中玩家可加入房间，当前轮观战，下一轮自动参与
- Feat: 登录页右上角新增更新日志按钮，点击弹窗展示版本历史
- Fix: 画师断线重连后自动恢复游戏状态，不再丢失词语和笔画
- Fix: 从大厅进入游戏时笔画不再丢失
- Fix: 快速画图时最后一段笔画不再丢失

## 1.2.0 — 2026-05-13

- Feat: 离开房间增加二次确认弹窗，避免误触
- Feat: 房间全员退出时立即清理房间和游戏数据，无需等待 30s 超时
- Feat: 移动端右上角新增 🏆 奖杯按钮，点击弹出积分榜弹窗
- Fix: 移动端顶部横向分数条改为奖杯弹窗入口，释放绘画空间
- Fix: 移动端游戏页面锁定 body 滚动，防止 Y 轴滚动条
- Fix: 移动端 game-area 对齐方式调整，内容撑满可用高度

## 1.1.0 — 2026-05-13

- Feat: 词库按难度分级（easy/medium/hard），按回合递进，前 30% 回合只用简单词
- Feat: 猜词者显示字数占位提示 `_ _ _`，替代原有"正在画的是"
- Feat: 时间过半后显示中文分类提示（动物/食物/日常等）
- Feat: 猜对者显示 ✅ 气泡动画，画师和未猜对者可看到
- Fix: 修复分类提示可能因 TIMER_SYNC 闪烁的问题
- Fix: 修复猜对者气泡用昵称去重可能因同名漏显的问题
- Fix: 禁止 iOS Safari 双指缩放和双击缩放，保护布局
- Perf: getWordCategory 从 O(n*m) 遍历改为 O(1) 反向索引

## 1.0.0 — 2026-05-13

- Fix: 房主创建房间后立刻显示在玩家列表中
- Fix: 快速画图时最后一段笔画不再丢失
- Fix: 画师轮转改为纯轮转，2 人局交替、多人局公平排序
- Feat: 轮次切换动画，分阶段展示答案、结束原因、下位画师
- Style: 轮次切换动画适配手机端字号
