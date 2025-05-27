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

# Perforce MCP Server

A Model Context Protocol (MCP) server that provides AI agents with access to Perforce version control system through your Node.js API.

## Features

- **Server Information**: Get Perforce server status and configuration
- **File Operations**: List files, get content, and view revision history
- **Change Management**: List recent changes and get detailed change information
- **User Management**: List Perforce users
- **Sync Operations**: Synchronize files from the depot
- **Security Analysis**: Analyze recent changes for potentially sensitive content

## Architecture

```
AI Agent (Claude) → MCP Server → Node.js API → Perforce Server
```

## Setup Instructions

### 1. Project Structure

Create the following directory structure:

```
your-project/
├── nodejs-api/           # Your existing Node.js API
│   ├── server.js
│   ├── package.json
│   └── Dockerfile
├── mcp-server/           # New MCP server
│   ├── index.js
│   ├── package.json
│   ├── test.js
│   └── Dockerfile
└── docker-compose.yml    # Updated compose file
```

### 2. Install Dependencies

In the `mcp-server` directory:

```bash
cd mcp-server
npm install
```

### 3. Test the Setup

```bash
# Test the MCP server functionality
npm test

# Or run directly
node test.js
```

### 4. Start the Services

```bash
# Start all services (Perforce, Node.js API, MCP Server)
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs mcp-server
```

### 5. Configure Claude Desktop

Add the MCP server to your Claude Desktop configuration file:

**Location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Configuration:**
```json
{
  "mcpServers": {
    "perforce": {
      "command": "node",
      "args": ["/path/to/your/mcp-server/index.js"],
      "env": {
        "PERFORCE_API_URL": "http://localhost:3000/api"
      }
    }
  }
}
```

**For Docker setup:**
```json
{
  "mcpServers": {
    "perforce": {
      "command": "docker",
      "args": ["exec", "-i", "perforce-mcp-server", "node", "index.js"],
      "env": {
        "PERFORCE_API_URL": "http://nodejs-api:3000/api"
      }
    }
  }
}
```

## Available Tools

### Basic Operations

#### `get_server_info`
Get Perforce server information and status.

```
No parameters required
```

#### `list_files`
List files in the Perforce depot.

**Parameters:**
- `path` (optional): Depot path to list files from (default: `//depot/...`)
- `max` (optional): Maximum number of files to return (1-1000, default: 100)

#### `get_file_content`
Get the content of a specific file.

**Parameters:**
- `path` (required): Full depot path to the file
- `revision` (optional): Specific revision number to retrieve

#### `get_file_history`
Get the revision history of a specific file.

**Parameters:**
- `path` (required): Full depot path to the file
- `max` (optional): Maximum number of history entries (1-100, default: 10)

### Change Management

#### `list_changes`
List recent changes/commits in Perforce.

**Parameters:**
- `max` (optional): Maximum number of changes to return (1-100, default: 20)
- `status` (optional): Filter by status (`pending` or `submitted`)
- `user` (optional): Filter changes by specific user

#### `get_change_details`
Get detailed information about a specific change.

**Parameters:**
- `changeId` (required): The change number to get details for

### User Management

#### `list_users`
List all users in the Perforce system.

```
No parameters required
```

### Sync Operations

#### `sync_files`
Synchronize files from the Perforce depot.

**Parameters:**
- `path` (optional): Depot path to sync (default: `//depot/...`)
- `force` (optional): Force sync even if files are up-to-date (default: false)

### Security Analysis

#### `analyze_sensitive_changes`
Analyze recent changes for potentially sensitive content.

**Parameters:**
- `maxChanges` (optional): Maximum number of recent changes to analyze (1-50, default: 10)
- `keywords` (optional): Array of keywords to search for (default: ["password", "secret", "key", "token", "credential", "auth"])

## Usage Examples

### Basic File Operations

```
Ask Claude: "List the recent files in our depot"
Tool used: list_files

Ask Claude: "Show me the content of //depot/main/config.txt"
Tool used: get_file_content with path="//depot/main/config.txt"
```

### Change Analysis

```
Ask Claude: "What are the last 10 changes in our repository?"
Tool used: list_changes with max=10

Ask Claude: "Show me details for change 1234"
Tool used: get_change_details with changeId=1234
```

### Security Analysis

```
Ask Claude: "Analyze recent changes for any sensitive content"
Tool used: analyze_sensitive_changes

Ask Claude: "Check the last 20 changes for passwords or keys"
Tool used: analyze_sensitive_changes with maxChanges=20, keywords=["password", "key"]
```

## Troubleshooting

### Connection Issues

1. **Check service status:**
   ```bash
   docker-compose ps
   curl http://localhost:3000/health
   ```

2. **Check logs:**
   ```bash
   docker-compose logs nodejs-api
   docker-compose logs mcp-server
   ```

3. **Test API directly:**
   ```bash
   curl http://localhost:3000/api/info
   ```

### MCP Server Issues

1. **Test MCP server:**
   ```bash
   cd mcp-server
   node test.js
   ```

2. **Check dependencies:**
   ```bash
   npm list @modelcontextprotocol/sdk
   ```

3. **Verify configuration in Claude Desktop:**
   - Ensure paths are correct
   - Check environment variables
   - Restart Claude Desktop after config changes

### Common Error Messages

- **"Network Error: Unable to reach Perforce API server"**
  - Check if the Node.js API is running on the correct port
  - Verify PERFORCE_API_URL environment variable

- **"API Error: 500 - Failed to get server info"**
  - Check Perforce server connection in the Node.js API
  - Verify Perforce credentials and server status

- **"Tool execution failed"**
  - Check MCP server logs for detailed error messages
  - Ensure all required parameters are provided

## Development

### Adding New Tools

1. Add tool definition in `setupToolHandlers()` method
2. Implement the corresponding method
3. Update this README with usage examples
4. Add tests in `test.js`

### Environment Variables

- `PERFORCE_API_URL`: URL of your Node.js Perforce API (default: http://localhost:3000/api)
- `NODE_ENV`: Environment mode (development/production)

## Security Considerations

- The MCP server runs with the same permissions as your Node.js API
- Sensitive change analysis helps identify potential security issues
- Consider implementing authentication if exposing beyond localhost
- Review change analysis results carefully - they may contain false positives

## License

MIT License - see LICENSE file for details.