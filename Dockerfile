# Multi-stage build for NexusProseCreator Publisher Service
# Includes Pandoc and Calibre for format conversion

FROM node:20-alpine AS base

# Install system dependencies for book publishing
# Note: Some advanced packages (calibre, full texlive) not available in Alpine
# Install minimal toolchain for format conversion
RUN apk update && \
    apk add --no-cache \
    pandoc \
    imagemagick \
    ghostscript \
    python3 \
    py3-pip \
    fontconfig \
    ttf-dejavu \
    && pip3 install --break-system-packages --no-cache-dir ebooklib Pillow

WORKDIR /app

# Copy package files
COPY services/nexus-prosecreator-publisher/package*.json ./

# Install ALL dependencies (including TypeScript for build)
RUN npm install

# Copy source code
COPY services/nexus-prosecreator-publisher/src ./src
COPY services/nexus-prosecreator-publisher/tsconfig.json ./

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies only
RUN apk update && \
    apk add --no-cache \
    pandoc \
    imagemagick \
    ghostscript \
    python3 \
    fontconfig \
    ttf-dejavu

WORKDIR /app

# Copy package files
COPY --from=base /app/package*.json ./

# Copy node_modules from build stage (already has all dependencies)
COPY --from=base /app/node_modules ./node_modules

# Copy built application
COPY --from=base /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 9012

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:9012/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/server.js"]
