"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachVisibilityRules = exports.requireFeature = exports.enforceOrganizationOwnership = exports.requireHierarchyLevel = exports.requireRole = exports.requirePermission = exports.loadUserRole = exports.organizationContext = void 0;
const configService_1 = __importDefault(require("../services/configService"));
/**
 * Middleware to add organization context to request
 * This extraction happens early in the request lifecycle
 * Supports both x-organization (slug) and x-organization-id (numeric) headers
 */
const organizationContext = async (req, res, next) => {
    try {
        // Get organization from headers.
        // Priority: explicit slug -> numeric ID -> default slug.
        const orgSlug = req.headers['x-organization']?.trim();
        const orgIdHeader = req.headers['x-organization-id']?.trim();
        let org = null;
        if (orgSlug) {
            org = await configService_1.default.getOrganization(orgSlug);
        }
        else if (orgIdHeader) {
            const orgId = Number(orgIdHeader);
            if (!Number.isFinite(orgId) || orgId <= 0) {
                return res.status(400).json({
                    error: 'Invalid organization',
                    message: `Invalid x-organization-id header value '${orgIdHeader}'`,
                });
            }
            org = await configService_1.default.getOrganization(orgId);
        }
        else {
            org = await configService_1.default.getOrganization('krysta-default');
        }
        if (!org) {
            return res.status(400).json({
                error: 'Invalid organization',
                message: orgSlug
                    ? `Organization '${orgSlug}' not found or is inactive`
                    : orgIdHeader
                        ? `Organization '${orgIdHeader}' not found or is inactive`
                        : `Organization 'krysta-default' not found or is inactive`,
            });
        }
        req.organization = {
            id: org.id,
            slug: org.slug,
            name: org.name,
        };
        next();
    }
    catch (error) {
        console.error('Organization context error:', error);
        res.status(500).json({ error: 'Failed to load organization context' });
    }
};
exports.organizationContext = organizationContext;
/**
 * Middleware to load user's role and permissions
 * Should be used after authenticateToken middleware
 */
const loadUserRole = async (req, res, next) => {
    try {
        if (!req.user?.id || !req.organization?.id) {
            return next(); // Role will be loaded on demand
        }
        const userRole = await configService_1.default.getUserRole(req.organization.id, req.user.id);
        if (userRole) {
            req.userRole = {
                id: userRole.id,
                name: userRole.name,
                permissions: userRole.permissions,
            };
        }
        next();
    }
    catch (error) {
        console.error('Error loading user role:', error);
        res.status(500).json({ error: 'Failed to load user role' });
    }
};
exports.loadUserRole = loadUserRole;
/**
 * Dynamic permission checker middleware
 * Checks if user has required permission(s)
 * Usage: requirePermission('order.approve', 'order.reject')
 */
const requirePermission = (...requiredPermissions) => {
    return async (req, res, next) => {
        try {
            if (!req.user?.id || !req.organization?.id) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            // Load role if not already loaded
            if (!req.userRole) {
                const userRole = await configService_1.default.getUserRole(req.organization.id, req.user.id);
                if (!userRole) {
                    return res.status(403).json({
                        error: 'No role assigned',
                        message: 'User does not have a role in this organization'
                    });
                }
                req.userRole = {
                    id: userRole.id,
                    name: userRole.name,
                    permissions: userRole.permissions,
                };
            }
            // Check if user has at least one of the required permissions
            const hasPermission = requiredPermissions.some(perm => req.userRole.permissions.includes(perm));
            if (!hasPermission) {
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    message: `Required one of: ${requiredPermissions.join(', ')}`,
                    yourPermissions: req.userRole.permissions,
                });
            }
            next();
        }
        catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({ error: 'Failed to check permissions' });
        }
    };
};
exports.requirePermission = requirePermission;
/**
 * Middleware to check role-based access
 * Usage: requireRole('Zonal Manager', 'Area Sales Manager')
 */
