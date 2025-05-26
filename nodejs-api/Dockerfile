# nodejs-api/Dockerfile
FROM node:18-slim

# Install system dependencies for Perforce CLI
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    software-properties-common \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Perforce P4 CLI
RUN wget -qO - https://package.perforce.com/perforce.pubkey | apt-key add - \
    && echo "deb http://package.perforce.com/apt/ubuntu/ jammy release" > /etc/apt/sources.list.d/perforce.list \
    && apt-get update \
    && apt-get install -y helix-cli \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy application code
COPY . .

# Create workspace directory
RUN mkdir -p /workspace

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]