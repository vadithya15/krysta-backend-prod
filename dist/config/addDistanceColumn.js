"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("./database"));
const addDistanceColumn = async () => {
    const client = await database_1.default.connect();
    try {
        console.log('Adding total_distance_km column to checkpoints table...');
        // Add the column if it doesn't exist
        await client.query(`
      DO $$ 
      BEGIN 
          IF NOT EXISTS (
              SELECT 1 
              FROM information_schema.columns 
              WHERE table_name='checkpoints' 
              AND column_name='total_distance_km'
          ) THEN
              ALTER TABLE checkpoints ADD COLUMN total_distance_km DECIMAL(10, 2) DEFAULT 0;
              RAISE NOTICE 'Column total_distance_km added successfully';
          ELSE
              RAISE NOTICE 'Column total_distance_km already exists';
          END IF;
      END $$;
    `);
        console.log('✓ Migration completed successfully');
        // Verify the column was added
        const result = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'checkpoints' 
      AND column_name = 'total_distance_km'
    `);
        if (result.rows.length > 0) {
            console.log('✓ Verification successful:', result.rows[0]);
        }
        else {
            console.log('⚠ Column not found after migration');
        }
    }
    catch (error) {
        console.error('Error during migration:', error.message);
        throw error;
    }
    finally {
        client.release();
    }
};
// Run migration if this file is executed directly
if (require.main === module) {
    addDistanceColumn()
        .then(() => {
        console.log('Migration complete');
        process.exit(0);
    })
        .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
    });
}
exports.default = addDistanceColumn;
