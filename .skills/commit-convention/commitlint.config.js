module.exports = {
  extends: ['@commitlint/config-conventional'],

  rules: {
    // 类型枚举
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // 修复 bug
        'docs',     // 文档变更
        'style',    // 代码格式（不影响功能）
        'refactor', // 重构
        'perf',     // 性能优化
        'test',     // 测试
        'build',    // 构建或依赖变更
        'ci',       // CI 配置
        'chore',    // 其他变更
        'revert',   // 回滚
      ],
    ],

    // 类型必须小写
    'type-case': [2, 'always', 'lower-case'],

    // 类型后面需要冒号
    'type-empty': [2, 'never'],

    // scope 范围（小写）
    'scope-case': [2, 'always', 'lower-case'],

    // scope 可以为空
    'scope-empty': [2, 'never'],

    // subject 不能为空
    'subject-empty': [2, 'never'],

    // subject 必须以句号结尾
    'subject-full-stop': [2, 'never', '.'],

    // subject 长度限制
    'subject-max-length': [2, 'always', 72],

    // body 最大行长度
    'body-max-line-length': [2, 'always', 100],

    // header 最大长度
    'header-max-length': [2, 'always', 100],

    // 允许的 scope
    'scope-enum': [
      2,
      'always',
      [
        'server',
        'client',
        'shared',
        'socket',
        'canvas',
        'store',
        'room',
        'game',
        'deps',
      ],
    ],
  },

  // 帮助信息
  helpUrl:
    'https://github.com/conventional-changelog/commitlint/#what-is-commitlint',
};