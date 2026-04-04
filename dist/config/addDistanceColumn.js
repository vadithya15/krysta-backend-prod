var __importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0});let database_1=__importDefault(require("./database")),addDistanceColumn=async()=>{var e=await database_1.default.connect();try{console.log("Adding total_distance_km column to checkpoints table..."),await e.query(`
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
    `),console.log("✓ Migration completed successfully");var t=await e.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'checkpoints' 
      AND column_name = 'total_distance_km'
    `);0<t.rows.length?console.log("✓ Verification successful:",t.rows[0]):console.log("⚠ Column not found after migration")}catch(e){throw console.error("Error during migration:",e.message),e}finally{e.release()}};require.main===module&&addDistanceColumn().then(()=>{console.log("Migration complete"),process.exit(0)}).catch(e=>{console.error("Migration failed:",e),process.exit(1)}),exports.default=addDistanceColumn;