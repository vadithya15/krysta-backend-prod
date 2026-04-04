var __importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0}),exports.deleteMenuItem=exports.updateMenuItem=exports.createMenuItem=exports.getMenuItemById=exports.getAllMenuItems=void 0;let database_1=__importDefault(require("../config/database")),ensureCheckedInDealersMenuItem=async()=>{await database_1.default.query(`
    ALTER TABLE menu_items
    ADD COLUMN IF NOT EXISTS show_on_ui BOOLEAN DEFAULT true;
  `),await database_1.default.query(`INSERT INTO menu_items (
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
      show_on_ui = true`,["checkedInDealers","Checked-In Dealers","CheckedInDealers","place","MaterialIcons","#16A085",12])},getAllMenuItems=async(e,t)=>{try{await ensureCheckedInDealersMenuItem();var a=await database_1.default.query(`
      SELECT 
        id, 
        label as name, 
        key as description, 
        icon_name as icon, 
        screen as route, 
        is_active,
        show_on_ui
      FROM menu_items 
      ORDER BY display_order ASC
    `);t.json({data:a.rows})}catch(e){console.error("Error fetching menu items:",e),t.status(500).json({error:"Failed to fetch menu items"})}},getMenuItemById=(exports.getAllMenuItems=getAllMenuItems,async(e,t)=>{try{var a=e.params.id,r=await database_1.default.query(`SELECT 
         id, 
         label as name, 
         key as description, 
         icon_name as icon, 
         screen as route, 
         is_active,
         show_on_ui
       FROM menu_items WHERE id = $1`,[a]);if(0===r.rows.length)return t.status(404).json({error:"Menu item not found"});t.json({data:r.rows[0]})}catch(e){console.error("Error fetching menu item:",e),t.status(500).json({error:"Failed to fetch menu item"})}}),createMenuItem=(exports.getMenuItemById=getMenuItemById,async(e,t)=>{try{var{key:a,label:r,screen:s,icon_name:n,icon_family:o,color:i,display_order:u,is_active:l,show_on_ui:d}=e.body;if(!a||!r)return t.status(400).json({error:"Key and Label are required"});var m=await database_1.default.query(`INSERT INTO menu_items (key, label, screen, icon_name, icon_family, color, display_order, is_active, show_on_ui) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING 
         id, 
         label as name, 
         key as description, 
         icon_name as icon, 
         screen as route, 
         is_active,
         show_on_ui`,[a,r,s||null,n||null,o||null,i||null,u||0,!1!==l,!1!==d]);t.status(201).json({data:m.rows[0]})}catch(e){if("23505"===e.code)return t.status(400).json({error:"Menu item key already exists"});console.error("Error creating menu item:",e),t.status(500).json({error:"Failed to create menu item"})}}),updateMenuItem=(exports.createMenuItem=createMenuItem,async(e,t)=>{try{var a,r=e.params.id,{is_active:s,show_on_ui:n}=e.body,o=await database_1.default.query("SELECT * FROM menu_items WHERE id = $1",[r]);return 0===o.rows.length?t.status(404).json({error:"Menu item not found"}):0===(a=await database_1.default.query(`UPDATE menu_items 
       SET is_active = $1, show_on_ui = $2
       WHERE id = $3 
       RETURNING 
         id, 
         label as name, 
         key as description, 
         icon_name as icon, 
         screen as route, 
         is_active,
         show_on_ui`,[void 0!==s?s:o.rows[0].is_active,void 0!==n?n:o.rows[0].show_on_ui,r])).rows.length?t.status(404).json({error:"Menu item not found"}):void t.json({data:a.rows[0]})}catch(e){if("23505"===e.code)return t.status(400).json({error:"Menu item key already exists"});console.error("Error updating menu item:",e),t.status(500).json({error:"Failed to update menu item"})}}),deleteMenuItem=(exports.updateMenuItem=updateMenuItem,async(e,t)=>{try{var a=e.params.id,r=await database_1.default.query("DELETE FROM menu_items WHERE id = $1 RETURNING *",[a]);if(0===r.rows.length)return t.status(404).json({error:"Menu item not found"});t.json({message:"Menu item deleted successfully",menuItem:r.rows[0]})}catch(e){if("23503"===e.code)return t.status(400).json({error:"Cannot delete menu item: still in use by permissions"});console.error("Error deleting menu item:",e),t.status(500).json({error:"Failed to delete menu item"})}});exports.deleteMenuItem=deleteMenuItem;