"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteOrderStatus = exports.updateOrderStatus = exports.createOrderStatus = exports.getOrderStatusById = exports.getAllOrderStatuses = void 0;
const database_1 = __importDefault(require("../config/database"));
// Get all order statuses
const getAllOrderStatuses = async (req, res) => {
    try {
        const result = await database_1.default.query('SELECT * FROM order_status ORDER BY name ASC');
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching order statuses:', error);
        res.status(500).json({ error: 'Failed to fetch order statuses' });
    }
};
exports.getAllOrderStatuses = getAllOrderStatuses;
// Get single order status by ID
const getOrderStatusById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query('SELECT * FROM order_status WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order status not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Error fetching order status:', error);
        res.status(500).json({ error: 'Failed to fetch order status' });
    }
};
exports.getOrderStatusById = getOrderStatusById;
// Create new order status
const createOrderStatus = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        const result = await database_1.default.query('INSERT INTO order_status (name, description) VALUES ($1, $2) RETURNING *', [name, description || null]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Order status name already exists' });
        }
        console.error('Error creating order status:', error);
        res.status(500).json({ error: 'Failed to create order status' });
    }
};
exports.createOrderStatus = createOrderStatus;
// Update order status
const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        const result = await database_1.default.query('UPDATE order_status SET name = $1, description = $2 WHERE id = $3 RETURNING *', [name, description || null, id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order status not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Order status name already exists' });
        }
        console.error('Error updating order status:', error);
        res.status(500).json({ error: 'Failed to update order status' });
    }
};
exports.updateOrderStatus = updateOrderStatus;
// Delete order status
const deleteOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query('DELETE FROM order_status WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order status not found' });
        }
        res.json({ message: 'Order status deleted successfully', orderStatus: result.rows[0] });
    }
    catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ error: 'Cannot delete order status: still in use by orders' });
        }
        console.error('Error deleting order status:', error);
        res.status(500).json({ error: 'Failed to delete order status' });
    }
};
exports.deleteOrderStatus = deleteOrderStatus;
