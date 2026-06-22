"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const checkpointController_1 = require("../controllers/checkpointController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// All checkpoint routes require authentication
router.post('/start', auth_1.authenticateToken, checkpointController_1.startDay);
router.post('/end', auth_1.authenticateToken, checkpointController_1.endDay);
router.get('/current', auth_1.authenticateToken, checkpointController_1.getCurrentCheckpoint);
router.get('/history', auth_1.authenticateToken, checkpointController_1.getCheckpointHistory);
exports.default = router;
