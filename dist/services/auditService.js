var __importDefault=this&&this.__importDefault||function(t){return t&&t.__esModule?t:{default:t}};Object.defineProperty(exports,"__esModule",{value:!0});let database_1=__importDefault(require("../config/database"));class AuditService{async log(t){try{await database_1.default.query(`INSERT INTO audit_logs (user_id, phone_number, action, action_details, status, ip_address, user_agent, error_message, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,[t.user_id||null,t.phone_number||null,t.action,t.action_details||null,t.status,t.ip_address||null,t.user_agent||null,t.error_message||null,t.metadata?JSON.stringify(t.metadata):null])}catch(t){console.error("Error logging audit entry:",t)}}async getAuditLogs(e={}){try{var{user_id:r,action:s,status:o,phone_number:u,days:i=7,limit:n=50,offset:d=0}=e;let t="SELECT * FROM audit_logs WHERE created_at >= NOW() - INTERVAL '$1 days'";var l=[i];let a=2;r&&(t+=" AND user_id = $"+a,l.push(r),a++),s&&(t+=" AND action = $"+a,l.push(s),a++),o&&(t+=" AND status = $"+a,l.push(o),a++),u&&(t+=" AND phone_number = $"+a,l.push(u),a++);var c=`SELECT COUNT(*) as total FROM audit_logs WHERE created_at >= NOW() - INTERVAL '${i} days'`,_=await database_1.default.query(c),E=parseInt(_.rows[0].total,10),g=(t+=` ORDER BY created_at DESC LIMIT $${a} OFFSET $`+(a+1),l.push(n,d),await database_1.default.query(t,l));return{logs:g.rows,total:E}}catch(t){throw console.error("Error retrieving audit logs:",t),t}}async getUserAuditLogs(t,a=100){try{return(await database_1.default.query(`SELECT * FROM audit_logs 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,[t,a])).rows}catch(t){throw console.error("Error retrieving user audit logs:",t),t}}async getPhoneAuditLogs(t,a=100){try{return(await database_1.default.query(`SELECT * FROM audit_logs 
         WHERE phone_number = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,[t,a])).rows}catch(t){throw console.error("Error retrieving phone audit logs:",t),t}}async getActionLogs(t,a=100){try{return(await database_1.default.query(`SELECT * FROM audit_logs 
         WHERE action = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,[t,a])).rows}catch(t){throw console.error("Error retrieving action logs:",t),t}}async getFailedAttempts(t,a=30){try{var e=await database_1.default.query(`SELECT COUNT(*) as count FROM audit_logs 
         WHERE phone_number = $1 
         AND status = 'failed'
         AND action IN ('send-otp', 'verify-otp')
         AND created_at >= NOW() - INTERVAL '${a} minutes'`,[t]);return parseInt(e.rows[0].count,10)}catch(t){return console.error("Error retrieving failed attempts:",t),0}}async clearOldLogs(t=90){try{return(await database_1.default.query(`DELETE FROM audit_logs 
         WHERE created_at < NOW() - INTERVAL '${t} days'`)).rowCount||0}catch(t){throw console.error("Error clearing old audit logs:",t),t}}}exports.default=new AuditService;