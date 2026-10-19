// ==============================================================================
// DATABASE CONNECTION MODULE (backend/db.js)
// ==============================================================================
// Architectural Role: Pure MySQL Database Connection Pool
//
// NO WORKAROUNDS / NO IN-MEMORY FALLBACK:
// This module directly and exclusively communicates with the live MySQL server.
// Every query executed by Express routes runs directly against the MySQL engine.
//
// WHY USE A CONNECTION POOL INSTEAD OF A SINGLE CONNECTION?
// 1. Concurrency: Node.js handles multiple incoming HTTP requests simultaneously.
//    A single `createConnection()` forces all queries into a single queue over one socket.
//    A pool maintains a set of ready-to-use connections (e.g., 10), serving concurrent
//    requests in parallel.
// 2. Resilience: If MySQL drops an idle connection or restarts, the pool automatically
//    creates fresh connections on demand without crashing the Node.js server.
// 3. Efficiency: Handshaking a new TCP/TLS connection for every single HTTP request
//    adds 30-50ms latency. The pool keeps connections warm and reuses them.
// ==============================================================================

const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

// Load environment variables from backend/.env into process.env
dotenv.config();

// Create the MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'admin',
  database: process.env.DB_NAME || 'campus_crud',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Diagnostic startup test: acquire a connection from the pool to verify credentials
async function verifyDatabaseConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('----------------------------------------------------');
    console.log('✅ [MySQL Database]: Connected successfully!');
    console.log(`   Host:     ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306}`);
    console.log(`   Database: ${process.env.DB_NAME || 'campus_crud'}`);
    console.log(`   User:     ${process.env.DB_USER || 'root'}`);
    console.log('----------------------------------------------------');
    connection.release(); // Return connection back to the pool
  } catch (error) {
    console.error('----------------------------------------------------');
    console.error('❌ [MySQL Database Error]: Connection failed!');
    console.error(`   Message: ${error.message}`);
    console.error(`   Code:    ${error.code}`);
    console.error('----------------------------------------------------');
    throw error;
  }
}

verifyDatabaseConnection();

// Export the pool directly for use in Express routes
module.exports = pool;
