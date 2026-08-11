#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# docker-entrypoint.sh — Generate runtime configuration before nginx starts
#
# This script runs when the container starts and generates runtime-config.js
# with the actual backend URL from environment variables.
#
# Environment variables:
#   SERVER_URL - Full backend URL (e.g., http://54.123.45.67:5001)
#                Falls back to localhost:5001 if not set
# ─────────────────────────────────────────────────────────────────────────────

set -e

# Default to localhost if SERVER_URL is not set (for local Docker testing)
SERVER_URL="${SERVER_URL:-http://localhost:5001}"

echo "🔧 Generating runtime configuration..."
echo "📡 Backend URL: ${SERVER_URL}"

# Generate runtime-config.js with the actual backend URL
cat > /usr/share/nginx/html/runtime-config.js <<EOF
// Auto-generated at container startup — DO NOT EDIT
// This file is created by docker-entrypoint.sh from the SERVER_URL environment variable
window.API_CONFIG = {
  apiBase: '${SERVER_URL}/api',
  socketUrl: '${SERVER_URL}'
};
console.log('🌐 Runtime config loaded:', window.API_CONFIG);
EOF

echo "✅ Runtime configuration generated"
echo "🚀 Starting nginx..."

# Start nginx (pass all arguments to nginx)
exec nginx -g 'daemon off;'
