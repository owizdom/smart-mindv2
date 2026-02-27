# ── Build stage ──
FROM node:22-slim AS builder
WORKDIR /app

# Install build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY agents/ ./agents/
COPY dashboard/ ./dashboard/
RUN npm run build

# ── Runtime stage ──
FROM node:22-slim AS runtime
WORKDIR /app

# Copy compiled JS + node_modules (includes pre-built native binaries)
COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/dashboard    ./dashboard

RUN mkdir -p /data
VOLUME ["/data"]

# EigenCloud routes external traffic to port 80
EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:'+(process.env.AGENT_PORT||80)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENV NODE_ENV=production
ENV DB_PATH=/data/swarm-agent.db
ENV AGENT_PORT=80

CMD ["node", "dist/agents/runner.js"]
