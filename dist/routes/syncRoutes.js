"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const syncController_1 = require("../controllers/syncController");
const router = (0, express_1.Router)();
// All sync routes require authentication
router.use(auth_1.authenticateToken);
// Batch sync multiple items
router.post('/batch', syncController_1.batchSync);
// Sync locations (high priority)
router.post('/locations', syncController_1.syncLocations);
// Get sync queue status
router.get('/queue-status', syncController_1.getSyncQueueStatus);
// Close day
router.post('/close-day', syncController_1.closeDay);
// Get daily work status
router.get('/daily-status', syncController_1.getDailyWorkStatus);
exports.default = router;
