"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUnit = exports.updateUnit = exports.createUnit = exports.getUnitById = exports.getAllUnits = void 0;
const database_1 = __importDefault(require("../config/database"));
// Get all units
const getAllUnits = async (req, res) => {
    try {
        const result = await database_1.default.query('SELECT * FROM units ORDER BY name ASC');
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching units:', error);
        res.status(500).json({ error: 'Failed to fetch units' });
    }
};
exports.getAllUnits = getAllUnits;
// Get single unit by ID
const getUnitById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query('SELECT * FROM units WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Unit not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Error fetching unit:', error);
        res.status(500).json({ error: 'Failed to fetch unit' });
    }
};
exports.getUnitById = getUnitById;
// Create new unit
const createUnit = async (req, res) => {
    try {
        const { name, abbreviation, description } = req.body;
        if (!name || !abbreviation) {
            return res.status(400).json({ error: 'Name and abbreviation are required' });
        }
        const result = await database_1.default.query('INSERT INTO units (name, abbreviation, description) VALUES ($1, $2, $3) RETURNING *', [name, abbreviation, description || null]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Unit name or abbreviation already exists' });
        }
        console.error('Error creating unit:', error);
        res.status(500).json({ error: 'Failed to create unit' });
    }
};
exports.createUnit = createUnit;
// Update unit
const updateUnit = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, abbreviation, description } = req.body;
        const result = await database_1.default.query('UPDATE units SET name = $1, abbreviation = $2, description = $3 WHERE id = $4 RETURNING *', [name, abbreviation, description || null, id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Unit not found' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Unit name or abbreviation already exists' });
        }
        console.error('Error updating unit:', error);
        res.status(500).json({ error: 'Failed to update unit' });
    }
};
exports.updateUnit = updateUnit;
// Delete unit
const deleteUnit = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query('DELETE FROM units WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Unit not found' });
        }
        res.json({ message: 'Unit deleted successfully', unit: result.rows[0] });
    }
    catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ error: 'Cannot delete unit: still in use by products' });
        }
        console.error('Error deleting unit:', error);
        res.status(500).json({ error: 'Failed to delete unit' });
    }
};
exports.deleteUnit = deleteUnit;
