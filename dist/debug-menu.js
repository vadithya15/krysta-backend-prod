var __importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0});let database_1=__importDefault(require("./config/database"));async function debugMenu(){try{console.log("=== Debugging Target Setting Menu ===\n"),console.log("1. Checking if targetSetting menu item exists...");var e,o=await database_1.default.query(`
      SELECT id, key, label, screen FROM menu_items WHERE key = 'targetSetting';
    `),l=(0===o.rows.length?console.log("❌ targetSetting menu item NOT found in database"):(console.log("✓ targetSetting menu item found:"),console.log("  ID:",o.rows[0].id),console.log("  Label:",o.rows[0].label),console.log("  Screen:",o.rows[0].screen)),console.log("\n2. Checking available roles in database..."),await database_1.default.query(`
      SELECT id, name FROM roles ORDER BY id;
    `)),r=(console.log("Available roles:"),l.rows.forEach(e=>{console.log(`  - ID: ${e.id}, Name: "${e.name}"`)}),0<o.rows.length&&(console.log("\n3. Checking role_menu_permissions for targetSetting..."),0===(e=await database_1.default.query(`
        SELECT rmp.id, r.name as role_name, m.label as menu_label
        FROM role_menu_permissions rmp
        JOIN roles r ON rmp.role_id = r.id
        JOIN menu_items m ON rmp.menu_item_id = m.id
        WHERE m.key = 'targetSetting';
      `)).rows.length?console.log("❌ targetSetting has NO role permissions assigned"):(console.log("✓ targetSetting permissions:"),e.rows.forEach(e=>{console.log(`  - Role: "${e.role_name}", Menu: "${e.menu_label}"`)}))),console.log("\n4. Checking sample user roles..."),await database_1.default.query(`
      SELECT u.id, u.name, u.email, r.name as role FROM users u
      JOIN roles r ON u.role_id = r.id
      LIMIT 3;
    `));if(console.log("Sample users:"),r.rows.forEach(e=>{console.log(`  - ${e.name} (${e.email}): "${e.role}" role`)}),0<l.rows.length){console.log("\n5. Checking menu items for each role...");for(var a of l.rows){var s=await database_1.default.query(`
          SELECT m.key, m.label
          FROM role_menu_permissions rmp
          JOIN menu_items m ON rmp.menu_item_id = m.id
          WHERE rmp.role_id = $1
          ORDER BY m.display_order;
        `,[a.id]);console.log(`
  Role "${a.name}" (ID: ${a.id}):`),0===s.rows.length?console.log("    ❌ No menu items assigned"):s.rows.forEach(e=>{var o="targetSetting"===e.key?" ⭐ TARGET":"";console.log(`    - ${e.label} (${e.key})`+o)})}}process.exit(0)}catch(e){console.error("❌ Error:",e),process.exit(1)}}debugMenu();