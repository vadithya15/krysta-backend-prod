"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyReporteesCount = exports.getAllRoles = exports.getUserRegions = exports.deleteUser = exports.updateUser = exports.createUser = exports.getUserById = exports.getAllUsers = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = __importDefault(require("../config/database"));
const role_access_1 = require("../middleware/role-access");
const hasTableColumn = async (tableName, columnName) => {
    const result = await database_1.default.query(`SELECT 1
     FROM information_schema.columns
     WHERE table_name = $1 AND column_name = $2
     LIMIT 1`, [tableName, columnName]);
    return result.rows.length > 0;
};
const findRoleByName = async (roleName, organizationId) => {
    const hasRoleOrgColumn = await hasTableColumn('roles', 'organization_id');
    if (hasRoleOrgColumn) {
        return database_1.default.query('SELECT id, name FROM roles WHERE LOWER(name) = LOWER($1) AND organization_id = $2', [roleName, organizationId]);
    }
    return database_1.default.query('SELECT id, name FROM roles WHERE LOWER(name) = LOWER($1)', [roleName]);
};
/**
 * Get all users with pagination and filters
 */
const getAllUsers = async (req, res) => {
    try {
        const organizationId = req.organization?.id;
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization context required' });
        }
        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        // Filter parameters
        const search = req.query.search;
        const role = req.query.role;
        const is_active = req.query.is_active;
        // Build WHERE conditions
        let whereConditions = ['u.organization_id = $1'];
        let queryParams = [organizationId];
        let paramIndex = 2;
        const requesterId = req.user?.id;
        if (requesterId) {
            const accessibleUserIds = await (0, role_access_1.getAccessibleUserIds)(requesterId);
            if (accessibleUserIds.length === 0) {
                return res.json({
                    data: [],
                    pagination: {
                        total: 0,
                        page,
                        limit,
                        pages: 0,
                    },
                });
            }
            whereConditions.push(`u.id = ANY($${paramIndex})`);
            queryParams.push(accessibleUserIds);
            paramIndex++;
        }
        if (search) {
            whereConditions.push(`(u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }
        if (role) {
            whereConditions.push(`r.name = $${paramIndex}`);
            queryParams.push(role);
            paramIndex++;
        }
        if (is_active !== undefined) {
            whereConditions.push(`u.is_active = $${paramIndex}`);
            queryParams.push(is_active === 'true');
            paramIndex++;
        }
        const whereClause = whereConditions.join(' AND ');
        // Get total count
        const countResult = await database_1.default.query(`SELECT COUNT(*) as count 
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE ${whereClause}`, queryParams);
        const total = parseInt(countResult.rows[0].count);
        // Get paginated users
        const result = await database_1.default.query(`SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.organization_id,
        u.is_active,
        u.created_at,
        u.hierarchy_level,
        u.assigned_regional_manager_id,
        r.name as role,
        r.id as role_id,
        mgr.name as manager_name,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object('id', r2.id, 'name', r2.name)
              ORDER BY r2.name
            )
            FROM user_regions ur2
            INNER JOIN regions r2 ON r2.id = ur2.region_id
            WHERE ur2.user_id = u.id
          ),
          '[]'::json
        ) as regions
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN users mgr ON u.assigned_regional_manager_id = mgr.id
       WHERE ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, [...queryParams, limit, offset]);
        const usersWithFlags = result.rows.map((user) => ({
            ...user,
            is_director_locked: String(user.role || '').toLowerCase() === 'director',
        }));
        res.json({
            data: usersWithFlags,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to fetch users'
        });
    }
};
exports.getAllUsers = getAllUsers;
/**
 * Get a single user by ID
 */
