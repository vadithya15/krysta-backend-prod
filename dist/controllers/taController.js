"use strict";
/**
 * Travel Allowance (TA) Controller
 * Handles vehicle types and travel expense calculations
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveExpenses = exports.getUserExpenses = exports.getPendingExpensesByUser = exports.getExpenseSummary = exports.deleteTravelExpense = exports.getTravelExpenseById = exports.getTravelExpenses = exports.updateRoleDailyAllowance = exports.getRoleDailyAllowances = exports.getDailyAllowanceForCurrentUser = exports.updateTravelExpense = exports.createTravelExpense = exports.getVehicleTypeById = exports.getVehicleTypes = void 0;
const database_1 = __importDefault(require("../config/database"));
const roleAccess_1 = require("../middleware/roleAccess");
const getStandardDailyAllowanceByUserId = async (userId) => {
    const result = await database_1.default.query(`SELECT COALESCE(trda.allowance_amount, 0) AS daily_allowance
     FROM users u
     LEFT JOIN ta_role_daily_allowance trda ON trda.role_id = u.role_id
     WHERE u.id = $1`, [userId]);
    if (result.rows.length === 0) {
        return 0;
    }
    return parseFloat(result.rows[0].daily_allowance) || 0;
};
// Get all active vehicle types
const getVehicleTypes = async (req, res) => {
    try {
        const result = await database_1.default.query('SELECT id, vehicle_name, rate_per_km, description FROM vehicle_types WHERE is_active = true ORDER BY id');
        res.json({ vehicleTypes: result.rows });
    }
    catch (error) {
        console.error('Error fetching vehicle types:', error);
        res.status(500).json({ error: 'Failed to fetch vehicle types' });
    }
};
exports.getVehicleTypes = getVehicleTypes;
// Get vehicle type by ID
const getVehicleTypeById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query('SELECT id, vehicle_name, rate_per_km, description FROM vehicle_types WHERE id = $1 AND is_active = true', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vehicle type not found' });
        }
        res.json({ vehicleType: result.rows[0] });
    }
    catch (error) {
        console.error('Error fetching vehicle type:', error);
        res.status(500).json({ error: 'Failed to fetch vehicle type' });
    }
};
exports.getVehicleTypeById = getVehicleTypeById;
// Create travel expense claim
const createTravelExpense = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { vehicle_type_id, travel_date, distance_km, gps_km, rate_per_km, fuel_charges, parking_charges, other_expense, is_gps_based, is_manual_edit, remarks } = req.body;
        // Validate required fields
        if (!vehicle_type_id || !travel_date || distance_km === undefined || rate_per_km === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Validate positive values
        if (distance_km < 0 || rate_per_km < 0) {
            return res.status(400).json({ error: 'Distance and rate must be positive values' });
        }
        const fuelCharges = parseFloat(fuel_charges ?? 0) || 0;
        const parkingCharges = parseFloat(parking_charges ?? 0) || 0;
        const otherExpense = parseFloat(other_expense ?? 0) || 0;
        const dailyAllowance = await getStandardDailyAllowanceByUserId(userId);
        if (fuelCharges < 0 || parkingCharges < 0 || otherExpense < 0 || dailyAllowance < 0) {
            return res.status(400).json({ error: 'Additional charges must be positive values' });
        }
        // Calculate total amount from base TA + additional charges
        const baseAmount = parseFloat((distance_km * rate_per_km).toFixed(2));
        const calculatedAmount = parseFloat((baseAmount + fuelCharges + parkingCharges + otherExpense + dailyAllowance).toFixed(2));
        // Check daily KM limit
        const settings = await database_1.default.query("SELECT setting_value FROM settings WHERE setting_key = 'ta_max_daily_km'");
        const maxDailyKm = settings.rows[0]?.setting_value ? parseFloat(settings.rows[0].setting_value) : 500;
        if (distance_km > maxDailyKm) {
            return res.status(400).json({
                error: `Distance exceeds daily limit of ${maxDailyKm} km`
            });
        }
        // Check if expense already exists for this date
        const existing = await database_1.default.query('SELECT id FROM travel_expenses WHERE user_id = $1 AND travel_date = $2', [userId, travel_date]);
        if (existing.rows.length > 0) {
            return res.status(400).json({
                error: 'Travel expense already exists for this date. Please update the existing record.'
            });
        }
        // Insert travel expense
        const result = await database_1.default.query(`INSERT INTO travel_expenses 
        (user_id, vehicle_type_id, travel_date, distance_km, gps_km, rate_per_km, total_amount,
         fuel_charges, parking_charges, other_expense, daily_allowance,
         is_gps_based, is_manual_edit, remarks, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending')
      RETURNING *`, [
            userId,
            vehicle_type_id,
            travel_date,
            distance_km,
            gps_km,
            rate_per_km,
            calculatedAmount,
            fuelCharges,
            parkingCharges,
            otherExpense,
            dailyAllowance,
            is_gps_based,
            is_manual_edit,
            remarks
        ]);
        res.status(201).json({
            success: true,
            expense: result.rows[0],
            message: 'Travel expense created successfully'
        });
    }
    catch (error) {
        console.error('Error creating travel expense:', error);
        res.status(500).json({ error: 'Failed to create travel expense' });
    }
};
exports.createTravelExpense = createTravelExpense;
// Update travel expense
const updateTravelExpense = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id } = req.params;
        const { vehicle_type_id, distance_km, gps_km, rate_per_km, fuel_charges, parking_charges, other_expense, is_manual_edit, remarks, _resubmit } = req.body;
        // Check if expense exists and belongs to user
        const existing = await database_1.default.query('SELECT * FROM travel_expenses WHERE id = $1 AND user_id = $2', [id, userId]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Travel expense not found' });
        }
        // Check current status
        const currentStatus = existing.rows[0].status;
        // Check permissions based on status
        if (currentStatus === 'approved') {
            return res.status(400).json({ error: 'Cannot edit approved expenses' });
        }
        // If resubmitting from pending_modification, allow it
        // If already pending and trying to edit, allow it
        // If rejected, don't allow editing
        if (currentStatus === 'rejected') {
            return res.status(400).json({ error: 'Cannot edit rejected expenses' });
        }
        const nextFuelCharges = fuel_charges !== undefined ? (parseFloat(fuel_charges) || 0) : (parseFloat(existing.rows[0].fuel_charges ?? 0) || 0);
        const nextParkingCharges = parking_charges !== undefined ? (parseFloat(parking_charges) || 0) : (parseFloat(existing.rows[0].parking_charges ?? 0) || 0);
        const nextOtherExpense = other_expense !== undefined ? (parseFloat(other_expense) || 0) : (parseFloat(existing.rows[0].other_expense ?? 0) || 0);
        const nextDailyAllowance = await getStandardDailyAllowanceByUserId(userId);
        if (nextFuelCharges < 0 || nextParkingCharges < 0 || nextOtherExpense < 0 || nextDailyAllowance < 0) {
            return res.status(400).json({ error: 'Additional charges must be positive values' });
        }
        // Calculate new total
        const newDistance = distance_km !== undefined ? distance_km : existing.rows[0].distance_km;
        const newRate = rate_per_km !== undefined ? rate_per_km : existing.rows[0].rate_per_km;
        if (!Number.isFinite(Number(newDistance)) || !Number.isFinite(Number(newRate))) {
            return res.status(400).json({ error: 'Distance and rate must be valid numbers' });
        }
        if (Number(newDistance) < 0 || Number(newRate) < 0) {
            return res.status(400).json({ error: 'Distance and rate must be positive values' });
        }
        const newBaseAmount = parseFloat((newDistance * newRate).toFixed(2));
        const calculatedAmount = parseFloat((newBaseAmount + nextFuelCharges + nextParkingCharges + nextOtherExpense + nextDailyAllowance).toFixed(2));
        // Determine new status
        let newStatus = currentStatus; // Keep current status by default
        let modificationReason = existing.rows[0].modification_reason; // Keep existing modification reason
        // If resubmitting from pending_modification, change status back to pending
        if (_resubmit && currentStatus === 'pending_modification') {
            newStatus = 'pending';
            // Clear modification fields when resubmitting
            modificationReason = null;
        }
        // Update expense
        const result = await database_1.default.query(`UPDATE travel_expenses 
      SET vehicle_type_id = COALESCE($1, vehicle_type_id),
          distance_km = COALESCE($2, distance_km),
          gps_km = COALESCE($3, gps_km),
          rate_per_km = COALESCE($4, rate_per_km),
          total_amount = $5,
          fuel_charges = COALESCE($6, fuel_charges),
          parking_charges = COALESCE($7, parking_charges),
          other_expense = COALESCE($8, other_expense),
          daily_allowance = COALESCE($9, daily_allowance),
          is_manual_edit = COALESCE($10, is_manual_edit),
          remarks = COALESCE($11, remarks),
          status = $13,
          modification_reason = $14,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $12 AND user_id = $15
      RETURNING *`, [
            vehicle_type_id,
            distance_km,
            gps_km,
            rate_per_km,
            calculatedAmount,
            fuel_charges,
            parking_charges,
            other_expense,
            nextDailyAllowance,
            is_manual_edit,
            remarks,
            id,
            newStatus,
            modificationReason,
            userId
        ]);
        res.json({
            success: true,
            expense: result.rows[0],
            message: _resubmit && currentStatus === 'pending_modification'
                ? 'Travel expense resubmitted for approval'
                : 'Travel expense updated successfully'
        });
    }
    catch (error) {
        console.error('Error updating travel expense:', error);
        res.status(500).json({ error: 'Failed to update travel expense' });
    }
};
exports.updateTravelExpense = updateTravelExpense;
// Get standard daily allowance for current user based on role
const getDailyAllowanceForCurrentUser = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const result = await database_1.default.query(`SELECT
          r.id AS role_id,
          r.name AS role_name,
          COALESCE(trda.allowance_amount, 0) AS daily_allowance
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN ta_role_daily_allowance trda ON trda.role_id = r.id
       WHERE u.id = $1`, [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const row = result.rows[0];
        res.json({
            role_id: row.role_id,
            role_name: row.role_name,
            daily_allowance: parseFloat(row.daily_allowance) || 0,
        });
    }
    catch (error) {
        console.error('Error fetching daily allowance:', error);
        res.status(500).json({ error: 'Failed to fetch daily allowance' });
    }
};
exports.getDailyAllowanceForCurrentUser = getDailyAllowanceForCurrentUser;
// Get role-wise daily allowance master data
const getRoleDailyAllowances = async (req, res) => {
    try {
        const result = await database_1.default.query(`SELECT
          r.id AS role_id,
          r.name AS role_name,
          COALESCE(trda.allowance_amount, 0) AS allowance_amount
       FROM roles r
       LEFT JOIN ta_role_daily_allowance trda ON trda.role_id = r.id
       ORDER BY r.name ASC`);
        res.json({ allowances: result.rows.map((row) => ({
                role_id: row.role_id,
                role_name: row.role_name,
                allowance_amount: parseFloat(row.allowance_amount) || 0,
            })) });
    }
    catch (error) {
        console.error('Error fetching role daily allowances:', error);
        res.status(500).json({ error: 'Failed to fetch role daily allowances' });
    }
};
exports.getRoleDailyAllowances = getRoleDailyAllowances;
// Update role-wise daily allowance (admin only)
const updateRoleDailyAllowance = async (req, res) => {
    try {
        const { roleId } = req.params;
        const { allowance_amount } = req.body;
        const parsedRoleId = parseInt(roleId, 10);
        if (Number.isNaN(parsedRoleId)) {
            return res.status(400).json({ error: 'Invalid role ID' });
        }
        const allowanceAmount = parseFloat(allowance_amount);
        if (Number.isNaN(allowanceAmount) || allowanceAmount < 0) {
            return res.status(400).json({ error: 'allowance_amount must be a non-negative number' });
        }
        const roleExists = await database_1.default.query('SELECT id, name FROM roles WHERE id = $1', [parsedRoleId]);
        if (roleExists.rows.length === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }
        await database_1.default.query(`INSERT INTO ta_role_daily_allowance (role_id, allowance_amount)
       VALUES ($1, $2)
       ON CONFLICT (role_id)
       DO UPDATE SET allowance_amount = EXCLUDED.allowance_amount, updated_at = CURRENT_TIMESTAMP`, [parsedRoleId, allowanceAmount]);
        res.json({
            success: true,
            role_id: parsedRoleId,
            role_name: roleExists.rows[0].name,
            allowance_amount: allowanceAmount,
            message: 'Role daily allowance updated successfully',
        });
    }
    catch (error) {
        console.error('Error updating role daily allowance:', error);
        res.status(500).json({ error: 'Failed to update role daily allowance' });
    }
};
exports.updateRoleDailyAllowance = updateRoleDailyAllowance;
// Get user's travel expenses
const getTravelExpenses = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { start_date, end_date, status } = req.query;
        let query = `
      SELECT te.*, vt.vehicle_name, vt.description as vehicle_description,
             u.name as user_name, u.email as user_email,
             mu.name as modification_requested_by_name
      FROM travel_expenses te
      JOIN vehicle_types vt ON te.vehicle_type_id = vt.id
      JOIN users u ON te.user_id = u.id
      LEFT JOIN users mu ON te.modification_requested_by = mu.id
      WHERE te.user_id = $1
    `;
        const params = [userId];
        if (start_date) {
            params.push(start_date);
            query += ` AND te.travel_date >= $${params.length}`;
        }
        if (end_date) {
            params.push(end_date);
            query += ` AND te.travel_date <= $${params.length}`;
        }
        if (status) {
            params.push(status);
            query += ` AND te.status = $${params.length}`;
        }
        query += ' ORDER BY te.travel_date DESC, te.created_at DESC';
        const result = await database_1.default.query(query, params);
        res.json({ expenses: result.rows });
    }
    catch (error) {
        console.error('Error fetching travel expenses:', error);
        res.status(500).json({ error: 'Failed to fetch travel expenses' });
    }
};
exports.getTravelExpenses = getTravelExpenses;
// Get travel expense by ID
const getTravelExpenseById = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id } = req.params;
        const result = await database_1.default.query(`SELECT te.*, vt.vehicle_name, vt.description as vehicle_description,
              u.name as user_name, u.email as user_email,
              mu.name as modification_requested_by_name
       FROM travel_expenses te
       JOIN vehicle_types vt ON te.vehicle_type_id = vt.id
       JOIN users u ON te.user_id = u.id
       LEFT JOIN users mu ON te.modification_requested_by = mu.id
       WHERE te.id = $1 AND te.user_id = $2`, [id, userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Travel expense not found' });
        }
        res.json({ expense: result.rows[0] });
    }
    catch (error) {
        console.error('Error fetching travel expense:', error);
        res.status(500).json({ error: 'Failed to fetch travel expense' });
    }
};
exports.getTravelExpenseById = getTravelExpenseById;
// Delete travel expense
const deleteTravelExpense = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id } = req.params;
        // Check if expense exists and belongs to user
        const existing = await database_1.default.query('SELECT status FROM travel_expenses WHERE id = $1 AND user_id = $2', [id, userId]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Travel expense not found' });
        }
        // Don't allow deleting approved expenses
        if (existing.rows[0].status === 'approved') {
            return res.status(400).json({ error: 'Cannot delete approved expenses' });
        }
        await database_1.default.query('DELETE FROM travel_expenses WHERE id = $1 AND user_id = $2', [id, userId]);
        res.json({
            success: true,
            message: 'Travel expense deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting travel expense:', error);
        res.status(500).json({ error: 'Failed to delete travel expense' });
    }
};
exports.deleteTravelExpense = deleteTravelExpense;
// Get expense summary
const getExpenseSummary = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { start_date, end_date } = req.query;
        let query = `
      SELECT 
        COUNT(*) as total_claims,
        SUM(distance_km) as total_km,
        SUM(total_amount) as total_amount,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_claims,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_claims,
        SUM(CASE WHEN status = 'approved' THEN total_amount ELSE 0 END) as approved_amount
      FROM travel_expenses
      WHERE user_id = $1
    `;
        const params = [userId];
        if (start_date) {
            params.push(start_date);
            query += ` AND travel_date >= $${params.length}`;
        }
        if (end_date) {
            params.push(end_date);
            query += ` AND travel_date <= $${params.length}`;
        }
        const result = await database_1.default.query(query, params);
        res.json({ summary: result.rows[0] });
    }
    catch (error) {
        console.error('Error fetching expense summary:', error);
        res.status(500).json({ error: 'Failed to fetch expense summary' });
    }
};
exports.getExpenseSummary = getExpenseSummary;
// Get pending expenses grouped by user (for approvers)
const getPendingExpensesByUser = async (req, res) => {
    try {
        const approverId = req.user?.id;
        if (!approverId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const accessibleUserIds = await (0, roleAccess_1.getAccessibleUserIds)(approverId);
        if (accessibleUserIds.length === 0) {
            return res.json({ users: [] });
        }
        // Get all users with pending expenses (including pending_modification)
        const result = await database_1.default.query(`SELECT 
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        COUNT(te.id) as expense_count,
        SUM(te.total_amount) as total_amount,
        MIN(te.travel_date) as earliest_date,
        MAX(te.travel_date) as latest_date
      FROM users u
      INNER JOIN travel_expenses te ON u.id = te.user_id
      WHERE te.status IN ('pending', 'pending_modification')
        AND te.user_id = ANY($1)
      GROUP BY u.id, u.name, u.email
      ORDER BY total_amount DESC, user_name ASC`, [accessibleUserIds]);
        res.json({ users: result.rows });
    }
    catch (error) {
        console.error('Error fetching pending expenses by user:', error);
        res.status(500).json({ error: 'Failed to fetch pending expenses' });
    }
};
exports.getPendingExpensesByUser = getPendingExpensesByUser;
// Get all expenses for a specific user (for approvers)
const getUserExpenses = async (req, res) => {
    try {
        const approverId = req.user?.id;
        if (!approverId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { userId } = req.params;
        const { status } = req.query;
        const targetUserId = parseInt(userId);
        if (Number.isNaN(targetUserId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        const accessibleUserIds = await (0, roleAccess_1.getAccessibleUserIds)(approverId);
        if (!accessibleUserIds.includes(targetUserId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        let query = `
      SELECT te.*, vt.vehicle_name, vt.description as vehicle_description,
             u.name as user_name, u.email as user_email,
             mu.name as modification_requested_by_name
      FROM travel_expenses te
      JOIN vehicle_types vt ON te.vehicle_type_id = vt.id
      JOIN users u ON te.user_id = u.id
      LEFT JOIN users mu ON te.modification_requested_by = mu.id
      WHERE te.user_id = $1
    `;
        const params = [targetUserId];
        if (status) {
            params.push(status);
            query += ` AND te.status = $${params.length}`;
        }
        query += ' ORDER BY te.travel_date DESC, te.created_at DESC';
        const result = await database_1.default.query(query, params);
        res.json({ expenses: result.rows });
    }
    catch (error) {
        console.error('Error fetching user expenses:', error);
        res.status(500).json({ error: 'Failed to fetch user expenses' });
    }
};
exports.getUserExpenses = getUserExpenses;
// Approve or reject expenses (bulk operation)
const approveExpenses = async (req, res) => {
    try {
        const approverId = req.user?.id;
        if (!approverId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { expense_ids, action, reason } = req.body; // action: 'approve', 'reject', or 'modify'
        if (!expense_ids || !Array.isArray(expense_ids) || expense_ids.length === 0) {
            return res.status(400).json({ error: 'expense_ids array is required' });
        }
        if (!['approve', 'reject', 'modify'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action. Must be "approve", "reject", or "modify"' });
        }
        // Validate reason is provided for modify action
        if (action === 'modify' && (!reason || reason.trim() === '')) {
            return res.status(400).json({ error: 'Reason is required for modify action' });
        }
        let newStatus;
        if (action === 'approve') {
            newStatus = 'approved';
        }
        else if (action === 'reject') {
            newStatus = 'rejected';
        }
        else {
            newStatus = 'pending_modification';
        }
        // Build query based on action
        let query = `
      UPDATE travel_expenses 
      SET status = $1,
          approved_by = $2,
          approved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP`;
        let params = [newStatus, approverId, expense_ids];
        if (action === 'modify') {
            query += `,
          modification_reason = $4,
          modification_requested_by = $2,
          modification_requested_at = CURRENT_TIMESTAMP`;
            params = [newStatus, approverId, expense_ids, reason.trim()];
        }
        query += `
      WHERE id = ANY($3::int[]) AND status = 'pending'
      RETURNING id, user_id, total_amount, status`;
        // Update expenses
        const result = await database_1.default.query(query, params);
        const updatedCount = result.rows.length;
        if (updatedCount === 0) {
            return res.status(404).json({
                error: 'No pending expenses found with the provided IDs'
            });
        }
        res.json({
            success: true,
            message: action === 'modify'
                ? `Successfully sent ${updatedCount} expense(s) back for modification`
                : `Successfully ${action}d ${updatedCount} expense(s)`,
            updated_expenses: result.rows
        });
    }
    catch (error) {
        console.error('Error approving expenses:', error);
        res.status(500).json({ error: 'Failed to approve expenses' });
    }
};
exports.approveExpenses = approveExpenses;
