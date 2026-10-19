// ==============================================================================
// EXPRESS REST API SERVER (backend/server.js)
// ==============================================================================
// Pure Web Server + MySQL Architecture (No Mock Fallbacks / No Workarounds)
//
// THE DATA JOURNEY EXPLAINED (PEDAGOGICAL OVERVIEW):
// ------------------------------------------------------------------------------
// When a user interacts with the UI in the browser, data travels through these layers:
// 1. [CLIENT / BROWSER]:
//    - The user submits an HTML form or clicks "Delete".
//    - Vanilla JS intercepts the event (`e.preventDefault()`), builds a JSON payload,
//      and fires `fetch('/api/sports', { method, headers, body })`.
// 2. [NETWORK & CORS LAYER]:
//    - The HTTP request reaches this Node.js server over TCP/IP (localhost or Local Area Network).
//    - `cors()` ensures the browser allows the communication regardless of origin.
// 3. [BODY PARSER MIDDLEWARE]:
//    - `express.json()` buffers the incoming TCP data chunks, runs `JSON.parse()`,
//      and attaches the resulting JavaScript object to `req.body`.
// 4. [ROUTER & CRUCIAL BUSINESS LOGIC]:
//    - Express matches the HTTP method and URL endpoint.
//    - Crucial Logic: Handles Single-Table Polymorphism.
//      - If record_type is 'fixture', player_name, position, and jersey_number MUST be NULL.
//      - If record_type is 'player', player_name, position, and jersey_number are saved.
// 5. [MYSQL DATABASE (mysql2/promise)]:
//    - Express executes parameterized queries with `?` placeholders on the MySQL pool.
//    - Parameterized queries ensure that SQL Injection is mathematically impossible.
// 6. [HTTP RESPONSE]:
//    - Express serializes MySQL's response into JSON and replies with proper HTTP status
//      codes (200 OK, 201 Created, 404 Not Found, 500 Server Error).
// 7. [DOM REHYDRATION]:
//    - The browser's `fetch()` Promise resolves, and Vanilla JS updates the DOM
//      surgically without triggering a full page refresh.
// ==============================================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const dotenv = require('dotenv');

// Load environment variables (.env)
dotenv.config();

// Import the pure MySQL connection pool
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ==============================================================================
// MIDDLEWARE
// ==============================================================================

// 1. Enable Cross-Origin Resource Sharing (CORS)
// Allows browsers running on localhost, local network IPs, or Live Server to call this API.
app.use(cors());

// 2. JSON Body Parser
// Reassembles raw TCP request stream into req.body object.
app.use(express.json());

// 3. Serve Frontend Static Assets (index.html, app.js, style.css)
// This enables accessing the web interface directly via browser at http://localhost:3000
// or from any device on your local network at http://<YOUR_LAN_IP>:3000.
app.use(express.static(path.join(__dirname, '../frontend')));


// ==============================================================================
// RESTFUL API ENDPOINTS (/api/sports)
// ==============================================================================

/**
 * ------------------------------------------------------------------------------
 * ENDPOINT 1: GET /api/sports
 * PURPOSE:    Retrieve all records from the `sports` table in MySQL
 * HTTP CODE:  200 OK
 * DATA JOURNEY:
 *   Frontend fetch('/api/sports') -> Express app.get() ->
 *   MySQL executes `SELECT * FROM sports ORDER BY id ASC` ->
 *   Rows returned directly from MySQL -> JSON response sent to client.
 * ------------------------------------------------------------------------------
 */
app.get('/api/sports', async (req, res, next) => {
  try {
    // Pure MySQL Query via pool
    const [rows] = await pool.query(
      'SELECT id, player_name, position, jersey_number, created_at, updated_at FROM sports ORDER BY id ASC'
    );

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    next(error); // Pass to centralized error handler
  }
});

/**
 * ------------------------------------------------------------------------------
 * ENDPOINT 2: GET /api/sports/:id
 * PURPOSE:    Fetch a single sport record by primary key ID
 * HTTP CODE:  200 OK (Found) | 404 Not Found
 * ------------------------------------------------------------------------------
 */
app.get('/api/sports/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Parameterized query prevents SQL injection
    const [rows] = await pool.query(
      'SELECT id, player_name, position, jersey_number, created_at, updated_at FROM sports WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Sport record with ID ${id} not found.`
      });
    }

    res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * ------------------------------------------------------------------------------
 * ENDPOINT 3: POST /api/sports
 * PURPOSE:    Create a new record in MySQL (Player or Fixture)
 * HTTP CODE:  201 Created | 400 Bad Request
 *
 * CRUCIAL LOGIC: HANDLING NULL VALUES IN A SINGLE TABLE
 * The `sports` table stores both Players and Fixtures.
 * - When creating a 'player':
 *     player_name is required. position and jersey_number are optional.
 * - When creating a 'fixture':
 *     player_name, position, and jersey_number MUST be set to NULL.
 *
 * The backend enforces this normalization before issuing the SQL INSERT.
 * ------------------------------------------------------------------------------
 */
