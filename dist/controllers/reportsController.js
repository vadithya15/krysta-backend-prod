"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductSalesReport = void 0;
const database_1 = __importDefault(require("../config/database"));
const getProductSalesReport = async (req, res) => {
    try {
        const orgId = req.organization?.id;
        if (!orgId) {
            return res.status(400).json({ error: 'Organization not set' });
        }
        const { from, to, status, limit = 50, offset = 0 } = req.query;
        const params = [orgId];
        let whereClause = 'WHERE o.organization_id = $1';
        if (from) {
            params.push(from);
            whereClause += ` AND o.created_at >= $${params.length}`;
        }
        if (to) {
            params.push(to);
            whereClause += ` AND o.created_at <= $${params.length}`;
        }
        if (status) {
            params.push(status);
            whereClause += ` AND o.status = $${params.length}`;
        }
        const limitValue = Number.isFinite(Number(limit)) ? Math.min(Math.max(Number(limit), 1), 500) : 50;
        const offsetValue = Number.isFinite(Number(offset)) ? Math.max(Number(offset), 0) : 0;
        const summaryResult = await database_1.default.query(`SELECT
         COUNT(DISTINCT oi.product_id) AS total_products,
         COALESCE(SUM(oi.quantity), 0) AS total_quantity,
         COALESCE(SUM(oi.total_price), 0) AS total_revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       ${whereClause}`, params);
        params.push(limitValue);
        params.push(offsetValue);
        const dataResult = await database_1.default.query(`SELECT
         oi.product_id,
         oi.product_name,
         COALESCE(SUM(oi.quantity), 0) AS quantity_sold,
         COALESCE(SUM(oi.total_price), 0) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       ${whereClause}
       GROUP BY oi.product_id, oi.product_name
       ORDER BY revenue DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        res.json({
            data: dataResult.rows,
            summary: {
                total_products: parseInt(summaryResult.rows[0]?.total_products || '0', 10),
                total_quantity: parseInt(summaryResult.rows[0]?.total_quantity || '0', 10),
                total_revenue: parseFloat(summaryResult.rows[0]?.total_revenue || '0'),
            },
            pagination: {
                limit: limitValue,
                offset: offsetValue,
            },
        });
    }
    catch (error) {
        console.error('Error fetching product sales report:', error);
        res.status(500).json({ error: 'Failed to fetch product sales report' });
    }
};
exports.getProductSalesReport = getProductSalesReport;
