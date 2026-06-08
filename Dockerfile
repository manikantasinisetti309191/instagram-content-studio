FROM node:20-slim

# Install canvas dependencies (required for carousel image generation)
RUN apt-get update && apt-get install -y \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY . .

# Create data directories
RUN mkdir -p backend/data/images backend/data/posts backend/data/logs logs

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "backend/server.js"]