const getUserById = async (req, res) => {
    try {
        const organizationId = req.organization?.id;
        const { id } = req.params;
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization context required' });
        }
        const requesterId = req.user?.id;
        if (requesterId) {
            const accessibleUserIds = await (0, role_access_1.getAccessibleUserIds)(requesterId);
            const targetId = parseInt(id, 10);
            if (!Number.isNaN(targetId) && !accessibleUserIds.includes(targetId)) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'You do not have permission to access this user',
                });
            }
        }
        const result = await database_1.default.query(`SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.organization_id,
        u.is_active,
        u.created_at,
        u.hierarchy_level,
        u.assigned_regional_manager_id,
        r.name as role,
        r.id as role_id,
        mgr.name as manager_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN users mgr ON u.assigned_regional_manager_id = mgr.id
       WHERE u.id = $1 AND u.organization_id = $2`, [id, organizationId]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: 'User not found'
            });
        }
        const user = result.rows[0];
        // Fetch assigned regions
        const regionsResult = await database_1.default.query(`SELECT r.id, r.name FROM regions r
       INNER JOIN user_regions ur ON r.id = ur.region_id
       WHERE ur.user_id = $1`, [id]);
        // Fetch assigned areas
        const areasResult = await database_1.default.query(`SELECT a.id, a.name FROM areas a
       INNER JOIN user_areas ua ON a.id = ua.area_id
       WHERE ua.user_id = $1`, [id]);
        res.json({
            data: {
                ...user,
                regions: regionsResult.rows,
                areas: areasResult.rows,
                is_director_locked: String(user.role || '').toLowerCase() === 'director',
            },
        });
    }
    catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to fetch user'
        });
    }
};
exports.getUserById = getUserById;
/**
 * Create a new user
 */
const createUser = async (req, res) => {
    try {
        const organizationId = req.organization?.id;
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization context required' });
        }
        const { name, email, phone, password, role, hierarchy_level, assigned_regional_manager_id, region_ids, area_ids } = req.body;
        // Validate required fields
        if (!name || !email || !phone || !password || !role) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Name, email, phone, password, and role are required'
            });
        }
        // Check if user already exists
        const existingUser = await database_1.default.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                error: 'Conflict',
                message: 'User with this email already exists'
            });
        }
        // Get role_id from role name
        const roleResult = await findRoleByName(role, organizationId);
        if (roleResult.rows.length === 0) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Invalid role'
            });
        }
        const roleId = roleResult.rows[0].id;
        const resolvedRoleName = String(roleResult.rows[0].name || role);
        const isDirectorRole = resolvedRoleName.toLowerCase() === 'director';
        const effectiveHierarchyLevel = isDirectorRole ? 1 : (hierarchy_level || 0);
        const effectiveManagerId = isDirectorRole ? null : (assigned_regional_manager_id || null);
        const effectiveRegionIds = isDirectorRole ? [] : (Array.isArray(region_ids) ? region_ids : []);
        const effectiveAreaIds = Array.isArray(area_ids) ? area_ids : [];
        // Hash password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Insert user
        const result = await database_1.default.query(`INSERT INTO users (name, email, phone, password, role_id, organization_id, hierarchy_level, assigned_regional_manager_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
       RETURNING id, name, email, phone, organization_id, is_active, created_at, hierarchy_level, assigned_regional_manager_id`, [name, email, phone, hashedPassword, roleId, organizationId, effectiveHierarchyLevel, effectiveManagerId]);
        const newUser = result.rows[0];
        // Assign regions if provided
        if (effectiveRegionIds.length > 0) {
            for (const regionId of effectiveRegionIds) {
                await database_1.default.query('INSERT INTO user_regions (user_id, region_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [newUser.id, regionId]);
            }
        }
        // Assign areas if provided
        if (effectiveAreaIds.length > 0) {
            for (const areaId of effectiveAreaIds) {
                await database_1.default.query('INSERT INTO user_areas (user_id, area_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [newUser.id, areaId]);
            }
        }
        // Fetch assigned regions
        const regionsResult = await database_1.default.query(`SELECT r.id, r.name FROM regions r
       INNER JOIN user_regions ur ON r.id = ur.region_id
       WHERE ur.user_id = $1`, [newUser.id]);
        // Fetch assigned areas
        const areasResult = await database_1.default.query(`SELECT a.id, a.name FROM areas a
       INNER JOIN user_areas ua ON a.id = ua.area_id
       WHERE ua.user_id = $1`, [newUser.id]);
        res.status(201).json({
            data: {
                ...newUser,
                role: resolvedRoleName,
                role_id: roleId,
                regions: regionsResult.rows,
                areas: areasResult.rows,
                is_director_locked: isDirectorRole,
            },
            message: 'User created successfully',
        });
    }
    catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to create user'
        });
    }
};
exports.createUser = createUser;
/**
 * Update an existing user
 */
