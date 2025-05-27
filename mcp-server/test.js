#!/usr/bin/env node

// Simple test to verify MCP server functionality
const axios = require('axios');

const PERFORCE_API_URL = process.env.PERFORCE_API_URL || 'http://localhost:3000/api';

async function testPerforceAPI() {
  console.log('Testing Perforce API connection...');
  console.log(`API URL: ${PERFORCE_API_URL}`);
  
  try {
    // Test health endpoint
    console.log('\n1. Testing health endpoint...');
    const healthResponse = await axios.get(`${PERFORCE_API_URL.replace('/api', '')}/health`);
    console.log('✅ Health check passed:', healthResponse.data.status);
    
    // Test server info
    console.log('\n2. Testing server info...');
    const infoResponse = await axios.get(`${PERFORCE_API_URL}/info`);
    console.log('✅ Server info retrieved successfully');
    console.log('Server info keys:', Object.keys(infoResponse.data.data || {}));
    console.log('Server info values:', Object.values(infoResponse.data.data || {}));
    
    // Test list files
    console.log('\n3. Testing list files...');
    const filesResponse = await axios.get(`${PERFORCE_API_URL}/files`);
    console.log('✅ Files listed successfully');
    console.log('Files count:', filesResponse.data.data?.count || 0);
    
    // Test list changes
    console.log('\n4. Testing list changes...');
    const changesResponse = await axios.get(`${PERFORCE_API_URL}/changes`);
    console.log('✅ Changes listed successfully');
    console.log('Changes count:', changesResponse.data.data?.count || 0);
    
    console.log('\n🎉 All tests passed! MCP server should work correctly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

async function testMCPServer() {
  console.log('\n' + '='.repeat(50));
  console.log('MCP SERVER FUNCTIONALITY TEST');
  console.log('='.repeat(50));
  
  // Test that we can import the MCP SDK
  try {
    console.log('\n1. Testing MCP SDK import...');
    const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
    console.log('✅ MCP SDK imported successfully');
  } catch (error) {
    console.error('❌ Failed to import MCP SDK:', error.message);
    console.log('Please run: npm install');
    return;
  }
  
  // Test API connectivity
  await testPerforceAPI();
  
  console.log('\n' + '='.repeat(50));
  console.log('USAGE INSTRUCTIONS');
  console.log('='.repeat(50));
  console.log('1. Start your Perforce and Node.js API containers:');
  console.log('   docker-compose up -d');
  console.log('');
  console.log('2. Add this MCP server to your Claude Desktop config:');
  console.log('   {');
  console.log('     "mcpServers": {');
  console.log('       "perforce": {');
  console.log('         "command": "node",');
  console.log('         "args": ["/path/to/index.js"],');
  console.log('         "env": {');
  console.log(`           "PERFORCE_API_URL": "${PERFORCE_API_URL}"`);
  console.log('         }');
  console.log('       }');
  console.log('     }');
  console.log('   }');
  console.log('');
  console.log('3. Available MCP tools:');
  console.log('   - get_server_info: Get Perforce server information');
  console.log('   - list_files: List files in depot');
  console.log('   - get_file_content: Get specific file content');
  console.log('   - get_file_history: Get file revision history');
  console.log('   - list_changes: List recent changes/commits');
  console.log('   - get_change_details: Get detailed change information');
  console.log('   - list_users: List Perforce users');
  console.log('   - sync_files: Sync files from depot');
  console.log('   - analyze_sensitive_changes: Analyze changes for sensitive content');
}

if (require.main === module) {
  testMCPServer().catch(console.error);
}

module.exports = { testPerforceAPI, testMCPServer };