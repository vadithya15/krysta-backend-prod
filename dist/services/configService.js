"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../config/database"));
class ConfigService {
    constructor() {
        this.configCache = new Map();
        this.cacheExpiry = new Map();
        this.CACHE_TTL = 60 * 60 * 1000; // 1 hour
    }
    /**
     * Get organization by ID or slug
     */
    async getOrganization(identifier) {
        try {
            const query = typeof identifier === 'number'
                ? 'SELECT * FROM organizations WHERE id = $1 AND is_active = true'
                : 'SELECT * FROM organizations WHERE slug = $1 AND is_active = true';
            const result = await database_1.default.query(query, [identifier]);
            return result.rows[0] || null;
        }
        catch (error) {
            console.error('Error fetching organization:', error);
            throw error;
        }
    }
    /**
     * Load complete organization configuration
     * This is the main method that loads all org-specific settings
     */
    async loadOrgConfig(organizationId) {
        // Check cache first
        const cached = this.configCache.get(organizationId);
        const expiry = this.cacheExpiry.get(organizationId);
        if (cached && expiry && Date.now() < expiry) {
            return cached;
        }
        try {
            // Load organization
            const orgResult = await database_1.default.query('SELECT * FROM organizations WHERE id = $1 AND is_active = true', [organizationId]);
            if (orgResult.rows.length === 0) {
                throw new Error(`Organization ${organizationId} not found or inactive`);
            }
            const organization = orgResult.rows[0];
            // Load roles with permissions
            const rolesResult = await database_1.default.query(`SELECT rd.*, 
                ARRAY_AGG(DISTINCT p.code) as permissions
         FROM role_definitions rd
         LEFT JOIN role_permissions rp ON rd.id = rp.role_definition_id
         LEFT JOIN permissions p ON rp.permission_id = p.id
         WHERE rd.organization_id = $1 AND rd.is_active = true
         GROUP BY rd.id
         ORDER BY rd.hierarchy_level ASC`, [organizationId]);
            const roles = rolesResult.rows.map(row => ({
                ...row,
                permissions: row.permissions.filter((p) => p !== null),
            }));
            // Load hierarchy levels
            const hierarchyResult = await database_1.default.query(`SELECT * FROM hierarchy_level_definitions 
         WHERE organization_id = $1 AND is_active = true
         ORDER BY level_number ASC`, [organizationId]);
            const hierarchyLevels = hierarchyResult.rows;
            // Load visibility rules
            const visibilityResult = await database_1.default.query(`SELECT * FROM data_visibility_rules 
         WHERE organization_id = $1
         ORDER BY resource_type ASC`, [organizationId]);
            const visibilityRules = visibilityResult.rows;
            // Load permissions
            const permResult = await database_1.default.query('SELECT code, name FROM permissions ORDER BY code');
            const permissions = new Map(permResult.rows.map(p => [p.code, p.name]));
            // Build config object
            const config = {
                organization,
                roles,
                hierarchyLevels,
                visibilityRules,
                permissions,
            };
            // Cache it
            this.configCache.set(organizationId, config);
            this.cacheExpiry.set(organizationId, Date.now() + this.CACHE_TTL);
            return config;
        }
        catch (error) {
            console.error(`Error loading organization config (${organizationId}):`, error);
            throw error;
        }
    }
    /**
     * Get role definition
     */
    async getRoleDefinition(organizationId, roleId) {
        try {
            const config = await this.loadOrgConfig(organizationId);
            return config.roles.find(r => r.id === roleId) || null;
        }
        catch (error) {
            console.error('Error getting role definition:', error);
            throw error;
        }
    }
    /**
     * Get role by name
     */
    async getRoleByName(organizationId, roleName) {
        try {
            const config = await this.loadOrgConfig(organizationId);
            return config.roles.find(r => r.name === roleName) || null;
        }
        catch (error) {
            console.error('Error getting role by name:', error);
            throw error;
        }
    }
    /**
     * Check if user has permission
     */
    async hasPermission(organizationId, userId, permissionCode) {
        try {
            // Get user's role assignment
            const userResult = await database_1.default.query(`SELECT rd.* 
         FROM hierarchy_assignments ha
         JOIN role_definitions rd ON ha.role_definition_id = rd.id
         WHERE ha.user_id = $1 AND ha.organization_id = $2 AND ha.is_primary = true`, [userId, organizationId]);
            if (userResult.rows.length === 0) {
                return false;
            }
            // Check if role has permission
            const permResult = await database_1.default.query(`SELECT COUNT(*) as count FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.id
         WHERE rp.role_definition_id = $1 AND p.code = $2`, [userResult.rows[0].id, permissionCode]);
            return parseInt(permResult.rows[0].count) > 0;
        }
        catch (error) {
            console.error('Error checking permission:', error);
            return false;
        }
    }
    /**
     * Get visibility rules for a role
     */
    async getVisibilityRules(organizationId, roleId, resourceType) {
        try {
            const config = await this.loadOrgConfig(organizationId);
            return (config.visibilityRules.find(r => r.role_definition_id === roleId && r.resource_type === resourceType) || null);
        }
        catch (error) {
            console.error('Error getting visibility rules:', error);
            throw error;
        }
    }
    /**
     * Get all roles for organization
     */
    async getRoles(organizationId) {
        try {
            const config = await this.loadOrgConfig(organizationId);
            return config.roles;
        }
        catch (error) {
            console.error('Error getting roles:', error);
            throw error;
        }
    }
    /**
     * Get all hierarchy levels for organization
     */
    async getHierarchyLevels(organizationId) {
        try {
            const config = await this.loadOrgConfig(organizationId);
            return config.hierarchyLevels;
        }
        catch (error) {
            console.error('Error getting hierarchy levels:', error);
            throw error;
        }
    }
    /**
     * Get organization setting
     */
    async getOrgSetting(organizationId, settingKey) {
        try {
            const result = await database_1.default.query('SELECT setting_value FROM organization_settings WHERE organization_id = $1 AND setting_key = $2', [organizationId, settingKey]);
            return result.rows[0]?.setting_value || null;
        }
        catch (error) {
            console.error('Error getting organization setting:', error);
            throw error;
        }
    }
    /**
     * Set organization setting
     */
    async setOrgSetting(organizationId, settingKey, settingValue) {
        try {
            await database_1.default.query(`INSERT INTO organization_settings (organization_id, setting_key, setting_value)
         VALUES ($1, $2, $3)
         ON CONFLICT (organization_id, setting_key) DO UPDATE
         SET setting_value = $3, updated_at = CURRENT_TIMESTAMP`, [organizationId, settingKey, settingValue]);
            // Invalidate cache
            this.invalidateCache(organizationId);
        }
        catch (error) {
            console.error('Error setting organization setting:', error);
            throw error;
        }
    }
    /**
     * Invalidate cache for organization
     */
    invalidateCache(organizationId) {
        this.configCache.delete(organizationId);
        this.cacheExpiry.delete(organizationId);
    }
    /**
     * Invalidate all caches
     */
    invalidateAllCaches() {
        this.configCache.clear();
        this.cacheExpiry.clear();
    }
    /**
     * Get user's role in organization
     */
    async getUserRole(organizationId, userId) {
        try {
            const result = await database_1.default.query(`SELECT rd.* FROM hierarchy_assignments ha
         JOIN role_definitions rd ON ha.role_definition_id = rd.id
         WHERE ha.user_id = $1 AND ha.organization_id = $2 AND ha.is_primary = true`, [userId, organizationId]);
            if (result.rows.length === 0) {
                return null;
            }
            // Load permissions for role
            const permResult = await database_1.default.query(`SELECT p.code FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.id
         WHERE rp.role_definition_id = $1`, [result.rows[0].id]);
            return {
                ...result.rows[0],
                permissions: permResult.rows.map((p) => p.code),
            };
        }
        catch (error) {
            console.error('Error getting user role:', error);
            throw error;
        }
    }
    /**
     * Get user's organization ID from user ID
     */
    async getUserOrganizationId(userId) {
        try {
            const result = await database_1.default.query('SELECT organization_id FROM users WHERE id = $1', [userId]);
            return result.rows[0]?.organization_id || null;
        }
        catch (error) {
            console.error('Error getting user organization:', error);
            throw error;
        }
    }
}
// Export singleton instance
exports.default = new ConfigService();
