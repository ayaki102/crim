const express = require('express');
const database = require('../database');

module.exports = (io) => {
  const router = express.Router();

  // GET /api/pins - Get all pins
  router.get('/', async (req, res) => {
    try {
      const pins = await database.getAllPins();
      res.json(pins);
    } catch (error) {
      console.error('Błąd przy pobieraniu pinów:', error);
      res.status(500).json({ error: 'Błąd serwera przy pobieraniu pinów' });
    }
  });

  // GET /api/pins/:id - Get single pin with visit history
  router.get('/:id', async (req, res) => {
    try {
      const pin = await database.getPinById(req.params.id);
      if (!pin) {
        return res.status(404).json({ error: 'Pin nie został znaleziony' });
      }
      
      const visitHistory = await database.getVisitHistory(req.params.id);
      res.json({ ...pin, visitHistory });
    } catch (error) {
      console.error('Błąd przy pobieraniu pina:', error);
      res.status(500).json({ error: 'Błąd serwera przy pobieraniu pina' });
    }
  });

  // POST /api/pins - Create new pin
  router.post('/', async (req, res) => {
    try {
      const { name, description, latitude, longitude, category } = req.body;

      if (!name || !latitude || !longitude) {
        return res.status(400).json({ 
          error: 'Nazwa, szerokość i długość geograficzna są wymagane' 
        });
      }

      const newPin = await database.createPin({
        name: name.trim(),
        description: description ? description.trim() : '',
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        category: category || 'Domyślna'
      });

      // Emit real-time update to all connected clients
      io.to('pins_room').emit('pin_created', newPin);

      res.status(201).json(newPin);
    } catch (error) {
      console.error('Błąd przy tworzeniu pina:', error);
      res.status(500).json({ error: 'Błąd serwera przy tworzeniu pina' });
    }
  });

  // PUT /api/pins/:id - Update existing pin
  router.put('/:id', async (req, res) => {
    try {
      const { name, description, latitude, longitude, category } = req.body;
      const pinId = req.params.id;

      if (!name || !latitude || !longitude) {
        return res.status(400).json({ 
          error: 'Nazwa, szerokość i długość geograficzna są wymagane' 
        });
      }

      const existingPin = await database.getPinById(pinId);
      if (!existingPin) {
        return res.status(404).json({ error: 'Pin nie został znaleziony' });
      }

      const updatedPin = await database.updatePin(pinId, {
        name: name.trim(),
        description: description ? description.trim() : '',
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        category: category
      });

      // Emit real-time update to all connected clients
      io.to('pins_room').emit('pin_updated', updatedPin);

      res.json(updatedPin);
    } catch (error) {
      console.error('Błąd przy aktualizacji pina:', error);
      res.status(500).json({ error: 'Błąd serwera przy aktualizacji pina' });
    }
  });

  // DELETE /api/pins/:id - Delete pin
  router.delete('/:id', async (req, res) => {
    try {
      const pinId = req.params.id;
      
      const existingPin = await database.getPinById(pinId);
      if (!existingPin) {
        return res.status(404).json({ error: 'Pin nie został znaleziony' });
      }

      const result = await database.deletePin(pinId);
      
      if (result.deleted) {
        // Emit real-time update to all connected clients
        io.to('pins_room').emit('pin_deleted', { id: parseInt(pinId) });
        res.json({ message: 'Pin został usunięty pomyślnie', id: parseInt(pinId) });
      } else {
        res.status(404).json({ error: 'Pin nie został znaleziony' });
      }
    } catch (error) {
      console.error('Błąd przy usuwaniu pina:', error);
      res.status(500).json({ error: 'Błąd serwera przy usuwaniu pina' });
    }
  });

  // POST /api/pins/:id/visit - Record a visit to a pin
  router.post('/:id/visit', async (req, res) => {
    try {
      const pinId = req.params.id;
      const userId = req.session.userId;
      const username = req.session.username;

      const existingPin = await database.getPinById(pinId);
      if (!existingPin) {
        return res.status(404).json({ error: 'Pin nie został znaleziony' });
      }

      const visit = await database.addVisit(pinId, userId, username);
      
      // Emit real-time update to all connected clients
      io.to('pins_room').emit('pin_visited', {
        pinId: parseInt(pinId),
        visit: visit
      });

      res.json({ 
        message: 'Wizyta została zarejestrowana', 
        visit: visit 
      });
    } catch (error) {
      console.error('Błąd przy rejestracji wizyty:', error);
      res.status(500).json({ error: 'Błąd serwera przy rejestracji wizyty' });
    }
  });

  // GET /api/pins/:id/history - Get visit history for a pin
  router.get('/:id/history', async (req, res) => {
    try {
      const pinId = req.params.id;
      
      const existingPin = await database.getPinById(pinId);
      if (!existingPin) {
        return res.status(404).json({ error: 'Pin nie został znaleziony' });
      }

      const history = await database.getVisitHistory(pinId);
      res.json(history);
    } catch (error) {
      console.error('Błąd przy pobieraniu historii wizyty:', error);
      res.status(500).json({ error: 'Błąd serwera przy pobieraniu historii' });
    }
  });

  // GET /api/categories - Get all categories
  router.get('/categories/all', async (req, res) => {
    try {
      const categories = await database.getAllCategories();
      res.json(categories);
    } catch (error) {
      console.error('Błąd przy pobieraniu kategorii:', error);
      res.status(500).json({ error: 'Błąd serwera przy pobieraniu kategorii' });
    }
  });

  return router;
};