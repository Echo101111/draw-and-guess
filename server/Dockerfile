FROM node:18-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@9
# 如需镜像加速，取消注释下一行：
# RUN pnpm config set registry https://registry.npmmirror.com

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY shared/tsconfig.json shared/
COPY server/package.json server/
RUN pnpm install --frozen-lockfile

COPY shared/src shared/src
COPY server/ server/
RUN pnpm --filter @draw-and-guess/shared build && pnpm --filter @draw-and-guess/server build

FROM node:18-alpine
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
RUN npm install -g pnpm@9
# 如需镜像加速，取消注释下一行：
# RUN pnpm config set registry https://registry.npmmirror.com

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY shared/package.json shared/
COPY server/package.json server/
RUN pnpm install --frozen-lockfile --prod

# su-exec 用于从 root 降权到 appuser
RUN apk add --no-cache su-exec

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/shared/dist ./shared/dist
COPY server/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 构建时创建 data 目录并授权
RUN mkdir -p /app/server/dist/server/data && chown appuser:appgroup /app/server/dist/server/data

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server/dist/server/src/index.js"]
