FROM node:20-slim

# Install canvas + font dependencies (required for carousel image generation)
RUN apt-get update && apt-get install -y \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libfontconfig1 \
    libfontconfig1-dev \
    fonts-liberation \
    fonts-noto-color-emoji \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production --omit=dev

# Copy source code
COPY . .

# Ensure data directories exist with correct permissions
# Note: backend/data/ is mounted as a persistent disk on Render.com
RUN mkdir -p backend/data/images backend/data/posts backend/data/logs backend/data/analytics logs

# Expose port
EXPOSE 3000

# Health check (Render.com uses this to verify the container is healthy)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/status', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the server
CMD ["node", "backend/server.js"]
