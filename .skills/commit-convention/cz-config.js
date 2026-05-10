module.exports = {
  types: [
    {
      value: 'feat',
      name: 'feat:     新功能',
      title: 'Features',
    },
    {
      value: 'fix',
      name: 'fix:      修复 bug',
      title: 'Bug Fixes',
    },
    {
      value: 'docs',
      name: 'docs:     文档变更',
      title: 'Documentation',
    },
    {
      value: 'style',
      name: 'style:    代码格式（不影响功能）',
      title: 'Styles',
    },
    {
      value: 'refactor',
      name: 'refactor: 重构',
      title: 'Code Refactoring',
    },
    {
      value: 'perf',
      name: 'perf:     性能优化',
      title: 'Performance Improvements',
    },
    {
      value: 'test',
      name: 'test:     添加/修改测试',
      title: 'Tests',
    },
    {
      value: 'build',
      name: 'build:    构建或依赖变更',
      title: 'Builds',
    },
    {
      value: 'ci',
      name: 'ci:       CI 配置',
      title: 'Continuous Integrations',
    },
    {
      value: 'chore',
      name: 'chore:    其他变更',
      title: 'Chores',
    },
    {
      value: 'revert',
      name: 'revert:   回滚',
      title: 'Reverts',
    },
  ],

  scopes: [
    { value: 'server', name: 'server:   服务端代码' },
    { value: 'client', name: 'client:   客户端代码' },
    { value: 'shared', name: 'shared:   共享类型/常量' },
    { value: 'socket', name: 'socket:   Socket.io 事件处理' },
    { value: 'canvas', name: 'canvas:   画布相关（Fabric.js）' },
    { value: 'store', name: 'store:    状态管理（Pinia）' },
    { value: 'room', name: 'room:    房间管理' },
    { value: 'game', name: 'game:    游戏逻辑' },
    { value: 'deps', name: 'deps:    依赖更新' },
  ],

  // 允许自定义 scope
  allowCustomScopes: true,
  allowEmptyScopes: true,
  customScopesAlias: 'custom',

  // subject 相关
  subjectLimit: 72,

  // 问题状态
  issuePrefixes: [
    { value: 'closed', name: 'closed:   ISSUES #xxx' },
  ],
  allowCustomIssuePrefixes: true,

  // 跳过问题
  skipQuestions: ['body', 'issues', 'breaking'],

  // 默认问题前缀
  defaultIssuePrefix: 'closed',

  // 是否在选择 scope 后换行
  breaklineNumber: 100,

  // 问题关键字
  issuePrefixesForAutoAutomator: ['closed'],
};