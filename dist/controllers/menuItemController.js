"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMenuItem = exports.updateMenuItem = exports.createMenuItem = exports.getMenuItemById = exports.getAllMenuItems = void 0;
const database_1 = __importDefault(require("../config/database"));
const ensureCheckedInDealersMenuItem = async () => {
    await database_1.default.query(`
    ALTER TABLE menu_items
    ADD COLUMN IF NOT EXISTS show_on_ui BOOLEAN DEFAULT true;
  `);
    await database_1.default.query(`INSERT INTO menu_items (
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
      show_on_ui = true`, [
        'checkedInDealers',
        'Checked-In Dealers',
        'CheckedInDealers',
        'place',
        'MaterialIcons',
        '#16A085',
        12,
    ]);
};
// Get all menu items (only active items)
const getAllMenuItems = async (req, res) => {
    try {
        await ensureCheckedInDealersMenuItem();
        const result = await database_1.default.query(`
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
    `);
        res.json({ data: result.rows });
    }
    catch (error) {
        console.error('Error fetching menu items:', error);
        res.status(500).json({ error: 'Failed to fetch menu items' });
    }
};
exports.getAllMenuItems = getAllMenuItems;
// Get single menu item by ID
const getMenuItemById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query(`SELECT 
         id, 
         label as name, 
         key as description, 
         icon_name as icon, 
         screen as route, 
         is_active,
         show_on_ui
       FROM menu_items WHERE id = $1`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        res.json({ data: result.rows[0] });
    }
    catch (error) {
        console.error('Error fetching menu item:', error);
        res.status(500).json({ error: 'Failed to fetch menu item' });
    }
};
exports.getMenuItemById = getMenuItemById;
// Create new menu item
const createMenuItem = async (req, res) => {
    try {
        const { key, label, screen, icon_name, icon_family, color, display_order, is_active, show_on_ui } = req.body;
        if (!key || !label) {
            return res.status(400).json({ error: 'Key and Label are required' });
        }
        const result = await database_1.default.query(`INSERT INTO menu_items (key, label, screen, icon_name, icon_family, color, display_order, is_active, show_on_ui) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING 
         id, 
         label as name, 
         key as description, 
         icon_name as icon, 
         screen as route, 
         is_active,
         show_on_ui`, [
            key,
            label,
            screen || null,
            icon_name || null,
            icon_family || null,
            color || null,
            display_order || 0,
            is_active !== false,
            show_on_ui !== false
        ]);
        res.status(201).json({ data: result.rows[0] });
    }
    catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Menu item key already exists' });
        }
        console.error('Error creating menu item:', error);
        res.status(500).json({ error: 'Failed to create menu item' });
    }
};
exports.createMenuItem = createMenuItem;
// Update menu item
const updateMenuItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active, show_on_ui } = req.body;
        // Get current menu item first
        const current = await database_1.default.query('SELECT * FROM menu_items WHERE id = $1', [id]);
        if (current.rows.length === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        // Update is_active and/or show_on_ui
        const result = await database_1.default.query(`UPDATE menu_items 
       SET is_active = $1, show_on_ui = $2
       WHERE id = $3 
       RETURNING 
         id, 
         label as name, 
         key as description, 
         icon_name as icon, 
         screen as route, 
         is_active,
         show_on_ui`, [
            is_active !== undefined ? is_active : current.rows[0].is_active,
            show_on_ui !== undefined ? show_on_ui : current.rows[0].show_on_ui,
            id
        ]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        res.json({ data: result.rows[0] });
    }
    catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Menu item key already exists' });
        }
        console.error('Error updating menu item:', error);
        res.status(500).json({ error: 'Failed to update menu item' });
    }
};
exports.updateMenuItem = updateMenuItem;
// Delete menu item
const deleteMenuItem = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query('DELETE FROM menu_items WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        res.json({ message: 'Menu item deleted successfully', menuItem: result.rows[0] });
    }
    catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ error: 'Cannot delete menu item: still in use by permissions' });
        }
        console.error('Error deleting menu item:', error);
        res.status(500).json({ error: 'Failed to delete menu item' });
    }
};
exports.deleteMenuItem = deleteMenuItem;
