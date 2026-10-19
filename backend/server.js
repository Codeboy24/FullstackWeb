// ==============================================================================
// EXPRESS REST API SERVER (backend/server.js)
// ==============================================================================
// In-Memory Mock Database Implementation (No external database required)
// Compatible with Express 5 path syntax.

const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==============================================================================
// IN-MEMORY DUMMY DATABASE
// ==============================================================================
let nextId = 4; // Tracks the next auto-increment ID
let sportsData = [
  {
    id: 1,
    player_name: "Marcus Rashford",
    position: "Forward",
    jersey_number: 10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 2,
    player_name: "Bukayo Saka",
    position: "Winger",
    jersey_number: 7,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 3,
    player_name: null,
    position: null,
    jersey_number: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// ==============================================================================
// MIDDLEWARE
// ==============================================================================

// 1. Enable Cross-Origin Resource Sharing (CORS)
app.use(cors());

// 2. JSON Body Parser
app.use(express.json());

// 3. Serve Frontend Static Assets
app.use(express.static(path.join(__dirname, '../frontend')));

// ==============================================================================
// RESTFUL API ENDPOINTS (/api/sports)
// ==============================================================================

/**
 * ENDPOINT 1: GET /api/sports
 * PURPOSE: Retrieve all sport records
 */
app.get('/api/sports', (req, res) => {
  res.status(200).json({
    success: true,
    count: sportsData.length,
    data: sportsData
  });
});

/**
 * ENDPOINT 2: GET /api/sports/:id
 * PURPOSE: Fetch a single sport record by ID
 */
app.get('/api/sports/:id', (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const record = sportsData.find(item => item.id === targetId);

  if (!record) {
    return res.status(404).json({
      success: false,
      message: `Sport record with ID ${targetId} not found.`
    });
  }

  res.status(200).json({
    success: true,
    data: record
  });
});

/**
 * ENDPOINT 3: POST /api/sports
 * PURPOSE: Create a new record (Player or Fixture)
 */
app.post('/api/sports', (req, res) => {
  const { record_type, player_name, position, jersey_number } = req.body;

  const isFixture = (record_type && record_type.toLowerCase() === 'fixture') ||
                    (!player_name && !position && (jersey_number === undefined || jersey_number === null || jersey_number === ''));

  let finalPlayerName = null;
  let finalPosition = null;
  let finalJerseyNumber = null;

  if (!isFixture) {
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

  const newRecord = {
    id: nextId++,
    player_name: finalPlayerName,
    position: finalPosition,
    jersey_number: finalJerseyNumber,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  sportsData.push(newRecord);

  res.status(201).json({
    success: true,
    message: `${isFixture ? 'Fixture' : 'Player'} successfully registered!`,
    data: newRecord
  });
});

/**
 * ENDPOINT 4: PUT /api/sports/:id
 * PURPOSE: Update an existing record
 */
app.put('/api/sports/:id', (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const index = sportsData.findIndex(item => item.id === targetId);

  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: `Cannot update: Sport record with ID ${targetId} not found.`
    });
  }

  const existing = sportsData[index];
  const { record_type, player_name, position, jersey_number } = req.body;
  const isFixture = (record_type && record_type.toLowerCase() === 'fixture');

  let finalPlayerName = null;
  let finalPosition = null;
  let finalJerseyNumber = null;

  if (!isFixture) {
    finalPlayerName = (player_name !== undefined)
      ? (player_name ? player_name.trim() : null)
      : existing.player_name;

    finalPosition = (position !== undefined)
      ? (position ? position.trim() : null)
      : existing.position;

    finalJerseyNumber = (jersey_number !== undefined && jersey_number !== '' && jersey_number !== null)
      ? parseInt(jersey_number, 10)
      : existing.jersey_number;
  }

  const updatedRecord = {
    ...existing,
    player_name: finalPlayerName,
    position: finalPosition,
    jersey_number: finalJerseyNumber,
    updated_at: new Date().toISOString()
  };

  sportsData[index] = updatedRecord;

  res.status(200).json({
    success: true,
    message: `Record #${targetId} updated successfully!`,
    data: updatedRecord
  });
});

/**
 * ENDPOINT 5: DELETE /api/sports/:id
 * PURPOSE: Delete a record by ID
 */
app.delete('/api/sports/:id', (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const initialLength = sportsData.length;
  
  sportsData = sportsData.filter(item => item.id !== targetId);

  if (sportsData.length === initialLength) {
    return res.status(404).json({
      success: false,
      message: `Cannot delete: Record with ID ${targetId} does not exist.`
    });
  }

  res.status(200).json({
    success: true,
    message: `Record with ID ${targetId} deleted successfully.`,
    deletedId: targetId
  });
});

// ==============================================================================
// CENTRALIZED ERROR HANDLING MIDDLEWARE
// ==============================================================================
app.use((err, req, res, next) => {
  console.error('🔥 [Server Error]:', err.message);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error.',
    errorCode: err.code || 'SERVER_ERROR'
  });
});

// ==============================================================================
// EXPRESS 5 WILDCARD FALLBACK
// ==============================================================================
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ==============================================================================
// START SERVER
// ==============================================================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});