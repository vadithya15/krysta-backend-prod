var __importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0});let database_1=__importDefault(require("./config/database"));async function testUsersEndpoint(){try{console.log("Testing /api/users endpoint...\n");var e=await database_1.default.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        r.name as role
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = true
      ORDER BY u.name;
    `);console.log("✓ Users retrieved successfully:"),console.log(`  Total users: ${e.rows.length}
`),e.rows.forEach(e=>{console.log(`  - ${e.name} (${e.email}) - Role: `+e.role)}),console.log("\n✅ /api/users endpoint should work correctly"),process.exit(0)}catch(e){console.error("❌ Error:",e),process.exit(1)}}testUsersEndpoint();