const updateUser = async (req, res) => {
    try {
        const organizationId = req.organization?.id;
        const { id } = req.params;
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization context required' });
        }
        const { name, email, phone, role, hierarchy_level, is_active, assigned_regional_manager_id, region_ids, area_ids } = req.body;
        // Check if user exists and belongs to organization
        const existingUser = await database_1.default.query(`SELECT u.id, r.name as current_role
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1 AND u.organization_id = $2`, [id, organizationId]);
        if (existingUser.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: 'User not found'
            });
        }
        const targetRoleName = String(role ?? existingUser.rows[0].current_role ?? '');
        const isDirectorTargetRole = targetRoleName.toLowerCase() === 'director';
        // Build update query dynamically
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;
        if (name !== undefined) {
            updateFields.push(`name = $${paramIndex}`);
            updateValues.push(name);
            paramIndex++;
        }
        if (email !== undefined) {
            updateFields.push(`email = $${paramIndex}`);
            updateValues.push(email);
            paramIndex++;
        }
        if (phone !== undefined) {
            updateFields.push(`phone = $${paramIndex}`);
            updateValues.push(phone);
            paramIndex++;
        }
        if (!isDirectorTargetRole && hierarchy_level !== undefined) {
            updateFields.push(`hierarchy_level = $${paramIndex}`);
            updateValues.push(hierarchy_level);
            paramIndex++;
        }
        if (is_active !== undefined) {
            updateFields.push(`is_active = $${paramIndex}`);
            updateValues.push(is_active);
            paramIndex++;
        }
        if (!isDirectorTargetRole && assigned_regional_manager_id !== undefined) {
            updateFields.push(`assigned_regional_manager_id = $${paramIndex}`);
            updateValues.push(assigned_regional_manager_id || null);
            paramIndex++;
        }
        // Handle role update
        let roleId;
        if (role !== undefined) {
            const roleResult = await findRoleByName(role, organizationId);
            if (roleResult.rows.length === 0) {
                return res.status(400).json({
                    error: 'Validation error',
                    message: 'Invalid role'
                });
            }
            roleId = roleResult.rows[0].id;
            updateFields.push(`role_id = $${paramIndex}`);
            updateValues.push(roleId);
            paramIndex++;
        }
        // Director users must always be level 1 and have no reporting manager
        if (isDirectorTargetRole) {
            updateFields.push(`hierarchy_level = $${paramIndex}`);
            updateValues.push(1);
            paramIndex++;
            updateFields.push(`assigned_regional_manager_id = $${paramIndex}`);
            updateValues.push(null);
            paramIndex++;
        }
        if (updateFields.length === 0) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'No fields to update'
            });
        }
        // Add id to the values
        updateValues.push(id);
        // Execute update
        const result = await database_1.default.query(`UPDATE users 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, name, email, phone, organization_id, is_active, created_at, hierarchy_level, role_id`, updateValues);
        const updatedUser = result.rows[0];
        // Update regions if provided
        const shouldUpdateRegions = isDirectorTargetRole || region_ids !== undefined;
        const finalRegionIds = isDirectorTargetRole ? [] : (Array.isArray(region_ids) ? region_ids : []);
        if (shouldUpdateRegions) {
            // Clear existing regions
            await database_1.default.query('DELETE FROM user_regions WHERE user_id = $1', [id]);
            // Add new regions
            if (finalRegionIds.length > 0) {
                for (const regionId of finalRegionIds) {
                    await database_1.default.query('INSERT INTO user_regions (user_id, region_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, regionId]);
                }
            }
        }
        // Update areas if provided
        if (area_ids !== undefined) {
            const finalAreaIds = Array.isArray(area_ids) ? area_ids : [];
            // Clear existing areas
            await database_1.default.query('DELETE FROM user_areas WHERE user_id = $1', [id]);
            // Add new areas
            if (finalAreaIds.length > 0) {
                for (const areaId of finalAreaIds) {
                    await database_1.default.query('INSERT INTO user_areas (user_id, area_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, areaId]);
                }
            }
        }
        // Get role name
        const updatedRoleResult = await database_1.default.query('SELECT name FROM roles WHERE id = $1', [updatedUser.role_id]);
        const resolvedUpdatedRole = String(updatedRoleResult.rows[0]?.name || '');
        // Fetch assigned regions
        const regionsResult = await database_1.default.query(`SELECT r.id, r.name FROM regions r
       INNER JOIN user_regions ur ON r.id = ur.region_id
       WHERE ur.user_id = $1`, [id]);
        // Fetch assigned areas
        const areasResult = await database_1.default.query(`SELECT a.id, a.name FROM areas a
       INNER JOIN user_areas ua ON a.id = ua.area_id
       WHERE ua.user_id = $1`, [id]);
        res.json({
            data: {
                ...updatedUser,
                role: resolvedUpdatedRole,
                regions: regionsResult.rows,
                areas: areasResult.rows,
                is_director_locked: resolvedUpdatedRole.toLowerCase() === 'director',
            },
            message: 'User updated successfully',
        });
    }
    catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to update user'
        });
    }
};
exports.updateUser = updateUser;
/**
 * Delete a user (soft delete by setting is_active = false)
 */
