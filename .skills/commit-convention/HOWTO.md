# 提交规范 (.skills/commit-convention)

本目录包含项目的 Git 提交规范配置。

## 文件说明

```
commit-convention/
├── commitlint.config.js   # commitlint 规则配置
├── cz-config.js          # commitizen 配置（交互式提交）
└── HOWTO.md              # 使用说明
```

## 规范格式

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Type 类型

| Type     | 说明                           |
| -------- | ------------------------------ |
| `feat`   | 新功能                         |
| `fix`    | 修复 bug                       |
| `docs`   | 文档变更                       |
| `style`  | 代码格式（不影响功能）         |
| `refactor` | 重构                         |
| `perf`   | 性能优化                       |
| `test`   | 添加/修改测试                  |
| `build`  | 构建或依赖变更                 |
| `ci`     | CI 配置                        |
| `chore`  | 其他变更（配置、工具等）       |

### Scope 范围

使用以下之一（来自 CLAUDE.md 的模块结构）：

- `server` - 服务端代码
- `client` - 客户端代码
- `shared` - 共享类型/常量
- `socket` - Socket.io 事件处理
- `canvas` - 画布相关（Fabric.js）
- `store` - 状态管理（Pinia）
- `room` - 房间管理
- `game` - 游戏逻辑
- `deps` - 依赖更新

### 示例

```
feat(server): 添加房间创建功能

fix(client): 修复画布清除按钮无响应问题

docs: 更新 README 中的安装步骤

refactor(socket): 重构事件处理器结构

feat(canvas): 实现画笔颜色切换
```

## 安装配置

```bash
# 安装依赖
pnpm add -D @commitlint/cli @commitlint/config-conventional commitizen

# 初始化 commitizen
pnpm exec commitizen init cz-conventional-changelog --save-dev --save-exact

# 配置 commitlint（创建 .commitlintrc.js）
# 详见 commitlint.config.js
```

## Git Hooks（可选）

配合 husky 使用：

```bash
pnpm add -D husky
pnpm exec husky install
pnpm exec husky add .husky/commit-msg 'pnpm exec commitlint --edit $1'
```

## 验证提交

```bash
# 手动验证最近一次提交
git commit -m "fix(server): ..." | npx commitlint --edit

# 检查文件
pnpm exec commitlint --from HEAD~1 --to HEAD --style conventional
```