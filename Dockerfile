# Единый образ: Next.js (web) + health-ui MCP + tmux с Claude Code внутри.
# Claude Code CLI работает через свой OAuth, поэтому директории ~/.claude и ~/.claude.json
# монтируются с хоста через docker-compose (см. docker-compose.yml).

FROM node:20-bookworm-slim

# --- system deps ------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
      tmux ca-certificates curl wget git tini jq golang-go \
    && rm -rf /var/lib/apt/lists/*

# --- Claude Code CLI --------------------------------------------------------
RUN npm install -g @anthropic-ai/claude-code

# --- ghealth (Google Health API CLI) — optional wearables sync --------------
RUN git clone --depth 1 https://github.com/Google-Health-API/google-health-cli.git /tmp/ghealth \
    && cd /tmp/ghealth && go build -o /usr/local/bin/ghealth . \
    && rm -rf /tmp/ghealth

# --- app --------------------------------------------------------------------
WORKDIR /app

# 1. install web deps (cached layer)
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci

# 2. install mcp deps
COPY mcp/package.json mcp/package-lock.json ./mcp/
RUN cd mcp && npm ci

# 3. copy sources
COPY web/ ./web/
COPY mcp/ ./mcp/
COPY runtime/ ./runtime/
COPY wearables/ ./wearables/
COPY data.example/ ./data.example/
COPY ecosystem.config.js ./

# 4. build Next.js
RUN cd web && npm run build

# --- runtime ---------------------------------------------------------------
ENV NODE_ENV=production \
    PORT=3100 \
    HEALTH_DATA_DIR=/data \
    HEALTH_TMUX_SESSION=health \
    HEALTH_START_SCRIPT=/app/runtime/start-claude.sh

VOLUME ["/data"]
EXPOSE 3100

COPY deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh /app/runtime/start-claude.sh

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node_modules/next/dist/bin/next", "start", "-p", "3100"]
