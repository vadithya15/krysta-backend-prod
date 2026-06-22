"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const organizationService_1 = __importDefault(require("../services/organizationService"));
const configService_1 = __importDefault(require("../services/configService"));
/**
 * Organization Controller
 * Handles organization management API endpoints
 */
class OrganizationController {
    /**
     * Create a new organization (Admin only)
     * POST /api/organizations
     */
    async createOrganization(req, res) {
        try {
            const { name, slug, description, website, industry, contact_email, contact_phone, subscription_tier, max_users } = req.body;
            if (!name || !slug) {
                return res.status(400).json({
                    error: 'Validation error',
                    message: 'name and slug are required'
                });
            }
            const organization = await organizationService_1.default.createOrganization({
                name,
                slug,
                description,
                website,
                industry,
                contact_email,
                contact_phone,
                subscription_tier,
                max_users,
            }, req.user?.id);
            res.status(201).json({
                message: 'Organization created successfully',
                organization,
            });
        }
        catch (error) {
            console.error('Error creating organization:', error);
            res.status(500).json({
                error: 'Failed to create organization',
                message: error.message
            });
        }
    }
    /**
     * Get organization details
     * GET /api/organizations/:id
     */
    async getOrganization(req, res) {
        try {
            const { id } = req.params;
            const org = await configService_1.default.getOrganization(id);
            if (!org) {
                return res.status(404).json({ error: 'Organization not found' });
            }
            res.json({ organization: org });
        }
        catch (error) {
            console.error('Error fetching organization:', error);
            res.status(500).json({ error: 'Failed to fetch organization' });
        }
    }
    /**
     * Get current organization
     * GET /api/organizations/me
     */
    async getCurrentOrganization(req, res) {
        try {
            if (!req.organization?.id) {
                return res.status(400).json({ error: 'Organization not set in context' });
            }
            const org = await configService_1.default.getOrganization(req.organization.id);
            if (!org) {
                return res.status(404).json({ error: 'Organization not found' });
            }
            res.json({ organization: org });
        }
        catch (error) {
            console.error('Error fetching current organization:', error);
            res.status(500).json({ error: 'Failed to fetch organization' });
        }
    }
    /**
     * Update organization
     * PATCH /api/organizations/:id
     */
    async updateOrganization(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            const organization = await organizationService_1.default.updateOrganization(parseInt(id), updates);
            res.json({
                message: 'Organization updated successfully',
                organization,
            });
        }
        catch (error) {
            console.error('Error updating organization:', error);
            res.status(500).json({
                error: 'Failed to update organization',
                message: error.message
            });
        }
    }
    /**
     * Get organization roles
     * GET /api/organizations/:id/roles
     */
    async getOrganizationRoles(req, res) {
        try {
            const { id } = req.params;
            const orgId = parseInt(id);
            const roles = await configService_1.default.getRoles(orgId);
            res.json({
                organization_id: orgId,
                roles,
                total: roles.length,
            });
        }
        catch (error) {
            console.error('Error fetching roles:', error);
            res.status(500).json({ error: 'Failed to fetch roles' });
        }
    }
    /**
     * Get organization hierarchy levels
     * GET /api/organizations/:id/hierarchy-levels
     */
    async getHierarchyLevels(req, res) {
        try {
            const { id } = req.params;
            const orgId = parseInt(id);
            const levels = await configService_1.default.getHierarchyLevels(orgId);
            res.json({
                organization_id: orgId,
                hierarchy_levels: levels,
                total: levels.length,
            });
        }
        catch (error) {
            console.error('Error fetching hierarchy levels:', error);
            res.status(500).json({ error: 'Failed to fetch hierarchy levels' });
        }
    }
    /**
     * Create or update role
     * POST /api/organizations/:id/roles
     */
    async createOrUpdateRole(req, res) {
        try {
            const { id } = req.params;
            const orgId = parseInt(id);
            const roleData = req.body;
            const role = await organizationService_1.default.createOrUpdateRole(orgId, roleData);
            res.json({
                message: 'Role created/updated successfully',
                role,
            });
        }
        catch (error) {
            console.error('Error creating/updating role:', error);
            res.status(500).json({
                error: 'Failed to create/update role',
                message: error.message
            });
        }
    }
    /**
     * Assign user to organization
     * POST /api/organizations/:id/users/:userId/assign
     */
    async assignUserToOrganization(req, res) {
        try {
            const { id, userId } = req.params;
            const { roleId, hierarchyNodeId } = req.body;
            const orgId = parseInt(id);
            if (!roleId) {
                return res.status(400).json({
                    error: 'Validation error',
                    message: 'roleId is required'
                });
            }
            await organizationService_1.default.assignUserToOrganization(orgId, parseInt(userId), roleId, hierarchyNodeId);
            res.json({
                message: 'User assigned to organization successfully'
            });
        }
        catch (error) {
            console.error('Error assigning user:', error);
            res.status(500).json({
                error: 'Failed to assign user',
                message: error.message
            });
        }
    }
    /**
     * Get organization users
     * GET /api/organizations/:id/users
     */
    async getOrganizationUsers(req, res) {
        try {
            const { id } = req.params;
            const orgId = parseInt(id);
            const users = await organizationService_1.default.getOrganizationUsers(orgId);
            res.json({
                organization_id: orgId,
                users,
                total: users.length,
            });
        }
        catch (error) {
            console.error('Error fetching organization users:', error);
            res.status(500).json({ error: 'Failed to fetch users' });
        }
    }
    /**
     * Get organization statistics
     * GET /api/organizations/:id/stats
     */
    async getOrganizationStats(req, res) {
        try {
            const { id } = req.params;
            const orgId = parseInt(id);
            const stats = await organizationService_1.default.getOrganizationStats(orgId);
            res.json({
                organization_id: orgId,
                statistics: stats,
            });
        }
        catch (error) {
            console.error('Error fetching organization stats:', error);
            res.status(500).json({ error: 'Failed to fetch statistics' });
        }
    }
    /**
     * Get organization configuration (all settings combined)
     * GET /api/organizations/:id/config
     */
    async getOrganizationConfig(req, res) {
        try {
            const { id } = req.params;
            const orgId = parseInt(id);
            const config = await configService_1.default.loadOrgConfig(orgId);
            // Return config in the format expected by mobile app
            res.json({
                organization: config.organization,
                roles: config.roles,
                hierarchyLevels: config.hierarchyLevels,
                permissions: Array.from(config.permissions.entries()).map(([code, name]) => ({
                    code,
                    name,
                    category: code.split('.')[0], // Extract category from permission code
                })),
                visibilityRules: config.visibilityRules,
            });
        }
        catch (error) {
            console.error('Error fetching organization config:', error);
            res.status(500).json({
                error: 'Failed to fetch configuration',
                message: error.message
            });
        }
    }
    /**
     * Reload organization configuration (clear cache)
     * POST /api/organizations/:id/reload-config
     */
    async reloadOrganizationConfig(req, res) {
        try {
            const { id } = req.params;
            const orgId = parseInt(id);
            configService_1.default.invalidateCache(orgId);
            res.json({
                message: 'Organization configuration cleared and will be reloaded',
                organization_id: orgId
            });
        }
        catch (error) {
            console.error('Error reloading config:', error);
            res.status(500).json({
                error: 'Failed to reload configuration',
                message: error.message
            });
        }
    }
    /**
     * Get current user's role and permissions
     * GET /api/organizations/me/my-role
     */
    async getMyRole(req, res) {
        try {
            if (!req.user?.id || !req.organization?.id) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const userRole = await configService_1.default.getUserRole(req.organization.id, req.user.id);
            if (!userRole) {
                return res.status(404).json({
                    error: 'No role assigned',
                    message: 'User does not have a role in this organization'
                });
            }
            res.json({
                user_id: req.user.id,
                organization_id: req.organization.id,
                role: {
                    id: userRole.id,
                    name: userRole.name,
                    display_name: userRole.display_name,
                    hierarchy_level: userRole.hierarchy_level,
                    permissions: userRole.permissions,
                }
            });
        }
        catch (error) {
            console.error('Error fetching user role:', error);
            res.status(500).json({ error: 'Failed to fetch user role' });
        }
    }
    /**
     * Check if user has permission
     * GET /api/organizations/me/check-permission?permission=order.approve
     */
    async checkPermission(req, res) {
        try {
            const { permission } = req.query;
            if (!permission || typeof permission !== 'string') {
                return res.status(400).json({
                    error: 'Validation error',
                    message: 'permission query parameter is required'
                });
            }
            if (!req.user?.id || !req.organization?.id) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const hasPermission = await configService_1.default.hasPermission(req.organization.id, req.user.id, permission);
            res.json({
                user_id: req.user.id,
                organization_id: req.organization.id,
                permission,
                has_permission: hasPermission
            });
        }
        catch (error) {
            console.error('Error checking permission:', error);
            res.status(500).json({ error: 'Failed to check permission' });
        }
    }
}
exports.default = new OrganizationController();
