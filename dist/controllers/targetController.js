"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTarget = exports.getTargetByType = exports.getAllTargets = exports.getUserTargets = exports.setUserTarget = void 0;
const database_1 = __importDefault(require("../config/database"));
const role_access_1 = require("../middleware/role-access");
// Create or update target for a user
// Note: 'sales' field represents the number of orders target, not monetary amount
const setUserTarget = async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const { collection_plan_old, collection_plan_new, abs, sales, target_type, target_month, target_date, } = req.body;
        if (!target_type || !['monthly', 'daily'].includes(target_type)) {
            return res.status(400).json({
                error: 'Invalid target type',
                message: 'target_type must be either "monthly" or "daily"',
            });
        }
        const dateValue = target_type === 'monthly' ? target_month : target_date;
        if (!dateValue) {
            return res.status(400).json({
                error: 'Missing date',
                message: `target_${target_type === 'monthly' ? 'month' : 'date'} is required`,
            });
        }
        // Check if target already exists for this user and period
        const checkQuery = `
      SELECT id FROM targets 
      WHERE user_id = $1 
      AND target_type = $2 
      AND ${target_type === 'monthly' ? 'target_month' : 'target_date'} = $3
    `;
        const checkResult = await database_1.default.query(checkQuery, [userId, target_type, dateValue]);
        let result;
        if (checkResult.rows.length > 0) {
            // Update existing target
            const updateQuery = `
        UPDATE targets 
        SET 
          collection_plan_old = $1,
          collection_plan_new = $2,
          abs = $3,
          sales = $4,
          updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `;
            result = await database_1.default.query(updateQuery, [
                collection_plan_old || 0,
                collection_plan_new || 0,
                abs || 0,
                sales || 0,
                checkResult.rows[0].id,
            ]);
        }
        else {
            // Create new target
            const insertQuery = `
        INSERT INTO targets (
          user_id,
          collection_plan_old,
          collection_plan_new,
          abs,
          sales,
          target_type,
          ${target_type === 'monthly' ? 'target_month' : 'target_date'},
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *
      `;
            result = await database_1.default.query(insertQuery, [
                userId,
                collection_plan_old || 0,
                collection_plan_new || 0,
                abs || 0,
                sales || 0,
                target_type,
                dateValue,
            ]);
        }
        const target = result.rows[0];
        res.json({
            message: 'Target set successfully',
            target: {
                ...target,
                collection_plan_old: Number(target.collection_plan_old || 0),
                collection_plan_new: Number(target.collection_plan_new || 0),
                abs: Number(target.abs || 0),
                sales: Number(target.sales || 0),
            },
        });
    }
    catch (error) {
        console.error('Set target error:', error);
        res.status(500).json({
            error: 'Failed to set target',
            message: error.message,
        });
    }
};
exports.setUserTarget = setUserTarget;
// Get targets for a user
const getUserTargets = async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const requesterId = req.user?.id;
        if (requesterId) {
            const accessibleUserIds = await (0, role_access_1.getAccessibleUserIds)(requesterId);
            if (!accessibleUserIds.includes(userId)) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'You do not have permission to access this user targets',
                });
            }
        }
        const query = `
      SELECT * FROM targets 
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
        const result = await database_1.default.query(query, [userId]);
        const targets = result.rows.map((target) => ({
            ...target,
            collection_plan_old: Number(target.collection_plan_old || 0),
            collection_plan_new: Number(target.collection_plan_new || 0),
            abs: Number(target.abs || 0),
            sales: Number(target.sales || 0),
        }));
        res.json({
            targets,
            total: result.rowCount,
        });
    }
    catch (error) {
        console.error('Get user targets error:', error);
        res.status(500).json({
            error: 'Failed to get targets',
            message: error.message,
        });
    }
};
exports.getUserTargets = getUserTargets;
// Get all targets (role-based access)
const getAllTargets = async (req, res) => {
    try {
        const userId = req.user?.id || req.userId;
        const { user_id, target_type, limit = 100, offset = 0 } = req.query;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Get accessible user IDs based on role
        const accessibleUserIds = await (0, role_access_1.getAccessibleUserIds)(userId);
        if (accessibleUserIds.length === 0) {
            return res.json({ targets: [], total: 0 });
        }
        let query = `
      SELECT t.*, u.name as user_name, u.email as user_email
      FROM targets t
      JOIN users u ON t.user_id = u.id
      WHERE t.user_id = ANY($1)
    `;
        const params = [accessibleUserIds];
        let paramIndex = 2;
        if (user_id) {
            // Additional filter by specific user_id (must be in accessible list)
            query += ` AND t.user_id = $${paramIndex}`;
            params.push(user_id);
            paramIndex++;
        }
        if (target_type && ['monthly', 'daily'].includes(target_type)) {
            query += ` AND t.target_type = $${paramIndex}`;
            params.push(target_type);
            paramIndex++;
        }
        query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);
        const result = await database_1.default.query(query, params);
        const targets = result.rows.map((target) => ({
            ...target,
            collection_plan_old: Number(target.collection_plan_old || 0),
            collection_plan_new: Number(target.collection_plan_new || 0),
            abs: Number(target.abs || 0),
            sales: Number(target.sales || 0),
        }));
        res.json({
            targets,
            total: result.rowCount,
        });
    }
    catch (error) {
        console.error('Get all targets error:', error);
        res.status(500).json({
            error: 'Failed to get targets',
            message: error.message,
        });
    }
};
exports.getAllTargets = getAllTargets;
// Get target by type for a user
const getTargetByType = async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const { type, date } = req.query;
        const requesterId = req.user?.id;
        if (requesterId) {
            const accessibleUserIds = await (0, role_access_1.getAccessibleUserIds)(requesterId);
            if (!accessibleUserIds.includes(userId)) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'You do not have permission to access this user target',
                });
            }
        }
        if (!type || !['monthly', 'daily'].includes(type)) {
            return res.status(400).json({
                error: 'Invalid type',
                message: 'type must be either "monthly" or "daily"',
            });
        }
        let query = `
      SELECT * FROM targets 
      WHERE user_id = $1 
      AND target_type = $2
    `;
        const params = [userId, type];
        if (type === 'monthly' && date) {
            // For monthly, format is YYYY-MM
            query += ` AND target_month = $3`;
            params.push(date);
        }
        else if (type === 'daily' && date) {
            // For daily, format is YYYY-MM-DD
            query += ` AND target_date = $3`;
            params.push(date);
        }
        const result = await database_1.default.query(query, params);
        const target = result.rows.length > 0
            ? {
                ...result.rows[0],
                collection_plan_old: Number(result.rows[0].collection_plan_old || 0),
                collection_plan_new: Number(result.rows[0].collection_plan_new || 0),
                abs: Number(result.rows[0].abs || 0),
                sales: Number(result.rows[0].sales || 0),
            }
            : null;
        res.json({
            target,
        });
    }
    catch (error) {
        console.error('Get target by type error:', error);
        res.status(500).json({
            error: 'Failed to get target',
            message: error.message,
        });
    }
};
exports.getTargetByType = getTargetByType;
// Delete target
const deleteTarget = async (req, res) => {
    try {
        const targetId = parseInt(req.params.targetId);
        const query = `
      DELETE FROM targets 
      WHERE id = $1
      RETURNING *
    `;
        const result = await database_1.default.query(query, [targetId]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Target not found',
            });
        }
        const target = result.rows[0];
        res.json({
            message: 'Target deleted successfully',
            target: {
                ...target,
                collection_plan_old: Number(target.collection_plan_old || 0),
                collection_plan_new: Number(target.collection_plan_new || 0),
                abs: Number(target.abs || 0),
                sales: Number(target.sales || 0),
            },
        });
    }
    catch (error) {
        console.error('Delete target error:', error);
        res.status(500).json({
            error: 'Failed to delete target',
            message: error.message,
        });
    }
};
exports.deleteTarget = deleteTarget;
