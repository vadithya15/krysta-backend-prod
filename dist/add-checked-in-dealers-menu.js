var __importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0});let database_1=__importDefault(require("./config/database")),upsertCheckedInDealersMenu=async()=>{var a=await database_1.default.connect();try{await a.query("BEGIN"),await a.query(`
      ALTER TABLE menu_items
      ADD COLUMN IF NOT EXISTS show_on_ui BOOLEAN DEFAULT true;
    `);var e,r=await a.query(`INSERT INTO menu_items (
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
      RETURNING id, key, label, screen`,["checkedInDealers","Checked-In Dealers","CheckedInDealers","place","MaterialIcons","#16A085",12]),o=r.rows[0].id,i=await a.query("SELECT id, name FROM roles WHERE LOWER(name) IN ('admin', 'manager', 'director', 'superadmin')");for(e of i.rows)await a.query(`INSERT INTO role_menu_permissions (role_id, menu_item_id)
         VALUES ($1, $2)
         ON CONFLICT (role_id, menu_item_id) DO NOTHING`,[e.id,o]);await a.query("COMMIT"),console.log("Checked-In Dealers menu item upserted successfully"),console.log("Menu item:",r.rows[0]),console.log("Roles mapped:",i.rows.map(e=>e.name).join(", ")||"none")}catch(e){throw await a.query("ROLLBACK"),console.error("Failed to upsert Checked-In Dealers menu item:",e),e}finally{a.release()}};require.main===module&&upsertCheckedInDealersMenu().then(()=>process.exit(0)).catch(()=>process.exit(1)),exports.default=upsertCheckedInDealersMenu;