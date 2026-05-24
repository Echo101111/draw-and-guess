FROM node:18-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@9 && apk add --no-cache python3 make g++
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

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/shared/dist ./shared/dist

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

USER appuser

CMD ["node", "server/dist/server/src/index.js"]
