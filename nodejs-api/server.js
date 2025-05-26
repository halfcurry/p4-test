// nodejs-api/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');
const { exec } = require('child_process');
const { promisify } = require('util');
const winston = require('winston');
const path = require('path');

// Configure logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3000;

// Perforce configuration
const P4_CONFIG = {
  port: process.env.P4PORT || 'localhost:1666',
  user: process.env.P4USER || 'super',
  password: process.env.P4PASSWD || 'YourStrongPassword123!',
  client: process.env.P4CLIENT || 'nodejs-client'
};

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) }}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Utility function to execute P4 commands
async function executeP4Command(command, options = {}) {
  const env = {
    ...process.env,
    P4PORT: P4_CONFIG.port,
    P4USER: P4_CONFIG.user,
    P4PASSWD: P4_CONFIG.password,
    P4CLIENT: P4_CONFIG.client
  };

  const fullCommand = `p4 ${command}`;
  logger.info(`Executing P4 command: ${fullCommand}`);

  try {
    const { stdout, stderr } = await execAsync(fullCommand, { 
      env,
      cwd: options.cwd || '/workspace',
      timeout: options.timeout || 30000
    });

    if (stderr && !stderr.includes('warning')) {
      logger.warn(`P4 command warning: ${stderr}`);
    }

    // Corrected logging line in executeP4Command
    logger.info(`P4 command stdout for "${fullCommand}":\n${stdout.trim()}`);

    return { success: true, output: stdout.trim(), error: null };
  } catch (error) {
    logger.error(`P4 command failed: ${error.message}`);
    return { success: false, output: null, error: error.message };
  }
}

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

// Routes

