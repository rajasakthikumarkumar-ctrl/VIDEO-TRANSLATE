# ─────────────────────────────────────────────────────────────────────────────
# Server — Node.js 20 Alpine
#
# The server uses ES Modules ("type": "module" in package.json) and
# starts with `node index.js`. No build step is needed.
#
# GROQ_API_KEY is injected at RUNTIME via docker-compose / EC2 environment.
# It must never be baked into the image.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine

# Best practice: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --prefer-offline

# Copy application source
COPY . .

# Switch to non-root user after files are in place
USER appuser

# Port the server listens on (must match PORT env var or default 5001)
EXPOSE 5001

# Health check — EC2 / Docker Compose can detect unhealthy containers
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5001/health || exit 1

CMD ["node", "index.js"]
