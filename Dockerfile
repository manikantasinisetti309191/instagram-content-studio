FROM node:20-slim

WORKDIR /app

# Copy package files and install dependencies
# @napi-rs/canvas ships pre-compiled Linux binaries — NO system build deps needed
COPY package*.json ./
RUN npm install --omit=dev

# Copy source code
COPY . .

# Create data directories
RUN mkdir -p backend/data/images backend/data/posts backend/data/logs backend/data/analytics

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/status', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "backend/server.js"]
