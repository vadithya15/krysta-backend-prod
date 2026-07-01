"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOrderPdf = exports.updateOrderPaymentWithReceipt = exports.getReceipt = exports.getDealerPaymentSummary = exports.getPaymentTransactions = exports.updateOrderApproval = exports.getPendingApprovals = exports.updateOrderPayment = exports.getOrderById = exports.getOrders = exports.createOrder = void 0;
const database_1 = __importDefault(require("../config/database"));
const socketService_1 = require("../services/socketService");
const role_access_1 = require("../middleware/role-access");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const createOrder = async (req, res) => {
    const client = await database_1.default.connect();
    try {
        const userId = req.user?.id;
        const { dealer_id, items, subtotal, discount, tax, total, payment_method, payment_type, advance_amount, notes, } = req.body;
        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'Order must contain items' });
        }
        await client.query('BEGIN');
        // Generate order number
        const orderNumber = `ORD-${Date.now()}`;
        // Calculate remaining balance
        const remainingBalance = payment_type === 'advance' ? (total - advance_amount) : 0;
        // Create order (pending approval)
        const orderResult = await client.query(`INSERT INTO orders (order_number, user_id, dealer_id, subtotal, discount, tax, total, payment_method, payment_type, advance_amount, remaining_balance, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending')
       RETURNING *`, [
            orderNumber,
            userId,
            dealer_id,
            subtotal,
            discount,
            tax,
            total,
            payment_method,
            payment_type,
            advance_amount || 0,
            remainingBalance,
            notes,
        ]);
        const order = orderResult.rows[0];
        // Create order items (stock logic removed)
        for (const item of items) {
            // Check product existence
            const productResult = await client.query('SELECT id FROM products WHERE id = $1', [item.product_id]);
            if (productResult.rows.length === 0) {
                throw new Error(`Product ${item.product_id} not found`);
            }
            // Insert order item
            await client.query(`INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5, $6)`, [
                order.id,
                item.product_id,
                item.product_name,
                item.quantity,
                item.unit_price,
                item.total_price,
            ]);
        }
        // Create initial payment transaction for the order (status_id=1 pending, awaiting approval)
        // This represents the amount due for the order
        if (remainingBalance > 0) {
            await client.query(`INSERT INTO payment_transactions 
         (order_id, dealer_id, user_id, amount, payment_method, payment_mode, notes, status_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1)`, [
                order.id,
                dealer_id,
                userId,
                remainingBalance, // Amount due for payment
                payment_method || 'cash',
                'invoice', // Mark as invoice/due for payment
                notes || `Order placed. Amount due: ₹${remainingBalance}`,
            ]);
        }
        // If advance payment is made, create a completed payment transaction for the advance amount
        if (advance_amount && advance_amount > 0) {
            await client.query(`INSERT INTO payment_transactions 
         (order_id, dealer_id, user_id, amount, payment_method, payment_mode, notes, status_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 3)`, // status_id=3 for completed
            [
                order.id,
                dealer_id,
                userId,
                advance_amount,
                payment_method || 'cash',
                'advance', // Mark as advance payment
                `Advance payment received: ₹${advance_amount}`,
            ]);
        }
        await client.query('COMMIT');
        // Fetch complete order with items
        const completeOrder = await getOrderDetails(order.id);
        res.status(201).json({
            message: 'Order submitted for approval',
            order: completeOrder,
        });
        // Notify managers/admins about pending approval
        try {
            const approversResult = await client.query(`SELECT u.id, u.name, u.push_notification_token
               FROM users u
               JOIN roles r ON u.role_id = r.id
               WHERE r.name IN ('Manager', 'Admin') AND u.is_active = true`);
            for (const approver of approversResult.rows) {
                await client.query(`INSERT INTO notifications (user_id, title, body, type, created_at)
                 VALUES ($1, $2, $3, $4, NOW())`, [
                    approver.id,
                    'Order Approval Required',
                    `Order ${completeOrder.order_number} requires approval`,
                    'order_approval'
                ]);
            }
        }
        catch (notifyError) {
            console.error('Error notifying approvers:', notifyError);
            // Do not fail the order creation
        }
        // Emit socket event for real-time updates
        (0, socketService_1.emitOrderCreated)(completeOrder);
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Create order error:', error);
        res.status(500).json({ error: error.message || 'Server error creating order' });
    }
    finally {
        client.release();
    }
};
exports.createOrder = createOrder;
const getOrders = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { status, limit = 50, offset = 0 } = req.query;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Get accessible user IDs based on role
        const accessibleUserIds = await (0, role_access_1.getAccessibleUserIds)(userId);
        if (accessibleUserIds.length === 0) {
            return res.json({ orders: [] });
        }
        let query = `
      SELECT o.*, 
             u.name as sales_rep_name,
             dv.name as dealer_name,
             dv.city as dealer_city,
             dv.phone as dealer_phone,
             COALESCE(pm.name, o.payment_method) as payment_method_name,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', oi.id,
                   'order_id', oi.order_id,
                   'product_id', oi.product_id,
                   'product_name', oi.product_name,
                   'quantity', oi.quantity,
                   'unit_price', oi.unit_price,
                   'total_price', oi.total_price
                 )
                 ORDER BY oi.id
               ) FILTER (WHERE oi.id IS NOT NULL),
               '[]'::json
             ) as items
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN dealers_view dv ON o.dealer_id = dv.id
      LEFT JOIN payment_methods pm ON (
        (o.payment_method ~ '^\\d+$' AND o.payment_method::integer = pm.id)
        OR lower(o.payment_method) = lower(pm.name)
      )
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.user_id = ANY($1)
    `;
        const params = [accessibleUserIds];
        let paramCount = 1;
        if (status) {
            paramCount++;
            query += ` AND o.status = $${paramCount}`;
            params.push(status);
        }
        query += `
      GROUP BY o.id, u.name, dv.name, dv.city, dv.phone, pm.name
      ORDER BY o.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
        params.push(limit, offset);
        const result = await database_1.default.query(query, params);
        res.json({ orders: result.rows });
    }
    catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Server error fetching orders' });
    }
};
exports.getOrders = getOrders;
const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const accessibleUserIds = await (0, role_access_1.getAccessibleUserIds)(userId);
        const order = await getOrderDetails(parseInt(id), accessibleUserIds);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json({ order });
    }
    catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Server error fetching order' });
    }
};
exports.getOrderById = getOrderById;
// Helper function to get complete order details
const getOrderDetails = async (orderId, accessibleUserIds) => {
    let query = `
    SELECT o.*, 
           u.name as sales_rep_name,
           dv.name as dealer_name,
           dv.phone as dealer_phone,
           dv.address as dealer_address,
           dv.gst_number as dealer_gst_number,
           COALESCE(pm.name, o.payment_method) as payment_method_name
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    LEFT JOIN dealers_view dv ON o.dealer_id = dv.id
    LEFT JOIN payment_methods pm ON (
      (o.payment_method ~ '^\\d+$' AND o.payment_method::integer = pm.id)
      OR lower(o.payment_method) = lower(pm.name)
    )
    WHERE o.id = $1
  `;
    const params = [orderId];
    if (accessibleUserIds && accessibleUserIds.length > 0) {
        query += ' AND o.user_id = ANY($2)';
        params.push(accessibleUserIds);
    }
    const orderResult = await database_1.default.query(query, params);
    if (orderResult.rows.length === 0) {
        return null;
    }
    const order = orderResult.rows[0];
    // Get order items
    const itemsResult = await database_1.default.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
    order.items = itemsResult.rows;
    // Get payment transactions with status
    const paymentsResult = await database_1.default.query(`SELECT pt.id, pt.amount, pt.payment_mode, pt.payment_method, pt.reference_number, 
            pt.notes, pt.receipt_uri, pt.receipt_name, pt.created_at,
            pt.status_id, ps.name as status
     FROM payment_transactions pt
     LEFT JOIN payment_status ps ON pt.status_id = ps.id
     WHERE pt.order_id = $1 
     ORDER BY pt.created_at ASC`, [orderId]);
    order.payment_transactions = paymentsResult.rows;
    return order;
};
const updateOrderPayment = async (req, res) => {
    const client = await database_1.default.connect();
    try {
        const { id } = req.params;
        const { amount, payment_method = 'cash', payment_mode = 'cash', reference_number, notes, receipt_uri, receipt_name } = req.body;
        const userId = req.user?.id;
        // Get order (any user can collect payments)
        const orderResult = await client.query('SELECT * FROM orders WHERE id = $1', [id]);
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const order = orderResult.rows[0];
        // Validate payment amount
        if (amount <= 0 || amount > order.remaining_balance) {
            return res.status(400).json({ error: 'Invalid payment amount' });
        }
        await client.query('BEGIN');
        try {
            // Handle file saving if receipt_uri (base64 data) is provided
            let savedReceiptPath = null;
            if (receipt_uri && receipt_name) {
                try {
                    // Create receipts directory if it doesn't exist
                    const receiptsDir = path.join(process.cwd(), 'uploads', 'receipts');
                    if (!fs.existsSync(receiptsDir)) {
                        fs.mkdirSync(receiptsDir, { recursive: true });
                    }
                    // Create unique filename
                    const timestamp = Date.now();
                    const uniqueFileName = `receipt_${order.id}_${timestamp}_${receipt_name}`;
                    const filePath = path.join(receiptsDir, uniqueFileName);
                    // Decode base64 and write file
                    const buffer = Buffer.from(receipt_uri, 'base64');
                    fs.writeFileSync(filePath, buffer);
                    // Store relative path for database
                    savedReceiptPath = `uploads/receipts/${uniqueFileName}`;
                    console.log(`Receipt saved: ${savedReceiptPath}`);
                }
                catch (fileError) {
                    console.error('Error saving receipt file:', fileError);
                    // Continue without file - don't fail the payment
                }
            }
            // Calculate new balances
            const newBalancePaid = (order.balance_paid || 0) + amount;
            const newRemainingBalance = order.remaining_balance - amount;
            // Update order with payment
            const updatedOrder = await client.query(`UPDATE orders 
         SET balance_paid = $1, 
             remaining_balance = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`, [newBalancePaid, newRemainingBalance, id]);
            // Create payment transaction record for audit trail (status_id=2 completed)
            await client.query(`INSERT INTO payment_transactions 
         (order_id, dealer_id, user_id, amount, payment_method, payment_mode, reference_number, notes, receipt_uri, receipt_name, status_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 2)`, [
                order.id,
                order.dealer_id,
                userId,
                amount,
                payment_method,
                payment_mode,
                reference_number || null,
                notes || null,
                savedReceiptPath || null, // Store file path, not base64
                receipt_name || null,
            ]);
            await client.query('COMMIT');
            const accessibleUserIdsForPayment = userId ? await (0, role_access_1.getAccessibleUserIds)(userId) : undefined;
            const completeOrder = await getOrderDetails(parseInt(id), accessibleUserIdsForPayment);
            res.json({
                message: 'Payment collected successfully',
                order: completeOrder,
                transaction: {
                    amount,
                    payment_mode,
                    reference_number,
                    receipt_saved: !!savedReceiptPath,
                    timestamp: new Date().toISOString(),
                }
            });
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
    }
    catch (error) {
        console.error('Update payment error:', error);
        res.status(500).json({ error: error.message || 'Server error updating payment' });
    }
    finally {
        client.release();
    }
};
exports.updateOrderPayment = updateOrderPayment;
const getPendingApprovals = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const role = await (0, role_access_1.getUserRole)(userId);
        const allowedRoles = [role_access_1.ROLES.ADMIN, role_access_1.ROLES.DIRECTOR, role_access_1.ROLES.REGIONAL_MANAGER, role_access_1.ROLES.MANAGER];
        if (!role || !allowedRoles.includes(role)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const accessibleUserIds = await (0, role_access_1.getAccessibleUserIds)(userId);
        if (accessibleUserIds.length === 0) {
            return res.json({ orders: [] });
        }
        const { limit = 50, offset = 0 } = req.query;
        // Get orders that either have pending status OR have pending payment transactions
        const orderResult = await database_1.default.query(`SELECT DISTINCT o.*, 
              u.name as sales_rep_name,
              dv.name as dealer_name,
              dv.city as dealer_city,
              dv.phone as dealer_phone,
              dv.address as dealer_address,
              COALESCE(pm.name, o.payment_method) as payment_method_name
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN dealers_view dv ON o.dealer_id = dv.id
       LEFT JOIN payment_methods pm ON (
         (o.payment_method ~ '^\\d+$' AND o.payment_method::integer = pm.id)
         OR lower(o.payment_method) = lower(pm.name)
       )
       LEFT JOIN payment_transactions pt ON o.id = pt.order_id
       WHERE (o.status = 'pending' OR pt.status_id = 1)
         AND o.user_id = ANY($1)
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`, [accessibleUserIds, limit, offset]);
        // For each order, get its items and payment transactions with status
        const ordersWithDetails = await Promise.all(orderResult.rows.map(async (order) => {
            // Get order items
            const itemsResult = await database_1.default.query(`SELECT * FROM order_items WHERE order_id = $1`, [order.id]);
            // Get payment transactions
            const paymentsResult = await database_1.default.query(`SELECT pt.id, pt.amount, pt.payment_mode, pt.payment_method, pt.reference_number, 
                  pt.notes, pt.receipt_uri, pt.receipt_name, pt.created_at,
                  pt.status_id, ps.name as status
           FROM payment_transactions pt
           LEFT JOIN payment_status ps ON pt.status_id = ps.id
           WHERE pt.order_id = $1 
           ORDER BY pt.created_at ASC`, [order.id]);
            return {
                ...order,
                items: itemsResult.rows.length > 0 ? itemsResult.rows : [],
                payment_transactions: paymentsResult.rows.length > 0 ? paymentsResult.rows : null
            };
        }));
        res.json({ orders: ordersWithDetails });
    }
    catch (error) {
        console.error('Get pending approvals error:', error);
        res.status(500).json({ error: 'Server error fetching pending approvals' });
    }
};
exports.getPendingApprovals = getPendingApprovals;
const updateOrderApproval = async (req, res) => {
    const client = await database_1.default.connect();
    try {
        const role = req.user?.role;
        const allowedRoles = [role_access_1.ROLES.ADMIN, role_access_1.ROLES.DIRECTOR, role_access_1.ROLES.REGIONAL_MANAGER, role_access_1.ROLES.MANAGER];
        if (!role || !allowedRoles.includes(role)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const { id } = req.params;
        const { action } = req.body;
        if (!action || (action !== 'approve' && action !== 'reject')) {
            return res.status(400).json({ error: 'Invalid action. Use approve or reject.' });
        }
        await client.query('BEGIN');
        const orderResult = await client.query('SELECT * FROM orders WHERE id = $1', [id]);
        if (orderResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Order not found' });
        }
        const order = orderResult.rows[0];
        if (order.status !== 'pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Only pending orders can be approved or rejected' });
        }
        if (action === 'approve') {
            const itemsResult = await client.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
            // Stock validation removed - allowing negative stock
            for (const item of itemsResult.rows) {
                await client.query('UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [item.quantity, item.product_id]);
            }
            // Mark all pending payment transactions as completed when order is approved
            await client.query(`UPDATE payment_transactions SET status_id = 2, updated_at = CURRENT_TIMESTAMP 
         WHERE order_id = $1 AND status_id = 1`, [id]);
            await client.query(`UPDATE orders SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
        }
        else {
            // On rejection, mark payment transactions as rejected
            await client.query(`UPDATE payment_transactions SET status_id = 3, updated_at = CURRENT_TIMESTAMP 
         WHERE order_id = $1 AND status_id = 1`, [id]);
            await client.query(`UPDATE orders SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
        }
        await client.query('COMMIT');
        const completeOrder = await getOrderDetails(parseInt(id));
        // Notify sales rep about approval/rejection
        try {
            if (order.user_id) {
                await client.query(`INSERT INTO notifications (user_id, title, body, type, created_at)
           VALUES ($1, $2, $3, $4, NOW())`, [
                    order.user_id,
                    action === 'approve' ? 'Order Approved' : 'Order Rejected',
                    `Order ${completeOrder.order_number} has been ${action}d`,
                    'order_status'
                ]);
            }
        }
        catch (notifyError) {
            console.error('Error notifying sales rep:', notifyError);
        }
        // Emit socket update
        (0, socketService_1.emitOrderUpdate)(order.id, action === 'approve' ? 'confirmed' : 'rejected');
        res.json({
            message: `Order ${action}d successfully`,
            order: completeOrder,
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Update approval error:', error);
        res.status(500).json({ error: error.message || 'Server error updating approval' });
    }
    finally {
        client.release();
    }
};
exports.updateOrderApproval = updateOrderApproval;
const getPaymentTransactions = async (req, res) => {
    try {
        const { orderId, dealerId } = req.query;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Get accessible user IDs based on role
        const accessibleUserIds = await (0, role_access_1.getAccessibleUserIds)(userId);
        if (accessibleUserIds.length === 0) {
            return res.json({ transactions: [], total_transactions: 0, total_amount: 0 });
        }
        let query = `
      SELECT 
        pt.*,
        o.order_number,
        o.created_at as order_created_at,
        dv.name as dealer_name,
        u.name as collected_by,
        o.total,
        o.remaining_balance,
        o.balance_paid
      FROM payment_transactions pt
      JOIN orders o ON pt.order_id = o.id
      JOIN dealers_view dv ON pt.dealer_id = dv.id
      LEFT JOIN users u ON pt.user_id = u.id
      WHERE pt.user_id = ANY($1)
    `;
        const params = [accessibleUserIds];
        if (orderId) {
            query += ` AND pt.order_id = $${params.length + 1}`;
            params.push(orderId);
        }
        if (dealerId) {
            query += ` AND pt.dealer_id = $${params.length + 1}`;
            params.push(dealerId);
        }
        query += ` ORDER BY pt.created_at DESC`;
        const result = await database_1.default.query(query, params);
        res.json({
            transactions: result.rows,
            total_transactions: result.rows.length,
            total_amount: result.rows.reduce((sum, t) => sum + parseFloat(t.amount), 0),
        });
    }
    catch (error) {
        console.error('Get payment transactions error:', error);
        res.status(500).json({ error: error.message || 'Server error fetching transactions' });
    }
};
exports.getPaymentTransactions = getPaymentTransactions;
const getDealerPaymentSummary = async (req, res) => {
    try {
        const { dealerId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const accessibleUserIds = await (0, role_access_1.getAccessibleUserIds)(userId);
        // Get all orders for this dealer
        const ordersResult = await database_1.default.query(`
      SELECT 
        o.id,
        o.order_number,
        o.total,
        o.advance_amount,
        o.remaining_balance,
        o.balance_paid,
        o.created_at,
        COALESCE(SUM(pt.amount), 0) as collected_amount
      FROM orders o
      LEFT JOIN payment_transactions pt ON o.id = pt.order_id
      WHERE o.user_id = ANY($1) AND o.dealer_id = $2 AND o.status = 'confirmed'
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `, [accessibleUserIds, dealerId]);
        // Get payment transactions for this dealer
        const transactionsResult = await database_1.default.query(`
      SELECT 
        pt.*,
        o.order_number
      FROM payment_transactions pt
      JOIN orders o ON pt.order_id = o.id
      WHERE pt.user_id = ANY($1) AND pt.dealer_id = $2
      ORDER BY pt.created_at DESC
      LIMIT 20
    `, [accessibleUserIds, dealerId]);
        const orders = ordersResult.rows;
        const transactions = transactionsResult.rows;
        const summary = {
            dealer_id: dealerId,
            total_orders: orders.length,
            total_order_value: orders.reduce((sum, o) => sum + parseFloat(o.total), 0),
            total_pending: orders.reduce((sum, o) => sum + parseFloat(o.remaining_balance || 0), 0),
            total_collected: transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0),
            total_advance: orders.reduce((sum, o) => sum + parseFloat(o.advance_amount || 0), 0),
            orders,
            recent_transactions: transactions,
        };
        res.json(summary);
    }
    catch (error) {
        console.error('Get dealer payment summary error:', error);
        res.status(500).json({ error: error.message || 'Server error fetching summary' });
    }
};
exports.getDealerPaymentSummary = getDealerPaymentSummary;
const getReceipt = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const accessibleUserIds = await (0, role_access_1.getAccessibleUserIds)(userId);
        // Get transaction details
        const result = await database_1.default.query(`SELECT receipt_uri, receipt_name FROM payment_transactions 
       WHERE id = $1 AND user_id = ANY($2)`, [transactionId, accessibleUserIds]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        const { receipt_uri, receipt_name } = result.rows[0];
        if (!receipt_uri) {
            return res.status(404).json({ error: 'No receipt file found for this transaction' });
        }
        // Construct full file path
        const filePath = path.join(process.cwd(), receipt_uri);
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Receipt file not found on server' });
        }
        // Send file
        res.download(filePath, receipt_name || 'receipt', (err) => {
            if (err) {
                console.error('Error sending receipt file:', err);
            }
        });
    }
    catch (error) {
        console.error('Get receipt error:', error);
        res.status(500).json({ error: error.message || 'Server error fetching receipt' });
    }
};
exports.getReceipt = getReceipt;
// Update order payment with receipt file upload (multipart/form-data)
const updateOrderPaymentWithReceipt = async (req, res) => {
    const client = await database_1.default.connect();
    try {
        const { id } = req.params;
        const { amount, payment_method = 'cash', payment_mode = 'cash', reference_number, notes } = req.body;
        const file = req.file; // Multer-processed file
        const userId = req.user?.id;
        // console.log('Payment request received:', {
        //   orderId: id,
        //   amount,
        //   paymentMethod: payment_method,
        //   paymentMode: payment_mode,
        //   userId,
        //   hasFile: !!file,
        //   fileName: file?.originalname,
        // });
        // Get order (any user can collect payments)
        const orderResult = await client.query('SELECT * FROM orders WHERE id = $1', [id]);
        if (orderResult.rows.length === 0) {
            // console.log(`Order ${id} not found`);
            return res.status(404).json({ error: 'Order not found' });
        }
        const order = orderResult.rows[0];
        const amountValue = parseFloat(amount);
        // console.log('Order details:', {
        //   orderId: order.id,
        //   remainingBalance: order.remaining_balance,
        //   amountValue,
        // });
        // Validate payment amount
        if (amountValue <= 0 || amountValue > order.remaining_balance) {
            // console.log(`Invalid amount: ${amountValue}, remaining: ${order.remaining_balance}`);
            return res.status(400).json({ error: 'Invalid payment amount' });
        }
        await client.query('BEGIN');
        try {
            // Handle file saving if receipt file is provided
            let savedReceiptPath = null;
            let receiptFileName = null;
            if (file) {
                try {
                    // Create receipts directory if it doesn't exist
                    const receiptsDir = path.join(process.cwd(), 'uploads', 'receipts');
                    if (!fs.existsSync(receiptsDir)) {
                        fs.mkdirSync(receiptsDir, { recursive: true });
                    }
                    // Create unique filename
                    const timestamp = Date.now();
                    const originalFileName = file.originalname;
                    const uniqueFileName = `receipt_${order.id}_${timestamp}_${originalFileName}`;
                    const filePath = path.join(receiptsDir, uniqueFileName);
                    // Write file from buffer
                    fs.writeFileSync(filePath, file.buffer);
                    // Store relative path for database
                    savedReceiptPath = `uploads/receipts/${uniqueFileName}`;
                    receiptFileName = originalFileName;
                    // console.log(`Receipt saved successfully: ${savedReceiptPath}`);
                }
                catch (fileError) {
                    console.error('Error saving receipt file:', fileError);
                    // Continue without file - don't fail the payment
                }
            }
            // Calculate new balances
            const newBalancePaid = (order.balance_paid || 0) + amountValue;
            const newRemainingBalance = order.remaining_balance - amountValue;
            // console.log('Updating order balances:', {
            //   oldBalancePaid: order.balance_paid,
            //   newBalancePaid,
            //   oldRemainingBalance: order.remaining_balance,
            //   newRemainingBalance,
            // });
            // Update order with payment
            const updatedOrder = await client.query(`UPDATE orders 
         SET balance_paid = $1, 
             remaining_balance = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`, [newBalancePaid, newRemainingBalance, id]);
            // console.log('Order updated:', updatedOrder.rows[0]);
            // Create payment transaction record for audit trail (status_id=2 completed)
            const transactionResult = await client.query(`INSERT INTO payment_transactions 
         (order_id, dealer_id, user_id, amount, payment_method, payment_mode, reference_number, notes, receipt_uri, receipt_name, status_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 2)
         RETURNING *`, [
                order.id,
                order.dealer_id,
                userId,
                amountValue,
                payment_method,
                payment_mode,
                reference_number || null,
                notes || null,
                savedReceiptPath || null,
                receiptFileName || null,
            ]);
            // console.log('Payment transaction created:', transactionResult.rows[0]);
            await client.query('COMMIT');
            const accessibleUserIdsForPayment = userId ? await (0, role_access_1.getAccessibleUserIds)(userId) : undefined;
            const completeOrder = await getOrderDetails(parseInt(id), accessibleUserIdsForPayment);
            res.json({
                message: 'Payment collected successfully with receipt',
                order: completeOrder,
                transaction: {
                    amount: amountValue,
                    paymentMode: payment_mode,
                    newBalance: newRemainingBalance,
                    receiptPath: savedReceiptPath,
                },
            });
        }
        catch (innerError) {
            await client.query('ROLLBACK');
            throw innerError;
        }
    }
    catch (error) {
        console.error('Update payment error:', error);
        res.status(500).json({ error: error.message || 'Server error updating payment' });
    }
    finally {
        client.release();
    }
};
exports.updateOrderPaymentWithReceipt = updateOrderPaymentWithReceipt;
const generateOrderPdf = async (req, res) => {
    try {
        const { id } = req.params;
        // Get order details with items
        const order = await getOrderDetails(parseInt(id));
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        // Create PDF document
        const doc = new pdfkit_1.default({
            size: 'A4',
            margin: 40,
        });
        // Set response headers for PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Order-${order.order_number}.pdf"`);
        // Pipe to response
        doc.pipe(res);
        // Add title
        doc.fontSize(20).font('Helvetica-Bold').text('ORDER APPROVAL DOCUMENT', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica').text('─'.repeat(80), { align: 'center' });
        doc.moveDown();
        // Order Information
        doc.fontSize(12).font('Helvetica-Bold').text('ORDER INFORMATION');
        doc.fontSize(10).font('Helvetica');
        doc.text(`Order Number: ${order.order_number}`, { indent: 20 });
        doc.text(`Order Date: ${new Date(order.created_at).toLocaleDateString()}`, { indent: 20 });
        doc.text(`Status: ${order.status.toUpperCase()}`, { indent: 20 });
        doc.moveDown();
        // Dealer Information
        doc.fontSize(12).font('Helvetica-Bold').text('DEALER INFORMATION');
        doc.fontSize(10).font('Helvetica');
        doc.text(`Dealer: ${order.dealer_name}`, { indent: 20 });
        if (order.dealer_phone) {
            doc.text(`Phone: ${order.dealer_phone}`, { indent: 20 });
        }
        if (order.dealer_gst_number) {
            doc.text(`GSTIN: ${order.dealer_gst_number}`, { indent: 20 });
        }
        if (order.dealer_address) {
            doc.text(`Address: ${order.dealer_address}`, { indent: 20 });
        }
        doc.moveDown();
        // Sales Rep Information
        doc.fontSize(12).font('Helvetica-Bold').text('SALES REPRESENTATIVE');
        doc.fontSize(10).font('Helvetica');
        doc.text(`Name: ${order.sales_rep_name || 'N/A'}`, { indent: 20 });
        doc.moveDown();
        // Products Table
        doc.fontSize(12).font('Helvetica-Bold').text('PRODUCTS ORDERED');
        doc.moveDown(0.3);
        // Table headers
        const tableTop = doc.y;
        const col1X = 50;
        const col2X = 280;
        const col3X = 360;
        const col4X = 450;
        const col5X = 530;
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Product Name', col1X, tableTop);
        doc.text('Qty', col3X, tableTop);
        doc.text('Unit Price', col4X, tableTop);
        doc.text('Total', col5X, tableTop);
        // Draw line under headers
        doc.moveTo(col1X - 10, tableTop + 15).lineTo(570, tableTop + 15).stroke();
        // Table rows
        doc.fontSize(9).font('Helvetica');
        let currentY = tableTop + 25;
        if (order.items && order.items.length > 0) {
            order.items.forEach((item) => {
                doc.text(item.product_name, col1X, currentY, { width: 200 });
                doc.text(item.quantity.toString(), col3X, currentY);
                doc.text(`Rs. ${Number(item.unit_price).toFixed(2)}`, col4X, currentY);
                doc.text(`Rs. ${Number(item.total_price).toFixed(2)}`, col5X, currentY);
                currentY += 15;
            });
        }
        // Draw line after items
        doc.moveTo(col1X - 10, currentY + 5).lineTo(570, currentY + 5).stroke();
        currentY += 15;
        // Payment Summary
        const subtotal = Number(order.subtotal || 0);
        const discount = Number(order.discount || 0);
        const taxAmount = Number(order.tax || 0);
        const taxableAmount = subtotal - discount;
        const cgstAmount = taxAmount / 2;
        const sgstAmount = taxAmount / 2;
        doc.fontSize(12).font('Helvetica-Bold').text('PAYMENT SUMMARY');
        doc.fontSize(10).font('Helvetica');
        doc.text(`Subtotal: Rs. ${subtotal.toFixed(2)}`, { indent: 20 });
        if (discount > 0) {
            doc.text(`Discount: -Rs. ${discount.toFixed(2)}`, { indent: 20 });
        }
        doc.text(`Taxable Amount: Rs. ${taxableAmount.toFixed(2)}`, { indent: 20 });
        doc.text(`CGST (9%): Rs. ${cgstAmount.toFixed(2)}`, { indent: 20 });
        doc.text(`SGST (9%): Rs. ${sgstAmount.toFixed(2)}`, { indent: 20 });
        doc.text(`Total GST: Rs. ${taxAmount.toFixed(2)}`, { indent: 20 });
        doc.fontSize(11).font('Helvetica-Bold');
        doc.text(`Total Amount: Rs. ${Number(order.total || 0).toFixed(2)}`, { indent: 20 });
        doc.moveDown();
        // Payment Details
        if (order.payment_type) {
            doc.fontSize(11).font('Helvetica-Bold').text('PAYMENT TYPE');
            doc.fontSize(10).font('Helvetica');
            doc.text(`Type: ${order.payment_type.toUpperCase()}`, { indent: 20 });
            if (order.advance_amount && order.advance_amount > 0) {
                doc.text(`Advance Collected: Rs. ${Number(order.advance_amount).toFixed(2)}`, { indent: 20 });
                if (order.remaining_balance && order.remaining_balance > 0) {
                    doc.text(`Outstanding Due: Rs. ${Number(order.remaining_balance).toFixed(2)}`, { indent: 20 });
                }
            }
            doc.moveDown();
        }
        // Notes
        if (order.notes) {
            doc.fontSize(11).font('Helvetica-Bold').text('NOTES');
            doc.fontSize(10).font('Helvetica');
            doc.text(order.notes, { indent: 20, width: 500 });
            doc.moveDown();
        }
        // Footer
        doc.fontSize(9).font('Helvetica').text('─'.repeat(80), { align: 'center' });
        doc.text(`Document Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.text('Krysta Sales Tracker - Approval System', { align: 'center' });
        // Finalize PDF
        doc.end();
    }
    catch (error) {
        console.error('Generate PDF error:', error);
        res.status(500).json({ error: error.message || 'Server error generating PDF' });
    }
};
exports.generateOrderPdf = generateOrderPdf;