const requireRole = (...roleNames) => {
    return async (req, res, next) => {
        try {
            if (!req.user?.id || !req.organization?.id) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            // Load role if not already loaded
            if (!req.userRole) {
                const userRole = await configService_1.default.getUserRole(req.organization.id, req.user.id);
                if (!userRole) {
                    return res.status(403).json({
                        error: 'No role assigned',
                        message: 'User does not have a role in this organization'
                    });
                }
                req.userRole = {
                    id: userRole.id,
                    name: userRole.name,
                    permissions: userRole.permissions,
                };
            }
            // Check if user has one of the required roles
            const hasRole = roleNames.includes(req.userRole.name);
            if (!hasRole) {
                return res.status(403).json({
                    error: 'Insufficient role',
                    message: `Required one of: ${roleNames.join(', ')}`,
                    yourRole: req.userRole.name,
                });
            }
            next();
        }
        catch (error) {
            console.error('Role check error:', error);
            res.status(500).json({ error: 'Failed to check role' });
        }
    };
};
exports.requireRole = requireRole;
/**
 * Middleware to check hierarchy level
 * Usage: requireHierarchyLevel(2, 3) - requires level 2 or 3
 */
const requireHierarchyLevel = (...levels) => {
    return async (req, res, next) => {
        try {
            if (!req.user?.id || !req.organization?.id) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            // Load role if not already loaded
            if (!req.userRole) {
                const userRole = await configService_1.default.getUserRole(req.organization.id, req.user.id);
                if (!userRole) {
                    return res.status(403).json({
                        error: 'No role assigned'
                    });
                }
                req.userRole = {
                    id: userRole.id,
                    name: userRole.name,
                    permissions: userRole.permissions,
                };
            }
            const role = await configService_1.default.getRoleDefinition(req.organization.id, req.userRole.id);
            if (!role || !levels.includes(role.hierarchy_level)) {
                return res.status(403).json({
                    error: 'Insufficient hierarchy level',
                    message: `Required level(s): ${levels.join(', ')}`
                });
            }
            next();
        }
        catch (error) {
            console.error('Hierarchy level check error:', error);
            res.status(500).json({ error: 'Failed to check hierarchy level' });
        }
    };
};
exports.requireHierarchyLevel = requireHierarchyLevel;
/**
 * Middleware to enforce multi-tenancy
 * Ensures user can only access their own organization's data
 */
const enforceOrganizationOwnership = async (req, res, next) => {
    try {
        if (!req.user?.id || !req.organization?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Get user's organization
        const userOrgId = await configService_1.default.getUserOrganizationId(req.user.id);
        if (userOrgId !== req.organization.id) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'User does not belong to this organization'
            });
        }
        next();
    }
    catch (error) {
        console.error('Organization ownership check error:', error);
        res.status(500).json({ error: 'Failed to verify organization ownership' });
    }
};
exports.enforceOrganizationOwnership = enforceOrganizationOwnership;
/**
 * Middleware to check if organization has feature enabled
 * Usage: requireFeature('reporting')(req, res, next)
 */
const requireFeature = (featureName) => {
    return async (req, res, next) => {
        try {
            if (!req.organization?.id) {
                return res.status(400).json({ error: 'Organization not set' });
            }
            const org = await configService_1.default.getOrganization(req.organization.id);
            if (!org) {
                return res.status(400).json({ error: 'Organization not found' });
            }
            if (!org.features.includes(featureName)) {
                return res.status(403).json({
                    error: 'Feature not available',
                    message: `Organization does not have access to '${featureName}' feature`,
                    availableFeatures: org.features.split(',').map(f => f.trim()),
                });
            }
            next();
        }
        catch (error) {
            console.error('Feature check error:', error);
            res.status(500).json({ error: 'Failed to check feature availability' });
        }
    };
};
exports.requireFeature = requireFeature;
/**
 * Helper middleware to attach visibility rules to request
 * Used for data filtering queries
 */
const attachVisibilityRules = async (req, res, next) => {
    try {
        if (!req.user?.id || !req.organization?.id || !req.userRole?.id) {
            return next();
        }
        // Get visibility rules - this will be used by controllers for data filtering
        const resourceType = req.query.resource || req.body?.resource || '*';
        const rules = await configService_1.default.getVisibilityRules(req.organization.id, req.userRole.id, resourceType);
        req.visibilityRules = rules;
        next();
    }
    catch (error) {
        console.error('Error attaching visibility rules:', error);
        // Don't fail the request, just continue without rules
        next();
    }
};
exports.attachVisibilityRules = attachVisibilityRules;
