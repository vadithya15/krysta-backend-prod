var __importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0}),exports.getRolePermissions=exports.getAllMenuItems=exports.getMenuItemsForUser=void 0;let database_1=__importDefault(require("../config/database")),getMenuItemsForUser=async(e,r)=>{try{var s=e.user.id,o=await database_1.default.query(`
      SELECT DISTINCT 
        m.key,
        m.label,
        m.screen,
        m.icon_name,
        m.icon_family,
        m.color,
        m.display_order
      FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_menu_permissions rmp ON r.id = rmp.role_id
      JOIN menu_items m ON rmp.menu_item_id = m.id
      WHERE u.id = $1 AND u.is_active = true AND m.is_active = true
      ORDER BY m.display_order;
    `,[s]);r.json({menuItems:o.rows})}catch(e){console.error("Error fetching menu items:",e),r.status(500).json({error:"Server error fetching menu items"})}},getAllMenuItems=(exports.getMenuItemsForUser=getMenuItemsForUser,async(e,r)=>{try{var s=await database_1.default.query(`
      SELECT 
        id,
        key,
        label,
        screen,
        icon_name,
        icon_family,
        color,
        display_order,
        is_active
      FROM menu_items
      ORDER BY display_order;
    `);r.json({menuItems:s.rows})}catch(e){console.error("Error fetching all menu items:",e),r.status(500).json({error:"Server error"})}}),getRolePermissions=(exports.getAllMenuItems=getAllMenuItems,async(e,s)=>{try{var o=await database_1.default.query(`
      SELECT 
        r.id as role_id,
        r.name as role_name,
        m.key as menu_key,
        m.label as menu_label
      FROM roles r
      LEFT JOIN role_menu_permissions rmp ON r.id = rmp.role_id
      LEFT JOIN menu_items m ON rmp.menu_item_id = m.id
      WHERE m.is_active = true
      ORDER BY r.id, m.display_order;
    `);let r={};o.rows.forEach(e=>{r[e.role_id]||(r[e.role_id]={roleId:e.role_id,roleName:e.role_name,menuItems:[]}),e.menu_key&&r[e.role_id].menuItems.push({key:e.menu_key,label:e.menu_label})}),s.json({permissions:Object.values(r)})}catch(e){console.error("Error fetching role permissions:",e),s.status(500).json({error:"Server error"})}});exports.getRolePermissions=getRolePermissions;