"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auditController_1 = require("../controllers/auditController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Mobile event logging (public - will use optional token if available)
router.post('/log', auditController_1.logMobileEvent);
// All other audit routes require authentication
router.use(auth_1.authenticateToken);
// Get audit logs with filters
router.get('/logs', auditController_1.getAuditLogs);
// Get summary/dashboard
router.get('/summary', auditController_1.getAuditSummary);
// Get logs by user ID
router.get('/user/:userId', auditController_1.getUserAuditLogs);
// Get logs by phone number
router.get('/phone/:phoneNumber', auditController_1.getPhoneAuditLogs);
// Get logs by action type
router.get('/action/:action', auditController_1.getActionAuditLogs);
// Get failed attempts for a phone
router.get('/failed-attempts/:phoneNumber', auditController_1.getFailedAttempts);
// Cleanup old logs (admin only - optional: add role check)
router.post('/cleanup', auditController_1.cleanupAuditLogs);
exports.default = router;
