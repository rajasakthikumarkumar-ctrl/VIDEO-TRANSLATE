# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build the React application
#
# REACT_APP_* variables must be passed at docker build time because
# Create React App bakes them into the static bundle at compile time.
# They are NOT available at container runtime.
#
# Example:
#   docker build \
#     --build-arg REACT_APP_API_BASE=http://<EC2-IP>:5001/api \
#     --build-arg REACT_APP_SOCKET_URL=http://<EC2-IP>:5001 \
#     -t video-meet-client .
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer is cached unless package files change)
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# Receive build-time environment variables
ARG REACT_APP_API_BASE
ARG REACT_APP_SOCKET_URL

ENV REACT_APP_API_BASE=$REACT_APP_API_BASE
ENV REACT_APP_SOCKET_URL=$REACT_APP_SOCKET_URL

# Copy source and build
COPY . .
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Serve the static bundle with nginx
#
# The builder image (with node_modules, source code, build tooling) is
# discarded here. Only the compiled static files are carried forward,
# keeping the final image small (~25 MB vs ~500 MB).
#
# Runtime configuration:
#   - Set SERVER_URL environment variable to point to the backend
#   - Example: SERVER_URL=http://54.123.45.67:5001
#   - The entrypoint script generates runtime-config.js with this URL
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS production

# Remove the default nginx placeholder page
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled React build from Stage 1
COPY --from=builder /app/build /usr/share/nginx/html

# nginx config: handle React Router (client-side routing)
# Without this, any direct URL like /room/abc returns 404 from nginx.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy and set executable permission for entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

# Use custom entrypoint that generates runtime config before starting nginx
ENTRYPOINT ["/docker-entrypoint.sh"]
