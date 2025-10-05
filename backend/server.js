const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const database = require('./database');
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

// Session configuration
app.use(session({
  secret: 'map-pins-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));

// Simple auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Wymagane logowanie' });
  }
  next();
};

// Auth routes
app.post('/api/login', (req, res) => {
  const { username } = req.body;
  if (!username || username.trim().length === 0) {
    return res.status(400).json({ error: 'Nazwa użytkownika jest wymagana' });
  }
  
  req.session.userId = uuidv4();
  req.session.username = username.trim();
  
  res.json({ 
    success: true, 
    user: { 
      id: req.session.userId, 
      username: req.session.username 
    } 
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  if (req.session.userId) {
    res.json({ 
      user: { 
        id: req.session.userId, 
        username: req.session.username 
      } 
    });
  } else {
    res.status(401).json({ error: 'Niezalogowany' });
  }
});

// API routes
app.use('/api/pins', requireAuth, pinsRoutes(io));

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