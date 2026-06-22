"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("./database"));
const checkRoles = async () => {
    const client = await database_1.default.connect();
    try {
        console.log('\n=== ROLES TABLE ===');
        const rolesResult = await client.query('SELECT * FROM roles ORDER BY id;');
        console.table(rolesResult.rows);
        console.log('\n=== USERS WITH ROLES ===');
        const usersResult = await client.query(`
      SELECT u.id, u.name, u.email, r.name as role 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id 
      ORDER BY u.id;
    `);
        console.table(usersResult.rows);
    }
    catch (error) {
        console.error('Error checking roles:', error);
    }
    finally {
        client.release();
        process.exit(0);
    }
};
checkRoles();
