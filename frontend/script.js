// Global variables
let map;
let socket;
let currentUser = null;
let pins = [];
let categories = [];
let markers = [];
let isCreatingPin = false;

// DOM elements
const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');
const loginForm = document.getElementById('loginForm');
const userInfo = document.getElementById('userInfo');
const pinModal = document.getElementById('pinModal');
const pinForm = document.getElementById('pinForm');
const loading = document.getElementById('loading');
const toastContainer = document.getElementById('toastContainer');

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    setupEventListeners();
});

// Check authentication status
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/me');
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            showApp();
        } else {
            showLogin();
        }
    } catch (error) {
        console.error('Błąd sprawdzania autoryzacji:', error);
        showLogin();
    }
}

// Setup event listeners
function setupEventListeners() {
    // Login form
    loginForm.addEventListener('submit', handleLogin);

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Pin modal
    document.getElementById('addPinBtn').addEventListener('click', () => openPinModal());
    document.getElementById('fabAddPin').addEventListener('click', () => openPinModal());
    document.getElementById('closeModal').addEventListener('click', closePinModal);
    
    // Pin form
    pinForm.addEventListener('submit', handlePinSubmit);
    document.getElementById('deletePinBtn').addEventListener('click', handlePinDelete);
    document.getElementById('visitPinBtn').addEventListener('click', handlePinVisit);

    // Modal backdrop click
    pinModal.addEventListener('click', (e) => {
        if (e.target === pinModal) {
            closePinModal();
        }
    });
}

// Authentication functions
async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(loginForm);
    const username = formData.get('username');

    showLoading(true);
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });

        const data = await response.json();
        if (response.ok) {
            currentUser = data.user;
            showToast('Zalogowano pomyślnie!', 'success');
            showApp();
        } else {
            showToast(data.error || 'Błąd logowania', 'error');
        }
    } catch (error) {
        console.error('Błąd logowania:', error);
        showToast('Błąd połączenia z serwerem', 'error');
    } finally {
        showLoading(false);
    }
}

async function handleLogout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        if (socket) {
            socket.disconnect();
        }
        showLogin();
        showToast('Wylogowano pomyślnie', 'info');
    } catch (error) {
        console.error('Błąd wylogowania:', error);
        showToast('Błąd wylogowania', 'error');
    }
}

// Screen management
function showLogin() {
    loginScreen.classList.remove('hidden');
    appScreen.classList.add('hidden');
    loginForm.reset();
}

function showApp() {
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    userInfo.textContent = `Witaj, ${currentUser.username}!`;
    initializeMap();
    initializeSocket();
    loadCategories();
    loadPins();
}

// Map functions
function initializeMap() {
    // Initialize Leaflet map with OpenStreetMap
    map = L.map('map').setView([52.2297, 21.0122], 6); // Warsaw, Poland as default

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    // Add click handler for creating pins
    map.on('click', handleMapClick);

    // Try to get user's location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                map.setView([lat, lng], 12);
                showToast('Lokalizacja została ustawiona', 'success');
            },
            () => {
                showToast('Nie można pobrać lokalizacji. Używam domyślnej lokalizacji.', 'info');
            }
        );
    }
}

function handleMapClick(e) {
    if (isCreatingPin) {
        openPinModal(e.latlng.lat, e.latlng.lng);
        isCreatingPin = false;
        document.body.classList.remove('creating-pin');
    }
}

// Socket.io functions
function initializeSocket() {
    socket = io();

    socket.on('connect', () => {
        console.log('Połączono z serwerem Socket.io');
        socket.emit('join_room', { room: 'pins_room' });
    });

    socket.on('disconnect', () => {
        console.log('Rozłączono z serwerem Socket.io');
    });

    // Real-time pin updates
    socket.on('pin_created', (pin) => {
        addPinToMap(pin);
        pins.push(pin);
        showToast(`Nowy pin \"${pin.name}\" został dodany`, 'info');
    });

    socket.on('pin_updated', (pin) => {
        updatePinOnMap(pin);
        const index = pins.findIndex(p => p.id === pin.id);
        if (index !== -1) {
            pins[index] = { ...pins[index], ...pin };
        }
        showToast(`Pin \"${pin.name}\" został zaktualizowany`, 'info');
    });

    socket.on('pin_deleted', (data) => {
        removePinFromMap(data.id);
        pins = pins.filter(p => p.id !== data.id);
        showToast('Pin został usunięty', 'info');
    });

    socket.on('pin_visited', (data) => {
        showToast(`Pin został odwiedzony przez ${data.visit.username}`, 'info');
    });
}

