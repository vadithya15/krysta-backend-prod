"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePaymentMethod = exports.updatePaymentMethod = exports.createPaymentMethod = exports.getPaymentMethodById = exports.getAllPaymentMethods = void 0;
const database_1 = __importDefault(require("../config/database"));
// Get all payment methods (filtering by visibility and active status)
const getAllPaymentMethods = async (req, res) => {
    try {
        // Query param: ?ui=false returns all, default returns only visible + active methods
        const showOnUiOnly = req.query.ui !== 'false';
        let query = 'SELECT * FROM payment_methods';
        if (showOnUiOnly) {
            query += " WHERE show_on_ui = true AND is_active = true";
        }
        query += ' ORDER BY name ASC';
        const result = await database_1.default.query(query);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching payment methods:', error);
        res.status(500).json({ error: 'Failed to fetch payment methods' });
    }
};
exports.getAllPaymentMethods = getAllPaymentMethods;
// Get single payment method by ID
const getPaymentMethodById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query('SELECT * FROM payment_methods WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payment method not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Error fetching payment method:', error);
        res.status(500).json({ error: 'Failed to fetch payment method' });
    }
};
exports.getPaymentMethodById = getPaymentMethodById;
// Create new payment method
const createPaymentMethod = async (req, res) => {
    try {
        const { name, description, is_active } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        const result = await database_1.default.query('INSERT INTO payment_methods (name, description, is_active) VALUES ($1, $2, $3) RETURNING *', [name, description || null, is_active !== false]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Payment method name already exists' });
        }
        console.error('Error creating payment method:', error);
        res.status(500).json({ error: 'Failed to create payment method' });
    }
};
exports.createPaymentMethod = createPaymentMethod;
// Update payment method
const updatePaymentMethod = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, is_active } = req.body;
        const result = await database_1.default.query('UPDATE payment_methods SET name = $1, description = $2, is_active = $3 WHERE id = $4 RETURNING *', [name, description || null, is_active, id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payment method not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Payment method name already exists' });
        }
        console.error('Error updating payment method:', error);
        res.status(500).json({ error: 'Failed to update payment method' });
    }
};
exports.updatePaymentMethod = updatePaymentMethod;
// Delete payment method
const deletePaymentMethod = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query('DELETE FROM payment_methods WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Payment method not found' });
        }
        res.json({ message: 'Payment method deleted successfully', paymentMethod: result.rows[0] });
    }
    catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ error: 'Cannot delete payment method: still in use by orders' });
        }
        console.error('Error deleting payment method:', error);
        res.status(500).json({ error: 'Failed to delete payment method' });
    }
};
exports.deletePaymentMethod = deletePaymentMethod;
