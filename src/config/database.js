const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Helper function to get a client with automatic release
const getClient = async () => {
  const client = await pool.connect();
  const release = client.release;
  
  // Override release function to add logging if needed
  client.release = () => {
    release.apply(client);
  };
  
  return client;
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient,
  pool
};