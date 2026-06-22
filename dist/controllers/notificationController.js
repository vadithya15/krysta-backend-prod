"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeNotificationsTable = exports.updateNotificationPreferences = exports.getNotificationPreferences = exports.sendNotification = exports.getPendingWorkSummary = exports.getPendingWork = exports.registerDeviceToken = void 0;
const database_1 = __importDefault(require("../config/database"));
// Register device for push notifications
const registerDeviceToken = async (req, res) => {
    try {
        const { deviceToken } = req.body;
        const userId = req.userId;
        if (!deviceToken) {
            return res.status(400).json({ error: 'Device token is required' });
        }
        const result = await database_1.default.query('UPDATE users SET push_notification_token = $1 WHERE id = $2 RETURNING id, name, email', [deviceToken, userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            success: true,
            message: 'Device token registered successfully',
            user: result.rows[0]
        });
    }
    catch (error) {
        console.error('Error registering device token:', error);
        res.status(500).json({ error: 'Failed to register device token' });
    }
};
exports.registerDeviceToken = registerDeviceToken;
// Get pending work for current user
const getPendingWork = async (req, res) => {
    try {
        const userId = req.userId;
        const today = new Date().toISOString().split('T')[0];
        // Get daily work status
        const dailyWorkResult = await database_1.default.query('SELECT * FROM daily_work WHERE user_id = $1 AND work_date = $2', [userId, today]);
        const dailyWork = dailyWorkResult.rows[0] || {
            day_closed: false,
            pending_orders_count: 0,
            pending_visits_count: 0
        };
        // Get pending orders
        const ordersResult = await database_1.default.query('SELECT id, order_number, dealer_id, total, status FROM orders WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC', [userId, 'pending']);
        // Get pending dealer visits (not checked out)
        const visitsResult = await database_1.default.query(`SELECT id, dealer_id, check_in_time FROM dealer_visits 
       WHERE user_id = $1 AND DATE(check_in_time) = $2 AND check_out_time IS NULL`, [userId, today]);
        res.json({
            success: true,
            dayStatus: {
                day_closed: dailyWork.day_closed,
                closed_at: dailyWork.closed_at
            },
            pendingWork: {
                pending_orders_count: dailyWork.pending_orders_count || ordersResult.rows.length,
                pending_visits_count: dailyWork.pending_visits_count || visitsResult.rows.length,
                orders: ordersResult.rows,
                visits: visitsResult.rows
            }
        });
    }
    catch (error) {
        console.error('Error fetching pending work:', error);
        res.status(500).json({ error: 'Failed to fetch pending work' });
    }
};
exports.getPendingWork = getPendingWork;
// Get pending work summary (Manager/Admin only)
const getPendingWorkSummary = async (req, res) => {
    try {
        const userRole = req.userRole?.name;
        // Only managers and admins can view this
        if (userRole !== 'Manager' && userRole !== 'Admin') {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        const today = new Date().toISOString().split('T')[0];
        // Get all users with unclosed days
        const result = await database_1.default.query(`SELECT 
        u.id, 
        u.name, 
        u.email,
        dw.work_date,
        dw.day_closed,
        dw.pending_orders_count,
        dw.pending_visits_count,
        dw.last_updated
      FROM users u
      LEFT JOIN daily_work dw ON u.id = dw.user_id AND dw.work_date = $1
      WHERE u.role_id = (SELECT id FROM roles WHERE name = 'Sales Agent')
      ORDER BY dw.day_closed ASC, u.name`, [today]);
        const unclosedDays = result.rows.filter(row => !row.day_closed);
        res.json({
            success: true,
            summary: {
                total_agents: result.rows.length,
                unclosed_count: unclosedDays.length,
                closed_count: result.rows.filter(row => row.day_closed).length
            },
            unclosedDays: unclosedDays,
            allUsers: result.rows
        });
    }
    catch (error) {
        console.error('Error fetching pending work summary:', error);
        res.status(500).json({ error: 'Failed to fetch pending work summary' });
    }
};
exports.getPendingWorkSummary = getPendingWorkSummary;
// Send notification to specific user
const sendNotification = async (req, res) => {
    try {
        const { userId, title, body, type } = req.body;
        if (!userId || !title || !body) {
            return res.status(400).json({ error: 'userId, title, and body are required' });
        }
        // Get device token
        const userResult = await database_1.default.query('SELECT push_notification_token FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const deviceToken = userResult.rows[0].push_notification_token;
        if (!deviceToken) {
            return res.status(400).json({ error: 'User has no registered device' });
        }
        // In production, send via Expo Push Notifications
        // For now, we'll log it
        console.log(`Sending notification to ${userId}: ${title} - ${body}`);
        // Store notification in database (optional)
        await database_1.default.query(`INSERT INTO notifications (user_id, title, body, type, created_at) 
       VALUES ($1, $2, $3, $4, NOW())`, [userId, title, body, type || 'general']);
        res.json({
            success: true,
            message: 'Notification sent successfully',
            notificationData: {
                userId,
                title,
                body,
                type: type || 'general'
            }
        });
    }
    catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({ error: 'Failed to send notification' });
    }
};
exports.sendNotification = sendNotification;
// Get notification preferences
const getNotificationPreferences = async (req, res) => {
    try {
        const userId = req.userId;
        const result = await database_1.default.query('SELECT notification_preferences FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const preferences = result.rows[0].notification_preferences || {
            enabled: true,
            daily_reminder: true,
            email_alerts: true
        };
        res.json({
            success: true,
            preferences
        });
    }
    catch (error) {
        console.error('Error fetching notification preferences:', error);
        res.status(500).json({ error: 'Failed to fetch notification preferences' });
    }
};
exports.getNotificationPreferences = getNotificationPreferences;
// Update notification preferences
const updateNotificationPreferences = async (req, res) => {
    try {
        const userId = req.userId;
        const { preferences } = req.body;
        if (!preferences) {
            return res.status(400).json({ error: 'preferences object is required' });
        }
        const result = await database_1.default.query('UPDATE users SET notification_preferences = $1 WHERE id = $2 RETURNING notification_preferences', [JSON.stringify(preferences), userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            success: true,
            message: 'Notification preferences updated',
            preferences: result.rows[0].notification_preferences
        });
    }
    catch (error) {
        console.error('Error updating notification preferences:', error);
        res.status(500).json({ error: 'Failed to update notification preferences' });
    }
};
exports.updateNotificationPreferences = updateNotificationPreferences;
// Create notifications table if it doesn't exist
const initializeNotificationsTable = async () => {
    try {
        await database_1.default.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'general',
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP
      );
    `);
        await database_1.default.query('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);');
        await database_1.default.query('CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);');
        console.log('Notifications table initialized');
    }
    catch (error) {
        console.error('Error initializing notifications table:', error);
    }
};
exports.initializeNotificationsTable = initializeNotificationsTable;
