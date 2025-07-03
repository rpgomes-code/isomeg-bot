# Simple single-stage Dockerfile
FROM node:18-alpine

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy TypeScript config and source
COPY tsconfig.json ./
COPY src/ ./src/

# Build the application
RUN pnpm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S isomeg -u 1001 -G nodejs && \
    chown -R isomeg:nodejs /app

# Switch to non-root user
USER isomeg

# Start the application
ENTRYPOINT ["node", "dist/index.js"]