require('dotenv').config();
const express = require('express');
const compression = require('compression');
const exportRoutes = require('./routes/exports');
const { query } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(compression());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/', exportRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server with database retry
async function startServer() {
  let retries = 30;
  
  while (retries > 0) {
    try {
      await query('SELECT 1');
      console.log('Database connection successful');
      
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
      
      return;
    } catch (error) {
      console.log(`Database connection failed (${retries} retries left):`, error.message);
      retries--;
      
      if (retries === 0) {
        console.error('Could not connect to database after multiple retries');
        process.exit(1);
      }
      
      // Wait 5 seconds before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});