// Health check
app.get('/health', async (req, res) => {
  try {
    const result = await executeP4Command('info');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      perforce: result.success ? 'connected' : 'disconnected',
      version: '1.0.0'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Get server info
app.get('/api/info', async (req, res) => {
  try {
    const result = await executeP4Command('info');
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get server info',
        error: result.error
      });
    }

    // Parse P4 info output
    const info = {};
    result.output.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(': ');
      if (valueParts.length > 0) {
        info[key.trim()] = valueParts.join(': ').trim();
      }
    });

    res.json({
      success: true,
      data: info
    });
  } catch (error) {
    logger.error('Error getting server info:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// List files in depot (now returns raw output)
app.get('/api/files', [
  query('path').optional().isString().withMessage('Path must be a string'),
  query('max').optional().isInt({ min: 1, max: 1000 }).withMessage('Max must be between 1 and 1000')
], handleValidationErrors, async (req, res) => {
  try {
    const depotPath = req.query.path || '//depot/...';
    const maxFiles = req.query.max || 100;
    
    const result = await executeP4Command(`files -m ${maxFiles} "${depotPath}"`);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to list files',
        error: result.error
      });
    }

    // --- MODIFIED SECTION ---
    res.json({
      success: true,
      data: {
        rawOutput: result.output, // Return the raw output string
        count: result.output.split('\n').filter(line => line.trim()).length, // Still provide a count
        path: depotPath
      }
    });
    // --- END MODIFIED SECTION ---

  } catch (error) {
    logger.error('Error listing files:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get file content
app.get('/api/files/content', [
  query('path').notEmpty().isString().withMessage('Path is required and must be a string'),
  query('revision').optional().isInt().withMessage('Revision must be a number')
], handleValidationErrors, async (req, res) => {
  try {
    const filePath = req.query.path;
    const revision = req.query.revision ? `#${req.query.revision}` : '';
    
    const result = await executeP4Command(`print -q "${filePath}${revision}"`);
    
    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: 'File not found or cannot be accessed',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: {
        path: filePath,
        revision: revision,
        content: result.output
      }
    });
  } catch (error) {
    logger.error('Error getting file content:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get file history
app.get('/api/files/history', [
  query('path').notEmpty().isString().withMessage('Path is required and must be a string'),
  query('max').optional().isInt({ min: 1, max: 100 }).withMessage('Max must be between 1 and 100')
], handleValidationErrors, async (req, res) => {
  try {
    const filePath = req.query.path;
    const maxChanges = req.query.max || 10;
    
    const result = await executeP4Command(`filelog -m ${maxChanges} "${filePath}"`);
    
    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: 'File history not found',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: {
        path: filePath,
        history: result.output // Return raw output for history
      }
    });
  } catch (error) {
    logger.error('Error getting file history:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// List changes/commits
app.get('/api/changes', [
  query('max').optional().isInt({ min: 1, max: 100 }).withMessage('Max must be between 1 and 100'),
  query('status').optional().isIn(['pending', 'submitted']).withMessage('Status must be pending or submitted'),
  query('user').optional().isString().withMessage('User must be a string')
], handleValidationErrors, async (req, res) => {
  try {
    const maxChanges = req.query.max || 20;
    const status = req.query.status;
    const user = req.query.user;
    
    let command = `changes -m ${maxChanges}`;
    if (status) command += ` -s ${status}`;
    if (user) command += ` -u ${user}`;
    
    const result = await executeP4Command(command);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to list changes',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: {
        rawOutput: result.output, // Return raw output for changes
        count: result.output.split('\n').filter(line => line.trim()).length
      }
    });
  } catch (error) {
    logger.error('Error listing changes:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get change details
app.get('/api/changes/:changeId', [
  param('changeId').isInt().withMessage('Change ID must be a number')
], handleValidationErrors, async (req, res) => {
  try {
    const changeId = req.params.changeId;
    
    const result = await executeP4Command(`describe -s ${changeId}`);
    
    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: 'Change not found',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: {
        changeId: parseInt(changeId),
        rawOutput: result.output // Return raw output for change details
      }
    });
  } catch (error) {
    logger.error('Error getting change details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// List users
app.get('/api/users', async (req, res) => {
  try {
    const result = await executeP4Command('users');
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to list users',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: {
        rawOutput: result.output, // Return raw output for users
        count: result.output.split('\n').filter(line => line.trim()).length
      }
    });
  } catch (error) {
    logger.error('Error listing users:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Sync files
app.post('/api/sync', [
  body('path').optional().isString().withMessage('Path must be a string'),
  body('force').optional().isBoolean().withMessage('Force must be a boolean')
], handleValidationErrors, async (req, res) => {
  try {
    const path = req.body.path || '//depot/...';
    const force = req.body.force || false;
    
    let command = `sync`;
    if (force) command += ' -f';
    command += ` "${path}"`;
    
    const result = await executeP4Command(command);
    
    res.json({
      success: true,
      data: {
        path,
        rawOutput: result.output, // Return raw output for sync
        forced: force
      }
    });
  } catch (error) {
    logger.error('Error syncing files:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  const apiDocs = {
    title: 'Perforce REST API',
    version: '1.0.0',
    endpoints: {
      'GET /health': 'Health check',
      'GET /api/info': 'Get server information',
      'GET /api/files': 'List files in depot (returns raw P4 output) (query: path, max)',
      'GET /api/files/content': 'Get file content (query: path, revision)',
      'GET /api/files/history': 'Get file history (returns raw P4 output) (query: path, max)',
      'GET /api/changes': 'List changes (returns raw P4 output) (query: max, status, user)',
      'GET /api/changes/:changeId': 'Get change details (returns raw P4 output)',
      'GET /api/users': 'List users (returns raw P4 output)',
      'POST /api/sync': 'Sync files (returns raw P4 output) (body: path, force)',
      'GET /api/docs': 'This documentation'
    },
    examples: {
      'List recent files (raw)': 'GET /api/files?path=//depot/...&max=10',
      'Get file content': 'GET /api/files/content?path=//depot/main/README.md',
      'List recent changes (raw)': 'GET /api/changes?max=5',
      'Sync depot': 'POST /api/sync {"path": "//depot/..."}'
    }
  };
  
  res.json(apiDocs);
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    availableEndpoints: '/api/docs'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Perforce Node.js API server running on port ${PORT}`);
  logger.info(`API Documentation available at http://localhost:${PORT}/api/docs`);
  logger.info(`Health check available at http://localhost:${PORT}/health`);
});

module.exports = app;