var __importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0});let database_1=__importDefault(require("./database")),migrateToRoles=async()=>{var e=await database_1.default.connect();try{console.log("Starting migration to roles table..."),await e.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `),console.log("✓ Created roles table"),await e.query(`
      INSERT INTO roles (name, description) VALUES
        ('Sales Agent', 'Field sales representative'),
        ('Manager', 'Sales manager with team oversight'),
        ('Admin', 'System administrator with full access')
      ON CONFLICT (name) DO NOTHING;
    `),console.log("✓ Inserted default roles"),await e.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='users' AND column_name='role_id'
        ) THEN
          ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `),console.log("✓ Added role_id column to users table"),await e.query(`
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
    `),console.log("✓ Migrated existing role data"),await e.query(`
      UPDATE users 
      SET role_id = (SELECT id FROM roles WHERE name = 'Sales Agent' LIMIT 1)
      WHERE role_id IS NULL;
    `),console.log("✓ Set default role for users without role_id"),await e.query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='users' AND column_name='role'
        ) THEN
          ALTER TABLE users DROP COLUMN role;
        END IF;
      END $$;
    `),console.log("✓ Dropped old role column"),console.log("Migration to roles table completed successfully!")}catch(e){throw console.error("Error during migration:",e),e}finally{e.release()}};require.main===module&&migrateToRoles().then(()=>{console.log("Migration complete"),process.exit(0)}).catch(e=>{console.error("Migration failed:",e),process.exit(1)}),exports.default=migrateToRoles;