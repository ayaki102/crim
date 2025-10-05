# Map Pins App

Mobilna aplikacja webowa do zarządzania pinezkami na mapie z funkcjonalnością CRUD i real-time.

## Funkcjonalności

- 📍 Interaktywna mapa z kolorowymi pinezkami
- ✏️ Podstawowe operacje CRUD na pinach
- 👥 Obsługa do 10 jednoczesnych użytkowników
- ⏱️ Aktualizacje w czasie rzeczywistym
- 📱 Mobile-first design
- 🇵🇱 Interface w języku polskim
- 📋 Historia odwiedzin pinów
- 🔓 Prosty system logowania (MVP)

## Technologie

- **Frontend**: HTML, CSS, JavaScript, Leaflet.js
- **Backend**: Node.js, Express.js, Socket.io
- **Database**: SQLite
- **Maps**: OpenStreetMap

## Uruchomienie

1. Zainstaluj zależności:
```bash
npm install
```

2. Uruchom serwer:
```bash
npm start
```

3. Otwórz http://localhost:3000

## Struktura projektu

- `backend/` - Serwer Node.js/Express
- `frontend/` - Pliki frontend
- `public/` - Statyczne pliki
- `static/` - Zasoby statyczne