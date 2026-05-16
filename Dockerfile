# Draw and Guess - Railway Single Container Deployment (from client/)
# Serves both API (Node.js) and frontend (nginx)

# ========================
# Stage 1: Build
# ========================
FROM node:18-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@9
# Build timestamp for cache bust
ARG CACHEBUST=1

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY shared/ shared/
COPY server/package.json server/
COPY client/package.json client/
RUN pnpm install --frozen-lockfile

COPY server/ server/
COPY client/ client/
COPY CHANGELOG.md ./

# Build shared first, then server, then client
RUN pnpm --filter @draw-and-guess/shared build
RUN pnpm --filter @draw-and-guess/server build

# Client build: Vite only picks up VITE_* env vars at build time
ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=${VITE_SERVER_URL:-https://echogame.ccwu.cc}
RUN pnpm --filter @draw-and-guess/client build

# ========================
# Stage 2: Runtime
# ========================
FROM node:18-alpine AS runtime
WORKDIR /app
EXPOSE 80

RUN npm install -g pnpm@9 && \
    apk add --no-cache nginx curl

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/client/dist ./client/dist

COPY nginx.conf /etc/nginx/http.d/default.conf
RUN rm -f /etc/nginx/conf.d/default.conf

# Start nginx in background, then run Node.js
CMD sh -c 'nginx -g "daemon off;" & exec node server/dist/server/src/index.js'
