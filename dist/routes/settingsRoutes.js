"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settingsController_1 = require("../controllers/settingsController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public routes (no authentication required)
router.get('/public', settingsController_1.getPublicSettings);
router.get('/public/:key', settingsController_1.getSettingByKey);
// Protected routes (authentication required)
router.get('/', auth_1.authenticateToken, settingsController_1.getAllSettings);
router.get('/id/:id', auth_1.authenticateToken, settingsController_1.getSettingById);
router.post('/', auth_1.authenticateToken, settingsController_1.createSetting);
router.put('/id/:id', auth_1.authenticateToken, settingsController_1.updateSettingById);
router.delete('/id/:id', auth_1.authenticateToken, settingsController_1.deleteSetting);
router.put('/:key', auth_1.authenticateToken, settingsController_1.updateSetting);
exports.default = router;
