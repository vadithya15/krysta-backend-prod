"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("./config/database"));
async function fixMenuPermissions() {
    try {
        console.log('Fixing Target Setting menu permissions...\n');
        // 1. Get the targetSetting menu item ID
        const menuResult = await database_1.default.query(`
      SELECT id FROM menu_items WHERE key = 'targetSetting';
    `);
        if (menuResult.rows.length === 0) {
            console.error('❌ targetSetting menu item not found');
            process.exit(1);
        }
        const menuItemId = menuResult.rows[0].id;
        console.log(`✓ Found targetSetting menu item (ID: ${menuItemId})`);
        // 2. Get Manager and Admin role IDs
        const rolesResult = await database_1.default.query(`
      SELECT id, name FROM roles WHERE name IN ('Manager', 'Admin');
    `);
        if (rolesResult.rows.length === 0) {
            console.error('❌ Manager or Admin roles not found');
            process.exit(1);
        }
        console.log(`✓ Found roles:`);
        const managerRole = rolesResult.rows.find((r) => r.name === 'Manager');
        const adminRole = rolesResult.rows.find((r) => r.name === 'Admin');
        if (managerRole)
            console.log(`  - Manager (ID: ${managerRole.id})`);
        if (adminRole)
            console.log(`  - Admin (ID: ${adminRole.id})`);
        // 3. Assign to Manager role
        if (managerRole) {
            await database_1.default.query(`
        INSERT INTO role_menu_permissions (role_id, menu_item_id)
        VALUES ($1, $2)
        ON CONFLICT (role_id, menu_item_id) DO NOTHING;
      `, [managerRole.id, menuItemId]);
            console.log('✓ Assigned targetSetting to Manager role');
        }
        // 4. Assign to Admin role
        if (adminRole) {
            await database_1.default.query(`
        INSERT INTO role_menu_permissions (role_id, menu_item_id)
        VALUES ($1, $2)
        ON CONFLICT (role_id, menu_item_id) DO NOTHING;
      `, [adminRole.id, menuItemId]);
            console.log('✓ Assigned targetSetting to Admin role');
        }
        // 5. Verify
        console.log('\n✓ Verification:');
        const verifyResult = await database_1.default.query(`
      SELECT rmp.id, r.name as role_name, m.label as menu_label
      FROM role_menu_permissions rmp
      JOIN roles r ON rmp.role_id = r.id
      JOIN menu_items m ON rmp.menu_item_id = m.id
      WHERE m.key = 'targetSetting';
    `);
        verifyResult.rows.forEach((row) => {
            console.log(`  - ${row.role_name} role: ${row.menu_label}`);
        });
        console.log('\n✅ Target Setting menu permissions fixed successfully!');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}
fixMenuPermissions();
