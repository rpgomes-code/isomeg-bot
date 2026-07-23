FROM node:20-alpine

RUN apk add --no-cache ffmpeg && npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./

RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY drizzle/ ./drizzle/
COPY src/ ./src/

RUN pnpm run build

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 CMD node dist/scripts/healthcheck.js

RUN addgroup -g 1001 -S nodejs && \
    adduser -S isomeg -u 1001 -G nodejs && \
    chown -R isomeg:nodejs /app

USER isomeg

ENTRYPOINT ["node", "dist/index.js"]
