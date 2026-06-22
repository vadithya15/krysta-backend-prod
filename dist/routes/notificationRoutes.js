"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const notificationController_1 = require("../controllers/notificationController");
const router = (0, express_1.Router)();
// All notification routes require authentication
router.use(auth_1.authenticateToken);
// Register device token for push notifications
router.post('/register-device', notificationController_1.registerDeviceToken);
// Get pending work for current user
router.get('/pending-work', notificationController_1.getPendingWork);
// Get pending work summary (Manager/Admin only)
router.get('/pending-work-summary', notificationController_1.getPendingWorkSummary);
// Send notification to user (Admin/Manager only)
router.post('/send', notificationController_1.sendNotification);
// Get notification preferences
router.get('/preferences', notificationController_1.getNotificationPreferences);
// Update notification preferences
router.put('/preferences', notificationController_1.updateNotificationPreferences);
exports.default = router;
