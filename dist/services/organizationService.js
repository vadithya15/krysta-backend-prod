"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../config/database"));
const configService_1 = __importDefault(require("./configService"));
class OrganizationService {
    /**
     * Create a new organization
     * This is the main onboarding entry point
     */
    async createOrganization(input, createdById) {
        const client = await database_1.default.connect();
        try {
            await client.query('BEGIN');
            // Check if slug already exists
            const slugCheck = await client.query('SELECT id FROM organizations WHERE slug = $1', [input.slug]);
            if (slugCheck.rows.length > 0) {
                throw new Error(`Organization slug '${input.slug}' already exists`);
            }
            // Create organization
            const orgResult = await client.query(`INSERT INTO organizations 
          (name, slug, description, website, industry, contact_email, contact_phone, 
           subscription_tier, max_users, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`, [
                input.name,
                input.slug,
                input.description || null,
                input.website || null,
                input.industry || null,
                input.contact_email || null,
                input.contact_phone || null,
                input.subscription_tier || 'basic',
                input.max_users || 100,
                createdById || null,
            ]);
            const organizationId = orgResult.rows[0].id;
            // Initialize default roles for this organization
            await this.initializeDefaultRoles(client, organizationId);
            // Initialize default hierarchy levels
            await this.initializeDefaultHierarchy(client, organizationId);
            // Initialize default settings
            await this.initializeDefaultSettings(client, organizationId);
            await client.query('COMMIT');
            // Clear config cache for new org
            configService_1.default.invalidateCache(organizationId);
            return orgResult.rows[0];
        }
        catch (error) {
            await client.query('ROLLBACK');
            console.error('Error creating organization:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Initialize default roles for a new organization
     */
    async initializeDefaultRoles(client, organizationId) {
        const defaultRoles = [
            {
                name: 'Board of Directors',
                display_name: 'Board of Directors',
                hierarchy_level: 1,
                hierarchy_label: 'Board',
                color_code: '#DC2626',
                icon_name: 'crown'
            },
            {
                name: 'Zonal Manager',
                display_name: 'Zonal Manager',
                hierarchy_level: 2,
                hierarchy_label: 'Zonal',
                color_code: '#F59E0B',
                icon_name: 'map'
            },
            {
                name: 'Area Sales Manager',
                display_name: 'Area Sales Manager',
                hierarchy_level: 3,
                hierarchy_label: 'Area',
                color_code: '#3B82F6',
                icon_name: 'briefcase'
            },
            {
                name: 'Sales Officer',
                display_name: 'Sales Officer',
                hierarchy_level: 4,
                hierarchy_label: 'Officer',
                color_code: '#10B981',
                icon_name: 'user'
            },
            {
                name: 'Sales Trainee',
                display_name: 'Sales Trainee',
                hierarchy_level: 5,
                hierarchy_label: 'Trainee',
                color_code: '#8B5CF6',
                icon_name: 'user-plus'
            },
            {
                name: 'Admin',
                display_name: 'System Administrator',
                hierarchy_level: 10,
                hierarchy_label: 'Admin',
                color_code: '#000000',
                icon_name: 'settings'
            }
        ];
        for (const role of defaultRoles) {
            await client.query(`INSERT INTO role_definitions 
          (organization_id, name, display_name, hierarchy_level, hierarchy_label, color_code, icon_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`, [organizationId, role.name, role.display_name, role.hierarchy_level,
                role.hierarchy_label, role.color_code, role.icon_name]);
        }
    }
    /**
     * Initialize default hierarchy levels
     */
    async initializeDefaultHierarchy(client, organizationId) {
        const levels = [
            { level_name: 'board', display_name: 'Board', level_number: 1 },
            { level_name: 'zone', display_name: 'Zone', level_number: 2 },
            { level_name: 'region', display_name: 'Region', level_number: 3 },
            { level_name: 'area', display_name: 'Area', level_number: 4 },
            { level_name: 'department', display_name: 'Department', level_number: 5 }
        ];
        for (const level of levels) {
            await client.query(`INSERT INTO hierarchy_level_definitions 
          (organization_id, level_name, display_name, level_number)
         VALUES ($1, $2, $3, $4)`, [organizationId, level.level_name, level.display_name, level.level_number]);
        }
    }
    /**
     * Initialize default organization settings
     */
    async initializeDefaultSettings(client, organizationId) {
        const settings = [
            { key: 'enable_reporting', value: 'true' },
            { key: 'enable_analytics', value: 'true' },
            { key: 'enable_hierarchy_management', value: 'true' },
            { key: 'auto_approve_expenses', value: 'false' },
            { key: 'timezone', value: 'UTC' },
        ];
        for (const setting of settings) {
            await client.query(`INSERT INTO organization_settings 
          (organization_id, setting_key, setting_value)
         VALUES ($1, $2, $3)`, [organizationId, setting.key, setting.value]);
        }
    }
    /**
     * Update organization
     */
    async updateOrganization(organizationId, input) {
        try {
            const updates = [];
            const values = [];
            let paramCount = 1;
            if (input.name !== undefined) {
                updates.push(`name = $${paramCount++}`);
                values.push(input.name);
            }
            if (input.description !== undefined) {
                updates.push(`description = $${paramCount++}`);
                values.push(input.description);
            }
            if (input.website !== undefined) {
                updates.push(`website = $${paramCount++}`);
                values.push(input.website);
            }
            if (input.industry !== undefined) {
                updates.push(`industry = $${paramCount++}`);
                values.push(input.industry);
            }
            if (input.contact_email !== undefined) {
                updates.push(`contact_email = $${paramCount++}`);
                values.push(input.contact_email);
            }
            if (input.contact_phone !== undefined) {
                updates.push(`contact_phone = $${paramCount++}`);
                values.push(input.contact_phone);
            }
            if (input.subscription_tier !== undefined) {
                updates.push(`subscription_tier = $${paramCount++}`);
                values.push(input.subscription_tier);
            }
            if (input.max_users !== undefined) {
                updates.push(`max_users = $${paramCount++}`);
                values.push(input.max_users);
            }
            if (input.theme_color !== undefined) {
                updates.push(`theme_color = $${paramCount++}`);
                values.push(input.theme_color);
            }
            if (input.is_active !== undefined) {
                updates.push(`is_active = $${paramCount++}`);
                values.push(input.is_active);
            }
            if (updates.length === 0) {
                // Return current org without changes
                const result = await database_1.default.query('SELECT * FROM organizations WHERE id = $1', [organizationId]);
                return result.rows[0];
            }
            updates.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(organizationId);
            const result = await database_1.default.query(`UPDATE organizations SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`, values);
            // Clear cache
            configService_1.default.invalidateCache(organizationId);
            return result.rows[0];
        }
        catch (error) {
            console.error('Error updating organization:', error);
            throw error;
        }
    }
    /**
     * Assign user to organization with role
     */
    async assignUserToOrganization(organizationId, userId, roleId, hierarchyNodeId) {
        try {
            // Update user's organization
            await database_1.default.query('UPDATE users SET organization_id = $1 WHERE id = $2', [organizationId, userId]);
            // Create hierarchy assignment
            await database_1.default.query(`INSERT INTO hierarchy_assignments 
          (organization_id, user_id, hierarchy_node_id, role_definition_id, is_primary)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (organization_id, user_id, is_primary) 
         DO UPDATE SET role_definition_id = $4, hierarchy_node_id = $3`, [organizationId, userId, hierarchyNodeId || null, roleId]);
            // Clear cache
            configService_1.default.invalidateCache(organizationId);
        }
        catch (error) {
            console.error('Error assigning user to organization:', error);
            throw error;
        }
    }
    /**
     * Create or update role in organization
     */
    async createOrUpdateRole(organizationId, roleData) {
        try {
            if (!roleData.name || !roleData.display_name) {
                throw new Error('Role name and display_name are required');
            }
            const result = await database_1.default.query(`INSERT INTO role_definitions 
          (organization_id, name, display_name, hierarchy_level, hierarchy_label, 
           can_approve_orders, can_approve_payments, can_approve_expenses, can_modify_expenses,
           can_set_targets, can_view_analytics, can_manage_users, can_manage_roles,
           color_code, icon_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (organization_id, name) 
         DO UPDATE SET 
           display_name = $3,
           hierarchy_level = $4,
           hierarchy_label = $5,
           can_approve_orders = $6,
           can_approve_payments = $7,
           can_approve_expenses = $8,
           can_modify_expenses = $9,
           can_set_targets = $10,
           can_view_analytics = $11,
           can_manage_users = $12,
           can_manage_roles = $13,
           color_code = $14,
           icon_name = $15
         RETURNING *`, [
                organizationId,
                roleData.name,
                roleData.display_name,
                roleData.hierarchy_level || 1,
                roleData.hierarchy_label || roleData.name,
                roleData.can_approve_orders || false,
                roleData.can_approve_payments || false,
                roleData.can_approve_expenses || false,
                roleData.can_modify_expenses || false,
                roleData.can_set_targets || false,
                roleData.can_view_analytics || false,
                roleData.can_manage_users || false,
                roleData.can_manage_roles || false,
                roleData.color_code || '#3B82F6',
                roleData.icon_name || 'user',
            ]);
            // Clear cache
            configService_1.default.invalidateCache(organizationId);
            return result.rows[0];
        }
        catch (error) {
            console.error('Error creating/updating role:', error);
            throw error;
        }
    }
    /**
     * Get all users in organization
     */
    async getOrganizationUsers(organizationId) {
        try {
            const result = await database_1.default.query(`SELECT u.id, u.name, u.email, u.phone, rd.name as role_name, rd.display_name as role_display_name
         FROM users u
         LEFT JOIN hierarchy_assignments ha ON u.id = ha.user_id AND ha.organization_id = $1 AND ha.is_primary = true
         LEFT JOIN role_definitions rd ON ha.role_definition_id = rd.id
         WHERE u.organization_id = $1
         ORDER BY u.name`, [organizationId]);
            return result.rows;
        }
        catch (error) {
            console.error('Error getting organization users:', error);
            throw error;
        }
    }
    /**
     * Get organization usage statistics
     */
    async getOrganizationStats(organizationId) {
        try {
            const userCount = await database_1.default.query('SELECT COUNT(*) as count FROM users WHERE organization_id = $1', [organizationId]);
            const orderCount = await database_1.default.query('SELECT COUNT(*) as count FROM orders WHERE organization_id = $1', [organizationId]);
            const expenseCount = await database_1.default.query('SELECT COUNT(*) as count FROM travel_expenses WHERE organization_id = $1', [organizationId]);
            const roleCount = await database_1.default.query('SELECT COUNT(*) as count FROM role_definitions WHERE organization_id = $1 AND is_active = true', [organizationId]);
            return {
                totalUsers: parseInt(userCount.rows[0].count),
                totalOrders: parseInt(orderCount.rows[0].count),
                totalExpenses: parseInt(expenseCount.rows[0].count),
                activeRoles: parseInt(roleCount.rows[0].count),
            };
        }
        catch (error) {
            console.error('Error getting organization stats:', error);
            throw error;
        }
    }
}
exports.default = new OrganizationService();
