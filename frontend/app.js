// ==============================================================================
// FRONTEND VANILLA JAVASCRIPT APPLICATION (frontend/app.js)
// ==============================================================================
// Architectural Role: Single-Page Application (SPA) Controller
//
// HOW LOCAL NETWORK (LAN) ACCESSIBILITY WORKS:
// ------------------------------------------------------------------------------
// Instead of hardcoding 'http://localhost:3000', we dynamically compute the API URL
// using `window.location.origin`.
// When accessed from another computer or smartphone on your Wi-Fi network (e.g.
// http://192.168.8.100:3000), `window.location.origin` automatically resolves to
// `http://192.168.8.100:3000`, directing all fetch requests to your PC's IP address!
// ==============================================================================

const API_BASE_URL = `${window.location.origin}/api/sports`;

// ==============================================================================
// STATE MANAGEMENT (HOW THE DOM AVOIDS A FULL PAGE RELOAD)
// ==============================================================================
// In traditional web apps (MPAs), submitting a form or clicking a link causes
// the browser to request an entirely new HTML document from the server.
//
// In this Single-Page Application:
// 1. `event.preventDefault()` suppresses browser form submission and page reload.
// 2. Client-side state (`state.records`) holds the in-memory array of rows from MySQL.
// 3. When an API call succeeds (Create, Update, Delete), we update `state.records`
//    and execute `renderTable()`, which surgically replaces only the innerHTML
//    of the `<tbody>` element.
// 4. Scroll position, active form inputs, and application context remain intact.
const state = {
  records: [],         // Array of sports objects from MySQL
  activeFilter: 'all',  // 'all' | 'player' | 'fixture'
  editingId: null      // null when creating; integer ID when updating
};

// ==============================================================================
// DOM ELEMENT REFERENCES
// ==============================================================================
const DOM = {
  // Form elements
  form: document.getElementById('sportsForm'),
  formTitle: document.getElementById('formTitle'),
  formModeBadge: document.getElementById('formModeBadge'),
  recordId: document.getElementById('recordId'),
  typeRadios: document.querySelectorAll('input[name="record_type"]'),
  typePlayerLabel: document.getElementById('typePlayerLabel'),
  typeFixtureLabel: document.getElementById('typeFixtureLabel'),
  playerFieldsGroup: document.getElementById('playerFieldsGroup'),
  fixtureFieldsGroup: document.getElementById('fixtureFieldsGroup'),
  playerName: document.getElementById('playerName'),
  playerPosition: document.getElementById('playerPosition'),
  jerseyNumber: document.getElementById('jerseyNumber'),
  submitBtn: document.getElementById('submitBtn'),
  cancelEditBtn: document.getElementById('cancelEditBtn'),

  // Table & Filters
  tableBody: document.getElementById('sportsTableBody'),
  filterButtons: document.querySelectorAll('.filter-btn'),
  refreshBtn: document.getElementById('refreshBtn'),

  // Stats & Badges
  statTotal: document.getElementById('statTotal'),
  statPlayers: document.getElementById('statPlayers'),
  statFixtures: document.getElementById('statFixtures'),
  toast: document.getElementById('toastNotification'),
  toastMessage: document.getElementById('toastMessage'),
  toastIcon: document.getElementById('toastIcon'),
  apiStatusBadge: document.getElementById('apiStatusBadge'),
  networkBadge: document.getElementById('networkBadge')
};

// ==============================================================================
// DATA JOURNEY 1: READ ALL RECORDS (GET /api/sports)
// ==============================================================================
/**
 * Fetches all sports rows directly from the MySQL database.
 * DATA JOURNEY:
 *   1. Client executes `fetch('/api/sports')`.
 *   2. Express matches `app.get('/api/sports')`.
 *   3. `pool.query('SELECT * FROM sports ORDER BY id ASC')` runs on MySQL.
 *   4. MySQL returns rows; Express serializes them into JSON.
 *   5. Response arrives in browser, updates `state.records`, and re-renders table.
 */
