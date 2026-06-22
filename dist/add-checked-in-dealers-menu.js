"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("./config/database"));
const upsertCheckedInDealersMenu = async () => {
    const client = await database_1.default.connect();
    try {
        await client.query('BEGIN');
        // Ensure optional visibility column exists for older databases.
        await client.query(`
      ALTER TABLE menu_items
      ADD COLUMN IF NOT EXISTS show_on_ui BOOLEAN DEFAULT true;
    `);
        const menuInsert = await client.query(`INSERT INTO menu_items (
        key,
        label,
        screen,
        icon_name,
        icon_family,
        color,
        display_order,
        is_active,
        show_on_ui
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)
      ON CONFLICT (key)
      DO UPDATE SET
        label = EXCLUDED.label,
        screen = EXCLUDED.screen,
        icon_name = EXCLUDED.icon_name,
        icon_family = EXCLUDED.icon_family,
        color = EXCLUDED.color,
        is_active = true,
        show_on_ui = true
      RETURNING id, key, label, screen`, [
            'checkedInDealers',
            'Checked-In Dealers',
            'CheckedInDealers',
            'place',
            'MaterialIcons',
            '#16A085',
            12,
        ]);
        const menuId = menuInsert.rows[0].id;
        // Grant permission to commonly privileged roles.
        const roleResult = await client.query(`SELECT id, name FROM roles WHERE LOWER(name) IN ('admin', 'manager', 'director', 'superadmin')`);
        for (const role of roleResult.rows) {
            await client.query(`INSERT INTO role_menu_permissions (role_id, menu_item_id)
         VALUES ($1, $2)
         ON CONFLICT (role_id, menu_item_id) DO NOTHING`, [role.id, menuId]);
        }
        await client.query('COMMIT');
        console.log('Checked-In Dealers menu item upserted successfully');
        console.log('Menu item:', menuInsert.rows[0]);
        console.log('Roles mapped:', roleResult.rows.map((r) => r.name).join(', ') || 'none');
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Failed to upsert Checked-In Dealers menu item:', error);
        throw error;
    }
    finally {
        client.release();
    }
};
if (require.main === module) {
    upsertCheckedInDealersMenu()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
exports.default = upsertCheckedInDealersMenu;
