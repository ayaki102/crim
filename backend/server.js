const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

// Use PostgreSQL in production (Vercel) or SQLite for local development
const database = process.env.NODE_ENV === 'production' || 
                process.env.POSTGRES_URL || 
                process.env.POSTGRESS_POSTGRES_URL || 
                process.env.POSTGRESS_SUPABASE_URL || 
                process.env.DATABASE_URL 
  ? require('./database-postgres') 
  : require('./database');
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

// Initialize database and start server
database.initialize().then(() => {
  server.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
    console.log(`Otwórz http://localhost:${PORT} w przeglądarce`);
  });
}).catch(err => {
  console.error('Błąd inicjalizacji bazy danych:', err);
});