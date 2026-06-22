"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controllers/authController");
const otpAuthController_1 = require("../controllers/otpAuthController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.post('/register', authController_1.register);
router.post('/login', authController_1.login);
router.get('/profile', auth_1.authenticateToken, authController_1.getProfile);
// OTP-based authentication
router.post('/send-otp', otpAuthController_1.sendOTP);
router.post('/verify-otp', otpAuthController_1.verifyOTP);
exports.default = router;
