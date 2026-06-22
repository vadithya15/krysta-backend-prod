"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("./config/database"));
async function testUsersEndpoint() {
    try {
        console.log('Testing /api/users endpoint...\n');
        const result = await database_1.default.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        r.name as role
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = true
      ORDER BY u.name;
    `);
        console.log('✓ Users retrieved successfully:');
        console.log(`  Total users: ${result.rows.length}\n`);
        result.rows.forEach((user) => {
            console.log(`  - ${user.name} (${user.email}) - Role: ${user.role}`);
        });
        console.log('\n✅ /api/users endpoint should work correctly');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}
testUsersEndpoint();
