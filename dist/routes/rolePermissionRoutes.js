"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const rolePermissionController_1 = require("../controllers/rolePermissionController");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_1.authenticateToken);
// Get all role permissions
router.get('/', rolePermissionController_1.getAllRolePermissions);
// Get permissions for a specific role
router.get('/role/:roleId', rolePermissionController_1.getRolePermissionsByRole);
// Get single role permission
router.get('/:id', rolePermissionController_1.getRolePermissionById);
// Create new role permission
router.post('/', rolePermissionController_1.createRolePermission);
// Update single role permission
router.put('/:id', rolePermissionController_1.updateRolePermission);
// Bulk update permissions for a role
router.put('/role/:roleId/bulk', rolePermissionController_1.updateRolePermissions);
// Delete role permission
router.delete('/:id', rolePermissionController_1.deleteRolePermission);
exports.default = router;
