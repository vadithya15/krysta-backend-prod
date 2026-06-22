"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const socketService_1 = require("./services/socketService");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const productRoutes_1 = __importDefault(require("./routes/productRoutes"));
const categoryRoutes_1 = __importDefault(require("./routes/categoryRoutes"));
const dealerRoutes_1 = __importDefault(require("./routes/dealerRoutes"));
const dealerVisitRoutes_1 = __importDefault(require("./routes/dealerVisitRoutes"));
const orderRoutes_1 = __importDefault(require("./routes/orderRoutes"));
const checkpointRoutes_1 = __importDefault(require("./routes/checkpointRoutes"));
const locationRoutes_1 = __importDefault(require("./routes/locationRoutes"));
const menuRoutes_1 = __importDefault(require("./routes/menuRoutes"));
const targetRoutes_1 = __importDefault(require("./routes/targetRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const dealerPlanningRoutes_1 = __importDefault(require("./routes/dealerPlanningRoutes"));
const routeOptimizationRoutes_1 = __importDefault(require("./routes/routeOptimizationRoutes"));
const syncRoutes_1 = __importDefault(require("./routes/syncRoutes"));
const auditRoutes_1 = __importDefault(require("./routes/auditRoutes"));
const settingsRoutes_1 = __importDefault(require("./routes/settingsRoutes"));
const taRoutes_1 = __importDefault(require("./routes/taRoutes"));
const organizationRoutes_1 = __importDefault(require("./routes/organizationRoutes"));
const reportsRoutes_1 = __importDefault(require("./routes/reportsRoutes"));
// Admin Panel Master Tables Routes (Phase 2)
const unitRoutes_1 = __importDefault(require("./routes/unitRoutes"));
const paymentMethodRoutes_1 = __importDefault(require("./routes/paymentMethodRoutes"));
const orderStatusRoutes_1 = __importDefault(require("./routes/orderStatusRoutes"));
const visitReasonRoutes_1 = __importDefault(require("./routes/visitReasonRoutes"));
const menuItemRoutes_1 = __importDefault(require("./routes/menuItemRoutes"));
const rolePermissionRoutes_1 = __importDefault(require("./routes/rolePermissionRoutes"));
const areaRoutes_1 = __importDefault(require("./routes/areaRoutes"));
const regionRoutes_1 = __importDefault(require("./routes/regionRoutes"));
const database_1 = require("./config/database");
const initDb_1 = __importDefault(require("./config/initDb"));
const notificationController_1 = require("./controllers/notificationController");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Initialize Socket.IO
(0, socketService_1.initializeSocket)(server);
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
}));
// Increase JSON payload limit for large requests
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Serve static files from uploads directory
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// Routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/organizations', organizationRoutes_1.default);
app.use('/api/products', productRoutes_1.default);
app.use('/api/categories', categoryRoutes_1.default);
app.use('/api/dealers', dealerRoutes_1.default);
app.use('/api/dealer-visits', dealerVisitRoutes_1.default);
app.use('/api/orders', orderRoutes_1.default);
app.use('/api/checkpoints', checkpointRoutes_1.default);
app.use('/api/locations', locationRoutes_1.default);
app.use('/api/menu', menuRoutes_1.default);
app.use('/api/targets', targetRoutes_1.default);
app.use('/api/users', userRoutes_1.default);
app.use('/api/audit', auditRoutes_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
app.use('/api/sync', syncRoutes_1.default);
app.use('/api/settings', settingsRoutes_1.default);
app.use('/api/ta', taRoutes_1.default);
app.use('/api/reports', reportsRoutes_1.default);
// Dealer Planning API
app.use('/api/dealer-planning', dealerPlanningRoutes_1.default);
// Route Optimization API
app.use('/api/routes', routeOptimizationRoutes_1.default);
// Admin Panel - Master Tables API (Phase 2)
app.use('/api/admin/units', unitRoutes_1.default);
app.use('/api/admin/payment-methods', paymentMethodRoutes_1.default);
app.use('/api/admin/order-statuses', orderStatusRoutes_1.default);
app.use('/api/admin/visit-reasons', visitReasonRoutes_1.default);
app.use('/api/admin/menu-items', menuItemRoutes_1.default);
app.use('/api/admin/role-permissions', rolePermissionRoutes_1.default);
app.use('/api/regions', regionRoutes_1.default);
app.use('/api/areas', areaRoutes_1.default);
// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    console.error('Error stack:', err.stack);
    console.error('Request URL:', req.url);
    console.error('Request method:', req.method);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});
const PORT = process.env.PORT || 3000;
const startServer = async () => {
    try {
        // Test database connection
        const dbConnected = await (0, database_1.testConnection)();
        if (!dbConnected) {
            console.error('Failed to connect to database. Please check your database configuration.');
            process.exit(1);
        }
        // Initialize database tables and schema
        await (0, initDb_1.default)();
        // Initialize notifications table
        await (0, notificationController_1.initializeNotificationsTable)();
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log('Socket.IO initialized');
            console.log('Notification and Sync services initialized');
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
if (process.env.NODE_ENV !== 'test') {
    startServer();
}
exports.default = app;
