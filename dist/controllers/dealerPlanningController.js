"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteDealerPlan = exports.updateDealerPlan = exports.createDealerPlan = exports.getDealerPlans = void 0;
const database_1 = __importDefault(require("../config/database"));
const cache_1 = require("../utils/cache");
/**
 * Invalidate route cache for a given user and plan_date
 * Called whenever dealer plan is created/updated/deleted
 */
async function invalidateRouteCacheForPlan(user_id, plan_date) {
    try {
        // Delete from database
        const deleteResult = await database_1.default.query(`DELETE FROM planned_routes WHERE user_id = $1 AND plan_date = $2`, [user_id, plan_date]);
        // Clear from in-memory cache
        const cacheKeyPattern = `route:${user_id}:${plan_date}:`;
        const deletedCount = cache_1.routeCache.deleteByPattern(cacheKeyPattern);
        console.log(`🗑️ Invalidated route cache: ${deleteResult.rowCount} DB rows + ${deletedCount} memory entries for user=${user_id}, date=${plan_date}`);
    }
    catch (error) {
        console.error('Error invalidating route cache:', error);
        // Don't throw - cache invalidation failure shouldn't block plan operations
    }
}
// Get all dealer plans for a user/date
const getDealerPlans = async (req, res) => {
    try {
        const { user_id, date } = req.query;
        const requestedUserId = user_id != null ? Number(user_id) : null;
        const authenticatedUserId = req.user?.id ? Number(req.user.id) : null;
        const effectiveUserId = Number.isFinite(requestedUserId) ? requestedUserId : authenticatedUserId;
        let where = [];
        let params = [];
        if (effectiveUserId != null) {
            where.push(`user_id = $${params.length + 1}`);
            params.push(effectiveUserId);
        }
        if (date) {
            where.push(`plan_date = $${params.length + 1}::date`);
            params.push(date);
        }
        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const result = await database_1.default.query(`SELECT dp.*, d.name AS dealer_name, d.address AS dealer_address, d.phone AS dealer_phone,
              d.latitude AS latitude, d.longitude AS longitude
       FROM dealer_plans dp
       LEFT JOIN dealers d ON d.id = dp.dealer_id
       ${whereClause}
       ORDER BY dp.plan_date DESC`, params);
        res.json({ plans: result.rows });
    }
    catch (error) {
        console.error('Get dealer plans error:', error);
        res.status(500).json({ error: 'Server error fetching dealer plans' });
    }
};
exports.getDealerPlans = getDealerPlans;
// Create a new dealer plan
const createDealerPlan = async (req, res) => {
    try {
        const { user_id, dealer_id, plan_date, notes } = req.body;
        if (!user_id || !dealer_id || !plan_date) {
            return res.status(400).json({ error: 'user_id, dealer_id, and plan_date are required' });
        }
        // Get max waypoints setting from settings table
        const settingResult = await database_1.default.query(`SELECT setting_value FROM settings WHERE setting_key = 'route_max_waypoints' LIMIT 1`);
        const maxWaypoints = settingResult.rows.length > 0
            ? parseInt(settingResult.rows[0].setting_value, 10)
            : 20; // Default to 20 if setting not found (to avoid route optimization issues)
        // Count existing plans for this user and date
        const countResult = await database_1.default.query(`SELECT COUNT(*) as count FROM dealer_plans WHERE user_id = $1 AND plan_date = $2`, [user_id, plan_date]);
        const existingCount = parseInt(countResult.rows[0].count, 10);
        // Check if adding this plan would exceed the limit
        if (existingCount >= maxWaypoints) {
            return res.status(400).json({
                code: 'MAX_DEALERS_EXCEEDED',
                error: `Maximum ${maxWaypoints} dealers allowed per day`,
                maxWaypoints
            });
        }
        const result = await database_1.default.query(`INSERT INTO dealer_plans (user_id, dealer_id, plan_date, notes) VALUES ($1, $2, $3, $4) RETURNING *`, [user_id, dealer_id, plan_date, notes || null]);
        // EVENT-DRIVEN INVALIDATION: Invalidate route cache when plan is added
        await invalidateRouteCacheForPlan(user_id, plan_date);
        res.status(201).json({ message: 'Dealer plan created', plan: result.rows[0] });
    }
    catch (error) {
        console.error('Create dealer plan error:', error);
        res.status(500).json({ error: 'Server error creating dealer plan' });
    }
};
exports.createDealerPlan = createDealerPlan;
// Update a dealer plan
const updateDealerPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { plan_date, notes } = req.body;
        // Get existing plan to find user_id and old plan_date
        const existingResult = await database_1.default.query(`SELECT user_id, plan_date FROM dealer_plans WHERE id = $1`, [id]);
        if (existingResult.rows.length === 0) {
            return res.status(404).json({ error: 'Dealer plan not found' });
        }
        const { user_id, plan_date: oldPlanDate } = existingResult.rows[0];
        const result = await database_1.default.query(`UPDATE dealer_plans SET plan_date = $1, notes = $2 WHERE id = $3 RETURNING *`, [plan_date, notes, id]);
        // EVENT-DRIVEN INVALIDATION: Invalidate route cache for affected dates
        // Invalidate old date (if it changed)
        if (plan_date !== oldPlanDate) {
            await invalidateRouteCacheForPlan(user_id, oldPlanDate);
        }
        // Always invalidate new date
        await invalidateRouteCacheForPlan(user_id, plan_date);
        res.json({ message: 'Dealer plan updated', plan: result.rows[0] });
    }
    catch (error) {
        console.error('Update dealer plan error:', error);
        res.status(500).json({ error: 'Server error updating dealer plan' });
    }
};
exports.updateDealerPlan = updateDealerPlan;
// Delete a dealer plan
const deleteDealerPlan = async (req, res) => {
    try {
        const { id } = req.params;
        // Get plan details before deletion for cache invalidation
        const planResult = await database_1.default.query(`SELECT user_id, plan_date FROM dealer_plans WHERE id = $1`, [id]);
        if (planResult.rows.length === 0) {
            return res.status(404).json({ error: 'Dealer plan not found' });
        }
        const { user_id, plan_date } = planResult.rows[0];
        const result = await database_1.default.query(`DELETE FROM dealer_plans WHERE id = $1 RETURNING *`, [id]);
        // EVENT-DRIVEN INVALIDATION: Invalidate route cache when plan is removed
        await invalidateRouteCacheForPlan(user_id, plan_date);
        res.json({ message: 'Dealer plan deleted' });
    }
    catch (error) {
        console.error('Delete dealer plan error:', error);
        res.status(500).json({ error: 'Server error deleting dealer plan' });
    }
};
exports.deleteDealerPlan = deleteDealerPlan;
