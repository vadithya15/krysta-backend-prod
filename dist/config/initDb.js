"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("./database"));
const INIT_DB_LOCK_KEY = 98432157;
const isPgTypeRaceError = (error) => {
    return (error?.code === '23505' &&
        String(error?.constraint || '') === 'pg_type_typname_nsp_index');
};
const initializeDatabase = async (attempt = 1) => {
    const client = await database_1.default.connect();
    try {
        // Prevent concurrent initDb runs across processes/instances.
        // await client.query('SELECT pg_advisory_lock($1)', [INIT_DB_LOCK_KEY]);
        console.log('Creating database tables...');
        // Create roles table
        await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Insert default roles
        await client.query(`
      INSERT INTO roles (name, description) VALUES
        ('Sales Agent', 'Field sales representative'),
        ('Manager', 'Sales manager with team oversight'),
        ('Admin', 'System administrator with full access')
      ON CONFLICT (name) DO NOTHING;
    `);
        // Create users table (sales reps)
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        push_notification_token TEXT,
        last_login_date TIMESTAMP,
        last_day_closed_date TIMESTAMP,
        has_pending_work BOOLEAN DEFAULT false,
        notification_preferences JSON DEFAULT '{"enabled": true, "daily_reminder": true, "email_alerts": true}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Create dealers table
        await client.query(`
      CREATE TABLE IF NOT EXISTS dealers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        contact_person VARCHAR(255),
        phone VARCHAR(20),
        email VARCHAR(255),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        pincode VARCHAR(10),
        lno VARCHAR(100),
        area VARCHAR(100),
        region VARCHAR(100),
        city_id INTEGER,
        state_id INTEGER,
        area_id INTEGER,
        region_id INTEGER,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        gst_number VARCHAR(50),
        credit_limit DECIMAL(10, 2) DEFAULT 0,
        outstanding_balance DECIMAL(10, 2) DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Ensure new dealer columns exist for existing databases
        await client.query(`
      ALTER TABLE dealers
        ADD COLUMN IF NOT EXISTS lno VARCHAR(100),
        ADD COLUMN IF NOT EXISTS area VARCHAR(100),
        ADD COLUMN IF NOT EXISTS region VARCHAR(100),
        ADD COLUMN IF NOT EXISTS city_id INTEGER,
        ADD COLUMN IF NOT EXISTS state_id INTEGER,
        ADD COLUMN IF NOT EXISTS area_id INTEGER,
        ADD COLUMN IF NOT EXISTS region_id INTEGER,
        ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
        ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
    `);
        // Create regions table
        await client.query(`
      CREATE TABLE IF NOT EXISTS regions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Create areas table
        await client.query(`
      CREATE TABLE IF NOT EXISTS areas (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        region_id INTEGER REFERENCES regions(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, region_id)
      );
    `);
        // Create states table
        await client.query(`
      CREATE TABLE IF NOT EXISTS states (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Create cities table
        await client.query(`
      CREATE TABLE IF NOT EXISTS cities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        state_id INTEGER REFERENCES states(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, state_id)
      );
    `);
        // Add foreign keys for normalized dealer location
        await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_dealers_city'
        ) THEN
          ALTER TABLE dealers
            ADD CONSTRAINT fk_dealers_city FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_dealers_state'
        ) THEN
          ALTER TABLE dealers
            ADD CONSTRAINT fk_dealers_state FOREIGN KEY (state_id) REFERENCES states(id) ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_dealers_area'
        ) THEN
          ALTER TABLE dealers
            ADD CONSTRAINT fk_dealers_area FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_dealers_region'
        ) THEN
          ALTER TABLE dealers
            ADD CONSTRAINT fk_dealers_region FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
        // Create or update dealers_view for API compatibility
        await client.query('DROP VIEW IF EXISTS dealers_view');
        await client.query(`
      CREATE VIEW dealers_view AS
      SELECT
        d.id,
        d.name,
        d.contact_person,
        d.phone,
        d.email,
        d.address,
        COALESCE(c.name, d.city) AS city,
        COALESCE(s.name, d.state) AS state,
        d.pincode,
        d.lno,
        COALESCE(a.name, d.area) AS area,
        COALESCE(r.name, d.region) AS region,
        d.city_id,
        d.state_id,
        d.area_id,
        d.region_id,
        d.latitude,
        d.longitude,
        d.gst_number,
        d.credit_limit,
        d.outstanding_balance,
        d.is_active,
        d.created_at,
        d.updated_at
      FROM dealers d
      LEFT JOIN cities c ON c.id = d.city_id
      LEFT JOIN states s ON s.id = d.state_id
      LEFT JOIN areas a ON a.id = d.area_id
      LEFT JOIN regions r ON r.id = d.region_id;
    `);
        // Create user_regions mapping table
        await client.query(`
      CREATE TABLE IF NOT EXISTS user_regions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        region_id INTEGER NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, region_id)
      );
    `);
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_regions_user ON user_regions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_regions_region ON user_regions(region_id);
    `);
        // Create categories table
        await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Create products table
        await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        description TEXT,
        unit VARCHAR(50) DEFAULT 'pcs',
        price DECIMAL(10, 2) NOT NULL,
        discount DECIMAL(10, 2),
        billing_price DECIMAL(10, 2),
        stock_quantity INTEGER DEFAULT 0,
        min_order_quantity INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Create orders table
        await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        dealer_id INTEGER REFERENCES dealers(id) ON DELETE SET NULL,
        subtotal DECIMAL(10, 2) NOT NULL,
        discount DECIMAL(10, 2) DEFAULT 0,
        tax DECIMAL(10, 2) DEFAULT 0,
        total DECIMAL(10, 2) NOT NULL,
        payment_method VARCHAR(50),
        payment_type VARCHAR(50) DEFAULT 'full',
        advance_amount DECIMAL(10, 2) DEFAULT 0,
        remaining_balance DECIMAL(10, 2) DEFAULT 0,
        balance_paid DECIMAL(10, 2) DEFAULT 0,
        notes TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        sync_status VARCHAR(50) DEFAULT 'synced',
        offline_created BOOLEAN DEFAULT false,
        server_order_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Ensure new payment columns exist for existing databases
        await client.query(`
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50) DEFAULT 'full',
        ADD COLUMN IF NOT EXISTS advance_amount DECIMAL(10, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS remaining_balance DECIMAL(10, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS balance_paid DECIMAL(10, 2) DEFAULT 0;
    `);
        // Create payment_status table for status lookup
        await client.query(`
      CREATE TABLE IF NOT EXISTS payment_status (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Insert default payment statuses
        await client.query(`
      INSERT INTO payment_status (id, name, description) VALUES
        (1, 'pending', 'Payment transaction pending approval'),
        (2, 'completed', 'Payment transaction approved and completed'),
        (3, 'rejected', 'Payment transaction rejected')
      ON CONFLICT (name) DO NOTHING;
    `);
        // Ensure the sequence is set correctly
        await client.query(`
      SELECT setval('payment_status_id_seq', (SELECT MAX(id) FROM payment_status));
    `);
        // Create payment_transactions table for tracking all payments
        await client.query(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        dealer_id INTEGER NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        payment_mode VARCHAR(50) NOT NULL DEFAULT 'cash',
        reference_number VARCHAR(100),
        notes TEXT,
        receipt_uri TEXT,
        receipt_name TEXT,
        status_id INTEGER DEFAULT 1 REFERENCES payment_status(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Migrate existing status column to status_id if column exists
        await client.query(`
      DO $$ 
      BEGIN
        -- Add status_id column if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'payment_transactions' AND column_name = 'status_id'
        ) THEN
          ALTER TABLE payment_transactions ADD COLUMN status_id INTEGER DEFAULT 1 REFERENCES payment_status(id);
        END IF;

        -- Migrate data if old status column exists
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'payment_transactions' AND column_name = 'status'
        ) THEN
          -- Update existing records to use status_id based on status string
          UPDATE payment_transactions pt
          SET status_id = ps.id
          FROM payment_status ps
          WHERE pt.status = ps.name;
          
          -- Drop old status column
          ALTER TABLE payment_transactions DROP COLUMN status;
        END IF;
      END $$;
    `);
        // Create index for faster queries
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_dealer_id ON payment_transactions(dealer_id);
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
    `);
        // Create targets table
        await client.query(`
      CREATE TABLE IF NOT EXISTS targets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        collection_plan_old DECIMAL(12, 2) DEFAULT 0,
        collection_plan_new DECIMAL(12, 2) DEFAULT 0,
        abs DECIMAL(12, 2) DEFAULT 0,
        sales DECIMAL(12, 2) DEFAULT 0,
        target_type VARCHAR(20) NOT NULL,
        target_month VARCHAR(7),
        target_date DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
        // Create daily_work table for tracking day closure status
        await client.query(`
      CREATE TABLE IF NOT EXISTS daily_work (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        work_date DATE NOT NULL,
        day_closed BOOLEAN DEFAULT false,
        closed_at TIMESTAMP,
        pending_orders_count INTEGER DEFAULT 0,
        pending_visits_count INTEGER DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, work_date)
      );
    `);
        // Create dealer_plans table for day planning
        await client.query(`
      CREATE TABLE IF NOT EXISTS dealer_plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        dealer_id INTEGER NOT NULL,
        plan_date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Add foreign keys for dealer_plans if missing
        await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_dealer_plans_user'
        ) THEN
          ALTER TABLE dealer_plans
            ADD CONSTRAINT fk_dealer_plans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_dealer_plans_dealer'
        ) THEN
          ALTER TABLE dealer_plans
            ADD CONSTRAINT fk_dealer_plans_dealer FOREIGN KEY (dealer_id) REFERENCES dealers(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);
        // Create OTP table for phone-based authentication
        await client.query(`
      CREATE TABLE IF NOT EXISTS otp_verification (
        id SERIAL PRIMARY KEY,
        phone_number VARCHAR(20) NOT NULL UNIQUE,
        otp_code VARCHAR(6) NOT NULL,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        is_verified BOOLEAN DEFAULT false,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Create audit_logs table for tracking user actions and authentication events
        await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        phone_number VARCHAR(20),
        action VARCHAR(50) NOT NULL,
        action_details TEXT,
        status VARCHAR(20) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        error_message TEXT,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Create order_items table
        await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        product_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Create location_tracking table for GPS tracking
        await client.query(`
      CREATE TABLE IF NOT EXISTS location_tracking (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        accuracy DECIMAL(10, 2),
        speed DECIMAL(10, 2),
        is_background_location BOOLEAN DEFAULT false,
        sync_status VARCHAR(50) DEFAULT 'pending',
        recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Create indexes for better performance
        await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_orders_dealer ON orders(dealer_id);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_location_tracking_user ON location_tracking(user_id);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_location_tracking_recorded_at ON location_tracking(recorded_at DESC);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_daily_work_user_date ON daily_work(user_id, work_date);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_targets_user_type ON targets(user_id, target_type);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_phone ON audit_logs(phone_number);');
        // Insert sample categories
        await client.query(`
      INSERT INTO categories (name, description) VALUES
        ('All', 'All products'),
        ('Beverages', 'Drinks and beverages'),
        ('Snacks', 'Snacks and chips'),
        ('Dairy', 'Dairy products'),
        ('Groceries', 'Grocery items'),
        ('Krysta Life', 'Krysta Life product range')
      ON CONFLICT (name) DO NOTHING;
    `);
        // Insert sample products (using subqueries to get correct category IDs)
        await client.query(`
      INSERT INTO products (name, category_id, description, price, stock_quantity, unit) VALUES
        ('Coca Cola 500ml', (SELECT id FROM categories WHERE name = 'Beverages' LIMIT 1), 'Refreshing cola drink', 40.00, 1000, 'bottle'),
        ('Pepsi 500ml', (SELECT id FROM categories WHERE name = 'Beverages' LIMIT 1), 'Classic cola beverage', 40.00, 950, 'bottle'),
        ('Lays Classic 52g', (SELECT id FROM categories WHERE name = 'Snacks' LIMIT 1), 'Classic salted potato chips', 20.00, 500, 'pack'),
        ('Kurkure Masala 90g', (SELECT id FROM categories WHERE name = 'Snacks' LIMIT 1), 'Spicy masala snack', 20.00, 450, 'pack'),
        ('Amul Milk 1L', (SELECT id FROM categories WHERE name = 'Dairy' LIMIT 1), 'Fresh toned milk', 62.00, 300, 'packet'),
        ('Britannia Bread', (SELECT id FROM categories WHERE name = 'Groceries' LIMIT 1), 'White sandwich bread', 35.00, 200, 'loaf'),
        ('Maggi Noodles', (SELECT id FROM categories WHERE name = 'Groceries' LIMIT 1), 'Instant noodles', 12.00, 800, 'pack'),
        ('Parle-G Biscuits', (SELECT id FROM categories WHERE name = 'Snacks' LIMIT 1), 'Glucose biscuits', 10.00, 600, 'pack')
      ON CONFLICT DO NOTHING;
    `);
        // Insert Krysta Life products (Arrow to Alpha)
        await client.query(`
      WITH krysta_life_category AS (
        SELECT id FROM categories WHERE name = 'Krysta Life' LIMIT 1
      ),
      products_to_insert AS (
        SELECT * FROM (VALUES
          ('ARROW', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('ASTRA', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('BHUMIPUTRA', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('BHUSHAKTHI', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('CHAMP', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('ECOMITE', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('EXPERT', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('JET', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('JODI', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('KINGMITE', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('KRANTHI', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('KRYSTA FLOWER', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('LAGAN', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('MARVEL', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('NAKSHATRA', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('NEEM POWER', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('ORIENT', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('PINK PANTHER', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('R9', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('RADIANT', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('RAINBOW', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('SHAKTHI', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('SIXER', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('SUNSHINE', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('THUNDER', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('TRISHUL', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('TRIVENI', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('VEERA', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('WIN', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('ALL IN ONE', 'Krysta Life product', 'kg', 1.00, 1000, 1),
          ('ALPHA', 'Krysta Life product', 'kg', 1.00, 1000, 1)
        ) AS v(name, description, unit, price, stock_quantity, min_order_quantity)
      )
      INSERT INTO products (name, category_id, description, unit, price, stock_quantity, min_order_quantity)
      SELECT
        v.name,
        k.id,
        v.description,
        v.unit,
        v.price,
        v.stock_quantity,
        v.min_order_quantity
      FROM products_to_insert v
      CROSS JOIN krysta_life_category k
      WHERE NOT EXISTS (
        SELECT 1 FROM products p WHERE p.name = v.name
      );
    `);
        // Insert sample dealers
        await client.query(`
      INSERT INTO dealers (name, contact_person, phone, email, city, state, credit_limit) VALUES
        ('Raj Traders', 'Rajesh Kumar', '9876543210', 'raj@traders.com', 'Mumbai', 'Maharashtra', 100000.00),
        ('Sharma Store', 'Amit Sharma', '9876543211', 'amit@sharma.com', 'Delhi', 'Delhi', 75000.00),
        ('Modern Retail', 'Priya Singh', '9876543212', 'priya@modern.com', 'Bangalore', 'Karnataka', 150000.00)
      ON CONFLICT DO NOTHING;
    `);
        // Create organizations table (Multi-tenant support)
        await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        website VARCHAR(255),
        industry VARCHAR(100),
        contact_email VARCHAR(255),
        contact_phone VARCHAR(20),
        subscription_tier VARCHAR(50) DEFAULT 'basic',
        max_users INTEGER DEFAULT 100,
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Insert default organization if not exists
        await client.query(`
      INSERT INTO organizations (name, slug, description, is_active)
      VALUES ('Krysta Default', 'krysta-default', 'Default organization for Krysta Sales Tracker', true)
      ON CONFLICT (slug) DO NOTHING;
    `);
        console.log('Database initialized successfully!');
    }
    catch (error) {
        if (isPgTypeRaceError(error) && attempt < 2) {
            console.warn('Detected transient PostgreSQL type creation race during init. Retrying database initialization once...');
            return initializeDatabase(attempt + 1);
        }
        console.error('Error initializing database:', error);
        throw error;
    }
    finally {
        try {
            await client.query('SELECT pg_advisory_unlock($1)', [INIT_DB_LOCK_KEY]);
        }
        catch {
            // Ignore unlock errors; closing the session releases advisory lock anyway.
        }
        client.release();
    }
};
// Run initialization if this file is executed directly
if (require.main === module) {
    initializeDatabase()
        .then(() => {
        console.log('Database setup complete');
        process.exit(0);
    })
        .catch((error) => {
        console.error('Database setup failed:', error);
        process.exit(1);
    });
}
exports.default = initializeDatabase;
