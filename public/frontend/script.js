// Global variables
let map;
let socket;
let pins = [];
let categories = [];
let markers = [];

// DOM elements
const appScreen = document.getElementById('appScreen');
const pinModal = document.getElementById('pinModal');
const pinForm = document.getElementById('pinForm');
const categoryModal = document.getElementById('categoryModal');
const categoryForm = document.getElementById('categoryForm');
const loading = document.getElementById('loading');
const toastContainer = document.getElementById('toastContainer');

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    loadSavedUsername();
    setupEventListeners();
    initializeMap();
    initializeSocket();
    loadCategories();
    loadPins();
});

function getCurrentUsername() {
    const usernameInput = document.getElementById('currentUsername');
    const username = usernameInput.value.trim();
    
    // Save to localStorage for persistence
    if (username) {
        localStorage.setItem('mapPins_username', username);
    }
    
    return username || 'Anonimowy';
}

function loadSavedUsername() {
    const saved = localStorage.getItem('mapPins_username');
    if (saved) {
        document.getElementById('currentUsername').value = saved;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Pin modal
    document.getElementById('closeModal').addEventListener('click', closePinModal);
    
    // Category management
    document.getElementById('manageCategoriesBtn').addEventListener('click', openCategoryModal);
    document.getElementById('closeCategoryModal').addEventListener('click', closeCategoryModal);
    categoryForm.addEventListener('submit', handleCategorySubmit);
    document.getElementById('cancelCategoryBtn').addEventListener('click', resetCategoryForm);
    
    // Category selection with color preview
    document.getElementById('pinCategory').addEventListener('change', updateCategoryColorPreview);
    
    // Username input auto-save and validation
    const usernameField = document.getElementById('currentUsername');
    const usernameIndicator = document.getElementById('usernameIndicator');
    
    function updateUsernameIndicator() {
        const username = usernameField.value.trim();
        if (username && username !== 'Anonimowy') {
            usernameIndicator.style.display = 'inline';
            usernameIndicator.style.color = '#28a745';
            usernameField.style.borderColor = '#28a745';
        } else {
            usernameIndicator.style.display = 'none';
            usernameField.style.borderColor = '#ccc';
        }
    }
    
    usernameField.addEventListener('input', function(e) {
        const username = e.target.value.trim();
        if (username) {
            localStorage.setItem('mapPins_username', username);
        }
        updateUsernameIndicator();
    });
    
    // Initial indicator update
    updateUsernameIndicator();
    
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
    // Direct pin creation on any empty area click
    openPinModal(e.latlng.lat, e.latlng.lng);
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
        showToast(`Pin zostal odwiedzony przez ${data.visit.username}`, 'info');
    });
    
    // Real-time category updates
    socket.on('category_created', (category) => {
        categories.push(category);
        updateCategorySelect();
        updateCategoriesList();
        showToast(`Nowa kategoria \"${category.name}\" została dodana`, 'info');
    });
    
    socket.on('category_updated', (category) => {
        const index = categories.findIndex(c => c.id === category.id);
        if (index !== -1) {
            categories[index] = { ...categories[index], ...category };
        }
        updateCategorySelect();
        updateCategoriesList();
        // Update pins on map with new category colors
        displayPinsOnMap();
        showToast(`Kategoria \"${category.name}\" została zaktualizowana`, 'info');
    });
    
    socket.on('category_deleted', (data) => {
        categories = categories.filter(c => c.id !== data.id);
        updateCategorySelect();
        updateCategoriesList();
        showToast('Kategoria została usunięta', 'info');
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
    const currentValue = categorySelect.value;
    categorySelect.innerHTML = '';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = category.name;
        option.dataset.color = category.color;
        categorySelect.appendChild(option);
    });
    
    // Restore previous selection if it still exists
    if (currentValue && categories.some(c => c.name === currentValue)) {
        categorySelect.value = currentValue;
    }
    
    updateCategoryColorPreview();
}

