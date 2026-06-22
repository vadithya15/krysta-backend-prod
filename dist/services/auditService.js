"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../config/database"));
class AuditService {
    /**
     * Log an audit entry
     */
    async log(entry) {
        try {
            await database_1.default.query(`INSERT INTO audit_logs (user_id, phone_number, action, action_details, status, ip_address, user_agent, error_message, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [
                entry.user_id || null,
                entry.phone_number || null,
                entry.action,
                entry.action_details || null,
                entry.status,
                entry.ip_address || null,
                entry.user_agent || null,
                entry.error_message || null,
                entry.metadata ? JSON.stringify(entry.metadata) : null,
            ]);
        }
        catch (error) {
            console.error('Error logging audit entry:', error);
            // Don't throw - audit logging failure should not break the application
        }
    }
    /**
     * Get audit logs with filters
     */
    async getAuditLogs(filters = {}) {
        try {
            const { user_id, action, status, phone_number, days = 7, limit = 50, offset = 0 } = filters;
            let query = 'SELECT * FROM audit_logs WHERE created_at >= NOW() - INTERVAL \'$1 days\'';
            const params = [days];
            let paramIndex = 2;
            if (user_id) {
                query += ` AND user_id = $${paramIndex}`;
                params.push(user_id);
                paramIndex++;
            }
            if (action) {
                query += ` AND action = $${paramIndex}`;
                params.push(action);
                paramIndex++;
            }
            if (status) {
                query += ` AND status = $${paramIndex}`;
                params.push(status);
                paramIndex++;
            }
            if (phone_number) {
                query += ` AND phone_number = $${paramIndex}`;
                params.push(phone_number);
                paramIndex++;
            }
            // Count total
            const countQuery = `SELECT COUNT(*) as total FROM audit_logs WHERE created_at >= NOW() - INTERVAL '${days} days'`;
            const countResult = await database_1.default.query(countQuery);
            const total = parseInt(countResult.rows[0].total, 10);
            // Get paginated results
            query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(limit, offset);
            const result = await database_1.default.query(query, params);
            return {
                logs: result.rows,
                total,
            };
        }
        catch (error) {
            console.error('Error retrieving audit logs:', error);
            throw error;
        }
    }
    /**
     * Get logs for a specific user
     */
    async getUserAuditLogs(userId, limit = 100) {
        try {
            const result = await database_1.default.query(`SELECT * FROM audit_logs 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`, [userId, limit]);
            return result.rows;
        }
        catch (error) {
            console.error('Error retrieving user audit logs:', error);
            throw error;
        }
    }
    /**
     * Get logs for a specific phone number
     */
    async getPhoneAuditLogs(phoneNumber, limit = 100) {
        try {
            const result = await database_1.default.query(`SELECT * FROM audit_logs 
         WHERE phone_number = $1 
         ORDER BY created_at DESC 
         LIMIT $2`, [phoneNumber, limit]);
            return result.rows;
        }
        catch (error) {
            console.error('Error retrieving phone audit logs:', error);
            throw error;
        }
    }
    /**
     * Get logs for a specific action type
     */
    async getActionLogs(action, limit = 100) {
        try {
            const result = await database_1.default.query(`SELECT * FROM audit_logs 
         WHERE action = $1 
         ORDER BY created_at DESC 
         LIMIT $2`, [action, limit]);
            return result.rows;
        }
        catch (error) {
            console.error('Error retrieving action logs:', error);
            throw error;
        }
    }
    /**
     * Get failed login attempts for a phone number (for security)
     */
    async getFailedAttempts(phoneNumber, minutesBack = 30) {
        try {
            const result = await database_1.default.query(`SELECT COUNT(*) as count FROM audit_logs 
         WHERE phone_number = $1 
         AND status = 'failed'
         AND action IN ('send-otp', 'verify-otp')
         AND created_at >= NOW() - INTERVAL '${minutesBack} minutes'`, [phoneNumber]);
            return parseInt(result.rows[0].count, 10);
        }
        catch (error) {
            console.error('Error retrieving failed attempts:', error);
            return 0;
        }
    }
    /**
     * Clear old audit logs (retention policy)
     */
    async clearOldLogs(daysToKeep = 90) {
        try {
            const result = await database_1.default.query(`DELETE FROM audit_logs 
         WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'`);
            return result.rowCount || 0;
        }
        catch (error) {
            console.error('Error clearing old audit logs:', error);
            throw error;
        }
    }
}
exports.default = new AuditService();
