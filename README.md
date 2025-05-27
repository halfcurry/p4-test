# Perforce Node.js REST API

A containerized Perforce server with a Node.js REST API for easy integration and testing.

## Architecture

- **Perforce Server**: `sourcegraph/helix-p4d` - Full Perforce Helix Core server
- **Node.js API**: Express-based REST API with comprehensive Perforce integration
- **Docker Compose**: Orchestrated containers with networking and persistence

## Quick Start

### Prerequisites

- Docker and Docker Compose
- `curl` and `jq` (for testing)

### Setup

```bash
docker-compose build
docker-compose up -d
```

## API Endpoints

### Base URL: `http://localhost:3000`

| Endpoint | Method | Description | Parameters |
|----------|--------|-------------|------------|
| `/health` | GET | Health check | - |
| `/api/info` | GET | Server information | - |
| `/api/files` | GET | List depot files | `path`, `max` |
| `/api/files/content` | GET | Get file content | `path`, `revision` |
| `/api/files/history` | GET | File history | `path`, `max` |
| `/api/changes` | GET | List changes | `max`, `status`, `user` |
| `/api/changes/:id` | GET | Change details | - |
| `/api/users` | GET | List users | - |
| `/api/sync` | POST | Sync files | `path`, `force` |
| `/api/docs` | GET | API documentation | - |

## Usage Examples

### Using curl

```bash
# Health check
curl http://localhost:3000/health

# List recent files
curl "http://localhost:3000/api/files?max=10" | jq

# Get file content
curl "http://localhost:3000/api/files/content?path=//depot/main/README.md" | jq

# List recent changes
curl "http://localhost:3000/api/changes?max=5" | jq

# Sync files
curl -X POST http://localhost:3000/api/sync \
  -H "Content-Type: application/json" \
  -d '{"path": "//depot/...", "force": false}'
```

## Perforce Connection Details

- **Server**: `localhost:1666`
- **User**: `super`
- **Password**: `YourStrongPassword123!` (⚠️ Change this!)
- **Client**: `nodejs-client`

### Connecting with P4V or P4 CLI

```bash
# Set environment
export P4PORT=localhost:1666
export P4USER=super
export P4PASSWD=YourStrongPassword123!

# Test connection
p4 info

# List files
p4 files //depot/...

# Get changes
p4 changes -m 10
```

## Development

### Manual Docker Commands

```bash
# Build and start
docker-compose build
docker-compose up -d

# View logs
docker-compose logs -f nodejs-api
docker-compose logs -f perforce-server

# Execute commands
docker-compose exec nodejs-api bash
docker-compose exec perforce-server p4 info

# Stop and clean
docker-compose down
docker-compose down -v  # with volumes
```

### File Structure in Container

**Perforce Server:**
- Data: `/p4` (persisted volume)
- Depot: `//depot/...`

**Node.js API:**
- Workspace: `/workspace`
- App: `/app`

## Error Handling

The API provides consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```