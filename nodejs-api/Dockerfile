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
# We'll keep /app as your main application directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy application code
COPY . .

# Create workspace directory for Perforce operations
# This is where your client workspace will be rooted
RUN mkdir -p /workspace

# Copy the setup script into the container and make it executable
COPY scripts/setup-perforce.sh /usr/local/bin/setup-perforce.sh
RUN chmod +x /usr/local/bin/setup-perforce.sh

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application - this now runs the setup script first
# The '&&' ensures 'npm start' only runs if the setup script succeeds.
CMD ["sh", "-c", "/usr/local/bin/setup-perforce.sh && npm start"]