"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("./database"));
const migrateToRoles = async () => {
    const client = await database_1.default.connect();
    try {
        console.log('Starting migration to roles table...');
        // Step 1: Create roles table
        await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        console.log('✓ Created roles table');
        // Step 2: Insert default roles
        await client.query(`
      INSERT INTO roles (name, description) VALUES
        ('Sales Agent', 'Field sales representative'),
        ('Manager', 'Sales manager with team oversight'),
        ('Admin', 'System administrator with full access')
      ON CONFLICT (name) DO NOTHING;
    `);
        console.log('✓ Inserted default roles');
        // Step 3: Add role_id column to users if it doesn't exist
        await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='users' AND column_name='role_id'
        ) THEN
          ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
        console.log('✓ Added role_id column to users table');
        // Step 4: Migrate existing role data
        await client.query(`
      UPDATE users 
      SET role_id = (
        SELECT id FROM roles 
        WHERE LOWER(roles.name) = LOWER(users.role) 
           OR (LOWER(users.role) LIKE '%sales%' AND roles.name = 'Sales Agent')
           OR (LOWER(users.role) = 'manager' AND roles.name = 'Manager')
           OR (LOWER(users.role) = 'admin' AND roles.name = 'Admin')
        LIMIT 1
      )
      WHERE role_id IS NULL;
    `);
        console.log('✓ Migrated existing role data');
        // Step 5: Set default role_id for users without one
        await client.query(`
      UPDATE users 
      SET role_id = (SELECT id FROM roles WHERE name = 'Sales Agent' LIMIT 1)
      WHERE role_id IS NULL;
    `);
        console.log('✓ Set default role for users without role_id');
        // Step 6: Drop old role column if it exists
        await client.query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='users' AND column_name='role'
        ) THEN
          ALTER TABLE users DROP COLUMN role;
        END IF;
      END $$;
    `);
        console.log('✓ Dropped old role column');
        console.log('Migration to roles table completed successfully!');
    }
    catch (error) {
        console.error('Error during migration:', error);
        throw error;
    }
    finally {
        client.release();
    }
};
// Run migration if this file is executed directly
if (require.main === module) {
    migrateToRoles()
        .then(() => {
        console.log('Migration complete');
        process.exit(0);
    })
        .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
    });
}
exports.default = migrateToRoles;
