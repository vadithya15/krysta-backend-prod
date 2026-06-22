"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const locationController_1 = require("../controllers/locationController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// All location routes require authentication
router.post('/track', auth_1.authenticateToken, locationController_1.saveLocation);
router.get('/history', auth_1.authenticateToken, locationController_1.getLocationHistory);
router.get('/all-users', auth_1.authenticateToken, locationController_1.getAllUsersLocations);
router.get('/settings', auth_1.authenticateToken, locationController_1.getTrackingSettings);
router.put('/settings', auth_1.authenticateToken, locationController_1.updateTrackingSettings);
exports.default = router;
