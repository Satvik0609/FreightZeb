# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production && \
    npx prisma generate

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser  -S freightzeb -u 1001

# Copy deps + generated prisma client
COPY --from=deps --chown=freightzeb:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=freightzeb:nodejs /app/prisma      ./prisma

# Copy source
COPY --chown=freightzeb:nodejs src     ./src
COPY --chown=freightzeb:nodejs package.json ./

# Create required directories
RUN mkdir -p logs uploads && \
    chown -R freightzeb:nodejs logs uploads

USER freightzeb

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["node", "src/server.js"]