const deleteUser = async (req, res) => {
    try {
        const organizationId = req.organization?.id;
        const { id } = req.params;
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization context required' });
        }
        // Check if user exists and belongs to organization
        const existingUser = await database_1.default.query('SELECT id FROM users WHERE id = $1 AND organization_id = $2', [id, organizationId]);
        if (existingUser.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: 'User not found'
            });
        }
        // Soft delete by setting is_active to false
        await database_1.default.query('UPDATE users SET is_active = false WHERE id = $1', [id]);
        res.json({
            message: 'User deleted successfully',
        });
    }
    catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to delete user'
        });
    }
};
exports.deleteUser = deleteUser;
/**
 * Get regions assigned to a specific user
 */
const getUserRegions = async (req, res) => {
    try {
        const organizationId = req.organization?.id;
        const requesterId = req.user?.id;
        const { id } = req.params;
        const targetUserId = parseInt(id, 10);
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization context required' });
        }
        if (Number.isNaN(targetUserId)) {
            return res.status(400).json({ error: 'Invalid user id' });
        }
        if (requesterId) {
            const accessibleUserIds = await (0, role_access_1.getAccessibleUserIds)(requesterId);
            if (!accessibleUserIds.includes(targetUserId)) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'You do not have permission to access this user regions',
                });
            }
        }
        const regionColumns = ['r.id', 'r.name'];
        if (await hasTableColumn('regions', 'code'))
            regionColumns.push('r.code');
        if (await hasTableColumn('regions', 'description'))
            regionColumns.push('r.description');
        const regionsResult = await database_1.default.query(`SELECT ${regionColumns.join(', ')}
       FROM regions r
       INNER JOIN user_regions ur ON r.id = ur.region_id
       INNER JOIN users u ON u.id = ur.user_id
       WHERE ur.user_id = $1 AND u.organization_id = $2
       ORDER BY r.name`, [targetUserId, organizationId]);
        res.json({
            data: regionsResult.rows,
        });
    }
    catch (error) {
        console.error('Error fetching user regions:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to fetch user regions'
        });
    }
};
exports.getUserRegions = getUserRegions;
/**
 * Get all roles
 */
const getAllRoles = async (req, res) => {
    try {
        const organizationId = req.organization?.id;
        if (!organizationId) {
            return res.status(400).json({ error: 'Organization context required' });
        }
        // Check if roles table has organization_id column
        const hasRoleOrgColumn = await hasTableColumn('roles', 'organization_id');
        let result;
        if (hasRoleOrgColumn) {
            result = await database_1.default.query('SELECT id, name FROM roles WHERE organization_id = $1 ORDER BY name ASC', [organizationId]);
        }
        else {
            // Fallback: get all roles (organization-agnostic schema)
            result = await database_1.default.query('SELECT id, name FROM roles ORDER BY name ASC');
        }
        res.json({
            data: result.rows,
        });
    }
    catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to fetch roles'
        });
    }
};
exports.getAllRoles = getAllRoles;
/**
 * GET /users/me/reportees-count
 * Returns the count of active users who directly report to the logged-in user.
 * Pure hierarchy-based — no role names or IDs involved.
 */
const getMyReporteesCount = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const result = await database_1.default.query(`SELECT COUNT(*) as count
       FROM users
       WHERE assigned_regional_manager_id = $1
         AND is_active = true`, [userId]);
        const count = parseInt(result.rows[0]?.count || '0', 10);
        return res.json({ count, has_reportees: count > 0 });
    }
    catch (error) {
        console.error('Error fetching reportees count:', error);
        return res.status(500).json({ error: 'Server error', message: 'Failed to fetch reportees count' });
    }
};
exports.getMyReporteesCount = getMyReporteesCount;
exports.default = {
    getAllUsers: exports.getAllUsers,
    getUserById: exports.getUserById,
    createUser: exports.createUser,
    updateUser: exports.updateUser,
    deleteUser: exports.deleteUser,
    getUserRegions: exports.getUserRegions,
    getAllRoles: exports.getAllRoles,
    getMyReporteesCount: exports.getMyReporteesCount,
};
