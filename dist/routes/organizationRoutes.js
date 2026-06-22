"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const dynamicPermission_1 = require("../middleware/dynamicPermission");
const organizationController_1 = __importDefault(require("../controllers/organizationController"));
const router = express_1.default.Router();
/**
 * Organization Management Routes
 * All routes require authentication and organization context
 */
// Pre-middleware: Load organization context and user role
router.use(dynamicPermission_1.organizationContext);
router.use(auth_1.authenticateToken);
router.use(dynamicPermission_1.loadUserRole);
// ==================== Public Organization Routes ====================
/**
 * GET /api/organizations/me
 * Get details of current organization
 */
router.get('/me', organizationController_1.default.getCurrentOrganization);
/**
 * GET /api/organizations/me/my-role
 * Get current user's role and permissions
 */
router.get('/me/my-role', organizationController_1.default.getMyRole);
/**
 * GET /api/organizations/me/check-permission
 * Check if user has specific permission
 * Query: ?permission=order.approve
 */
router.get('/me/check-permission', organizationController_1.default.checkPermission);
/**
 * GET /api/organizations/me/roles
 * Get all roles available in current organization
 */
router.get('/me/roles', async (req, res) => {
    if (!req.organization?.id) {
        return res.status(400).json({ error: 'Organization not set' });
    }
    req.params.id = req.organization.id.toString();
    organizationController_1.default.getOrganizationRoles(req, res);
});
/**
 * GET /api/organizations/me/hierarchy-levels
 * Get hierarchy level definitions for current organization
 */
router.get('/me/hierarchy-levels', async (req, res) => {
    if (!req.organization?.id) {
        return res.status(400).json({ error: 'Organization not set' });
    }
    req.params.id = req.organization.id.toString();
    organizationController_1.default.getHierarchyLevels(req, res);
});
/**
 * GET /api/organizations/me/users
 * Get all users in current organization
 */
router.get('/me/users', async (req, res) => {
    if (!req.organization?.id) {
        return res.status(400).json({ error: 'Organization not set' });
    }
    req.params.id = req.organization.id.toString();
    organizationController_1.default.getOrganizationUsers(req, res);
});
/**
 * GET /api/organizations/me/stats
 * Get organization statistics
 */
router.get('/me/stats', async (req, res) => {
    if (!req.organization?.id) {
        return res.status(400).json({ error: 'Organization not set' });
    }
    req.params.id = req.organization.id.toString();
    organizationController_1.default.getOrganizationStats(req, res);
});
/**
 * GET /api/organizations/me/config
 * Get complete organization configuration
 */
router.get('/me/config', async (req, res) => {
    if (!req.organization?.id) {
        return res.status(400).json({ error: 'Organization not set' });
    }
    req.params.id = req.organization.id.toString();
    organizationController_1.default.getOrganizationConfig(req, res);
});
// ==================== Admin Organization Management Routes ====================
/**
 * POST /api/organizations
 * Create a new organization
 * Requires: admin.settings permission
 */
router.post('/', (0, dynamicPermission_1.requirePermission)('admin.settings'), organizationController_1.default.createOrganization);
/**
 * GET /api/organizations/:id
 * Get organization by ID
 */
router.get('/:id', organizationController_1.default.getOrganization);
/**
 * PATCH /api/organizations/:id
 * Update organization
 * Requires: admin.settings permission
 */
router.patch('/:id', (0, dynamicPermission_1.requirePermission)('admin.settings'), organizationController_1.default.updateOrganization);
/**
 * POST /api/organizations/:id/reload-config
 * Reload organization configuration (clear cache)
 * Requires: admin.settings permission
 */
router.post('/:id/reload-config', (0, dynamicPermission_1.requirePermission)('admin.settings'), organizationController_1.default.reloadOrganizationConfig);
/**
 * GET /api/organizations/:id/roles
 * Get all roles in organization
 * Requires: admin.manage_roles permission
 */
router.get('/:id/roles', (0, dynamicPermission_1.requirePermission)('admin.manage_roles'), organizationController_1.default.getOrganizationRoles);
/**
 * POST /api/organizations/:id/roles
 * Create or update role
 * Requires: admin.manage_roles permission
 */
router.post('/:id/roles', (0, dynamicPermission_1.requirePermission)('admin.manage_roles'), organizationController_1.default.createOrUpdateRole);
/**
 * GET /api/organizations/:id/hierarchy-levels
 * Get hierarchy levels in organization
 * Requires: admin.settings permission
 */
router.get('/:id/hierarchy-levels', (0, dynamicPermission_1.requirePermission)('admin.settings'), organizationController_1.default.getHierarchyLevels);
/**
 * GET /api/organizations/:id/users
 * Get all users in organization
 * Requires: user.view permission
 */
router.get('/:id/users', (0, dynamicPermission_1.requirePermission)('user.view'), organizationController_1.default.getOrganizationUsers);
/**
 * POST /api/organizations/:id/users/:userId/assign
 * Assign user to organization with role
 * Requires: user.edit permission
 */
router.post('/:id/users/:userId/assign', (0, dynamicPermission_1.requirePermission)('user.edit'), organizationController_1.default.assignUserToOrganization);
/**
 * GET /api/organizations/:id/stats
 * Get organization statistics
 * Requires: analytics.view permission
 */
router.get('/:id/stats', (0, dynamicPermission_1.requirePermission)('analytics.view'), organizationController_1.default.getOrganizationStats);
/**
 * GET /api/organizations/:id/config
 * Get complete organization configuration
 * Requires: admin.settings permission
 */
router.get('/:id/config', (0, dynamicPermission_1.requirePermission)('admin.settings'), organizationController_1.default.getOrganizationConfig);
exports.default = router;
