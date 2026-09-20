# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --ignore-scripts

COPY backend/ ./
RUN npx prisma generate && npx tsc --project tsconfig.build.json 2>/dev/null || npx tsc --noEmit

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

RUN apk add --no-cache dumb-init

WORKDIR /app

# Only copy production artifacts
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/package*.json ./backend/
COPY --from=builder /app/backend/prisma ./backend/prisma

ENV NODE_ENV=production
EXPOSE 4000

# dumb-init handles signal forwarding and zombie reaping
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/dist/server.js"]
