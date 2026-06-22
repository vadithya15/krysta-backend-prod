"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCheckpointHistory = exports.getCurrentCheckpoint = exports.endDay = exports.startDay = void 0;
const database_1 = __importDefault(require("../config/database"));
// Start day - Check in
const startDay = async (req, res) => {
    try {
        const userId = req.user.id;
        const { location, timestamp } = req.body;
        // Check if there's already an active day
        const checkQuery = `
      SELECT * FROM checkpoints 
      WHERE user_id = $1 AND check_out_time IS NULL 
      ORDER BY check_in_time DESC 
      LIMIT 1
    `;
        const checkResult = await database_1.default.query(checkQuery, [userId]);
        if (checkResult.rows.length > 0) {
            return res.status(400).json({
                error: 'Day already started',
                message: 'Please end your current day before starting a new one'
            });
        }
        // Insert check-in record
        const insertQuery = `
      INSERT INTO checkpoints (user_id, check_in_time, check_in_location, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
        const checkInTime = timestamp ? new Date(timestamp) : new Date();
        const result = await database_1.default.query(insertQuery, [
            userId,
            checkInTime,
            location || 'Unknown',
            'active'
        ]);
        res.json({
            message: 'Day started successfully',
            checkpoint: result.rows[0]
        });
    }
    catch (error) {
        console.error('Start day error:', error);
        res.status(500).json({ error: 'Failed to start day', message: error.message });
    }
};
exports.startDay = startDay;
// End day - Check out
const endDay = async (req, res) => {
    try {
        const userId = req.user.id;
        const { location, timestamp, totalDistance } = req.body;
        // Find active checkpoint
        const findQuery = `
      SELECT * FROM checkpoints 
      WHERE user_id = $1 AND check_out_time IS NULL 
      ORDER BY check_in_time DESC 
      LIMIT 1
    `;
        const findResult = await database_1.default.query(findQuery, [userId]);
        if (findResult.rows.length === 0) {
            return res.status(400).json({
                error: 'No active day',
                message: 'Please start your day first'
            });
        }
        const checkpoint = findResult.rows[0];
        const checkInTime = new Date(checkpoint.check_in_time);
        const checkOutTime = timestamp ? new Date(timestamp) : new Date();
        const parsedDistance = Number(totalDistance);
        const hasValidProvidedDistance = Number.isFinite(parsedDistance) && parsedDistance > 0;
        // Calculate distance from location_tracks if not provided/invalid
        let distanceKm = hasValidProvidedDistance ? parsedDistance : 0;
        if (!hasValidProvidedDistance) {
            try {
                // Get all location tracks for this day
                const locationQuery = `
          SELECT latitude, longitude, recorded_at 
          FROM location_tracks 
          WHERE user_id = $1 
          AND recorded_at >= $2 
          AND recorded_at <= $3
          ORDER BY recorded_at ASC
        `;
                const locationResult = await database_1.default.query(locationQuery, [
                    userId,
                    checkInTime,
                    checkOutTime
                ]);
                // Calculate total distance using Haversine formula
                if (locationResult.rows.length > 1) {
                    for (let i = 1; i < locationResult.rows.length; i++) {
                        const prev = locationResult.rows[i - 1];
                        const curr = locationResult.rows[i];
                        distanceKm += calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
                    }
                }
            }
            catch (error) {
                console.error('Error calculating distance from location tracks:', error);
                // Continue with distance = 0 if calculation fails
            }
        }
        // Update with check-out time and distance
        const updateQuery = `
      UPDATE checkpoints 
      SET check_out_time = $1, check_out_location = $2, status = $3, total_distance_km = $4
      WHERE id = $5
      RETURNING *
    `;
        const result = await database_1.default.query(updateQuery, [
            checkOutTime,
            location || 'Unknown',
            'completed',
            Number(distanceKm.toFixed(2)),
            checkpoint.id
        ]);
        res.json({
            message: 'Day ended successfully',
            checkpoint: result.rows[0]
        });
    }
    catch (error) {
        console.error('End day error:', error);
        res.status(500).json({ error: 'Failed to end day', message: error.message });
    }
};
exports.endDay = endDay;
// Helper function to calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};
const toRad = (value) => {
    return (value * Math.PI) / 180;
};
// Get current checkpoint status
const getCurrentCheckpoint = async (req, res) => {
    try {
        const userId = req.user.id;
        const query = `
      SELECT * FROM checkpoints 
      WHERE user_id = $1 AND check_out_time IS NULL 
      ORDER BY check_in_time DESC 
      LIMIT 1
    `;
        const result = await database_1.default.query(query, [userId]);
        if (result.rows.length === 0) {
            return res.json({
                active: false,
                checkpoint: null
            });
        }
        res.json({
            active: true,
            checkpoint: result.rows[0]
        });
    }
    catch (error) {
        console.error('Get checkpoint error:', error);
        res.status(500).json({ error: 'Failed to get checkpoint', message: error.message });
    }
};
exports.getCurrentCheckpoint = getCurrentCheckpoint;
// Get checkpoint history
const getCheckpointHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 10, offset = 0 } = req.query;
        const query = `
      SELECT * FROM checkpoints 
      WHERE user_id = $1 
      ORDER BY check_in_time DESC 
      LIMIT $2 OFFSET $3
    `;
        const result = await database_1.default.query(query, [userId, limit, offset]);
        res.json({
            checkpoints: result.rows,
            total: result.rowCount
        });
    }
    catch (error) {
        console.error('Get checkpoint history error:', error);
        res.status(500).json({ error: 'Failed to get checkpoint history', message: error.message });
    }
};
exports.getCheckpointHistory = getCheckpointHistory;
