"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dealerVisitController_1 = require("../controllers/dealerVisitController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// All routes require authentication
router.post('/start', auth_1.authenticateToken, dealerVisitController_1.startDealerVisit);
router.post('/end', auth_1.authenticateToken, dealerVisitController_1.endDealerVisit);
router.get('/active', auth_1.authenticateToken, dealerVisitController_1.getActiveVisit);
router.get('/history', auth_1.authenticateToken, dealerVisitController_1.getVisitHistory);
router.get('/today', auth_1.authenticateToken, dealerVisitController_1.getTodayVisits);
exports.default = router;
