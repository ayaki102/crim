const express = require('express');
// Use PostgreSQL in production or SQLite for local development
const database = process.env.NODE_ENV === 'production' || 
                process.env.DATABASE_URL || 
                process.env.POSTGRES_URL || 
                process.env.POSTGRESS_POSTGRES_URL || 
                process.env.POSTGRESS_SUPABASE_URL 
  ? require('../database-postgres') 
  : require('../database');

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
      const { name, description, latitude, longitude, category, created_by } = req.body;

      if (!name || !latitude || !longitude || !created_by) {
        return res.status(400).json({ 
          error: 'Nazwa, szerokość, długość geograficzna i nazwa twórcy są wymagane' 
        });
      }

      const newPin = await database.createPin({
        name: name.trim(),
        description: description ? description.trim() : '',
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        category: category || 'Domyślna',
        created_by: created_by.trim()
      });

      // Emit real-time update to all connected clients (if available)
      if (io) {
        io.to('pins_room').emit('pin_created', newPin);
      }

      res.status(201).json(newPin);
    } catch (error) {
      console.error('Błąd przy tworzeniu pina:', error);
      res.status(500).json({ error: 'Błąd serwera przy tworzeniu pina' });
    }
  });

  // PUT /api/pins/:id - Update existing pin
  router.put('/:id', async (req, res) => {
    try {
      const { name, description, latitude, longitude, category, updated_by } = req.body;
      const pinId = req.params.id;

      if (!name || !latitude || !longitude || !updated_by) {
        return res.status(400).json({ 
          error: 'Nazwa, szerokość, długość geograficzna i nazwa edytora są wymagane' 
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
        category: category,
        updated_by: updated_by.trim()
      });

      // Emit real-time update to all connected clients (if available)
      if (io) {
        io.to('pins_room').emit('pin_updated', updatedPin);
      }

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
        // Emit real-time update to all connected clients (if available)
        if (io) {
          io.to('pins_room').emit('pin_deleted', { id: parseInt(pinId) });
        }
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
      const { username, comment } = req.body;

      if (!username) {
        return res.status(400).json({ error: 'Nazwa użytkownika jest wymagana' });
      }

      const existingPin = await database.getPinById(pinId);
      if (!existingPin) {
        return res.status(404).json({ error: 'Pin nie został znaleziony' });
      }

      const visit = await database.addVisit(pinId, username.trim(), comment ? comment.trim() : null);
      
      // Emit real-time update to all connected clients (if available)
      if (io) {
        io.to('pins_room').emit('pin_visited', {
          pinId: parseInt(pinId),
          visit: visit
        });
      }

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

  // GET /api/pins/categories/all - Get all categories
  router.get('/categories/all', async (req, res) => {
    try {
      const categories = await database.getAllCategories();
      res.json(categories);
    } catch (error) {
      console.error('Błąd przy pobieraniu kategorii:', error);
      res.status(500).json({ error: 'Błąd serwera przy pobieraniu kategorii' });
    }
  });

  // POST /api/pins/categories - Create new category
  router.post('/categories', async (req, res) => {
    try {
      const { name, color } = req.body;

      if (!name || !color) {
        return res.status(400).json({ 
          error: 'Nazwa i kolor kategorii są wymagane' 
        });
      }

      const newCategory = await database.createCategory(name.trim(), color);

      // Emit real-time update to all connected clients (if available)
      if (io) {
        io.to('pins_room').emit('category_created', newCategory);
      }

      res.status(201).json(newCategory);
    } catch (error) {
      console.error('Błąd przy tworzeniu kategorii:', error);
      if (error.message.includes('UNIQUE constraint failed')) {
        res.status(409).json({ error: 'Kategoria o tej nazwie już istnieje' });
      } else {
        res.status(500).json({ error: 'Błąd serwera przy tworzeniu kategorii' });
      }
    }
  });

  // PUT /api/pins/categories/:id - Update existing category
  router.put('/categories/:id', async (req, res) => {
    try {
      const { name, color } = req.body;
      const categoryId = req.params.id;

      if (!name || !color) {
        return res.status(400).json({ 
          error: 'Nazwa i kolor kategorii są wymagane' 
        });
      }

      const existingCategory = await database.getCategoryById(categoryId);
      if (!existingCategory) {
        return res.status(404).json({ error: 'Kategoria nie została znaleziona' });
      }

      const updatedCategory = await database.updateCategory(categoryId, name.trim(), color);

      // Emit real-time update to all connected clients (if available)
      if (io) {
        io.to('pins_room').emit('category_updated', updatedCategory);
      }

      res.json(updatedCategory);
    } catch (error) {
      console.error('Błąd przy aktualizacji kategorii:', error);
      if (error.message.includes('UNIQUE constraint failed')) {
        res.status(409).json({ error: 'Kategoria o tej nazwie już istnieje' });
      } else {
        res.status(500).json({ error: 'Błąd serwera przy aktualizacji kategorii' });
      }
    }
  });

  // DELETE /api/pins/categories/:id - Delete category
  router.delete('/categories/:id', async (req, res) => {
    try {
      const categoryId = req.params.id;
      
      const existingCategory = await database.getCategoryById(categoryId);
      if (!existingCategory) {
        return res.status(404).json({ error: 'Kategoria nie została znaleziona' });
      }

      const result = await database.deleteCategory(categoryId);
      
      if (result.deleted) {
        // Emit real-time update to all connected clients (if available)
        if (io) {
          io.to('pins_room').emit('category_deleted', { id: parseInt(categoryId) });
        }
        res.json({ message: 'Kategoria została usunięta pomyślnie', id: parseInt(categoryId) });
      } else {
        res.status(404).json({ error: 'Kategoria nie została znaleziona' });
      }
    } catch (error) {
      console.error('Błąd przy usuwaniu kategorii:', error);
      res.status(400).json({ error: error.message || 'Błąd serwera przy usuwaniu kategorii' });
    }
  });

  return router;
};