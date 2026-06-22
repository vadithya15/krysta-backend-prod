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
const database_1 = __importDefault(require("./database"));
const readline = __importStar(require("readline"));
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const question = (query) => {
    return new Promise(resolve => rl.question(query, resolve));
};
const updateUserRole = async () => {
    const client = await database_1.default.connect();
    try {
        // Show available roles
        console.log('\n=== AVAILABLE ROLES ===');
        const rolesResult = await client.query('SELECT id, name, description FROM roles ORDER BY id;');
        rolesResult.rows.forEach(role => {
            console.log(`${role.id}. ${role.name} - ${role.description}`);
        });
        // Show users
        console.log('\n=== USERS ===');
        const usersResult = await client.query(`
      SELECT u.id, u.name, u.email, r.name as current_role 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id 
      ORDER BY u.id;
    `);
        usersResult.rows.forEach(user => {
            console.log(`${user.id}. ${user.name} (${user.email}) - Current Role: ${user.current_role || 'None'}`);
        });
        // Get input
        console.log('\n');
        const userIdStr = await question('Enter user ID to update: ');
        const userId = parseInt(userIdStr);
        const roleIdStr = await question('Enter new role ID (1=Sales Agent, 2=Manager, 3=Admin): ');
        const roleId = parseInt(roleIdStr);
        // Validate
        const user = usersResult.rows.find(u => u.id === userId);
        const role = rolesResult.rows.find(r => r.id === roleId);
        if (!user) {
            console.error('Invalid user ID');
            rl.close();
            process.exit(1);
        }
        if (!role) {
            console.error('Invalid role ID');
            rl.close();
            process.exit(1);
        }
        // Update
        await client.query('UPDATE users SET role_id = $1 WHERE id = $2', [roleId, userId]);
        console.log(`\n✓ Updated ${user.name}'s role to ${role.name}`);
        // Show updated user
        const updatedUser = await client.query(`
      SELECT u.id, u.name, u.email, r.name as role 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id 
      WHERE u.id = $1;
    `, [userId]);
        console.log('\nUpdated user:');
        console.table(updatedUser.rows);
    }
    catch (error) {
        console.error('Error updating user role:', error);
    }
    finally {
        client.release();
        rl.close();
        process.exit(0);
    }
};
updateUserRole();
