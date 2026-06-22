"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const categoryController_1 = require("../controllers/categoryController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_1.authenticateToken);
// Get all categories (with pagination)
router.get('/', categoryController_1.getCategories);
// Get single category by ID
router.get('/:id', categoryController_1.getCategoryById);
// Create new category
router.post('/', categoryController_1.createCategory);
// Update category
router.put('/:id', categoryController_1.updateCategory);
// Delete category (soft delete)
router.delete('/:id', categoryController_1.deleteCategory);
exports.default = router;
