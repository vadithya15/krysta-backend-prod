"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitOrderUpdate = exports.emitOrderCreated = exports.emitStockUpdate = exports.getIO = exports.initializeSocket = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
let io;
const initializeSocket = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST'],
        },
    });
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret');
            socket.data.user = decoded;
            next();
        }
        catch (error) {
            next(new Error('Authentication error'));
        }
    });
    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.data.user.email}`);
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.data.user.email}`);
        });
    });
    console.log('Socket.IO initialized');
    return io;
};
exports.initializeSocket = initializeSocket;
const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO not initialized');
    }
    return io;
};
exports.getIO = getIO;
// Emit events for real-time updates
const emitStockUpdate = (productId, newStock) => {
    if (io) {
        io.emit('stock_update', { productId, newStock, timestamp: new Date() });
    }
};
exports.emitStockUpdate = emitStockUpdate;
const emitOrderCreated = (order) => {
    if (io) {
        io.emit('order_created', { order, timestamp: new Date() });
    }
};
exports.emitOrderCreated = emitOrderCreated;
const emitOrderUpdate = (orderId, status) => {
    if (io) {
        io.emit('order_update', { orderId, status, timestamp: new Date() });
    }
};
exports.emitOrderUpdate = emitOrderUpdate;
