"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const orderStatusController_1 = require("../controllers/orderStatusController");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_1.authenticateToken);
// Get all order statuses
router.get('/', orderStatusController_1.getAllOrderStatuses);
// Get single order status
router.get('/:id', orderStatusController_1.getOrderStatusById);
// Create new order status
router.post('/', orderStatusController_1.createOrderStatus);
// Update order status
router.put('/:id', orderStatusController_1.updateOrderStatus);
// Delete order status
router.delete('/:id', orderStatusController_1.deleteOrderStatus);
exports.default = router;
