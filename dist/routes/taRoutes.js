"use strict";
/**
 * Travel Allowance Routes
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const roleAccess_1 = require("../middleware/roleAccess");
const taController_1 = require("../controllers/taController");
const router = express_1.default.Router();
// Vehicle types routes
router.get('/vehicle-types', auth_1.authenticateToken, taController_1.getVehicleTypes);
router.get('/vehicle-types/:id', auth_1.authenticateToken, taController_1.getVehicleTypeById);
// Travel expense routes
router.post('/expenses', auth_1.authenticateToken, taController_1.createTravelExpense);
router.put('/expenses/:id', auth_1.authenticateToken, taController_1.updateTravelExpense);
router.get('/expenses', auth_1.authenticateToken, taController_1.getTravelExpenses);
router.get('/expenses/:id', auth_1.authenticateToken, taController_1.getTravelExpenseById);
router.delete('/expenses/:id', auth_1.authenticateToken, taController_1.deleteTravelExpense);
// Summary route
router.get('/summary', auth_1.authenticateToken, taController_1.getExpenseSummary);
router.get('/daily-allowance', auth_1.authenticateToken, taController_1.getDailyAllowanceForCurrentUser);
router.get('/daily-allowance/roles', auth_1.authenticateToken, (0, roleAccess_1.requireRole)(roleAccess_1.ROLES.ADMIN, roleAccess_1.ROLES.DIRECTOR), taController_1.getRoleDailyAllowances);
router.put('/daily-allowance/roles/:roleId', auth_1.authenticateToken, (0, roleAccess_1.requireRole)(roleAccess_1.ROLES.ADMIN, roleAccess_1.ROLES.DIRECTOR), taController_1.updateRoleDailyAllowance);
// Approval routes (for approvers)
router.get('/pending-by-user', auth_1.authenticateToken, taController_1.getPendingExpensesByUser);
router.get('/user/:userId/expenses', auth_1.authenticateToken, taController_1.getUserExpenses);
router.post('/approve', auth_1.authenticateToken, taController_1.approveExpenses);
exports.default = router;
