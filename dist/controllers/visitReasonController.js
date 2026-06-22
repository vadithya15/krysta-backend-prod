"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteVisitReason = exports.updateVisitReason = exports.createVisitReason = exports.getVisitReasonById = exports.getAllVisitReasons = void 0;
const database_1 = __importDefault(require("../config/database"));
// Get all visit reasons
const getAllVisitReasons = async (req, res) => {
    try {
        const result = await database_1.default.query('SELECT * FROM visit_reasons ORDER BY name ASC');
        console.log('✅ Returning visit reasons:', {
            count: result.rows.length,
            sample: result.rows[0],
            all: JSON.stringify(result.rows, null, 2)
        });
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching visit reasons:', error);
        res.status(500).json({ error: 'Failed to fetch visit reasons' });
    }
};
exports.getAllVisitReasons = getAllVisitReasons;
// Get single visit reason by ID
const getVisitReasonById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query('SELECT * FROM visit_reasons WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Visit reason not found' });
        }
        res.json({ data: result.rows[0] });
    }
    catch (error) {
        console.error('Error fetching visit reason:', error);
        res.status(500).json({ error: 'Failed to fetch visit reason' });
    }
};
exports.getVisitReasonById = getVisitReasonById;
// Create new visit reason
const createVisitReason = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        const result = await database_1.default.query('INSERT INTO visit_reasons (name, description) VALUES ($1, $2) RETURNING *', [name, description || null]);
        res.status(201).json({ data: result.rows[0] });
    }
    catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Visit reason name already exists' });
        }
        console.error('Error creating visit reason:', error);
        res.status(500).json({ error: 'Failed to create visit reason' });
    }
};
exports.createVisitReason = createVisitReason;
// Update visit reason
const updateVisitReason = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, is_active, show_on_ui } = req.body;
        // Get current visit reason first
        const current = await database_1.default.query('SELECT * FROM visit_reasons WHERE id = $1', [id]);
        if (current.rows.length === 0) {
            return res.status(404).json({ error: 'Visit reason not found' });
        }
        const result = await database_1.default.query('UPDATE visit_reasons SET name = $1, description = $2, is_active = $3, show_on_ui = $4 WHERE id = $5 RETURNING *', [
            name !== undefined ? name : current.rows[0].name,
            description !== undefined ? description : current.rows[0].description,
            is_active !== undefined ? is_active : current.rows[0].is_active,
            show_on_ui !== undefined ? show_on_ui : current.rows[0].show_on_ui,
            id
        ]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Visit reason not found' });
        }
        res.json({ data: result.rows[0] });
    }
    catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Visit reason name already exists' });
        }
        console.error('Error updating visit reason:', error);
        res.status(500).json({ error: 'Failed to update visit reason' });
    }
};
exports.updateVisitReason = updateVisitReason;
// Delete visit reason
const deleteVisitReason = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query('DELETE FROM visit_reasons WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Visit reason not found' });
        }
        res.json({ message: 'Visit reason deleted successfully', visitReason: result.rows[0] });
    }
    catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ error: 'Cannot delete visit reason: still in use by visits' });
        }
        console.error('Error deleting visit reason:', error);
        res.status(500).json({ error: 'Failed to delete visit reason' });
    }
};
exports.deleteVisitReason = deleteVisitReason;
