"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDailyWorkStatus = exports.closeDay = exports.getSyncQueueStatus = exports.syncLocations = exports.batchSync = void 0;
const database_1 = __importDefault(require("../config/database"));
// Batch sync multiple items
const batchSync = async (req, res) => {
    try {
        const userId = req.userId;
        const { items } = req.body;
        console.log(`🔄 Batch sync request - userId: ${userId}, items: ${items?.length || 0}`);
        if (!userId) {
            console.error(`❌ Batch sync failed: userId not set. req.user:`, req.user ? `{id: ${req.user.id}, email: ${req.user.email}}` : 'undefined');
            return res.status(401).json({ error: 'User not authenticated' });
        }
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Items array is required and must not be empty' });
        }
        const results = {
            success: [],
            failed: [],
            processed: 0
        };
        for (const item of items) {
            try {
                switch (item.type) {
                    case 'order':
                        await syncOrder(userId, item);
                        results.success.push({ temp_id: item.temp_id, type: 'order' });
                        break;
                    case 'visit':
                        await syncVisit(userId, item);
                        results.success.push({ temp_id: item.temp_id, type: 'visit' });
                        break;
                    case 'location':
                        await syncLocation(userId, item);
                        results.success.push({ temp_id: item.temp_id, type: 'location' });
                        break;
                    case 'payment':
                        await syncPayment(userId, item);
                        results.success.push({ temp_id: item.temp_id, type: 'payment' });
                        break;
                    default:
                        results.failed.push({
                            temp_id: item.temp_id,
                            error: `Unknown item type: ${item.type}`
                        });
                }
                results.processed++;
            }
            catch (error) {
                results.failed.push({
                    temp_id: item.temp_id,
                    error: error.message
                });
            }
        }
        res.json({
            success: true,
            summary: {
                total: items.length,
                successful: results.success.length,
                failed: results.failed.length
            },
            results
        });
    }
    catch (error) {
        console.error('Error in batch sync:', error);
        res.status(500).json({ error: 'Batch sync failed' });
    }
};
exports.batchSync = batchSync;
// Sync individual order
const syncOrder = async (userId, item) => {
    const orderData = item.data;
    // Check if order already exists
    const existing = await database_1.default.query('SELECT id FROM orders WHERE order_number = $1', [orderData.order_number]);
    if (existing.rows.length > 0) {
        // Order already synced
        return { success: false, reason: 'Order already exists' };
    }
    // Create order
    const result = await database_1.default.query(`INSERT INTO orders (
      order_number, user_id, dealer_id, subtotal, discount, tax, total, 
      payment_method, notes, status, sync_status, offline_created
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id`, [
        orderData.order_number,
        userId,
        orderData.dealer_id,
        orderData.subtotal,
        orderData.discount || 0,
        orderData.tax || 0,
        orderData.total,
        orderData.payment_method,
        orderData.notes,
        orderData.status || 'pending',
        'synced',
        true
    ]);
    const orderId = result.rows[0].id;
    // Insert order items
    if (Array.isArray(orderData.items)) {
        for (const orderItem of orderData.items) {
            await database_1.default.query(`INSERT INTO order_items (
          order_id, product_id, product_name, quantity, unit_price, total_price
        ) VALUES ($1, $2, $3, $4, $5, $6)`, [
                orderId,
                orderItem.product_id,
                orderItem.product_name,
                orderItem.quantity,
                orderItem.unit_price,
                orderItem.total_price
            ]);
        }
    }
    return { success: true, order_id: orderId };
};
// Sync dealer visit
const syncVisit = async (userId, item) => {
    const visitData = item.data;
    const result = await database_1.default.query(`INSERT INTO dealer_visits (
      user_id, dealer_id, check_in_time, check_out_time, check_in_latitude, 
      check_in_longitude, check_out_latitude, check_out_longitude, notes, sync_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id`, [
        userId,
        visitData.dealer_id,
        visitData.check_in_time,
        visitData.check_out_time || null,
        visitData.check_in_latitude,
        visitData.check_in_longitude,
        visitData.check_out_latitude || null,
        visitData.check_out_longitude || null,
        visitData.notes,
        'synced'
    ]);
    return { success: true, visit_id: result.rows[0].id };
};
// Sync location point
const syncLocation = async (userId, item) => {
    const locationData = item.data;
    const result = await database_1.default.query(`INSERT INTO location_tracking (
      user_id, latitude, longitude, accuracy, speed, is_background_location, 
      sync_status, recorded_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id`, [
        userId,
        locationData.latitude,
        locationData.longitude,
        locationData.accuracy || null,
        locationData.speed || null,
        locationData.is_background_location || false,
        'synced',
        locationData.recorded_at || locationData.timestamp || new Date()
    ]);
    return { success: true, location_id: result.rows[0].id };
};
// Sync payment
const syncPayment = async (userId, item) => {
    const paymentData = item.data;
    // Note: This assumes a payments table exists
    // If not, it will need to be created
    try {
        const result = await database_1.default.query(`INSERT INTO payments (
        user_id, dealer_id, order_id, amount, payment_method, 
        reference_number, notes, sync_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`, [
            userId,
            paymentData.dealer_id,
            paymentData.order_id || null,
            paymentData.amount,
            paymentData.payment_method,
            paymentData.reference_number,
            paymentData.notes,
            'synced'
        ]);
        return { success: true, payment_id: result.rows[0].id };
    }
    catch (error) {
        // If payments table doesn't exist, skip for now
        console.log('Payments table not found, skipping payment sync');
        return { success: false, reason: 'Payments table not found' };
    }
};
// Sync pending locations (highest priority)
const syncLocations = async (req, res) => {
    try {
        const userId = req.userId;
        const { locations } = req.body;
        console.log(`🔄 Location sync request - userId: ${userId}, locations: ${locations?.length || 0}`);
        if (!userId) {
            console.error(`❌ Location sync failed: userId not set. req.user:`, req.user ? `{id: ${req.user.id}, email: ${req.user.email}}` : 'undefined', 'Token header:', req.headers['authorization'] ? 'present' : 'missing');
            return res.status(401).json({ error: 'User not authenticated' });
        }
        if (!Array.isArray(locations) || locations.length === 0) {
            return res.status(400).json({ error: 'Locations array is required' });
        }
        const results = [];
        for (const location of locations) {
            try {
                const result = await database_1.default.query(`INSERT INTO location_tracking (
            user_id, latitude, longitude, accuracy, speed, is_background_location, 
            sync_status, recorded_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id`, [
                    userId,
                    location.latitude,
                    location.longitude,
                    location.accuracy || null,
                    location.speed || null,
                    location.is_background_location || false,
                    'synced',
                    location.recorded_at || location.timestamp || new Date()
                ]);
                results.push({
                    success: true,
                    location_id: result.rows[0].id,
                    timestamp: location.recorded_at
                });
            }
            catch (error) {
                results.push({
                    success: false,
                    timestamp: location.recorded_at,
                    error: error.message
                });
            }
        }
        res.json({
            success: true,
            summary: {
                total: locations.length,
                synced: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            },
            results
        });
    }
    catch (error) {
        console.error('Error syncing locations:', error);
        res.status(500).json({ error: 'Location sync failed' });
    }
};
exports.syncLocations = syncLocations;
// Get sync queue status
const getSyncQueueStatus = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        // Get pending orders
        const ordersResult = await database_1.default.query('SELECT COUNT(*) as count FROM orders WHERE user_id = $1 AND sync_status = $2', [userId, 'pending']);
        // Get pending locations
        const locationsResult = await database_1.default.query('SELECT COUNT(*) as count FROM location_tracking WHERE user_id = $1 AND sync_status = $2', [userId, 'pending']);
        const totalPending = parseInt(ordersResult.rows[0].count || 0) +
            parseInt(locationsResult.rows[0].count || 0);
        res.json({
            success: true,
            syncStatus: {
                pending_items: totalPending,
                pending_orders: parseInt(ordersResult.rows[0].count || 0),
                pending_locations: parseInt(locationsResult.rows[0].count || 0),
                sync_enabled: true,
                last_sync: new Date()
            }
        });
    }
    catch (error) {
        console.error('Error getting sync queue status:', error);
        res.status(500).json({ error: 'Failed to get sync status' });
    }
};
exports.getSyncQueueStatus = getSyncQueueStatus;
// Mark day as closed
const closeDay = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const today = new Date().toISOString().split('T')[0];
        const result = await database_1.default.query(`INSERT INTO daily_work (user_id, work_date, day_closed, closed_at) 
       VALUES ($1, $2, true, NOW())
       ON CONFLICT (user_id, work_date) 
       DO UPDATE SET day_closed = true, closed_at = NOW()
       RETURNING *`, [userId, today]);
        // Update user's last_day_closed_date
        await database_1.default.query('UPDATE users SET last_day_closed_date = NOW() WHERE id = $1', [userId]);
        res.json({
            success: true,
            message: 'Day closed successfully',
            dailyWork: result.rows[0]
        });
    }
    catch (error) {
        console.error('Error closing day:', error);
        res.status(500).json({ error: 'Failed to close day' });
    }
};
exports.closeDay = closeDay;
// Get daily work status
const getDailyWorkStatus = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const today = new Date().toISOString().split('T')[0];
        const result = await database_1.default.query('SELECT * FROM daily_work WHERE user_id = $1 AND work_date = $2', [userId, today]);
        const dailyWork = result.rows[0] || {
            user_id: userId,
            work_date: today,
            day_closed: false,
            closed_at: null,
            pending_orders_count: 0,
            pending_visits_count: 0
        };
        res.json({
            success: true,
            dailyWork
        });
    }
    catch (error) {
        console.error('Error getting daily work status:', error);
        res.status(500).json({ error: 'Failed to get daily work status' });
    }
};
exports.getDailyWorkStatus = getDailyWorkStatus;
