# Changelog

## 2.0.1 — 2026-05-13

- Feat: 游戏进行中玩家可加入房间，当前轮观战（可看画板和聊天），下一轮自动参与
- Feat: 中途加入玩家收到 👀 观战提示，4 秒自动消失
- Feat: 登录页右上角新增更新日志按钮，点击弹窗展示版本历史（`?raw` import 从源文件读取）
- Fix: 画师断线重连机制 — 激活 `restoreSession()` 自动调用、服务端恢复游戏状态（词语/笔画/计时器/积分榜）
- Fix: 路由跳转（Lobby → Game）时监听器重注册导致笔画丢失 — 移除 LobbyPage 的 game 监听，Canvas 初始化后同步缓冲笔画
- Feat: nginx 生产缓存策略 — index.html `no-cache`，hashed assets `immutable` 永久缓存
- Feat: 服务端 `/health` 返回 `version` 字段，支持客户端版本检测
- Refactor: 提取 `emitGameSnapshot()` 消除 `sendSpectatorSnapshot`/`restorePlayerState` 重复代码

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
