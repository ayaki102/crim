const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'pins.db');

class Database {
  constructor() {
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      // Create data directory if it doesn't exist
      const fs = require('fs');
      const dataDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          reject(err);
          return;
        }
        console.log('Połączono z bazą danych SQLite');
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      const createPinsTable = `
        CREATE TABLE IF NOT EXISTS pins (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          category TEXT DEFAULT 'default',
          color TEXT DEFAULT '#FF5733',
          created_by TEXT NOT NULL,
          updated_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const createVisitHistoryTable = `
        CREATE TABLE IF NOT EXISTS visit_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pin_id INTEGER NOT NULL,
          username TEXT NOT NULL,
          comment TEXT,
          visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (pin_id) REFERENCES pins (id) ON DELETE CASCADE
        )
      `;

      const createCategoriesTable = `
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          color TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Insert default categories
      const insertDefaultCategories = `
        INSERT OR IGNORE INTO categories (name, color) VALUES 
        ('Domyślna', '#FF5733'),
        ('Ważne', '#FF0000'),
        ('Odwiedzone', '#00FF00'),
        ('Do sprawdzenia', '#FFFF00'),
        ('Ukończone', '#0000FF'),
        ('Problemowe', '#FF8C00')
      `;

      this.db.serialize(() => {
        this.db.run(createPinsTable, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        this.db.run(createVisitHistoryTable, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        this.db.run(createCategoriesTable, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        this.db.run(insertDefaultCategories, (err) => {
          if (err) {
            reject(err);
            return;
          }
          console.log('Tabele bazy danych utworzone pomyślnie');
          resolve();
        });
      });
    });
  }

  // Pins CRUD operations
  getAllPins() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT p.*, c.name as category_name, c.color as category_color 
        FROM pins p 
        LEFT JOIN categories c ON p.category = c.name 
        ORDER BY p.created_at DESC
      `;
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  getPinById(id) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT p.*, c.name as category_name, c.color as category_color 
        FROM pins p 
        LEFT JOIN categories c ON p.category = c.name 
        WHERE p.id = ?
      `;
      this.db.get(sql, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  createPin(pinData) {
    return new Promise((resolve, reject) => {
      const { name, description, latitude, longitude, category = 'Domyślna', created_by } = pinData;
      
      if (!created_by) {
        reject(new Error('created_by is required'));
        return;
      }
      
      // Get category color
      this.db.get('SELECT color FROM categories WHERE name = ?', [category], (err, categoryRow) => {
        const color = categoryRow ? categoryRow.color : '#FF5733';
        
        const sql = `
          INSERT INTO pins (name, description, latitude, longitude, category, color, created_by, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        this.db.run(sql, [name, description, latitude, longitude, category, color, created_by], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, ...pinData, color });
          }
        });
      });
    });
  }

  updatePin(id, pinData) {
    return new Promise((resolve, reject) => {
      const { name, description, latitude, longitude, category, updated_by } = pinData;
      
      if (!updated_by) {
        reject(new Error('updated_by is required'));
        return;
      }
      
      // Get category color if category is provided
      if (category) {
        this.db.get('SELECT color FROM categories WHERE name = ?', [category], (err, categoryRow) => {
          const color = categoryRow ? categoryRow.color : '#FF5733';
          
          const sql = `
            UPDATE pins 
            SET name = ?, description = ?, latitude = ?, longitude = ?, category = ?, color = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `;
          this.db.run(sql, [name, description, latitude, longitude, category, color, updated_by, id], function(err) {
            if (err) {
              reject(err);
            } else {
              resolve({ id, ...pinData, color });
            }
          });
        });
      } else {
        const sql = `
          UPDATE pins 
          SET name = ?, description = ?, latitude = ?, longitude = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        this.db.run(sql, [name, description, latitude, longitude, updated_by, id], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id, ...pinData });
          }
        });
      }
    });
  }

  deletePin(id) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM pins WHERE id = ?';
      this.db.run(sql, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, deleted: this.changes > 0 });
        }
      });
    });
  }

  // Visit history operations
  addVisit(pinId, username, comment = null) {
    return new Promise((resolve, reject) => {
      if (!username) {
        reject(new Error('username is required'));
        return;
      }
      
      const sql = 'INSERT INTO visit_history (pin_id, username, comment) VALUES (?, ?, ?)';
      this.db.run(sql, [pinId, username, comment], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, pinId, username, comment });
        }
      });
    });
  }

  getVisitHistory(pinId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM visit_history 
        WHERE pin_id = ? 
        ORDER BY visited_at DESC 
        LIMIT 10
      `;
      this.db.all(sql, [pinId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Categories operations
  getAllCategories() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM categories ORDER BY name ASC';
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  createCategory(name, color) {
    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO categories (name, color) VALUES (?, ?)';
      this.db.run(sql, [name, color], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, name, color });
        }
      });
    });
  }

  updateCategory(id, name, color) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE categories SET name = ?, color = ? WHERE id = ?';
      this.db.run(sql, [name, color, id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, name, color, updated: this.changes > 0 });
        }
      });
    });
  }

  deleteCategory(id) {
    return new Promise((resolve, reject) => {
      // First check if category is in use
      this.db.get('SELECT COUNT(*) as count FROM pins WHERE category = (SELECT name FROM categories WHERE id = ?)', [id], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (row.count > 0) {
          reject(new Error('Nie można usunąć kategorii która jest używana przez piny'));
          return;
        }
        
        // Delete category if not in use
        const sql = 'DELETE FROM categories WHERE id = ?';
        this.db.run(sql, [id], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id, deleted: this.changes > 0 });
          }
        });
      });
    });
  }

  getCategoryById(id) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM categories WHERE id = ?';
      this.db.get(sql, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  close() {
    return new Promise((resolve) => {
      if (this.db) {
        const db = this.db;
        this.db = null; // Prevent multiple close attempts
        db.close((err) => {
          if (err && err.code !== 'SQLITE_MISUSE') {
            console.error('Error closing SQLite database:', err);
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = new Database();