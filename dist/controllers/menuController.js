"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRolePermissions = exports.getAllMenuItems = exports.getMenuItemsForUser = void 0;
const database_1 = __importDefault(require("../config/database"));
const getMenuItemsForUser = async (req, res) => {
    try {
        const userId = req.user.id;
        // Get user's role and menu items
        const result = await database_1.default.query(`
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
    `, [userId]);
        res.json({
            menuItems: result.rows
        });
    }
    catch (error) {
        console.error('Error fetching menu items:', error);
        res.status(500).json({ error: 'Server error fetching menu items' });
    }
};
exports.getMenuItemsForUser = getMenuItemsForUser;
const getAllMenuItems = async (req, res) => {
    try {
        const result = await database_1.default.query(`
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
    `);
        res.json({
            menuItems: result.rows
        });
    }
    catch (error) {
        console.error('Error fetching all menu items:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.getAllMenuItems = getAllMenuItems;
const getRolePermissions = async (req, res) => {
    try {
        const result = await database_1.default.query(`
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
    `);
        // Group by role
        const permissions = {};
        result.rows.forEach(row => {
            if (!permissions[row.role_id]) {
                permissions[row.role_id] = {
                    roleId: row.role_id,
                    roleName: row.role_name,
                    menuItems: []
                };
            }
            if (row.menu_key) {
                permissions[row.role_id].menuItems.push({
                    key: row.menu_key,
                    label: row.menu_label
                });
            }
        });
        res.json({
            permissions: Object.values(permissions)
        });
    }
    catch (error) {
        console.error('Error fetching role permissions:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.getRolePermissions = getRolePermissions;