app.post('/api/sports', async (req, res, next) => {
  try {
    const { record_type, player_name, position, jersey_number } = req.body;

    const isFixture = (record_type && record_type.toLowerCase() === 'fixture') ||
                      (!player_name && !position && (jersey_number === undefined || jersey_number === null || jersey_number === ''));

    let finalPlayerName = null;
    let finalPosition = null;
    let finalJerseyNumber = null;

    if (isFixture) {
      // For fixtures, player attributes are explicitly coerced to NULL in MySQL
      finalPlayerName = null;
      finalPosition = null;
      finalJerseyNumber = null;
    } else {
      // For players, validate that a name was supplied
      if (!player_name || player_name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: "Field 'player_name' is required when creating a player record."
        });
      }
      finalPlayerName = player_name.trim();
      finalPosition = position && position.trim() !== '' ? position.trim() : null;
      finalJerseyNumber = (jersey_number !== undefined && jersey_number !== '' && jersey_number !== null)
        ? parseInt(jersey_number, 10)
        : null;
    }

    // Execute parameterized INSERT in MySQL
    const sql = `
      INSERT INTO sports (player_name, position, jersey_number)
      VALUES (?, ?, ?)
    `;

    const [result] = await pool.query(sql, [
      finalPlayerName,
      finalPosition,
      finalJerseyNumber
    ]);

    // Retrieve newly inserted row with database-generated timestamps
    const [newRow] = await pool.query(
      'SELECT id, player_name, position, jersey_number, created_at, updated_at FROM sports WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: `${isFixture ? 'Fixture' : 'Player'} successfully registered in MySQL!`,
      data: newRow[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * ------------------------------------------------------------------------------
 * ENDPOINT 4: PUT /api/sports/:id
 * PURPOSE:    Update an existing record in MySQL
 * HTTP CODE:  200 OK | 400 Bad Request | 404 Not Found
 * ------------------------------------------------------------------------------
 */
app.put('/api/sports/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check existence
    const [existing] = await pool.query('SELECT * FROM sports WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Cannot update: Sport record with ID ${id} not found.`
      });
    }

    const { record_type, player_name, position, jersey_number } = req.body;

    const isFixture = (record_type && record_type.toLowerCase() === 'fixture');

    let finalPlayerName = null;
    let finalPosition = null;
    let finalJerseyNumber = null;

    if (isFixture) {
      // Coerce all to NULL for fixtures
      finalPlayerName = null;
      finalPosition = null;
      finalJerseyNumber = null;
    } else {
      finalPlayerName = (player_name !== undefined)
        ? (player_name ? player_name.trim() : null)
        : existing[0].player_name;

      finalPosition = (position !== undefined)
        ? (position ? position.trim() : null)
        : existing[0].position;

      finalJerseyNumber = (jersey_number !== undefined && jersey_number !== '' && jersey_number !== null)
        ? parseInt(jersey_number, 10)
        : null;
    }

    // Execute parameterized UPDATE
    const updateSql = `
      UPDATE sports
      SET player_name = ?,
          position = ?,
          jersey_number = ?
      WHERE id = ?
    `;

    await pool.query(updateSql, [
      finalPlayerName,
      finalPosition,
      finalJerseyNumber,
      id
    ]);

    // Retrieve refreshed row with updated_at timestamp
    const [updatedRow] = await pool.query(
      'SELECT id, player_name, position, jersey_number, created_at, updated_at FROM sports WHERE id = ?',
      [id]
    );

    res.status(200).json({
      success: true,
      message: `Record #${id} updated successfully in MySQL!`,
      data: updatedRow[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * ------------------------------------------------------------------------------
 * ENDPOINT 5: DELETE /api/sports/:id
 * PURPOSE:    Delete a record from MySQL
 * HTTP CODE:  200 OK | 404 Not Found
 * ------------------------------------------------------------------------------
 */
app.delete('/api/sports/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query('DELETE FROM sports WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: `Cannot delete: Record with ID ${id} does not exist.`
      });
    }

    res.status(200).json({
      success: true,
      message: `Record with ID ${id} deleted successfully from MySQL.`,
      deletedId: Number(id)
    });
  } catch (error) {
    next(error);
  }
});

// ==============================================================================
// CENTRALIZED ERROR HANDLING MIDDLEWARE
// ==============================================================================
// Catches unhandled exceptions and database errors, ensuring structured JSON responses
// instead of abrupt process termination.
app.use((err, req, res, next) => {
  console.error('🔥 [Server Error]:', err.message);

  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Database / Server Error.',
    sqlMessage: err.sqlMessage || null,
    errorCode: err.code || 'SERVER_ERROR'
  });
});

// ==============================================================================
// LOCAL NETWORK DETECTION HELPER
// ==============================================================================
// Scans network interfaces to detect this computer's local Wi-Fi / Ethernet IPv4
function getLocalNetworkIp() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // Find IPv4 non-internal address (skip 127.0.0.1 and link-local 169.254)
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        ips.push({ name, address: net.address });
      }
    }
  }
  return ips.length > 0 ? ips[0].address : 'localhost';
}

// ==============================================================================
// START SERVER (BIND TO 0.0.0.0 FOR LOCAL NETWORK ACCESS)
// ==============================================================================
// Listening on '0.0.0.0' binds Express to ALL network interfaces, allowing devices
// on the same Wi-Fi / Ethernet network (phones, laptops) to access the system.
app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalNetworkIp();
  console.log('====================================================');
  console.log('🚀 Sports CRUD Pure Web Server Running!');
  console.log(`📡 Database Engine: Pure MySQL (campus_crud.sports)`);
  console.log(`🌐 Local Access:    http://localhost:${PORT}`);
  console.log(`📶 Network Access:  http://${localIp}:${PORT}`);
  console.log('----------------------------------------------------');
  console.log('RESTful Endpoints:');
  console.log(`   GET    /api/sports       (List all)`);
  console.log(`   GET    /api/sports/:id   (Get one)`);
  console.log(`   POST   /api/sports       (Create)`);
  console.log(`   PUT    /api/sports/:id   (Update)`);
  console.log(`   DELETE /api/sports/:id   (Delete)`);
  console.log('====================================================');
});
