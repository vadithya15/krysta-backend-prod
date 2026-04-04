var __importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0});let database_1=__importDefault(require("./config/database"));async function runMigration(){try{console.log("Starting Target Setting menu migration..."),await database_1.default.query(`
      INSERT INTO menu_items (key, label, screen, icon_name, icon_family, color, display_order, is_active)
      VALUES ('targetSetting', 'Target Setting', 'TargetSetting', 'track-changes', 'MaterialIcons', '#FF9800', 12, true)
      ON CONFLICT (key) DO UPDATE SET 
        label = EXCLUDED.label,
        screen = EXCLUDED.screen,
        icon_name = EXCLUDED.icon_name,
        icon_family = EXCLUDED.icon_family,
        color = EXCLUDED.color,
        is_active = EXCLUDED.is_active;
    `),console.log("✓ Target Setting menu item added"),await database_1.default.query(`
      INSERT INTO role_menu_permissions (role_id, menu_item_id)
      SELECT r.id, m.id FROM roles r, menu_items m
      WHERE r.name = 'manager' AND m.key = 'targetSetting'
      ON CONFLICT (role_id, menu_item_id) DO NOTHING;
    `),console.log("✓ Assigned to manager role"),await database_1.default.query(`
      INSERT INTO role_menu_permissions (role_id, menu_item_id)
      SELECT r.id, m.id FROM roles r, menu_items m
      WHERE r.name = 'admin' AND m.key = 'targetSetting'
      ON CONFLICT (role_id, menu_item_id) DO NOTHING;
    `),console.log("✓ Assigned to admin role");var e=await database_1.default.query(`
      SELECT m.key, m.label, r.name as role_name
      FROM menu_items m
      JOIN role_menu_permissions rmp ON m.id = rmp.menu_item_id
      JOIN roles r ON rmp.role_id = r.id
      WHERE m.key = 'targetSetting'
      ORDER BY r.name;
    `);console.log("\n✓ Migration completed successfully!"),console.log("\nTarget Setting menu item assigned to:"),e.rows.forEach(e=>{console.log(`  - ${e.role_name} role`)}),process.exit(0)}catch(e){console.error("❌ Migration failed:",e),process.exit(1)}}runMigration();