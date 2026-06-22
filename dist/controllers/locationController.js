"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTrackingSettings = exports.getTrackingSettings = exports.getAllUsersLocations = exports.getLocationHistory = exports.saveLocation = void 0;
const database_1 = __importDefault(require("../config/database"));
// Save location tracking data
const saveLocation = async (req, res) => {
    try {
        const userId = req.user.id;
        const { latitude, longitude, accuracy, timestamp } = req.body;
        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }
        const query = `
      INSERT INTO location_tracks (user_id, latitude, longitude, accuracy, recorded_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
        const recordedAt = timestamp ? new Date(timestamp) : new Date();
        const result = await database_1.default.query(query, [
            userId,
            latitude,
            longitude,
            accuracy || null,
            recordedAt
        ]);
        res.json({
            message: 'Location saved successfully',
            location: result.rows[0]
        });
    }
    catch (error) {
        console.error('Save location error:', error);
        res.status(500).json({ error: 'Failed to save location', message: error.message });
    }
};
exports.saveLocation = saveLocation;
// Get location history for a user
const getLocationHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { startDate, endDate, limit = 100, offset = 0 } = req.query;
        let query = `
      SELECT * FROM location_tracks 
      WHERE user_id = $1
    `;
        const params = [userId];
        let paramIndex = 2;
        if (startDate) {
            query += ` AND recorded_at >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }
        if (endDate) {
            query += ` AND recorded_at <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }
        query += ` ORDER BY recorded_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);
        const result = await database_1.default.query(query, params);
        res.json({
            locations: result.rows,
            total: result.rowCount
        });
    }
    catch (error) {
        console.error('Get location history error:', error);
        res.status(500).json({ error: 'Failed to get location history', message: error.message });
    }
};
exports.getLocationHistory = getLocationHistory;
// Get all users' latest locations (for map view)
const getAllUsersLocations = async (req, res) => {
    try {
        const query = `
      SELECT DISTINCT ON (lt.user_id)
        lt.user_id,
        lt.latitude,
        lt.longitude,
        lt.accuracy,
        lt.recorded_at,
        u.name as user_name,
        u.email as user_email,
        u.phone as user_phone,
        c.status as checkpoint_status,
        c.check_in_time,
        c.check_in_location
      FROM location_tracks lt
      INNER JOIN users u ON lt.user_id = u.id
      LEFT JOIN checkpoints c ON u.id = c.user_id AND c.status = 'active'
      WHERE u.is_active = true
      ORDER BY lt.user_id, lt.recorded_at DESC
    `;
        const result = await database_1.default.query(query);
        res.json({
            locations: result.rows,
            total: result.rowCount
        });
    }
    catch (error) {
        console.error('Get all users locations error:', error);
        res.status(500).json({ error: 'Failed to get users locations', message: error.message });
    }
};
exports.getAllUsersLocations = getAllUsersLocations;
// Get tracking settings
const getTrackingSettings = async (req, res) => {
    try {
        const query = `
      SELECT setting_key, setting_value, description 
      FROM settings 
      WHERE setting_key = 'location_tracking_interval'
    `;
        const result = await database_1.default.query(query);
        if (result.rows.length === 0) {
            // Return default value if not set
            return res.json({
                location_tracking_interval: 600000 // 10 minutes in milliseconds
            });
        }
        const settings = {};
        result.rows.forEach(row => {
            settings[row.setting_key] = parseInt(row.setting_value);
        });
        res.json(settings);
    }
    catch (error) {
        console.error('Get tracking settings error:', error);
        res.status(500).json({ error: 'Failed to get tracking settings', message: error.message });
    }
};
exports.getTrackingSettings = getTrackingSettings;
// Update tracking settings (admin only)
const updateTrackingSettings = async (req, res) => {
    try {
        const { location_tracking_interval } = req.body;
        if (!location_tracking_interval || location_tracking_interval < 60000) {
            return res.status(400).json({
                error: 'Invalid interval',
                message: 'Tracking interval must be at least 60000ms (1 minute)'
            });
        }
        const query = `
      INSERT INTO settings (setting_key, setting_value, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (setting_key) 
      DO UPDATE SET setting_value = $2, updated_at = NOW()
      RETURNING *
    `;
        const result = await database_1.default.query(query, [
            'location_tracking_interval',
            location_tracking_interval.toString(),
            'GPS tracking interval in milliseconds'
        ]);
        res.json({
            message: 'Tracking settings updated successfully',
            setting: result.rows[0]
        });
    }
    catch (error) {
        console.error('Update tracking settings error:', error);
        res.status(500).json({ error: 'Failed to update tracking settings', message: error.message });
    }
};
exports.updateTrackingSettings = updateTrackingSettings;
