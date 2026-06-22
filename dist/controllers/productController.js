"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProductStock = exports.getProductById = exports.getProducts = void 0;
const database_1 = __importDefault(require("../config/database"));
const getProducts = async (req, res) => {
    try {
        // Pagination parameters (apply only when explicitly provided)
        const pageQuery = req.query.page;
        const limitQuery = req.query.limit;
        const usePagination = pageQuery !== undefined || limitQuery !== undefined;
        const page = usePagination
            ? Math.max(parseInt(pageQuery || '1', 10) || 1, 1)
            : 1;
        const limit = usePagination
            ? Math.max(parseInt(limitQuery || '10', 10) || 10, 1)
            : 0;
        const offset = usePagination ? (page - 1) * limit : 0;
        // Filter parameters
        const { category_id } = req.query;
        let whereClause = 'WHERE is_active = true';
        const params = [];
        if (category_id && category_id !== '1') {
            params.push(category_id);
            whereClause += ` AND category_id = $${params.length}`;
        }
        // Get total count
        const countResult = await database_1.default.query(`SELECT COUNT(*) FROM products_view ${whereClause}`, params);
        const total = parseInt(countResult.rows[0]?.count || '0', 10);
        let productsQuery = `SELECT 
        id, 
        name, 
        category_id, 
        category_name as category, 
        description, 
        unit, 
        price, 
      discount,
      billing_price,
      per_box,
        stock_quantity as quantity_in_stock, 
        min_order_quantity, 
        is_active, 
        created_at, 
        updated_at 
       FROM products_view ${whereClause} ORDER BY name`;
        if (usePagination) {
            params.push(limit);
            params.push(offset);
            productsQuery += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
        }
        const result = await database_1.default.query(productsQuery, params);
        res.json({
            data: result.rows,
            pagination: {
                total,
                page,
                limit: usePagination ? limit : total,
                pages: usePagination ? Math.ceil(total / limit) : 1,
            },
        });
    }
    catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Server error fetching products' });
    }
};
exports.getProducts = getProducts;
const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query(`SELECT 
        id, 
        name, 
        category_id, 
        category_name as category, 
        description, 
        unit, 
        price, 
        discount,
        billing_price,
        per_box,
        stock_quantity as quantity_in_stock, 
        min_order_quantity, 
        is_active, 
        created_at, 
        updated_at 
       FROM products_view
       WHERE id = $1 AND is_active = true`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ data: result.rows[0] });
    }
    catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Server error fetching product' });
    }
};
exports.getProductById = getProductById;
const updateProductStock = async (productId, quantityChange) => {
    const result = await database_1.default.query('UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [quantityChange, productId]);
    return result.rows[0];
};
exports.updateProductStock = updateProductStock;