async function fetchSportsRecords() {
  try {
    renderLoadingState();
    setApiStatus('online', '● MySQL Connected');

    const response = await fetch(API_BASE_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    state.records = result.data || [];

    // Render updated state into the DOM
    renderTable();
    updateStats();
  } catch (error) {
    console.error('Fetch error:', error);
    setApiStatus('offline', '● MySQL Disconnected');
    renderErrorState(error.message);
    showToast(`Failed to connect to MySQL: ${error.message}`, 'error');
  }
}

// ==============================================================================
// DATA JOURNEY 2: CREATE & UPDATE (POST /api/sports & PUT /api/sports/:id)
// ==============================================================================
/**
 * Submits the form data via POST (create) or PUT (update).
 *
 * CRUCIAL LOGIC: HANDLING NULL VALUES IN A SINGLE TABLE
 * - If record_type is 'player':
 *     -> player_name, position, jersey_number are collected and validated.
 * - If record_type is 'fixture':
 *     -> player_name, position, jersey_number are explicitly sent as `null`.
 *     -> MySQL stores SQL `NULL` for these columns.
 */
async function handleFormSubmit(event) {
  event.preventDefault(); // HALTS FULL PAGE RELOAD!

  const selectedType = document.querySelector('input[name="record_type"]:checked').value;
  const isEditing = Boolean(state.editingId);

  // Validate player inputs
  if (selectedType === 'player') {
    if (!DOM.playerName.value.trim()) {
      showToast('Please enter the player name.', 'error');
      DOM.playerName.focus();
      return;
    }
  }

  // Construct payload with explicit null handling for polymorphic single table
  const payload = {
    record_type: selectedType,
    player_name: selectedType === 'player' ? DOM.playerName.value.trim() : null,
    position: selectedType === 'player' && DOM.playerPosition.value.trim() ? DOM.playerPosition.value.trim() : null,
    jersey_number: selectedType === 'player' && DOM.jerseyNumber.value !== '' ? parseInt(DOM.jerseyNumber.value, 10) : null
  };

  const url = isEditing ? `${API_BASE_URL}/${state.editingId}` : API_BASE_URL;
  const method = isEditing ? 'PUT' : 'POST';

  try {
    DOM.submitBtn.disabled = true;
    DOM.submitBtn.textContent = '⏳ Saving to MySQL...';

    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'MySQL database operation failed.');
    }

    showToast(result.message, 'success');
    resetForm();

    // Re-fetch to synchronize state with fresh MySQL auto-increment IDs and timestamps
    await fetchSportsRecords();
  } catch (error) {
    console.error('Submit error:', error);
    showToast(error.message, 'error');
  } finally {
    DOM.submitBtn.disabled = false;
    DOM.submitBtn.textContent = isEditing ? '💾 Update Record in MySQL' : '💾 Save Record to MySQL';
  }
}

// ==============================================================================
// DATA JOURNEY 3: DELETE RECORD (DELETE /api/sports/:id)
// ==============================================================================
/**
 * Deletes a row from MySQL by primary key ID.
 * DATA JOURNEY:
 *   1. User clicks "Delete" button; confirms intention.
 *   2. Client sends HTTP DELETE request to /api/sports/:id.
 *   3. Express runs `DELETE FROM sports WHERE id = ?` on MySQL.
 *   4. On success: JavaScript removes the item from `state.records` and updates the DOM
 *      immediately, avoiding a page refresh.
 */
async function deleteSportRecord(id, entityDescription) {
  const confirmed = window.confirm(`Are you sure you want to delete ${entityDescription} (ID: ${id}) from MySQL?`);
  if (!confirmed) return;

  try {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: 'DELETE',
      headers: { 'Accept': 'application/json' }
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to delete record.');
    }

    showToast(`Record #${id} deleted from MySQL.`, 'success');

    if (state.editingId === id) {
      resetForm();
    }

    // Surgical state & DOM update: filter out the deleted ID
    state.records = state.records.filter(r => r.id !== id);
    renderTable();
    updateStats();
  } catch (error) {
    console.error('Delete error:', error);
    showToast(`Delete failed: ${error.message}`, 'error');
  }
}

// ==============================================================================
// DATA JOURNEY 4: EDIT PREPARATION (GET /api/sports/:id)
// ==============================================================================
/**
 * Pre-populates the form with existing record data for editing.
 */
