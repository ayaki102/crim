const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

// Use PostgreSQL only when explicitly configured with PostgreSQL-specific env vars
// or when DATABASE_URL contains 'postgres' or 'postgresql'
const usePostgres = process.env.POSTGRES_URL || 
                    process.env.POSTGRESS_POSTGRES_URL || 
                    process.env.POSTGRESS_SUPABASE_URL || 
                    (process.env.DATABASE_URL && 
                     (process.env.DATABASE_URL.includes('postgres') || process.env.DATABASE_URL.includes('postgresql')));

const database = usePostgres ? require('./database-postgres') : require('./database');

console.log('Database selection:', {
  usePostgres: !!usePostgres,
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL_set: !!process.env.DATABASE_URL,
  POSTGRES_URL_set: !!process.env.POSTGRES_URL
});
const pinsRoutes = require('./routes/pins');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.static(path.join(__dirname, '..', 'frontend')));


// API routes
app.use('/api/pins', pinsRoutes(io));

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Użytkownik połączony:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Użytkownik rozłączony:', socket.id);
  });
  
  socket.on('join_room', (data) => {
    socket.join('pins_room');
    console.log(`Socket ${socket.id} dołączył do pokoju pins_room`);
  });
});

// Graceful shutdown handling
let isShuttingDown = false;

const gracefulShutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`${signal} received, shutting down gracefully`);
  
  server.close(() => {
    console.log('HTTP server closed');
    database.close().then(() => {
      console.log('Database connection closed');
      process.exit(0);
    }).catch(err => {
      console.error('Error closing database:', err);
      process.exit(1);
    });
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.log('Forced exit after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Initialize database and start server
database.initialize().then(() => {
  server.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
    console.log(`Otwórz http://localhost:${PORT} w przeglądarce`);
    console.log(`Database type: ${usePostgres ? 'PostgreSQL' : 'SQLite'}`);
  });
}).catch(err => {
  console.error('Błąd inicjalizacji bazy danych:', err);
  console.error('Stack trace:', err.stack);
  
  // If PostgreSQL fails, try falling back to SQLite for development
  if (usePostgres && !process.env.NODE_ENV) {
    console.log('Próba przełączenia na SQLite...');
    const sqliteDatabase = require('./database');
    sqliteDatabase.initialize().then(() => {
      server.listen(PORT, () => {
        console.log(`Serwer działa na porcie ${PORT} (SQLite fallback)`);
        console.log(`Otwórz http://localhost:${PORT} w przeglądarce`);
      });
    }).catch(fallbackErr => {
      console.error('Błąd inicjalizacji SQLite fallback:', fallbackErr);
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});
