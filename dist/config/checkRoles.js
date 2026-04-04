var __importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0});let database_1=__importDefault(require("./database")),checkRoles=async()=>{var e=await database_1.default.connect();try{console.log("\n=== ROLES TABLE ===");var r=await e.query("SELECT * FROM roles ORDER BY id;"),a=(console.table(r.rows),console.log("\n=== USERS WITH ROLES ==="),await e.query(`
      SELECT u.id, u.name, u.email, r.name as role 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id 
      ORDER BY u.id;
    `));console.table(a.rows)}catch(e){console.error("Error checking roles:",e)}finally{e.release(),process.exit(0)}};checkRoles();