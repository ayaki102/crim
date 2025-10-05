# Map Pins App - Self-Hosted

A simple web application for managing pins on a map with real-time updates.

## Features

- Interactive map with pin management
- Real-time updates using Socket.io
- SQLite database (default) or PostgreSQL
- CRUD operations for pins with categories
- Visit history tracking
- Mobile-friendly interface

## Self-Hosting Options

### Option 1: Docker (Recommended)

1. **Build and run with Docker Compose:**
   ```bash
   docker-compose up -d
   ```
   The app will be available at `http://localhost:3000`

2. **To use PostgreSQL instead of SQLite:**
   - Uncomment the PostgreSQL service and volumes in `docker-compose.yml`
   - Uncomment the `POSTGRES_URL` environment variable in the app service
   - Restart: `docker-compose down && docker-compose up -d`

### Option 2: Direct Node.js

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the application:**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

3. **For PostgreSQL (optional):**
   ```bash
   export POSTGRES_URL="postgresql://username:password@localhost:5432/database"
   npm start
   ```

## Configuration

The app uses environment variables for configuration:

- `PORT` - Server port (default: 3000)
- `POSTGRES_URL` - PostgreSQL connection string (optional, uses SQLite if not set)
- `NODE_ENV` - Environment (development/production)

## Database

- **SQLite (default)**: Database file stored in `./data/pins.db`
- **PostgreSQL**: Set `POSTGRES_URL` environment variable

## File Structure

```
├── backend/
│   ├── server.js           # Main server file
│   ├── database.js         # SQLite database module
│   ├── database-postgres.js # PostgreSQL database module
│   └── routes/
│       └── pins.js         # API routes
├── frontend/               # Frontend files
├── data/                   # SQLite database storage
├── docker-compose.yml      # Docker deployment
└── Dockerfile             # Docker image
```

## API Endpoints

- `GET /api/pins` - Get all pins
- `POST /api/pins` - Create new pin
- `PUT /api/pins/:id` - Update pin
- `DELETE /api/pins/:id` - Delete pin
- `GET /api/pins/:id/history` - Get visit history
- `POST /api/pins/:id/visit` - Add visit record

## Development

1. Install development dependencies: `npm install`
2. Run in development mode: `npm run dev`
3. The server will automatically restart on file changes

## Port Management

If port 3000 is busy, you can:
- Change the port: `PORT=8080 npm start`
- Or kill existing processes: `lsof -ti:3000 | xargs kill`

## Internet Exposure

To make your app accessible from anywhere on the internet:

### Quick Setup (Recommended)

1. **Transfer to Pi**: `./transfer-to-pi.sh YOUR_PI_IP`
2. **Deploy**: `ssh pi@YOUR_PI_IP 'cd ~/map-pins-app && ./deploy-rpi.sh'`
3. **Expose to Internet**: `ssh pi@YOUR_PI_IP 'cd ~/map-pins-app && ./setup-internet.sh'`

### Internet Exposure Options

- **Ngrok**: Easiest, works in 5 minutes, free tier available
- **Cloudflare Tunnel**: Best for permanent use, free, secure, HTTPS
- **Port Forwarding**: Traditional method, requires router access
- **VPS Proxy**: Professional setup, costs ~$5/month

📖 **See detailed guides**:
- `INTERNET_EXPOSURE.md` - Complete internet exposure guide
- `RASPBERRY_PI.md` - Raspberry Pi deployment guide

## License

MIT

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