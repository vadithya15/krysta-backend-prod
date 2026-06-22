"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const menuItemController_1 = require("../controllers/menuItemController");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_1.authenticateToken);
// Get all menu items
router.get('/', menuItemController_1.getAllMenuItems);
// Get single menu item
router.get('/:id', menuItemController_1.getMenuItemById);
// Create new menu item
router.post('/', menuItemController_1.createMenuItem);
// Update menu item
router.put('/:id', menuItemController_1.updateMenuItem);
// Delete menu item
router.delete('/:id', menuItemController_1.deleteMenuItem);
exports.default = router;
