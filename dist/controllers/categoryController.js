"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategoryById = exports.getCategories = void 0;
const database_1 = __importDefault(require("../config/database"));
/**
 * Get all categories with pagination
 */
const getCategories = async (req, res) => {
    try {
        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        // Filter parameters
        const search = req.query.search;
        const is_active = req.query.is_active;
        // Build WHERE conditions
        let whereConditions = ['1=1'];
        let queryParams = [];
        let paramIndex = 1;
        if (search) {
            whereConditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }
        if (is_active !== undefined) {
            whereConditions.push(`is_active = $${paramIndex}`);
            queryParams.push(is_active === 'true');
            paramIndex++;
        }
        const whereClause = whereConditions.join(' AND ');
        // Get total count
        const countResult = await database_1.default.query(`SELECT COUNT(*) as count FROM categories WHERE ${whereClause}`, queryParams);
        const total = parseInt(countResult.rows[0].count);
        // Get paginated categories
        const result = await database_1.default.query(`SELECT * FROM categories 
       WHERE ${whereClause}
       ORDER BY name
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, [...queryParams, limit, offset]);
        res.json({
            data: result.rows,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to fetch categories'
        });
    }
};
exports.getCategories = getCategories;
/**
 * Get a single category by ID
 */
const getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query('SELECT * FROM categories WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json({ data: result.rows[0] });
    }
    catch (error) {
        console.error('Get category error:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to fetch category'
        });
    }
};
exports.getCategoryById = getCategoryById;
/**
 * Create a new category
 */
const createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        // Validate required fields
        if (!name) {
            return res.status(400).json({ error: 'Category name is required' });
        }
        // Check if category already exists
        const existingCategory = await database_1.default.query('SELECT id FROM categories WHERE LOWER(name) = LOWER($1)', [name]);
        if (existingCategory.rows.length > 0) {
            return res.status(409).json({ error: 'Category with this name already exists' });
        }
        // Insert category
        const result = await database_1.default.query(`INSERT INTO categories (name, description, is_active, created_at, updated_at)
       VALUES ($1, $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`, [name, description || null]);
        res.status(201).json({
            message: 'Category created successfully',
            data: result.rows[0],
        });
    }
    catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to create category'
        });
    }
};
exports.createCategory = createCategory;
/**
 * Update an existing category
 */
const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, is_active } = req.body;
        // Check if category exists
        const existingCategory = await database_1.default.query('SELECT * FROM categories WHERE id = $1', [id]);
        if (existingCategory.rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        // Check if new name conflicts with another category
        if (name && name !== existingCategory.rows[0].name) {
            const nameConflict = await database_1.default.query('SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND id != $2', [name, id]);
            if (nameConflict.rows.length > 0) {
                return res.status(409).json({ error: 'Category with this name already exists' });
            }
        }
        const oldCategory = existingCategory.rows[0];
        // Update category
        const result = await database_1.default.query(`UPDATE categories SET
        name = $1,
        description = $2,
        is_active = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *`, [
            name !== undefined ? name : oldCategory.name,
            description !== undefined ? description : oldCategory.description,
            is_active !== undefined ? is_active : oldCategory.is_active,
            id,
        ]);
        res.json({
            message: 'Category updated successfully',
            data: result.rows[0],
        });
    }
    catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to update category'
        });
    }
};
exports.updateCategory = updateCategory;
/**
 * Delete a category (soft delete)
 */
const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        // Check if category exists
        const existingCategory = await database_1.default.query('SELECT * FROM categories WHERE id = $1', [id]);
        if (existingCategory.rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        // Check if category is being used by products
        const productsUsingCategory = await database_1.default.query('SELECT COUNT(*) as count FROM products WHERE category_id = $1', [id]);
        const productCount = parseInt(productsUsingCategory.rows[0].count);
        if (productCount > 0) {
            return res.status(400).json({
                error: 'Cannot delete category',
                message: `This category is being used by ${productCount} product(s)`
            });
        }
        // Soft delete
        await database_1.default.query(`UPDATE categories SET 
        is_active = false, 
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1`, [id]);
        res.json({
            message: 'Category deleted successfully'
        });
    }
    catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to delete category'
        });
    }
};
exports.deleteCategory = deleteCategory;
