"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("../config/database"));
const register = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        // Check if user exists
        const existingUser = await database_1.default.query('SELECT * FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }
        // Hash password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Insert user
        const result = await database_1.default.query(`INSERT INTO users (name, email, password, phone) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, email, phone, role_id`, [name, email, hashedPassword, phone]);
        const user = result.rows[0];
        // Get role name
        const roleResult = await database_1.default.query('SELECT name FROM roles WHERE id = $1', [user.role_id]);
        const roleName = roleResult.rows[0]?.name || 'Sales Agent';
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, name: user.name, role: roleName }, process.env.JWT_SECRET || 'secret', { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: roleName,
            },
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        // Find user
        const result = await database_1.default.query(`SELECT u.*, r.name as role_name 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE u.email = $1 AND u.is_active = true`, [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const user = result.rows[0];
        // Verify password
        const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, name: user.name, role: user.role_name || 'Sales Agent' }, process.env.JWT_SECRET || 'secret', { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role_name || 'Sales Agent',
            },
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
};
exports.login = login;
const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await database_1.default.query(`SELECT u.id, u.name, u.email, u.phone, u.created_at, r.name as role 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE u.id = $1`, [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user: result.rows[0] });
    }
    catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.getProfile = getProfile;
