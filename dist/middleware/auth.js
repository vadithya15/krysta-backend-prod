"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) {
        console.error('❌ Auth failed: No token provided. Authorization header:', authHeader ? 'present' : 'missing');
        return res.status(401).json({ error: 'Access token required' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret');
        req.user = decoded;
        // Also set userId for controllers that expect it
        req.userId = decoded.id;
        console.log(`✅ Token verified - userId: ${decoded.id}, email: ${decoded.email}`);
        next();
    }
    catch (error) {
        console.error('❌ Auth failed: Invalid or expired token. Error:', error.message);
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};
exports.authenticateToken = authenticateToken;
