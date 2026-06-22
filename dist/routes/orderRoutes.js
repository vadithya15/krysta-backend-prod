"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer = require('multer');
const orderController_1 = require("../controllers/orderController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        // Accept image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed'));
        }
    },
});
router.post('/', auth_1.authenticateToken, orderController_1.createOrder);
router.get('/', auth_1.authenticateToken, orderController_1.getOrders);
router.get('/pending-approvals', auth_1.authenticateToken, orderController_1.getPendingApprovals);
router.get('/transactions', auth_1.authenticateToken, orderController_1.getPaymentTransactions);
router.get('/receipt/:transactionId', auth_1.authenticateToken, orderController_1.getReceipt);
router.get('/dealer/:dealerId/summary', auth_1.authenticateToken, orderController_1.getDealerPaymentSummary);
router.get('/:id/pdf', auth_1.authenticateToken, orderController_1.generateOrderPdf);
router.get('/:id', auth_1.authenticateToken, orderController_1.getOrderById);
router.put('/:id/payment', auth_1.authenticateToken, orderController_1.updateOrderPayment);
router.post('/:id/payment-with-receipt', auth_1.authenticateToken, upload.single('receipt'), orderController_1.updateOrderPaymentWithReceipt);
router.put('/:id/approval', auth_1.authenticateToken, orderController_1.updateOrderApproval);
exports.default = router;
