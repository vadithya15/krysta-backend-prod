"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDataAccess = exports.requireRole = exports.ROLES = void 0;
exports.getUserRole = getUserRole;
exports.getSalesOfficersUnderRM = getSalesOfficersUnderRM;
exports.canAccessUserData = canAccessUserData;
exports.getAccessFilterSQL = getAccessFilterSQL;
exports.getAccessibleUserIds = getAccessibleUserIds;
const database_1 = __importDefault(require("../config/database"));
// Role constants
exports.ROLES = {
    DIRECTOR: 'Director',
    REGIONAL_MANAGER: 'Regional Manager',
    AREA_MANAGER: 'Area Manager',
    MANAGER: 'Manager',
    SALES_OFFICER: 'Sales Officer',
    SALES_AGENT: 'Sales Agent',
    ADMIN: 'Admin',
};
const normalizeRole = (role) => String(role || '').trim().toLowerCase();
const hasFullAccessRole = (role) => {
    const normalized = normalizeRole(role);
    return normalized === 'admin' || normalized === 'superadmin' || normalized === 'director';
};
const hasHierarchyAccessRole = (role) => {
    const normalized = normalizeRole(role);
    return (normalized === normalizeRole(exports.ROLES.REGIONAL_MANAGER) ||
        normalized === normalizeRole(exports.ROLES.AREA_MANAGER) ||
        normalized === normalizeRole(exports.ROLES.MANAGER));
};
const getUserContext = async (userId) => {
    const result = await database_1.default.query(`SELECT r.name as role_name, u.organization_id
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE u.id = $1`, [userId]);
    if (result.rows.length === 0) {
        return { roleName: null, organizationId: null };
    }
    return {
        roleName: result.rows[0].role_name || null,
        organizationId: result.rows[0].organization_id || null,
    };
};
// Get user's role name from role_id
async function getUserRole(userId) {
    const { roleName } = await getUserContext(userId);
    return roleName;
}
// Get all sales officers under a regional manager (kept for backward compatibility)
async function getSalesOfficersUnderRM(regionalManagerId) {
    const userContext = await getUserContext(regionalManagerId);
    if (!userContext.organizationId)
        return [];
    const result = await database_1.default.query(`SELECT u.id
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE u.assigned_regional_manager_id = $1
       AND u.organization_id = $2
       AND u.is_active = true
       AND LOWER(COALESCE(r.name, '')) = LOWER($3)`, [regionalManagerId, userContext.organizationId, exports.ROLES.SALES_OFFICER]);
    return result.rows.map((row) => row.id);
}
const getHierarchyDescendants = async (userId, organizationId) => {
    const result = await database_1.default.query(`WITH RECURSIVE hierarchy AS (
       SELECT u.id
       FROM users u
       WHERE u.assigned_regional_manager_id = $1
         AND u.organization_id = $2
         AND u.is_active = true

       UNION

       SELECT u2.id
       FROM users u2
       INNER JOIN hierarchy h ON u2.assigned_regional_manager_id = h.id
       WHERE u2.organization_id = $2
         AND u2.is_active = true
     )
     SELECT DISTINCT id FROM hierarchy`, [userId, organizationId]);
    return result.rows.map((row) => row.id);
};
// Check if user can access another user's data
async function canAccessUserData(requestingUserId, targetUserId) {
    const accessibleUserIds = await getAccessibleUserIds(requestingUserId);
    return accessibleUserIds.includes(targetUserId);
}
// Get SQL WHERE clause for filtering data based on user role
async function getAccessFilterSQL(userId) {
    const accessibleUserIds = await getAccessibleUserIds(userId);
    if (accessibleUserIds.length === 0) {
        return { whereClause: 'WHERE 1=0', params: [] };
    }
    return {
        whereClause: 'WHERE user_id = ANY($1)',
        params: [accessibleUserIds],
    };
}
// Middleware to check if user has specific role
const requireRole = (...allowedRoles) => {
    return async (req, res, next) => {
        try {
            if (!req.user?.id) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const userRole = await getUserRole(req.user.id);
            if (!userRole || !allowedRoles.map(normalizeRole).includes(normalizeRole(userRole))) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'You do not have permission to access this resource',
                });
            }
            next();
        }
        catch (error) {
            console.error('Role check error:', error);
            res.status(500).json({ error: 'Server error during authorization' });
        }
    };
};
exports.requireRole = requireRole;
// Middleware to check if user can access specific data
const checkDataAccess = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const targetUserId = parseInt(req.params.userId || req.query.userId);
        if (isNaN(targetUserId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        const hasAccess = await canAccessUserData(req.user.id, targetUserId);
        if (!hasAccess) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'You do not have permission to access this data',
            });
        }
        next();
    }
    catch (error) {
        console.error('Data access check error:', error);
        res.status(500).json({ error: 'Server error during authorization' });
    }
};
exports.checkDataAccess = checkDataAccess;
// Get accessible user IDs for the current user based on reporting hierarchy
async function getAccessibleUserIds(userId) {
    const { roleName, organizationId } = await getUserContext(userId);
    if (!roleName || !organizationId)
        return [];
    // Admin/Director can view all active users in organization.
    if (hasFullAccessRole(roleName)) {
        const result = await database_1.default.query('SELECT id FROM users WHERE organization_id = $1 AND is_active = true', [organizationId]);
        return result.rows.map((row) => row.id);
    }
    // Hierarchy roles can view all descendants plus themselves.
    if (hasHierarchyAccessRole(roleName)) {
        const descendants = await getHierarchyDescendants(userId, organizationId);
        return Array.from(new Set([userId, ...descendants]));
    }
    // Sales Officer/Sales Agent and other leaf roles can view only own data.
    return [userId];
}
exports.default = {
    ROLES: exports.ROLES,
    getUserRole,
    getSalesOfficersUnderRM,
    canAccessUserData,
    getAccessFilterSQL,
    requireRole: exports.requireRole,
    checkDataAccess: exports.checkDataAccess,
    getAccessibleUserIds,
};
