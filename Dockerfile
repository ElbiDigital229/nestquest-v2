# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY . .
RUN npm run build

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install production deps only
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy built client assets + server source
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Uploads directory — declared as a volume so container rebuilds don't wipe
# user-uploaded files. Mount a persistent volume here in production (or set
# UPLOADS_DIR to a mounted path such as /data/uploads).
RUN mkdir -p uploads
VOLUME ["/app/uploads"]

EXPOSE 3000

# Use tsx to run TypeScript directly (avoids a separate compile step for the server)
CMD ["node", "--import", "tsx/esm", "server/index.ts"]
