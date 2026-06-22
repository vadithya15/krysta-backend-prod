"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const paymentMethodController_1 = require("../controllers/paymentMethodController");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_1.authenticateToken);
// Get all payment methods
router.get('/', paymentMethodController_1.getAllPaymentMethods);
// Get single payment method
router.get('/:id', paymentMethodController_1.getPaymentMethodById);
// Create new payment method
router.post('/', paymentMethodController_1.createPaymentMethod);
// Update payment method
router.put('/:id', paymentMethodController_1.updatePaymentMethod);
// Delete payment method
router.delete('/:id', paymentMethodController_1.deletePaymentMethod);
exports.default = router;
