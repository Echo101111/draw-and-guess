#!/bin/sh
set -e

# 以 root 身份修复 data 目录权限
chown -R appuser:appgroup /app/server/dist/server/data 2>/dev/null || true

# 降权为 appuser 并执行主进程
exec su-exec appuser:appgroup "$@"
