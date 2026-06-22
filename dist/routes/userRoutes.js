"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const dynamicPermission_1 = require("../middleware/dynamicPermission");
const userController_1 = require("../controllers/userController");
const router = express_1.default.Router();
/**
 * User Management Routes
 * All routes require authentication and organization context
 */
// Apply middleware to all routes
router.use(dynamicPermission_1.organizationContext);
router.use(auth_1.authenticateToken);
/**
 * GET /api/users
 * Get all users with pagination and filters
 * Query params: page, limit, search, role, is_active
 */
router.get('/', userController_1.getAllUsers);
/**
 * GET /api/users/roles
 * Get all available roles
 */
router.get('/roles', userController_1.getAllRoles);
/**
 * GET /api/users/me/reportees-count
 * Returns whether the logged-in user has any direct reports (role-agnostic).
 */
router.get('/me/reportees-count', userController_1.getMyReporteesCount);
/**
 * GET /api/users/:id
 * Get a single user by ID
 */
router.get('/:id', userController_1.getUserById);
/**
 * GET /api/users/:id/regions
 * Get regions assigned to a specific user
 */
router.get('/:id/regions', userController_1.getUserRegions);
/**
 * POST /api/users
 * Create a new user
 * Body: { name, email, password, role, hierarchy_level? }
 */
router.post('/', userController_1.createUser);
/**
 * PUT /api/users/:id
 * Update an existing user
 * Body: { name?, email?, role?, hierarchy_level?, is_active? }
 */
router.put('/:id', userController_1.updateUser);
/**
 * DELETE /api/users/:id
 * Delete a user (soft delete)
 */
router.delete('/:id', userController_1.deleteUser);
exports.default = router;
