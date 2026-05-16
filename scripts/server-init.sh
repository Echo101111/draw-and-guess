#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "用法: ./scripts/server-init.sh <服务器IP> [ssh用户]"
  echo "示例: ./scripts/server-init.sh 123.45.67.89 ubuntu"
  exit 1
fi

SERVER_IP=$1
SSH_USER=${2:-ubuntu}
SSH_DEST="${SSH_USER}@${SERVER_IP}"

echo "🔧 初始化服务器 ${SSH_DEST}"

ssh -T "${SSH_DEST}" << 'SSHCMD'
set -euo pipefail

echo "1/5 📦 安装 Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
  echo "  Docker 安装完成"
else
  echo "  Docker 已安装，跳过"
fi

echo "2/5 ⚙️ 配置 Docker 国内镜像加速..."
sudo mkdir -p /etc/docker
cat <<'DAEMON' | sudo tee /etc/docker/daemon.json > /dev/null
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://docker.m.daocloud.io",
    "https://5t1x1h6z.mirror.aliyuncs.com"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
DAEMON
sudo systemctl daemon-reload && sudo systemctl restart docker
sudo systemctl enable docker
echo "  Docker 配置完成"

echo "3/5 🛡️ 检查防火墙（ufw）..."
if command -v ufw &>/dev/null && ufw status | grep -q active; then
  sudo ufw allow 8888/tcp comment 'draw-and-guess'
  echo "  ufw 已放行 8888 端口"
else
  echo "  ufw 未启用，跳过（请确保腾讯云安全组已放行 8888 端口）"
fi

echo "4/5 📁 创建项目目录..."
sudo mkdir -p /home/${USER}/draw-and-guess
sudo chown ${USER}:${USER} /home/${USER}/draw-and-guess
echo "  /home/${USER}/draw-and-guess 已就绪"

echo "5/5 ✅ 验证..."
docker --version
docker compose version

echo ""
echo "============================================="
echo "🎉 服务器初始化完成！"
echo "   接下来可以运行: ./deploy.sh ${SERVER_IP}"
echo "============================================="
SSHCMD
