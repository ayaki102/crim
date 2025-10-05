const { Pool } = require('pg');

class PostgresDatabase {
  constructor() {
    this.pool = null;
  }

  async initialize() {
    // Use Railway/Vercel/Supabase environment variables
    const connectionString = process.env.DATABASE_URL || 
                            process.env.POSTGRES_URL || 
                            process.env.POSTGRESS_POSTGRES_URL || 
                            process.env.POSTGRESS_SUPABASE_URL;
    
    console.log('Available env vars:', {
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
      POSTGRES_URL: process.env.POSTGRES_URL ? 'SET' : 'NOT SET',
      POSTGRESS_POSTGRES_URL: process.env.POSTGRESS_POSTGRES_URL ? 'SET' : 'NOT SET',
      POSTGRESS_SUPABASE_URL: process.env.POSTGRESS_SUPABASE_URL ? 'SET' : 'NOT SET'
    });
    
    if (!connectionString) {
      throw new Error('No PostgreSQL connection string found. Available env vars checked: DATABASE_URL, POSTGRES_URL, POSTGRESS_POSTGRES_URL, POSTGRESS_SUPABASE_URL');
    }
    
    console.log('Using connection string from:', connectionString.includes('supabase') ? 'Supabase' : 'Other');

    this.pool = new Pool({
      connectionString: connectionString,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false,
        require: true,
        ca: undefined,
        cert: undefined,
        key: undefined
      } : false
    });

    // Test connection
    try {
      await this.pool.query('SELECT NOW()');
      console.log('Connected to PostgreSQL database');
      await this.createTables();
    } catch (error) {
      console.error('Failed to connect to PostgreSQL:', error);
      throw error;
    }
  }

  async createTables() {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create pins table
      await client.query(`
        CREATE TABLE IF NOT EXISTS pins (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          latitude DECIMAL(10, 8) NOT NULL,
          longitude DECIMAL(11, 8) NOT NULL,
          category VARCHAR(100) DEFAULT 'default',
          color VARCHAR(7) DEFAULT '#FF5733',
          created_by VARCHAR(255) NOT NULL,
          updated_by VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create visit_history table
      await client.query(`
        CREATE TABLE IF NOT EXISTS visit_history (
          id SERIAL PRIMARY KEY,
          pin_id INTEGER NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
          username VARCHAR(255) NOT NULL,
          comment TEXT,
          visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create categories table
      await client.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          color VARCHAR(7) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert default categories (ON CONFLICT DO NOTHING for idempotency)
      await client.query(`
        INSERT INTO categories (name, color) VALUES 
        ('Domyślna', '#FF5733'),
        ('Ważne', '#FF0000'),
        ('Odwiedzone', '#00FF00'),
        ('Do sprawdzenia', '#FFFF00'),
        ('Ukończone', '#0000FF'),
        ('Problemowe', '#FF8C00')
        ON CONFLICT (name) DO NOTHING
      `);

      await client.query('COMMIT');
      console.log('Database tables created successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Pins CRUD operations
  async getAllPins() {
    const query = `
      SELECT p.*, c.name as category_name, c.color as category_color 
      FROM pins p 
      LEFT JOIN categories c ON p.category = c.name 
      ORDER BY p.created_at DESC
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async getPinById(id) {
    const query = `
      SELECT p.*, c.name as category_name, c.color as category_color 
      FROM pins p 
      LEFT JOIN categories c ON p.category = c.name 
      WHERE p.id = $1
    `;
    const result = await this.pool.query(query, [id]);
    return result.rows[0];
  }

  async createPin(pinData) {
    const { name, description, latitude, longitude, category = 'Domyślna', created_by } = pinData;
    
    if (!created_by) {
      throw new Error('created_by is required');
    }
    
    // Get category color
    const colorQuery = 'SELECT color FROM categories WHERE name = $1';
    const colorResult = await this.pool.query(colorQuery, [category]);
    const color = colorResult.rows[0]?.color || '#FF5733';
    
    const query = `
      INSERT INTO pins (name, description, latitude, longitude, category, color, created_by, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    const result = await this.pool.query(query, [name, description, latitude, longitude, category, color, created_by]);
    return result.rows[0];
  }

  async updatePin(id, pinData) {
    const { name, description, latitude, longitude, category, updated_by } = pinData;
    
    if (!updated_by) {
      throw new Error('updated_by is required');
    }
    
    let query, params;
    
    if (category) {
      // Get category color
      const colorQuery = 'SELECT color FROM categories WHERE name = $1';
      const colorResult = await this.pool.query(colorQuery, [category]);
      const color = colorResult.rows[0]?.color || '#FF5733';
      
      query = `
        UPDATE pins 
        SET name = $1, description = $2, latitude = $3, longitude = $4, category = $5, color = $6, updated_by = $7, updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
        RETURNING *
      `;
      params = [name, description, latitude, longitude, category, color, updated_by, id];
    } else {
      query = `
        UPDATE pins 
        SET name = $1, description = $2, latitude = $3, longitude = $4, updated_by = $5, updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING *
      `;
      params = [name, description, latitude, longitude, updated_by, id];
    }
    
    const result = await this.pool.query(query, params);
    return result.rows[0];
  }

  async deletePin(id) {
    const query = 'DELETE FROM pins WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return { id: parseInt(id), deleted: result.rowCount > 0 };
  }

  // Visit history operations
  async addVisit(pinId, username, comment = null) {
    if (!username) {
      throw new Error('username is required');
    }
    
    const query = 'INSERT INTO visit_history (pin_id, username, comment) VALUES ($1, $2, $3) RETURNING *';
    const result = await this.pool.query(query, [pinId, username, comment]);
    return result.rows[0];
  }

  async getVisitHistory(pinId) {
    const query = `
      SELECT * FROM visit_history 
      WHERE pin_id = $1 
      ORDER BY visited_at DESC 
      LIMIT 10
    `;
    const result = await this.pool.query(query, [pinId]);
    return result.rows;
  }

  // Categories operations
  async getAllCategories() {
    const query = 'SELECT * FROM categories ORDER BY name ASC';
    const result = await this.pool.query(query);
    return result.rows;
  }

  async createCategory(name, color) {
    const query = 'INSERT INTO categories (name, color) VALUES ($1, $2) RETURNING *';
    const result = await this.pool.query(query, [name, color]);
    return result.rows[0];
  }

  async updateCategory(id, name, color) {
    const query = 'UPDATE categories SET name = $1, color = $2 WHERE id = $3 RETURNING *';
    const result = await this.pool.query(query, [name, color, id]);
    return { ...result.rows[0], updated: result.rowCount > 0 };
  }

  async deleteCategory(id) {
    // First check if category is in use
    const checkQuery = 'SELECT COUNT(*) as count FROM pins WHERE category = (SELECT name FROM categories WHERE id = $1)';
    const checkResult = await this.pool.query(checkQuery, [id]);
    
    if (parseInt(checkResult.rows[0].count) > 0) {
      throw new Error('Nie można usunąć kategorii która jest używana przez piny');
    }
    
    // Delete category if not in use
    const query = 'DELETE FROM categories WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return { id: parseInt(id), deleted: result.rowCount > 0 };
  }

  async getCategoryById(id) {
    const query = 'SELECT * FROM categories WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rows[0];
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

module.exports = new PostgresDatabase();