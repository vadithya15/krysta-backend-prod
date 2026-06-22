"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("./config/database"));
async function debugMenu() {
    try {
        console.log('=== Debugging Target Setting Menu ===\n');
        // 1. Check if targetSetting menu item exists
        console.log('1. Checking if targetSetting menu item exists...');
        const menuResult = await database_1.default.query(`
      SELECT id, key, label, screen FROM menu_items WHERE key = 'targetSetting';
    `);
        if (menuResult.rows.length === 0) {
            console.log('❌ targetSetting menu item NOT found in database');
        }
        else {
            console.log('✓ targetSetting menu item found:');
            console.log('  ID:', menuResult.rows[0].id);
            console.log('  Label:', menuResult.rows[0].label);
            console.log('  Screen:', menuResult.rows[0].screen);
        }
        // 2. Check all existing roles
        console.log('\n2. Checking available roles in database...');
        const rolesResult = await database_1.default.query(`
      SELECT id, name FROM roles ORDER BY id;
    `);
        console.log('Available roles:');
        rolesResult.rows.forEach((row) => {
            console.log(`  - ID: ${row.id}, Name: "${row.name}"`);
        });
        // 3. Check role_menu_permissions for targetSetting
        if (menuResult.rows.length > 0) {
            console.log('\n3. Checking role_menu_permissions for targetSetting...');
            const permsResult = await database_1.default.query(`
        SELECT rmp.id, r.name as role_name, m.label as menu_label
        FROM role_menu_permissions rmp
        JOIN roles r ON rmp.role_id = r.id
        JOIN menu_items m ON rmp.menu_item_id = m.id
        WHERE m.key = 'targetSetting';
      `);
            if (permsResult.rows.length === 0) {
                console.log('❌ targetSetting has NO role permissions assigned');
            }
            else {
                console.log('✓ targetSetting permissions:');
                permsResult.rows.forEach((row) => {
                    console.log(`  - Role: "${row.role_name}", Menu: "${row.menu_label}"`);
                });
            }
        }
        // 4. Check a sample user and their role
        console.log('\n4. Checking sample user roles...');
        const userResult = await database_1.default.query(`
      SELECT u.id, u.name, u.email, r.name as role FROM users u
      JOIN roles r ON u.role_id = r.id
      LIMIT 3;
    `);
        console.log('Sample users:');
        userResult.rows.forEach((row) => {
            console.log(`  - ${row.name} (${row.email}): "${row.role}" role`);
        });
        // 5. Check what menu items manager role can see
        if (rolesResult.rows.length > 0) {
            console.log('\n5. Checking menu items for each role...');
            for (const role of rolesResult.rows) {
                const menuItemsForRole = await database_1.default.query(`
          SELECT m.key, m.label
          FROM role_menu_permissions rmp
          JOIN menu_items m ON rmp.menu_item_id = m.id
          WHERE rmp.role_id = $1
          ORDER BY m.display_order;
        `, [role.id]);
                console.log(`\n  Role "${role.name}" (ID: ${role.id}):`);
                if (menuItemsForRole.rows.length === 0) {
                    console.log('    ❌ No menu items assigned');
                }
                else {
                    menuItemsForRole.rows.forEach((item) => {
                        const isTarget = item.key === 'targetSetting' ? ' ⭐ TARGET' : '';
                        console.log(`    - ${item.label} (${item.key})${isTarget}`);
                    });
                }
            }
        }
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}
debugMenu();
