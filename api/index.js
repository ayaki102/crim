const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

// Use PostgreSQL in production (Vercel) or SQLite for local development
const database = process.env.NODE_ENV === 'production' || process.env.POSTGRES_URL || process.env.DATABASE_URL 
  ? require('../backend/database-postgres') 
  : require('../backend/database');
const pinsRoutes = require('../backend/routes/pins');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Initialize database
let dbInitialized = false;

async function initializeDatabase() {
  if (!dbInitialized) {
    try {
      await database.initialize();
      dbInitialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }
}

// API routes
app.use('/api/pins', async (req, res, next) => {
  try {
    await initializeDatabase();
    next();
  } catch (error) {
    res.status(500).json({ error: 'Database initialization failed' });
  }
}, pinsRoutes(null)); // Note: Socket.io won't work in serverless, but we'll handle that

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch all other routes and serve index.html (SPA behavior)
app.get('*', (req, res) => {
  // If it's an API request that wasn't caught, return 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  // Otherwise serve the main page
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Application error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

module.exports = app;