// Pin management functions
async function loadPins() {
    showLoading(true);
    try {
        const response = await fetch('/api/pins');
        if (response.ok) {
            pins = await response.json();
            displayPinsOnMap();
        } else {
            showToast('Błąd ładowania pinów', 'error');
        }
    } catch (error) {
        console.error('Błąd ładowania pinów:', error);
        showToast('Błąd połączenia z serwerem', 'error');
    } finally {
        showLoading(false);
    }
}

async function loadCategories() {
    try {
        const response = await fetch('/api/pins/categories/all');
        if (response.ok) {
            categories = await response.json();
            updateCategorySelect();
        }
    } catch (error) {
        console.error('Błąd ładowania kategorii:', error);
    }
}

function updateCategorySelect() {
    const categorySelect = document.getElementById('pinCategory');
    categorySelect.innerHTML = '';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = category.name;
        categorySelect.appendChild(option);
    });
}

function displayPinsOnMap() {
    clearMapMarkers();
    pins.forEach(pin => addPinToMap(pin));
}

function addPinToMap(pin) {
    const color = pin.color || pin.category_color || '#FF5733';
    
    // Create custom icon with pin color
    const pinIcon = L.divIcon({
        className: 'custom-pin',
        html: `<div class="pin-marker" style="background-color: ${color}"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    const marker = L.marker([pin.latitude, pin.longitude], { icon: pinIcon })
        .addTo(map)
        .bindPopup(`
            <div class="pin-popup">
                <h3>${pin.name}</h3>
                <p>${pin.description || 'Brak opisu'}</p>
                <p><small>Kategoria: ${pin.category || 'Domyślna'}</small></p>
                <button onclick="openPinModal(null, null, ${pin.id})" class="btn btn-sm btn-primary">Szczegóły</button>
            </div>
        `);

    markers.push({ id: pin.id, marker });
}

function updatePinOnMap(pin) {
    const markerData = markers.find(m => m.id === pin.id);
    if (markerData) {
        map.removeLayer(markerData.marker);
        markers = markers.filter(m => m.id !== pin.id);
        addPinToMap({ ...pin });
    }
}

function removePinFromMap(pinId) {
    const markerData = markers.find(m => m.id === pinId);
    if (markerData) {
        map.removeLayer(markerData.marker);
        markers = markers.filter(m => m.id !== pinId);
    }
}

function clearMapMarkers() {
    markers.forEach(markerData => {
        map.removeLayer(markerData.marker);
    });
    markers = [];
}

// Modal functions
function openPinModal(lat = null, lng = null, pinId = null) {
    const isEdit = pinId !== null;
    const pin = isEdit ? pins.find(p => p.id === pinId) : null;

    // Set modal title
    document.getElementById('modalTitle').textContent = isEdit ? 'Edytuj Pin' : 'Dodaj Nowy Pin';
    
    // Reset form
    pinForm.reset();
    document.getElementById('pinId').value = pinId || '';
    
    if (isEdit && pin) {
        // Fill form with pin data
        document.getElementById('pinName').value = pin.name;
        document.getElementById('pinDescription').value = pin.description || '';
        document.getElementById('pinCategory').value = pin.category || 'Domyślna';
        document.getElementById('pinLatitude').value = pin.latitude;
        document.getElementById('pinLongitude').value = pin.longitude;
        
        // Show edit-specific buttons
        document.getElementById('deletePinBtn').classList.remove('hidden');
        document.getElementById('visitPinBtn').classList.remove('hidden');
        
        // Load and show visit history
        loadVisitHistory(pinId);
    } else {
        // Set coordinates for new pin
        if (lat !== null && lng !== null) {
            document.getElementById('pinLatitude').value = lat.toFixed(6);
            document.getElementById('pinLongitude').value = lng.toFixed(6);
        }
        
        // Hide edit-specific buttons
        document.getElementById('deletePinBtn').classList.add('hidden');
        document.getElementById('visitPinBtn').classList.add('hidden');
        document.getElementById('visitHistory').classList.add('hidden');
    }
    
    pinModal.classList.remove('hidden');
    document.getElementById('pinName').focus();
}

function closePinModal() {
    pinModal.classList.add('hidden');
    pinForm.reset();
}

async function handlePinSubmit(e) {
    e.preventDefault();
    const formData = new FormData(pinForm);
    const pinId = formData.get('pinId');
    const isEdit = pinId !== '';

    const pinData = {
        name: formData.get('name'),
        description: formData.get('description'),
        latitude: parseFloat(formData.get('latitude')),
        longitude: parseFloat(formData.get('longitude')),
        category: formData.get('category')
    };

    showLoading(true);
    try {
        const url = isEdit ? `/api/pins/${pinId}` : '/api/pins';
        const method = isEdit ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pinData)
        });

        if (response.ok) {
            const result = await response.json();
            showToast(isEdit ? 'Pin został zaktualizowany' : 'Pin został utworzony', 'success');
            closePinModal();
        } else {
            const error = await response.json();
            showToast(error.error || 'Błąd zapisu pina', 'error');
        }
    } catch (error) {
        console.error('Błąd zapisu pina:', error);
        showToast('Błąd połączenia z serwerem', 'error');
    } finally {
        showLoading(false);
    }
}

async function handlePinDelete() {
    const pinId = document.getElementById('pinId').value;
    if (!pinId) return;

    if (!confirm('Czy na pewno chcesz usunąć ten pin?')) {
        return;
    }

    showLoading(true);
    try {
        const response = await fetch(`/api/pins/${pinId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Pin został usunięty', 'success');
            closePinModal();
        } else {
            const error = await response.json();
            showToast(error.error || 'Błąd usuwania pina', 'error');
        }
    } catch (error) {
        console.error('Błąd usuwania pina:', error);
        showToast('Błąd połączenia z serwerem', 'error');
    } finally {
        showLoading(false);
    }
}

async function handlePinVisit() {
    const pinId = document.getElementById('pinId').value;
    if (!pinId) return;

    showLoading(true);
    try {
        const response = await fetch(`/api/pins/${pinId}/visit`, {
            method: 'POST'
        });

        if (response.ok) {
            showToast('Wizyta została zarejestrowana', 'success');
            loadVisitHistory(pinId);
        } else {
            const error = await response.json();
            showToast(error.error || 'Błąd rejestracji wizyty', 'error');
        }
    } catch (error) {
        console.error('Błąd rejestracji wizyty:', error);
        showToast('Błąd połączenia z serwerem', 'error');
    } finally {
        showLoading(false);
    }
}

async function loadVisitHistory(pinId) {
    try {
        const response = await fetch(`/api/pins/${pinId}/history`);
        if (response.ok) {
            const history = await response.json();
            displayVisitHistory(history);
        }
    } catch (error) {
        console.error('Błąd ładowania historii wizyty:', error);
    }
}

function displayVisitHistory(history) {
    const historyContainer = document.getElementById('visitHistoryList');
    const historySection = document.getElementById('visitHistory');

    if (history.length === 0) {
        historyContainer.innerHTML = '<p class="no-visits">Brak odwiedzin</p>';
    } else {
        historyContainer.innerHTML = history.map(visit => `
            <div class="visit-item">
                <span class="visit-user">${visit.username}</span>
                <span class="visit-date">${new Date(visit.visited_at).toLocaleString('pl-PL')}</span>
            </div>
        `).join('');
    }
    
    historySection.classList.remove('hidden');
}

// Utility functions
function showLoading(show) {
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 4000);
}

// Add CSS for custom pin markers
const style = document.createElement('style');
style.textContent = `
    .custom-pin {
        border: none;
        background: transparent;
    }
    .pin-marker {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    .pin-popup .btn {
        padding: 4px 8px;
        font-size: 12px;
        margin-top: 5px;
    }
`;
document.head.appendChild(style);