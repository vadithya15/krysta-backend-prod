"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const menuController_1 = require("../controllers/menuController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Get menu items for current user based on role
router.get('/user-menu', auth_1.authenticateToken, menuController_1.getMenuItemsForUser);
// Get all menu items (admin)
router.get('/all', auth_1.authenticateToken, menuController_1.getAllMenuItems);
// Get role permissions (admin)
router.get('/permissions', auth_1.authenticateToken, menuController_1.getRolePermissions);
exports.default = router;