async function startEditRecord(id) {
  let record = state.records.find(r => r.id === id);

  if (!record) {
    try {
      const response = await fetch(`${API_BASE_URL}/${id}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      record = result.data;
    } catch (err) {
      showToast(`Error loading record #${id}: ${err.message}`, 'error');
      return;
    }
  }

  state.editingId = record.id;
  DOM.recordId.value = record.id;

  // Determine if this row is a Fixture (all player fields NULL) or a Player
  const isFixture = record.player_name === null && record.position === null && record.jersey_number === null;
  const targetType = isFixture ? 'fixture' : 'player';

  DOM.formTitle.textContent = `✏️ Edit Record #${record.id}`;
  DOM.formModeBadge.textContent = `EDITING ID: ${record.id}`;
  DOM.formModeBadge.className = 'mode-badge edit-mode';
  DOM.submitBtn.textContent = '💾 Update Record in MySQL';
  DOM.cancelEditBtn.classList.remove('hidden');

  const targetRadio = document.querySelector(`input[name="record_type"][value="${targetType}"]`);
  if (targetRadio) {
    targetRadio.checked = true;
    updateRecordTypeUI(targetType);
  }

  DOM.playerName.value = record.player_name || '';
  DOM.playerPosition.value = record.position || '';
  DOM.jerseyNumber.value = record.jersey_number !== null ? record.jersey_number : '';

  DOM.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast(`Loaded Record #${record.id} into form.`, 'info');
}

/**
 * Resets form back to Create Mode
 */
function resetForm() {
  state.editingId = null;
  DOM.recordId.value = '';
  DOM.form.reset();

  DOM.formTitle.textContent = '➕ Add New Record';
  DOM.formModeBadge.textContent = 'CREATE MODE';
  DOM.formModeBadge.className = 'mode-badge';
  DOM.submitBtn.textContent = '💾 Save Record to MySQL';
  DOM.cancelEditBtn.classList.add('hidden');

  const defaultRadio = document.querySelector('input[name="record_type"][value="player"]');
  if (defaultRadio) {
    defaultRadio.checked = true;
    updateRecordTypeUI('player');
  }
}

// ==============================================================================
// DOM RENDERING & DEFENSIVE NULL HANDLING
// ==============================================================================
/**
 * Renders table rows based on current state.records and active filter.
 *
 * CRUCIAL LOGIC: HOW THE FRONTEND HANDLES NULL VALUES IN A SINGLE TABLE:
 * For fixture records (Rows 6-10), MySQL returns:
 *   player_name: null
 *   position: null
 *   jersey_number: null
 *
 * Rather than printing ugly 'null' text, defensive rendering checks if the fields
 * are null and outputs a styled badge: `<span class="null-badge">NULL (Fixture)</span>`.
 */
function renderTable() {
  const filtered = state.records.filter(item => {
    const isFixture = (item.player_name === null && item.position === null && item.jersey_number === null);
    if (state.activeFilter === 'all') return true;
    if (state.activeFilter === 'player') return !isFixture;
    if (state.activeFilter === 'fixture') return isFixture;
    return true;
  });

  if (filtered.length === 0) {
    DOM.tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center empty-cell">
          No records found matching filter "<strong>${state.activeFilter}</strong>".
        </td>
      </tr>
    `;
    return;
  }

  const rowsHtml = filtered.map(item => {
    const isFixture = (item.player_name === null && item.position === null && item.jersey_number === null);

    // 1. Type Badge
    const typeBadge = isFixture
      ? `<span class="type-badge fixture">📅 Fixture</span>`
      : `<span class="type-badge player">👤 Player</span>`;

    // 2. Player Name (NULL Handling)
    const nameDisplay = item.player_name !== null
      ? `<strong>${escapeHtml(item.player_name)}</strong>`
      : `<span class="null-badge">NULL (Fixture Event)</span>`;

    // 3. Position (NULL Handling)
    const posDisplay = item.position !== null
      ? escapeHtml(item.position)
      : `<span class="null-badge">NULL (Fixture)</span>`;

    // 4. Jersey Number (NULL Handling)
    const jerseyDisplay = item.jersey_number !== null
      ? `<strong>#${item.jersey_number}</strong>`
      : `<span class="null-badge">NULL (Fixture)</span>`;

    // 5. Timestamps formatted from MySQL
    const createdAtStr = item.created_at ? new Date(item.created_at).toLocaleString() : '-';
    const updatedAtStr = item.updated_at ? new Date(item.updated_at).toLocaleString() : '-';

    // Entity name for delete dialog
    const entityLabel = isFixture ? `Fixture Event #${item.id}` : (item.player_name || `Player #${item.id}`);

    return `
      <tr data-id="${item.id}">
        <td><strong>#${item.id}</strong></td>
        <td>${typeBadge}</td>
        <td>${nameDisplay}</td>
        <td>${posDisplay}</td>
        <td>${jerseyDisplay}</td>
        <td><span class="timestamp-text">${createdAtStr}</span></td>
        <td><span class="timestamp-text">${updatedAtStr}</span></td>
        <td class="text-right">
          <div class="actions-cell">
            <button class="btn btn-sm btn-edit" onclick="startEditRecord(${item.id})">
              ✏️ Edit
            </button>
            <button class="btn btn-sm btn-delete" onclick="deleteSportRecord(${item.id}, '${escapeForJs(entityLabel)}')">
              🗑️ Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Surgically update DOM
  DOM.tableBody.innerHTML = rowsHtml;
}

/**
 * Updates quick stats counters
 */
function updateStats() {
  const total = state.records.length;
  const fixtures = state.records.filter(r => r.player_name === null && r.position === null && r.jersey_number === null).length;
  const players = total - fixtures;

  DOM.statTotal.textContent = total;
  DOM.statPlayers.textContent = players;
  DOM.statFixtures.textContent = fixtures;
}

/**
 * Switch form UI between Player and Fixture modes
 */
function updateRecordTypeUI(type) {
  if (type === 'player') {
    DOM.typePlayerLabel.classList.add('active');
    DOM.typeFixtureLabel.classList.remove('active');
    DOM.playerFieldsGroup.classList.remove('hidden');
    DOM.fixtureFieldsGroup.classList.add('hidden');
  } else {
    DOM.typeFixtureLabel.classList.add('active');
    DOM.typePlayerLabel.classList.remove('active');
    DOM.fixtureFieldsGroup.classList.remove('hidden');
    DOM.playerFieldsGroup.classList.add('hidden');
  }
}

// ==============================================================================
// HELPERS (TOASTS, ESCAPING, LOADING)
// ==============================================================================
function renderLoadingState() {
  DOM.tableBody.innerHTML = `
    <tr>
      <td colspan="8" class="text-center loading-cell">
        <span class="spinner"></span> Querying MySQL database...
      </td>
    </tr>
  `;
}

function renderErrorState(message) {
  DOM.tableBody.innerHTML = `
    <tr>
      <td colspan="8" class="text-center empty-cell" style="color: var(--danger);">
        <strong>❌ Could not load from MySQL:</strong> ${escapeHtml(message)}<br>
        <small style="color: var(--text-muted); display: block; margin-top: 8px;">
          Make sure your Node.js server (<code>npm start</code>) and MySQL are running.
        </small>
      </td>
    </tr>
  `;
}

let toastTimeout = null;
function showToast(message, type = 'info') {
  DOM.toastMessage.textContent = message;
  DOM.toast.className = `toast toast-${type}`;
  DOM.toastIcon.textContent = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';

  DOM.toast.classList.remove('hidden');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    DOM.toast.classList.add('hidden');
  }, 4500);
}

function setApiStatus(status, text) {
  DOM.apiStatusBadge.className = `badge badge-api ${status}`;
  DOM.apiStatusBadge.textContent = text;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeForJs(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// ==============================================================================
// INITIALIZATION
// ==============================================================================
function initEventListeners() {
  DOM.form.addEventListener('submit', handleFormSubmit);
  DOM.cancelEditBtn.addEventListener('click', resetForm);

  DOM.typeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      updateRecordTypeUI(e.target.value);
    });
  });

  DOM.filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeFilter = btn.getAttribute('data-filter');
      renderTable();
    });
  });

  DOM.refreshBtn.addEventListener('click', () => {
    fetchSportsRecords();
    showToast('Refreshing live data from MySQL...', 'info');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  fetchSportsRecords();
});
