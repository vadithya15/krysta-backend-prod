var __importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0});let database_1=__importDefault(require("./config/database"));async function fixMenuPermissions(){try{console.log("Fixing Target Setting menu permissions...\n");var e=await database_1.default.query(`
      SELECT id FROM menu_items WHERE key = 'targetSetting';
    `),o=(0===e.rows.length&&(console.error("❌ targetSetting menu item not found"),process.exit(1)),e.rows[0].id),n=(console.log(`✓ Found targetSetting menu item (ID: ${o})`),await database_1.default.query(`
      SELECT id, name FROM roles WHERE name IN ('Manager', 'Admin');
    `)),i=(0===n.rows.length&&(console.error("❌ Manager or Admin roles not found"),process.exit(1)),console.log("✓ Found roles:"),n.rows.find(e=>"Manager"===e.name)),r=n.rows.find(e=>"Admin"===e.name);i&&console.log(`  - Manager (ID: ${i.id})`),r&&console.log(`  - Admin (ID: ${r.id})`),i&&(await database_1.default.query(`
        INSERT INTO role_menu_permissions (role_id, menu_item_id)
        VALUES ($1, $2)
        ON CONFLICT (role_id, menu_item_id) DO NOTHING;
      `,[i.id,o]),console.log("✓ Assigned targetSetting to Manager role")),r&&(await database_1.default.query(`
        INSERT INTO role_menu_permissions (role_id, menu_item_id)
        VALUES ($1, $2)
        ON CONFLICT (role_id, menu_item_id) DO NOTHING;
      `,[r.id,o]),console.log("✓ Assigned targetSetting to Admin role")),console.log("\n✓ Verification:"),(await database_1.default.query(`
      SELECT rmp.id, r.name as role_name, m.label as menu_label
      FROM role_menu_permissions rmp
      JOIN roles r ON rmp.role_id = r.id
      JOIN menu_items m ON rmp.menu_item_id = m.id
      WHERE m.key = 'targetSetting';
    `)).rows.forEach(e=>{console.log(`  - ${e.role_name} role: `+e.menu_label)}),console.log("\n✅ Target Setting menu permissions fixed successfully!"),process.exit(0)}catch(e){console.error("❌ Error:",e),process.exit(1)}}fixMenuPermissions();