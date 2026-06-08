FROM node:20-bullseye-slim

# Install canvas native build dependencies + font support
# Using bullseye (Debian 11) for better canvas/node-gyp compatibility
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpixman-1-dev \
    libfontconfig1-dev \
    libfreetype6-dev \
    fonts-liberation \
    fonts-dejavu-core \
    pkg-config \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (canvas needs native compilation)
RUN npm install --omit=dev --build-from-source

# Copy source code
COPY . .

# Create data directories
# Note: backend/data/ is mounted as a persistent disk on Render.com
RUN mkdir -p backend/data/images backend/data/posts backend/data/logs backend/data/analytics

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/status', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the server
CMD ["node", "backend/server.js"]
