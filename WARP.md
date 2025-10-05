# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

A mobile-first web application for managing interactive map pins with real-time collaboration features. Built for Polish users with CRUD operations, real-time updates via Socket.io, and visit history tracking. Supports up to 10 concurrent users with session-based authentication.

## Core Technologies

- **Frontend**: Vanilla JavaScript with Leaflet.js for interactive maps using OpenStreetMap tiles
- **Backend**: Node.js with Express.js and Socket.io for real-time communication
- **Database**: SQLite with synchronous operations and manual transaction handling
- **Maps**: Leaflet.js with OpenStreetMap provider
- **Session Management**: express-session with in-memory storage

## Development Commands

### Basic Operations
```bash
# Install dependencies
npm install

# Start production server
npm start

# Start development server with auto-reload
npm run dev
```

### Database Operations
- Database file is created automatically at `data/pins.db`
- No migration system - schema is managed in `backend/database.js`
- Database initializes automatically on first server start

## Application Architecture

### Backend Structure

**Server Entry Point** (`backend/server.js`):
- Express server with Socket.io integration
- Session-based authentication with UUID user IDs
- Static file serving from `frontend/` and `public/` directories
- CORS configuration for Socket.io
- Real-time room management for `pins_room`

**Database Layer** (`backend/database.js`):
- SQLite database with three tables: `pins`, `visit_history`, `categories`
- Singleton pattern database instance
- Promise-based API wrapping SQLite3 callbacks
- Automatic schema initialization with default categories

**API Routes** (`backend/routes/pins.js`):
- RESTful PIN CRUD operations at `/api/pins`
- Real-time Socket.io emissions for all data changes
- Visit history tracking at `/api/pins/:id/visit`
- Category management at `/api/pins/categories/all`

### Frontend Structure

**Main Application** (`frontend/script.js`):
- Single-page application with DOM-based state management
- Global variables for map, socket, user state, and data collections
- Event-driven architecture with extensive Socket.io listeners
- Modal-based pin editing with form validation

**Authentication Flow**:
- Session check on page load via `/api/me`
- Simple username-based login (MVP implementation)
- Session persistence across browser sessions (30 days)

**Map Integration**:
- Leaflet.js initialization with Warsaw, Poland as default center
- Geolocation API integration for user positioning
- Click-to-create pin functionality with modal interface
- Custom marker management with category-based coloring

### Real-time Features

**Socket.io Events**:
- `pin_created` - New pin added by any user
- `pin_updated` - Pin modified by any user  
- `pin_deleted` - Pin removed by any user
- `pin_visited` - Pin visit recorded by any user
- `join_room` - User joins collaborative session

All connected clients receive immediate updates when any user modifies pins or records visits.

## Key Implementation Details

### Database Schema
- **pins**: Core pin data with category association and color mapping
- **visit_history**: Tracks user visits to pins with timestamps
- **categories**: Predefined categories with associated colors (Domyślna, Ważne, Odwiedzone, etc.)

### Authentication System
- MVP session-based auth with no password requirement
- User identification via session UUID and display username
- All API endpoints (except auth) require `requireAuth` middleware

### Polish Language Interface
- All user-facing text and API responses are in Polish
- Error messages and success notifications in Polish
- Form labels and UI elements use Polish terminology

## Development Guidelines

### Adding New Pin Categories
- Modify the default categories in `backend/database.js` line 68-76
- Categories have both name and color properties
- Colors are used for map marker styling

### Modifying Real-time Features
- All data mutations must emit Socket.io events to maintain synchronization
- Events are emitted to the `pins_room` which all users join automatically
- Event payloads should include complete object data for easy client updates

### Frontend State Management
- Global arrays (`pins`, `categories`, `markers`) store application state
- DOM updates are manual and require synchronization with global state
- Modal forms use hidden fields for edit mode detection

### Database Operations
- All database methods return Promises wrapping SQLite3 callbacks
- Foreign key constraints are enforced between pins and visit_history
- Database connection is singleton and initialized on server start

## File Structure Context

```
├── backend/
│   ├── server.js          # Express server + Socket.io setup
│   ├── database.js        # SQLite database layer
│   └── routes/pins.js     # PIN CRUD API endpoints
├── frontend/
│   ├── index.html         # Single-page application UI
│   ├── script.js          # Client-side application logic
│   └── styles.css         # Mobile-first CSS styling
├── data/                  # Created automatically for SQLite database
└── package.json           # Node.js dependencies and scripts
```

## Common Development Patterns

When working with this codebase:
- Database changes require server restart (no hot reload for schema)
- Real-time features depend on Socket.io room membership
- Pin operations always include category color resolution
- Visit history is limited to 10 most recent entries per pin
- Map markers are managed as a separate array from pin data
- Authentication state is checked on every page load via `/api/me`