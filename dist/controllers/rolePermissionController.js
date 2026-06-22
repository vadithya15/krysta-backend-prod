"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRolePermissions = exports.deleteRolePermission = exports.updateRolePermission = exports.createRolePermission = exports.getRolePermissionById = exports.getRolePermissionsByRole = exports.getAllRolePermissions = void 0;
const database_1 = __importDefault(require("../config/database"));
const hasTableColumn = async (tableName, columnName) => {
    const result = await database_1.default.query(`SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`, [tableName, columnName]);
    return result.rows.length > 0;
};
const normalizePermissionRow = (row) => ({
    ...row,
    can_view: row.can_view !== undefined ? Boolean(row.can_view) : true,
    can_create: row.can_create !== undefined ? Boolean(row.can_create) : false,
    can_edit: row.can_edit !== undefined ? Boolean(row.can_edit) : false,
    can_delete: row.can_delete !== undefined ? Boolean(row.can_delete) : false,
});
const getPermissionColumnSupport = async () => {
    const [canView, canCreate, canEdit, canDelete] = await Promise.all([
        hasTableColumn('role_menu_permissions', 'can_view'),
        hasTableColumn('role_menu_permissions', 'can_create'),
        hasTableColumn('role_menu_permissions', 'can_edit'),
        hasTableColumn('role_menu_permissions', 'can_delete'),
    ]);
    return { canView, canCreate, canEdit, canDelete };
};
// Get all role permissions
const getAllRolePermissions = async (req, res) => {
    try {
        const result = await database_1.default.query(`
      SELECT rmp.*, r.name as role_name, mi.label as menu_item_name 
      FROM role_menu_permissions rmp
      JOIN roles r ON rmp.role_id = r.id
      JOIN menu_items mi ON rmp.menu_item_id = mi.id
      ORDER BY r.name ASC, mi.display_order ASC
    `);
        res.json(result.rows.map(normalizePermissionRow));
    }
    catch (error) {
        console.error('Error fetching role permissions:', error);
        res.status(500).json({ error: 'Failed to fetch role permissions' });
    }
};
exports.getAllRolePermissions = getAllRolePermissions;
// Get permissions for a specific role
const getRolePermissionsByRole = async (req, res) => {
    try {
        const { roleId } = req.params;
        const result = await database_1.default.query(`
      SELECT rmp.*, mi.label as menu_item_name, mi.icon_name, mi.screen 
      FROM role_menu_permissions rmp
      JOIN menu_items mi ON rmp.menu_item_id = mi.id
      WHERE rmp.role_id = $1
      ORDER BY mi.display_order ASC
    `, [roleId]);
        res.json(result.rows.map(normalizePermissionRow));
    }
    catch (error) {
        console.error('Error fetching role permissions:', error);
        res.status(500).json({ error: 'Failed to fetch role permissions' });
    }
};
exports.getRolePermissionsByRole = getRolePermissionsByRole;
// Get single role permission by ID
const getRolePermissionById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query(`
      SELECT rmp.*, r.name as role_name, mi.label as menu_item_name 
      FROM role_menu_permissions rmp
      JOIN roles r ON rmp.role_id = r.id
      JOIN menu_items mi ON rmp.menu_item_id = mi.id
      WHERE rmp.id = $1
    `, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Role permission not found' });
        }
        res.json(normalizePermissionRow(result.rows[0]));
    }
    catch (error) {
        console.error('Error fetching role permission:', error);
        res.status(500).json({ error: 'Failed to fetch role permission' });
    }
};
exports.getRolePermissionById = getRolePermissionById;
// Create new role permission
const createRolePermission = async (req, res) => {
    try {
        const { role_id, menu_item_id, can_view, can_create, can_edit, can_delete } = req.body;
        if (!role_id || !menu_item_id) {
            return res.status(400).json({ error: 'Role ID and Menu Item ID are required' });
        }
        const support = await getPermissionColumnSupport();
        const columns = ['role_id', 'menu_item_id'];
        const values = [role_id, menu_item_id];
        if (support.canView) {
            columns.push('can_view');
            values.push(Boolean(can_view));
        }
        if (support.canCreate) {
            columns.push('can_create');
            values.push(Boolean(can_create));
        }
        if (support.canEdit) {
            columns.push('can_edit');
            values.push(Boolean(can_edit));
        }
        if (support.canDelete) {
            columns.push('can_delete');
            values.push(Boolean(can_delete));
        }
        const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
        const result = await database_1.default.query(`INSERT INTO role_menu_permissions (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`, values);
        res.status(201).json(normalizePermissionRow(result.rows[0]));
    }
    catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Permission already exists for this role and menu item' });
        }
        if (error.code === '23503') {
            return res.status(400).json({ error: 'Invalid role ID or menu item ID' });
        }
        console.error('Error creating role permission:', error);
        res.status(500).json({ error: 'Failed to create role permission' });
    }
};
exports.createRolePermission = createRolePermission;
// Update role permission
const updateRolePermission = async (req, res) => {
    try {
        const { id } = req.params;
        const { can_view, can_create, can_edit, can_delete } = req.body;
        const support = await getPermissionColumnSupport();
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;
        if (support.canView) {
            updateFields.push(`can_view = $${paramIndex}`);
            updateValues.push(Boolean(can_view));
            paramIndex++;
        }
        if (support.canCreate) {
            updateFields.push(`can_create = $${paramIndex}`);
            updateValues.push(Boolean(can_create));
            paramIndex++;
        }
        if (support.canEdit) {
            updateFields.push(`can_edit = $${paramIndex}`);
            updateValues.push(Boolean(can_edit));
            paramIndex++;
        }
        if (support.canDelete) {
            updateFields.push(`can_delete = $${paramIndex}`);
            updateValues.push(Boolean(can_delete));
            paramIndex++;
        }
        if (updateFields.length === 0) {
            return res.status(400).json({
                error: 'Fine-grained permission columns are not available in current schema',
            });
        }
        updateValues.push(id);
        const result = await database_1.default.query(`UPDATE role_menu_permissions
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex} RETURNING *`, updateValues);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Role permission not found' });
        }
        res.json(normalizePermissionRow(result.rows[0]));
    }
    catch (error) {
        console.error('Error updating role permission:', error);
        res.status(500).json({ error: 'Failed to update role permission' });
    }
};
exports.updateRolePermission = updateRolePermission;
// Delete role permission
const deleteRolePermission = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query('DELETE FROM role_menu_permissions WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Role permission not found' });
        }
        res.json({ message: 'Role permission deleted successfully', rolePermission: result.rows[0] });
    }
    catch (error) {
        console.error('Error deleting role permission:', error);
        res.status(500).json({ error: 'Failed to delete role permission' });
    }
};
exports.deleteRolePermission = deleteRolePermission;
// Bulk update permissions for a role
const updateRolePermissions = async (req, res) => {
    try {
        const { roleId } = req.params;
        const { permissions } = req.body;
        if (!Array.isArray(permissions)) {
            return res.status(400).json({ error: 'Permissions must be an array' });
        }
        const support = await getPermissionColumnSupport();
        // Delete existing permissions for this role
        await database_1.default.query('DELETE FROM role_menu_permissions WHERE role_id = $1', [roleId]);
        // Insert new permissions
        for (const perm of permissions) {
            const allowAnyAction = Boolean(perm.can_view || perm.can_create || perm.can_edit || perm.can_delete);
            // For legacy schema (no can_* columns), row presence means access.
            // Skip rows with no access selected.
            if (!support.canView && !support.canCreate && !support.canEdit && !support.canDelete && !allowAnyAction) {
                continue;
            }
            const columns = ['role_id', 'menu_item_id'];
            const values = [roleId, perm.menu_item_id];
            if (support.canView) {
                columns.push('can_view');
                values.push(Boolean(perm.can_view));
            }
            if (support.canCreate) {
                columns.push('can_create');
                values.push(Boolean(perm.can_create));
            }
            if (support.canEdit) {
                columns.push('can_edit');
                values.push(Boolean(perm.can_edit));
            }
            if (support.canDelete) {
                columns.push('can_delete');
                values.push(Boolean(perm.can_delete));
            }
            const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
            await database_1.default.query(`INSERT INTO role_menu_permissions (${columns.join(', ')}) VALUES (${placeholders})`, values);
        }
        res.json({ message: 'Role permissions updated successfully', count: permissions.length });
    }
    catch (error) {
        console.error('Error updating role permissions:', error);
        res.status(500).json({ error: 'Failed to update role permissions' });
    }
};
exports.updateRolePermissions = updateRolePermissions;
