"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const targetController_1 = require("../controllers/targetController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// All target routes require authentication
router.use(auth_1.authenticateToken);
// Set target for a user (create or update)
router.post('/user/:userId', targetController_1.setUserTarget);
// Get all targets for a user
router.get('/user/:userId', targetController_1.getUserTargets);
// Get target by type for a user
router.get('/user/:userId/by-type', targetController_1.getTargetByType);
// Get all targets (admin view)
router.get('/', targetController_1.getAllTargets);
// Delete target
router.delete('/:targetId', targetController_1.deleteTarget);
exports.default = router;
