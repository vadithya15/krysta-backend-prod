"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testConnection = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const dbHost = String(process.env.DB_HOST || 'localhost').trim();
const sslMode = String(process.env.DB_SSL_MODE || process.env.DB_SSL || '').toLowerCase();
const isLocalHost = dbHost === 'localhost' || dbHost === '127.0.0.1' || dbHost === '::1';
// If SSL mode is explicitly configured, honor it.
// Otherwise, default to SSL for non-local database hosts to satisfy managed Postgres pg_hba rules.
const useSsl = sslMode
    ? sslMode === 'true' || sslMode === 'require' || sslMode === '1'
    : !isLocalHost;
const pool = new pg_1.Pool({
    host: dbHost,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'krysta_sales',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: 20,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // increased from 2000 — AWS RDS needs more time
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
});
pool.on('error', (err) => {
    // Log but do NOT exit — stale connections drop occasionally and the pool will recover
    console.error('Unexpected error on idle pg-pool client (non-fatal):', err.message);
});
// Test database connection
const testConnection = async () => {
    try {
        const client = await pool.connect();
        console.log('Database connected successfully');
        client.release();
        return true;
    }
    catch (error) {
        console.error('Database connection failed:', error);
        return false;
    }
};
exports.testConnection = testConnection;
exports.default = pool;