function updateCategoryColorPreview() {
    const categorySelect = document.getElementById('pinCategory');
    const colorPreview = document.getElementById('categoryColorPreview');
    const selectedOption = categorySelect.options[categorySelect.selectedIndex];
    
    if (selectedOption && selectedOption.dataset.color) {
        colorPreview.style.backgroundColor = selectedOption.dataset.color;
        colorPreview.style.display = 'block';
    } else {
        colorPreview.style.display = 'none';
    }
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
        .on('click', function(e) {
            // Stop event from bubbling to map click
            L.DomEvent.stopPropagation(e);
            // Open pin for editing directly
            openPinModal(null, null, pin.id);
        })
        .bindPopup(`
            <div class="pin-popup">
                <h3>${pin.name}</h3>
                <p>${pin.description || 'Brak opisu'}</p>
                <p><small>Kategoria: ${pin.category || 'Domyślna'}</small></p>
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
        document.getElementById('visitSection').classList.remove('hidden');
        
        // Pre-fill visit username with current user
        document.getElementById('visitUsername').value = getCurrentUsername();
        
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
        document.getElementById('visitSection').classList.add('hidden');
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
    const currentUsername = getCurrentUsername();
    
    if (!currentUsername || currentUsername === 'Anonimowy') {
        showToast('Proszę wprowadzić swoją nazwę w polu "Kim jesteś" w górnej części ekranu', 'error');
        // Highlight the username field
        const usernameField = document.getElementById('currentUsername');
        usernameField.style.border = '2px solid #ff4444';
        usernameField.focus();
        setTimeout(() => {
            usernameField.style.border = '';
        }, 3000);
        return;
    }

    const pinData = {
        name: formData.get('name'),
        description: formData.get('description'),
        latitude: parseFloat(formData.get('latitude')),
        longitude: parseFloat(formData.get('longitude')),
        category: formData.get('category')
    };
    
    if (isEdit) {
        pinData.updated_by = currentUsername;
    } else {
        pinData.created_by = currentUsername;
    }

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
    const visitUsername = document.getElementById('visitUsername').value.trim();
    const visitComment = document.getElementById('visitComment').value.trim();
    
    if (!pinId) return;
    
    if (!visitUsername) {
        showToast('Proszę wprowadzić nazwę osoby odwiedzającej', 'error');
        return;
    }

    showLoading(true);
    try {
        const response = await fetch(`/api/pins/${pinId}/visit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: visitUsername, 
                comment: visitComment || null 
            })
        });

        if (response.ok) {
            showToast('Wizyta została zarejestrowana', 'success');
            loadVisitHistory(pinId);
            // Clear the visit fields
            document.getElementById('visitUsername').value = getCurrentUsername();
            document.getElementById('visitComment').value = '';
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
        historyContainer.innerHTML = history.map(visit => {
            const visitDate = new Date(visit.visited_at);
            const formattedDate = `${visitDate.getDate().toString().padStart(2, '0')}-${(visitDate.getMonth() + 1).toString().padStart(2, '0')}-${visitDate.getFullYear()} ${visitDate.getHours().toString().padStart(2, '0')}:${visitDate.getMinutes().toString().padStart(2, '0')}`;
            
            return `
                <div class="visit-item">
                    <div class="visit-header">
                        <span class="visit-user">${visit.username}</span>
                        <span class="visit-date">${formattedDate}</span>
                    </div>
                    ${visit.comment ? `<div class="visit-comment">${visit.comment}</div>` : ''}
                </div>
            `;
        }).join('');
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

// Category Management Functions
function openCategoryModal() {
    categoryModal.classList.remove('hidden');
    resetCategoryForm();
    loadCategoriesForManagement();
}

function closeCategoryModal() {
    categoryModal.classList.add('hidden');
    resetCategoryForm();
}

function resetCategoryForm() {
    categoryForm.reset();
    document.getElementById('categoryId').value = '';
    document.getElementById('saveCategoryBtn').textContent = 'Zapisz';
    document.querySelector('.category-form-section h3').textContent = 'Dodaj Nową Kategorię';
}

function loadCategoriesForManagement() {
    updateCategoriesList();
}

function updateCategoriesList() {
    const categoriesList = document.getElementById('categoriesList');
    
    if (categories.length === 0) {
        categoriesList.innerHTML = '<p class="no-categories">Brak kategorii</p>';
        return;
    }
    
    categoriesList.innerHTML = categories.map(category => `
        <div class="category-item" data-id="${category.id}">
            <div class="category-info">
                <div class="category-color-dot" style="background-color: ${category.color}"></div>
                <span class="category-name">${category.name}</span>
            </div>
            <div class="category-actions">
                <button class="btn btn-sm btn-primary" onclick="editCategory(${category.id})">Edytuj</button>
                <button class="btn btn-sm btn-danger" onclick="deleteCategory(${category.id})">Usuń</button>
            </div>
        </div>
    `).join('');
}

function editCategory(categoryId) {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;
    
    document.getElementById('categoryId').value = category.id;
    document.getElementById('categoryName').value = category.name;
    document.getElementById('categoryColor').value = category.color;
    document.getElementById('saveCategoryBtn').textContent = 'Zaktualizuj';
    document.querySelector('.category-form-section h3').textContent = 'Edytuj Kategorię';
}

async function handleCategorySubmit(e) {
    e.preventDefault();
    const formData = new FormData(categoryForm);
    const categoryId = formData.get('categoryId');
    const isEdit = categoryId !== '';
    
    const categoryData = {
        name: formData.get('name'),
        color: formData.get('color')
    };
    
    showLoading(true);
    try {
        const url = isEdit ? `/api/pins/categories/${categoryId}` : '/api/pins/categories';
        const method = isEdit ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(categoryData)
        });
        
        if (response.ok) {
            const result = await response.json();
            showToast(isEdit ? 'Kategoria została zaktualizowana' : 'Kategoria została utworzona', 'success');
            resetCategoryForm();
        } else {
            const error = await response.json();
            showToast(error.error || 'Błąd zapisu kategorii', 'error');
        }
    } catch (error) {
        console.error('Błąd zapisu kategorii:', error);
        showToast('Błąd połączenia z serwerem', 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteCategory(categoryId) {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;
    
    if (!confirm(`Czy na pewno chcesz usunąć kategorię \"${category.name}\"?`)) {
        return;
    }
    
    showLoading(true);
    try {
        const response = await fetch(`/api/pins/categories/${categoryId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('Kategoria została usunięta', 'success');
        } else {
            const error = await response.json();
            showToast(error.error || 'Błąd usuwania kategorii', 'error');
        }
    } catch (error) {
        console.error('Błąd usuwania kategorii:', error);
        showToast('Błąd połączenia z serwerem', 'error');
    } finally {
        showLoading(false);
    }
}

// Add CSS for custom pin markers and category management
const style = document.createElement('style');
style.textContent = `
    .custom-pin {
        border: none;
        background: transparent;
    }
    .pin-marker {
        width: 20px;
        height: 20px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        cursor: pointer;
    }
    .pin-popup {
        text-align: center;
    }
    .pin-popup h3 {
        margin: 0 0 8px 0;
        font-size: 16px;
    }
    .pin-popup p {
        margin: 4px 0;
        font-size: 14px;
    }
    .pin-popup .btn {
        margin-top: 8px;
        padding: 4px 12px;
        font-size: 12px;
    }
    .category-input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .category-color-preview {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid #ccc;
        display: none;
    }
    .category-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        border: 1px solid #ddd;
        border-radius: 8px;
        margin-bottom: 8px;
    }
    .category-info {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .category-color-dot {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 1px solid #ccc;
    }
    .category-name {
        font-weight: 500;
    }
    .category-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
    }
    .category-actions .btn {
        flex-shrink: 0;
        white-space: nowrap;
    }
    .categories-list-section {
        margin-top: 24px;
    }
    .no-categories {
        text-align: center;
        color: #666;
        font-style: italic;
        padding: 20px;
    }
    .visit-item {
        display: flex;
        justify-content: space-between;
        padding: 8px 12px;
        border-bottom: 1px solid #eee;
    }
    .visit-item:last-child {
        border-bottom: none;
    }
    .visit-user {
        font-weight: 500;
    }
    .visit-date {
        color: #666;
        font-size: 0.9em;
    }
    .username-input {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-right: 20px;
    }
    .username-input label {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.9);
        white-space: nowrap;
        font-weight: 600;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
    .username-field {
        padding: 8px 16px;
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        font-size: 14px;
        min-width: 140px;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        color: white;
        transition: all 0.3s ease;
    }
    .username-field::placeholder {
        color: rgba(255, 255, 255, 0.6);
    }
    .username-field:focus {
        outline: none;
        border-color: rgba(255, 255, 255, 0.5);
        background: rgba(255, 255, 255, 0.15);
        box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.1);
    }
    .visit-section {
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
    }
    .visit-section .input-group {
        margin-bottom: 16px;
    }
    .header-controls {
        display: flex;
        align-items: center;
    }
    .required {
        color: #ff6b6b;
        font-weight: bold;
    }
    .username-indicator {
        color: #51cf66;
        font-weight: bold;
        font-size: 18px;
        margin-left: 8px;
        display: none;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
    .username-field:valid:not(:placeholder-shown) {
        border-color: rgba(81, 207, 102, 0.8);
        background: rgba(81, 207, 102, 0.1);
    }
    
    /* Dark mode for dynamic styles */
    @media (prefers-color-scheme: dark) {
        .username-input label {
            color: rgba(247, 250, 252, 0.9);
        }
        .username-field {
            background: rgba(26, 32, 44, 0.8);
            border-color: rgba(255, 255, 255, 0.2);
            color: #f7fafc;
        }
        .username-field::placeholder {
            color: rgba(160, 174, 192, 0.8);
        }
        .username-field:focus {
            background: rgba(26, 32, 44, 0.95);
            border-color: rgba(144, 205, 244, 0.6);
            box-shadow: 0 0 0 4px rgba(144, 205, 244, 0.1);
        }
        .username-field:valid:not(:placeholder-shown) {
            border-color: rgba(81, 207, 102, 0.8);
            background: rgba(81, 207, 102, 0.15);
        }
        .visit-item {
            background: rgba(45, 55, 72, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .visit-header .visit-user {
            color: #90cdf4;
        }
        .visit-header .visit-date {
            color: #a0aec0;
        }
        .visit-comment {
            background: rgba(102, 126, 234, 0.1);
            color: #e2e8f0;
            border-left-color: #90cdf4;
        }
        .category-item {
            background: rgba(45, 55, 72, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .category-name {
            color: #f7fafc;
        }
        .no-categories {
            color: #a0aec0;
        }
    }
`;
document.head.appendChild(style);
