#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} = require('@modelcontextprotocol/sdk/types.js');
const axios = require('axios');

class PerforceServer {
  constructor() {
    this.server = new Server(
      {
        name: 'perforce-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.apiBaseUrl = process.env.PERFORCE_API_URL || 'http://localhost:3000/api';
    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_server_info',
            description: 'Get Perforce server information and status',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'list_files',
            description: 'List files in the Perforce depot with optional path filtering',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Depot path to list files from (e.g., //depot/...)',
                  default: '//depot/...',
                },
                max: {
                  type: 'number',
                  description: 'Maximum number of files to return (1-1000)',
                  minimum: 1,
                  maximum: 1000,
                  default: 100,
                },
              },
            },
          },
          {
            name: 'get_file_content',
            description: 'Get the content of a specific file from Perforce',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Full depot path to the file (e.g., //depot/main/file.txt)',
                },
                revision: {
                  type: 'number',
                  description: 'Specific revision number to retrieve (optional)',
                },
              },
              required: ['path'],
            },
          },
          {
            name: 'get_file_history',
            description: 'Get the revision history of a specific file',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Full depot path to the file',
                },
                max: {
                  type: 'number',
                  description: 'Maximum number of history entries to return (1-100)',
                  minimum: 1,
                  maximum: 100,
                  default: 10,
                },
              },
              required: ['path'],
            },
          },
          {
            name: 'list_changes',
            description: 'List recent changes/commits in Perforce',
            inputSchema: {
              type: 'object',
              properties: {
                max: {
                  type: 'number',
                  description: 'Maximum number of changes to return (1-100)',
                  minimum: 1,
                  maximum: 100,
                  default: 20,
                },
                status: {
                  type: 'string',
                  enum: ['pending', 'submitted'],
                  description: 'Filter changes by status',
                },
                user: {
                  type: 'string',
                  description: 'Filter changes by specific user',
                },
              },
            },
          },
          {
            name: 'get_change_details',
            description: 'Get detailed information about a specific change/commit',
            inputSchema: {
              type: 'object',
              properties: {
                changeId: {
                  type: 'number',
                  description: 'The change number to get details for',
                },
              },
              required: ['changeId'],
            },
          },
          {
            name: 'list_users',
            description: 'List all users in the Perforce system',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'sync_files',
            description: 'Synchronize files from the Perforce depot',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Depot path to sync (e.g., //depot/...)',
                  default: '//depot/...',
                },
                force: {
                  type: 'boolean',
                  description: 'Force sync even if files are up-to-date',
                  default: false,
                },
              },
            },
          },
          {
            name: 'analyze_sensitive_changes',
            description: 'Analyze recent changes for potentially sensitive content (combines multiple API calls)',
            inputSchema: {
              type: 'object',
              properties: {
                maxChanges: {
                  type: 'number',
                  description: 'Maximum number of recent changes to analyze',
                  minimum: 1,
                  maximum: 50,
                  default: 10,
                },
                keywords: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                  description: 'Keywords to look for in change descriptions (e.g., ["password", "key", "secret"])',
                  default: ['password', 'secret', 'key', 'token', 'credential', 'auth'],
                },
              },
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_server_info':
            return await this.getServerInfo();
          case 'list_files':
            return await this.listFiles(args?.path, args?.max);
          case 'get_file_content':
            return await this.getFileContent(args?.path, args?.revision);
          case 'get_file_history':
            return await this.getFileHistory(args?.path, args?.max);
          case 'list_changes':
            return await this.listChanges(args?.max, args?.status, args?.user);
          case 'get_change_details':
            return await this.getChangeDetails(args?.changeId);
          case 'list_users':
            return await this.listUsers();
          case 'sync_files':
            return await this.syncFiles(args?.path, args?.force);
          case 'analyze_sensitive_changes':
            return await this.analyzeSensitiveChanges(args?.maxChanges, args?.keywords);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        
        console.error(`Error in tool ${name}:`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error.message}`
        );
      }
    });
  }

  async makeApiRequest(endpoint, method = 'GET', data = null) {
    try {
      const config = {
        method,
        url: `${this.apiBaseUrl}${endpoint}`,
        timeout: 30000,
      };

      if (data) {
        config.data = data;
        config.headers = { 'Content-Type': 'application/json' };
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`API Error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`);
      } else if (error.request) {
        throw new Error('Network Error: Unable to reach Perforce API server');
      } else {
        throw new Error(`Request Error: ${error.message}`);
      }
    }
  }

  async getServerInfo() {
    const result = await this.makeApiRequest('/info');
    return {
      content: [
        {
          type: 'text',
          text: `Perforce Server Information:\n${JSON.stringify(result.data, null, 2)}`,
        },
      ],
    };
  }

  async listFiles(path = '//depot/...', max = 100) {
    const params = new URLSearchParams({ path, max: max.toString() });
    const result = await this.makeApiRequest(`/files?${params}`);
    
    return {
      content: [
        {
          type: 'text',
          text: `Files in ${path} (showing ${result.data.count} files):\n\n${result.data.rawOutput}`,
        },
      ],
    };
  }

  async getFileContent(path, revision) {
    if (!path) {
      throw new McpError(ErrorCode.InvalidParams, 'File path is required');
    }

    const params = new URLSearchParams({ path });
    if (revision) params.append('revision', revision.toString());
    
    const result = await this.makeApiRequest(`/files/content?${params}`);
    
    return {
      content: [
        {
          type: 'text',
          text: `Content of ${path}${revision ? `#${revision}` : ''}:\n\n${result.data.content}`,
        },
      ],
    };
  }

  async getFileHistory(path, max = 10) {
    if (!path) {
      throw new McpError(ErrorCode.InvalidParams, 'File path is required');
    }

    const params = new URLSearchParams({ path, max: max.toString() });
    const result = await this.makeApiRequest(`/files/history?${params}`);
    
    return {
      content: [
        {
          type: 'text',
          text: `History for ${path}:\n\n${result.data.history}`,
        },
      ],
    };
  }

  async listChanges(max = 20, status, user) {
    const params = new URLSearchParams({ max: max.toString() });
    if (status) params.append('status', status);
    if (user) params.append('user', user);
    
    const result = await this.makeApiRequest(`/changes?${params}`);
    
    return {
      content: [
        {
          type: 'text',
          text: `Recent Changes (${result.data.count} entries):\n\n${result.data.rawOutput}`,
        },
      ],
    };
  }

  async getChangeDetails(changeId) {
    if (!changeId) {
      throw new McpError(ErrorCode.InvalidParams, 'Change ID is required');
    }

    const result = await this.makeApiRequest(`/changes/${changeId}`);
    
    return {
      content: [
        {
          type: 'text',
          text: `Details for Change ${changeId}:\n\n${result.data.rawOutput}`,
        },
      ],
    };
  }

  async listUsers() {
    const result = await this.makeApiRequest('/users');
    
    return {
      content: [
        {
          type: 'text',
          text: `Perforce Users (${result.data.count} users):\n\n${result.data.rawOutput}`,
        },
      ],
    };
  }

  async syncFiles(path = '//depot/...', force = false) {
    const result = await this.makeApiRequest('/sync', 'POST', { path, force });
    
    return {
      content: [
        {
          type: 'text',
          text: `Sync Results for ${path}${force ? ' (forced)' : ''}:\n\n${result.data.rawOutput}`,
        },
      ],
    };
  }

  async analyzeSensitiveChanges(maxChanges = 10, keywords = ['password', 'secret', 'key', 'token', 'credential', 'auth']) {
    try {
      // Get recent changes
      const changesResult = await this.makeApiRequest(`/changes?max=${maxChanges}`);
      const changesText = changesResult.data.rawOutput;
      
      // Parse change numbers from the output
      const changeNumbers = [];
      const changeLines = changesText.split('\n').filter(line => line.trim());
      
      for (const line of changeLines) {
        const match = line.match(/^Change (\d+)/);
        if (match) {
          changeNumbers.push(parseInt(match[1]));
        }
      }

      let analysisResults = `Sensitive Change Analysis Report\n`;
      analysisResults += `=====================================\n`;
      analysisResults += `Analyzed ${changeNumbers.length} recent changes\n`;
      analysisResults += `Keywords searched: ${keywords.join(', ')}\n\n`;

      let foundSensitiveChanges = 0;

      // Analyze each change for sensitive content
      for (const changeId of changeNumbers) {
        try {
          const changeResult = await this.makeApiRequest(`/changes/${changeId}`);
          const changeDetails = changeResult.data.rawOutput;
          
          // Check for sensitive keywords (case-insensitive)
          const foundKeywords = [];
          const lowerChangeDetails = changeDetails.toLowerCase();
          
          for (const keyword of keywords) {
            if (lowerChangeDetails.includes(keyword.toLowerCase())) {
              foundKeywords.push(keyword);
            }
          }

          if (foundKeywords.length > 0) {
            foundSensitiveChanges++;
            analysisResults += `🚨 POTENTIALLY SENSITIVE CHANGE ${changeId}\n`;
            analysisResults += `Keywords found: ${foundKeywords.join(', ')}\n`;
            analysisResults += `Details:\n${changeDetails}\n`;
            analysisResults += `${'='.repeat(60)}\n\n`;
          }
        } catch (error) {
          analysisResults += `⚠️  Could not analyze change ${changeId}: ${error.message}\n\n`;
        }
      }

      if (foundSensitiveChanges === 0) {
        analysisResults += `✅ No potentially sensitive changes found in the last ${maxChanges} changes.\n`;
      } else {
        analysisResults += `\n🔍 SUMMARY: Found ${foundSensitiveChanges} potentially sensitive changes out of ${changeNumbers.length} analyzed.\n`;
        analysisResults += `Please review these changes carefully for actual sensitive content.\n`;
      }

      return {
        content: [
          {
            type: 'text',
            text: analysisResults,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to analyze sensitive changes: ${error.message}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Perforce MCP server running on stdio');
  }
}

const server = new PerforceServer();
server.run().catch(console.error);