#!/usr/bin/env bash
set -euo pipefail

# 从 .env 加载配置（如果存在）
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

SERVER_IP=${1:-${SERVER_IP:-}}
SSH_USER=${2:-${SSH_USER:-ubuntu}}

if [ -z "$SERVER_IP" ]; then
  echo "错误: 未指定服务器 IP"
  echo ""
  echo "用法: pnpm deploy [服务器IP] [ssh用户]"
  echo "示例: pnpm deploy 123.45.67.89 ubuntu"
  echo ""
  echo "或在项目 .env 文件中设置:"
  echo "  SERVER_IP=123.45.67.89"
  echo "  SSH_USER=ubuntu"
  exit 1
fi
SSH_DEST="${SSH_USER}@${SERVER_IP}"
PROJECT_DIR="/home/${SSH_USER}/draw-and-guess"
ARCHIVE=".deploy-package.tar.gz"

echo "🚀 部署到 ${SSH_DEST}"

echo "📦 打包项目..."
tar --no-xattrs \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=.claude \
    --exclude=.opencode \
    --exclude=.skills \
    --exclude="${ARCHIVE}" \
    -czf "${ARCHIVE}" .

echo "📤 上传..."
scp "${ARCHIVE}" "${SSH_DEST}:/tmp/"

echo "🔧 部署..."
ssh -T "${SSH_DEST}" << SSHCMD
set -euo pipefail
mkdir -p "${PROJECT_DIR}"
rm -rf "${PROJECT_DIR}"/*
tar -xzf "/tmp/${ARCHIVE}" -C "${PROJECT_DIR}"
rm "/tmp/${ARCHIVE}"
cd "${PROJECT_DIR}"
echo "🐳 构建并启动..."
docker compose up -d --build
echo "✅ 部署完成！"
echo "   访问: http://${SERVER_IP}:8888"
echo "   健康:  http://${SERVER_IP}:8888/health"
SSHCMD

rm "${ARCHIVE}"
echo "🎉 完成"
