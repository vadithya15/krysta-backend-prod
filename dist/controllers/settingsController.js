"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSetting = exports.deleteSetting = exports.updateSettingById = exports.createSetting = exports.getSettingById = exports.getAllSettings = exports.getSettingByKey = exports.getPublicSettings = void 0;
const database_1 = __importDefault(require("../config/database"));
/**
 * Get public app settings
 * No authentication required for public settings
 */
const getPublicSettings = async (req, res) => {
    try {
        const result = await database_1.default.query(`
      SELECT setting_key, setting_value, description
      FROM settings
      WHERE is_public = true
      ORDER BY setting_key
    `);
        // Convert to key-value object
        const settings = {};
        result.rows.forEach((row) => {
            settings[row.setting_key] = row.setting_value || '';
        });
        res.json({ settings });
    }
    catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
};
exports.getPublicSettings = getPublicSettings;
/**
 * Get specific setting by key
 */
const getSettingByKey = async (req, res) => {
    try {
        const { key } = req.params;
        const result = await database_1.default.query(`SELECT setting_key, setting_value, description
       FROM settings
       WHERE setting_key = $1 AND is_public = true`, [key]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }
        res.json({
            key: result.rows[0].setting_key,
            value: result.rows[0].setting_value || '',
            description: result.rows[0].description,
        });
    }
    catch (error) {
        console.error('Get setting error:', error);
        res.status(500).json({ error: 'Failed to fetch setting' });
    }
};
exports.getSettingByKey = getSettingByKey;
/**
 * Get all settings (admin only)
 */
const getAllSettings = async (req, res) => {
    try {
        const result = await database_1.default.query(`SELECT id, setting_key, setting_value, description, is_public, created_at, updated_at
       FROM settings
       ORDER BY setting_key ASC`);
        res.json({ data: result.rows });
    }
    catch (error) {
        console.error('Get all settings error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
};
exports.getAllSettings = getAllSettings;
/**
 * Get setting by ID (admin only)
 */
const getSettingById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query(`SELECT id, setting_key, setting_value, description, is_public, created_at, updated_at
       FROM settings
       WHERE id = $1`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }
        res.json({ data: result.rows[0] });
    }
    catch (error) {
        console.error('Get setting by id error:', error);
        res.status(500).json({ error: 'Failed to fetch setting' });
    }
};
exports.getSettingById = getSettingById;
/**
 * Create setting (admin only)
 */
const createSetting = async (req, res) => {
    try {
        const { setting_key, setting_value, description, is_public } = req.body;
        if (!setting_key) {
            return res.status(400).json({ error: 'setting_key is required' });
        }
        const result = await database_1.default.query(`INSERT INTO settings (setting_key, setting_value, description, is_public)
       VALUES ($1, $2, $3, $4)
       RETURNING id, setting_key, setting_value, description, is_public, created_at, updated_at`, [
            String(setting_key).trim(),
            setting_value ?? '',
            description ?? null,
            is_public === true,
        ]);
        res.status(201).json({ data: result.rows[0] });
    }
    catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Setting key already exists' });
        }
        console.error('Create setting error:', error);
        res.status(500).json({ error: 'Failed to create setting' });
    }
};
exports.createSetting = createSetting;
/**
 * Update setting by ID (admin only)
 */
const updateSettingById = async (req, res) => {
    try {
        const { id } = req.params;
        const { setting_key, setting_value, description, is_public } = req.body;
        const current = await database_1.default.query('SELECT * FROM settings WHERE id = $1', [id]);
        if (current.rows.length === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }
        const result = await database_1.default.query(`UPDATE settings
       SET setting_key = $1,
           setting_value = $2,
           description = $3,
           is_public = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, setting_key, setting_value, description, is_public, created_at, updated_at`, [
            setting_key !== undefined ? String(setting_key).trim() : current.rows[0].setting_key,
            setting_value !== undefined ? setting_value : current.rows[0].setting_value,
            description !== undefined ? description : current.rows[0].description,
            is_public !== undefined ? is_public : current.rows[0].is_public,
            id,
        ]);
        res.json({ data: result.rows[0] });
    }
    catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Setting key already exists' });
        }
        console.error('Update setting by id error:', error);
        res.status(500).json({ error: 'Failed to update setting' });
    }
};
exports.updateSettingById = updateSettingById;
/**
 * Delete setting by ID (admin only)
 */
const deleteSetting = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query('DELETE FROM settings WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }
        res.json({ message: 'Setting deleted successfully' });
    }
    catch (error) {
        console.error('Delete setting error:', error);
        res.status(500).json({ error: 'Failed to delete setting' });
    }
};
exports.deleteSetting = deleteSetting;
/**
 * Update setting by key (admin only, backward compatibility)
 */
const updateSetting = async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;
        const result = await database_1.default.query(`UPDATE settings
       SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
       WHERE setting_key = $2
       RETURNING setting_key, setting_value, description`, [value, key]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }
        res.json({ data: result.rows[0] });
    }
    catch (error) {
        console.error('Update setting error:', error);
        res.status(500).json({ error: 'Failed to update setting' });
    }
};
exports.updateSetting = updateSetting;
