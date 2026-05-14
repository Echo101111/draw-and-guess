FROM node:18-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@9

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY client/package.json client/
RUN pnpm install --frozen-lockfile

COPY shared/src shared/src
COPY client/ client/
COPY CHANGELOG.md ./
RUN pnpm --filter @draw-and-guess/shared build

ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=${VITE_SERVER_URL:-http://localhost:3000}
RUN pnpm --filter @draw-and-guess/client build

FROM nginx:alpine
COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
