"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const routeOptimizationController_1 = require("../controllers/routeOptimizationController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// All routes require authentication
router.post('/optimize-from-plan', auth_1.authenticateToken, routeOptimizationController_1.optimizeRouteFromPlan);
router.post('/get-route', auth_1.authenticateToken, routeOptimizationController_1.getRoute);
router.post('/get-distance', auth_1.authenticateToken, routeOptimizationController_1.getDistance);
router.delete('/cache', auth_1.authenticateToken, routeOptimizationController_1.clearRouteCache);
exports.default = router;
