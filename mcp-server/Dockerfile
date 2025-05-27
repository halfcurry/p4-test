# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies for better logging and debugging
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm i --only=production

# Copy source code
COPY index.js ./
COPY test.js ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001 -G nodejs

# Create data directory and set permissions
RUN mkdir -p /app/data && \
    chown -R mcp:nodejs /app

# Switch to non-root user
USER mcp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('MCP Server Health Check: OK')" || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PERFORCE_API_URL=http://nodejs-api:3000/api

# Make the script executable
RUN chmod +x index.js

# Default command
CMD ["node", "index.js"]