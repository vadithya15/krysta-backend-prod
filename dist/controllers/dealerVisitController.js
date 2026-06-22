"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTodayVisits = exports.getVisitHistory = exports.getActiveVisit = exports.endDealerVisit = exports.startDealerVisit = void 0;
const database_1 = __importDefault(require("../config/database"));
const role_access_1 = require("../middleware/role-access");
const parseCoordinatesFromLocationText = (locationText) => {
    if (!locationText || typeof locationText !== 'string') {
        return null;
    }
    const match = locationText.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (!match) {
        return null;
    }
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return null;
    }
    return { latitude, longitude };
};
// Start a dealer visit - Check-in
const startDealerVisit = async (req, res) => {
    try {
        const userId = req.user.id;
        const { dealerId, checkInLocation, checkInTime, checkInCoordinates } = req.body;
        if (!dealerId) {
            return res.status(400).json({ error: 'Dealer ID is required' });
        }
        // Check if dealer exists
        const dealerCheck = await database_1.default.query('SELECT id FROM dealers WHERE id = $1 AND is_active = true', [dealerId]);
        if (dealerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Dealer not found' });
        }
        // Check for active visit to same dealer
        const activeVisit = await database_1.default.query('SELECT id FROM dealer_visits WHERE user_id = $1 AND dealer_id = $2 AND check_out_time IS NULL', [userId, dealerId]);
        if (activeVisit.rows.length > 0) {
            return res.status(400).json({
                error: 'Active visit already exists',
                message: 'Please check out from the current visit first'
            });
        }
        // Create visit record
        const insertQuery = `
      INSERT INTO dealer_visits (user_id, dealer_id, check_in_time, check_in_location, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
        const checkInDate = checkInTime ? new Date(checkInTime) : new Date();
        const result = await database_1.default.query(insertQuery, [
            userId,
            dealerId,
            checkInDate,
            checkInLocation || 'Unknown',
            'active'
        ]);
        const coordinatePayload = checkInCoordinates &&
            Number.isFinite(Number(checkInCoordinates.latitude)) &&
            Number.isFinite(Number(checkInCoordinates.longitude))
            ? {
                latitude: Number(checkInCoordinates.latitude),
                longitude: Number(checkInCoordinates.longitude),
            }
            : parseCoordinatesFromLocationText(checkInLocation);
        if (coordinatePayload) {
            await database_1.default.query(`UPDATE dealers
         SET latitude = $1,
             longitude = $2,
             updated_at = NOW()
         WHERE id = $3`, [coordinatePayload.latitude, coordinatePayload.longitude, dealerId]);
        }
        res.json({
            message: 'Visit started successfully',
            visit: result.rows[0]
        });
    }
    catch (error) {
        console.error('Start dealer visit error:', error);
        res.status(500).json({ error: 'Failed to start visit', message: error.message });
    }
};
exports.startDealerVisit = startDealerVisit;
// End a dealer visit - Check-out
const endDealerVisit = async (req, res) => {
    try {
        const userId = req.user.id;
        const { visitId, checkOutLocation, checkOutTime, visitReason, orderRequired } = req.body;
        console.log('🔍 endDealerVisit request:', {
            visitId, visitId_type: typeof visitId,
            checkOutLocation, checkOutLocation_type: typeof checkOutLocation,
            checkOutTime, checkOutTime_type: typeof checkOutTime,
            visitReason, visitReason_type: typeof visitReason,
            orderRequired, orderRequired_type: typeof orderRequired,
            userId
        });
        if (!visitId || typeof visitId !== 'number') {
            return res.status(400).json({ error: 'Visit ID is required and must be a number', received: { visitId, type: typeof visitId } });
        }
        if (!checkOutLocation) {
            return res.status(400).json({ error: 'Checkout location is required' });
        }
        if (!checkOutTime) {
            return res.status(400).json({ error: 'Checkout time is required' });
        }
        // Check if visit exists and belongs to user
        const visitCheck = await database_1.default.query('SELECT * FROM dealer_visits WHERE id = $1 AND user_id = $2', [visitId, userId]);
        if (visitCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Visit not found' });
        }
        if (visitCheck.rows[0].check_out_time) {
            return res.status(400).json({ error: 'Visit already checked out' });
        }
        // Update visit with check-out details
        const updateQuery = `
      UPDATE dealer_visits 
      SET check_out_time = $1, 
          check_out_location = $2, 
          visit_reason = $3, 
          order_required = $4,
          status = $5
      WHERE id = $6
      RETURNING *
    `;
        const checkOutDate = checkOutTime ? new Date(checkOutTime) : new Date();
        console.log('✅ Executing endDealerVisit update:', {
            checkOutDate,
            checkOutLocation,
            visitReason,
            orderRequired: orderRequired || false,
            visitId
        });
        const result = await database_1.default.query(updateQuery, [
            checkOutDate,
            checkOutLocation || 'Unknown',
            visitReason || null,
            orderRequired || false,
            'completed',
            visitId
        ]);
        res.json({
            message: 'Visit ended successfully',
            visit: result.rows[0]
        });
    }
    catch (error) {
        console.error('❌ End dealer visit error:', error);
        console.error('   Error message:', error.message);
        console.error('   Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to end visit', message: error.message });
    }
};
exports.endDealerVisit = endDealerVisit;
// Get active visit for current user
const getActiveVisit = async (req, res) => {
    try {
        const userId = req.user.id;
        const query = `
      SELECT dv.*, dview.name, dview.address, dview.phone
      FROM dealer_visits dv
      JOIN dealers_view dview ON dv.dealer_id = dview.id
      WHERE dv.user_id = $1 AND dv.check_out_time IS NULL
      ORDER BY dv.check_in_time DESC
      LIMIT 1
    `;
        const result = await database_1.default.query(query, [userId]);
        if (result.rows.length === 0) {
            return res.json({
                active: false,
                visit: null
            });
        }
        res.json({
            active: true,
            visit: result.rows[0]
        });
    }
    catch (error) {
        console.error('Get active visit error:', error);
        res.status(500).json({ error: 'Failed to get active visit', message: error.message });
    }
};
exports.getActiveVisit = getActiveVisit;
// Get visit history for current user
const getVisitHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { dealerId, startDate, endDate, limit = 50, offset = 0 } = req.query;
        const accessibleUserIds = await (0, role_access_1.getAccessibleUserIds)(userId);
        if (accessibleUserIds.length === 0) {
            return res.json({ visits: [], total: 0, limit, offset });
        }
        let query = `
      SELECT dv.*, dview.name, dview.address, dview.phone, dview.latitude, dview.longitude,
             u.name as checked_in_by_name, u.email as checked_in_by_email, u.phone as checked_in_by_phone
      FROM dealer_visits dv
      JOIN dealers_view dview ON dv.dealer_id = dview.id
      LEFT JOIN users u ON dv.user_id = u.id
      WHERE dv.user_id = ANY($1)
    `;
        const params = [accessibleUserIds];
        let paramIndex = 2;
        if (dealerId) {
            query += ` AND dv.dealer_id = $${paramIndex}`;
            params.push(dealerId);
            paramIndex++;
        }
        if (startDate) {
            query += ` AND dv.check_in_time >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }
        if (endDate) {
            query += ` AND dv.check_in_time <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }
        query += ` ORDER BY dv.check_in_time DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);
        const result = await database_1.default.query(query, params);
        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM dealer_visits WHERE user_id = ANY($1)';
        const countParams = [accessibleUserIds];
        let countParamIndex = 2;
        if (dealerId) {
            countQuery += ` AND dealer_id = $${countParamIndex}`;
            countParams.push(dealerId);
            countParamIndex++;
        }
        const countResult = await database_1.default.query(countQuery, countParams);
        res.json({
            visits: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit,
            offset
        });
    }
    catch (error) {
        console.error('Get visit history error:', error);
        res.status(500).json({ error: 'Failed to get visit history', message: error.message });
    }
};
exports.getVisitHistory = getVisitHistory;
// Get today's visits
const getTodayVisits = async (req, res) => {
    try {
        const userId = req.user.id;
        const accessibleUserIds = await (0, role_access_1.getAccessibleUserIds)(userId);
        if (accessibleUserIds.length === 0) {
            return res.json({ visits: [], total: 0 });
        }
        const query = `
      SELECT dv.*, dview.name, dview.address, dview.phone, dview.latitude, dview.longitude,
             u.name as checked_in_by_name, u.email as checked_in_by_email, u.phone as checked_in_by_phone
      FROM dealer_visits dv
      JOIN dealers_view dview ON dv.dealer_id = dview.id
      LEFT JOIN users u ON dv.user_id = u.id
      WHERE dv.user_id = ANY($1)
      AND DATE(dv.check_in_time) = CURRENT_DATE
      ORDER BY dv.check_in_time DESC
    `;
        const result = await database_1.default.query(query, [accessibleUserIds]);
        res.json({
            visits: result.rows,
            total: result.rows.length
        });
    }
    catch (error) {
        console.error('Get today visits error:', error);
        res.status(500).json({ error: 'Failed to get today visits', message: error.message });
    }
};
exports.getTodayVisits = getTodayVisits;
