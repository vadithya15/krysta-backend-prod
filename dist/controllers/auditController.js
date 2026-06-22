"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupAuditLogs = exports.getAuditSummary = exports.getFailedAttempts = exports.getActionAuditLogs = exports.getPhoneAuditLogs = exports.getUserAuditLogs = exports.getAuditLogs = exports.logMobileEvent = void 0;
const auditService_1 = __importDefault(require("../services/auditService"));
const database_1 = __importDefault(require("../config/database"));
/**
 * Log event from mobile app
 */
const logMobileEvent = async (req, res) => {
    try {
        const { action, action_details, status, error_message, metadata, user_agent } = req.body;
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
        // Get user ID from token if available
        const userId = req.user?.id;
        await auditService_1.default.log({
            user_id: userId,
            action,
            action_details,
            status,
            ip_address: clientIp,
            user_agent,
            error_message,
            metadata,
        });
        res.json({
            message: 'Audit event logged successfully',
        });
    }
    catch (error) {
        console.error('Log mobile event error:', error);
        // Don't fail the request - audit logging should not break the app
        res.status(200).json({ message: 'Event processing completed' });
    }
};
exports.logMobileEvent = logMobileEvent;
/**
 * Get audit logs (admin/manager only)
 */
const getAuditLogs = async (req, res) => {
    try {
        const { user_id, action, status, phone_number, days = 7, limit = 50, offset = 0 } = req.query;
        const filters = {
            user_id: user_id ? parseInt(user_id) : undefined,
            action: action,
            status: status,
            phone_number: phone_number,
            days: days ? parseInt(days) : 7,
            limit: limit ? parseInt(limit) : 50,
            offset: offset ? parseInt(offset) : 0,
        };
        const result = await auditService_1.default.getAuditLogs(filters);
        res.json({
            message: 'Audit logs retrieved successfully',
            data: result.logs,
            pagination: {
                total: result.total,
                limit: filters.limit,
                offset: filters.offset,
            },
        });
    }
    catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: 'Failed to retrieve audit logs' });
    }
};
exports.getAuditLogs = getAuditLogs;
/**
 * Get user's audit logs
 */
const getUserAuditLogs = async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 100 } = req.query;
        const logs = await auditService_1.default.getUserAuditLogs(parseInt(userId), parseInt(limit) || 100);
        res.json({
            message: 'User audit logs retrieved successfully',
            data: logs,
        });
    }
    catch (error) {
        console.error('Get user audit logs error:', error);
        res.status(500).json({ error: 'Failed to retrieve user audit logs' });
    }
};
exports.getUserAuditLogs = getUserAuditLogs;
/**
 * Get logs for a phone number
 */
const getPhoneAuditLogs = async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const { limit = 100 } = req.query;
        const logs = await auditService_1.default.getPhoneAuditLogs(phoneNumber, parseInt(limit) || 100);
        res.json({
            message: 'Phone audit logs retrieved successfully',
            data: logs,
        });
    }
    catch (error) {
        console.error('Get phone audit logs error:', error);
        res.status(500).json({ error: 'Failed to retrieve phone audit logs' });
    }
};
exports.getPhoneAuditLogs = getPhoneAuditLogs;
/**
 * Get logs for a specific action
 */
const getActionAuditLogs = async (req, res) => {
    try {
        const { action } = req.params;
        const { limit = 100 } = req.query;
        const logs = await auditService_1.default.getActionLogs(action, parseInt(limit) || 100);
        res.json({
            message: `Audit logs for action '${action}' retrieved successfully`,
            data: logs,
        });
    }
    catch (error) {
        console.error('Get action audit logs error:', error);
        res.status(500).json({ error: 'Failed to retrieve action audit logs' });
    }
};
exports.getActionAuditLogs = getActionAuditLogs;
/**
 * Get failed login attempts for a phone
 */
const getFailedAttempts = async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const { minutesBack = 30 } = req.query;
        const count = await auditService_1.default.getFailedAttempts(phoneNumber, parseInt(minutesBack) || 30);
        res.json({
            message: 'Failed attempts retrieved successfully',
            data: {
                phone_number: phoneNumber,
                failed_attempts: count,
                time_window_minutes: minutesBack,
            },
        });
    }
    catch (error) {
        console.error('Get failed attempts error:', error);
        res.status(500).json({ error: 'Failed to retrieve failed attempts' });
    }
};
exports.getFailedAttempts = getFailedAttempts;
/**
 * Get audit summary (dashboard)
 */
const getAuditSummary = async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const daysNum = parseInt(days) || 7;
        // Get total logins
        const loginsResult = await database_1.default.query(`SELECT COUNT(*) as count FROM audit_logs 
       WHERE action = 'verify-otp' AND status = 'success' 
       AND created_at >= NOW() - INTERVAL '${daysNum} days'`);
        // Get failed attempts
        const failedResult = await database_1.default.query(`SELECT COUNT(*) as count FROM audit_logs 
       WHERE status IN ('failed', 'attempted') 
       AND action IN ('send-otp', 'verify-otp')
       AND created_at >= NOW() - INTERVAL '${daysNum} days'`);
        // Get unique users
        const uniqueUsersResult = await database_1.default.query(`SELECT COUNT(DISTINCT user_id) as count FROM audit_logs 
       WHERE user_id IS NOT NULL
       AND created_at >= NOW() - INTERVAL '${daysNum} days'`);
        // Get unique phones
        const uniquePhonesResult = await database_1.default.query(`SELECT COUNT(DISTINCT phone_number) as count FROM audit_logs 
       WHERE phone_number IS NOT NULL
       AND created_at >= NOW() - INTERVAL '${daysNum} days'`);
        // Get action distribution
        const actionsResult = await database_1.default.query(`SELECT action, status, COUNT(*) as count FROM audit_logs 
       WHERE created_at >= NOW() - INTERVAL '${daysNum} days'
       GROUP BY action, status
       ORDER BY action, status`);
        res.json({
            message: 'Audit summary retrieved successfully',
            data: {
                time_period_days: daysNum,
                summary: {
                    total_successful_logins: parseInt(loginsResult.rows[0].count),
                    total_failed_attempts: parseInt(failedResult.rows[0].count),
                    unique_users: parseInt(uniqueUsersResult.rows[0].count),
                    unique_phone_numbers: parseInt(uniquePhonesResult.rows[0].count),
                },
                action_distribution: actionsResult.rows,
            },
        });
    }
    catch (error) {
        console.error('Get audit summary error:', error);
        res.status(500).json({ error: 'Failed to retrieve audit summary' });
    }
};
exports.getAuditSummary = getAuditSummary;
/**
 * Clean up old audit logs
 */
const cleanupAuditLogs = async (req, res) => {
    try {
        const { daysToKeep = 90 } = req.body;
        const deletedCount = await auditService_1.default.clearOldLogs(daysToKeep);
        res.json({
            message: 'Audit logs cleanup completed',
            data: {
                deleted_records: deletedCount,
                retention_days: daysToKeep,
            },
        });
    }
    catch (error) {
        console.error('Cleanup audit logs error:', error);
        res.status(500).json({ error: 'Failed to cleanup audit logs' });
    }
};
exports.cleanupAuditLogs = cleanupAuditLogs;
