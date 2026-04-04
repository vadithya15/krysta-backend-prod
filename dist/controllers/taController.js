var __importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0}),exports.approveExpenses=exports.getUserExpenses=exports.getPendingExpensesByUser=exports.getExpenseSummary=exports.deleteTravelExpense=exports.getTravelExpenseById=exports.getTravelExpenses=exports.updateRoleDailyAllowance=exports.getRoleDailyAllowances=exports.getDailyAllowanceForCurrentUser=exports.updateTravelExpense=exports.createTravelExpense=exports.getVehicleTypeById=exports.getVehicleTypes=void 0;let database_1=__importDefault(require("../config/database")),roleAccess_1=require("../middleware/roleAccess"),getStandardDailyAllowanceByUserId=async e=>{e=await database_1.default.query(`SELECT COALESCE(trda.allowance_amount, 0) AS daily_allowance
     FROM users u
     LEFT JOIN ta_role_daily_allowance trda ON trda.role_id = u.role_id
     WHERE u.id = $1`,[e]);return 0!==e.rows.length&&parseFloat(e.rows[0].daily_allowance)||0},getVehicleTypes=async(e,a)=>{try{var r=await database_1.default.query("SELECT id, vehicle_name, rate_per_km, description FROM vehicle_types WHERE is_active = true ORDER BY id");a.json({vehicleTypes:r.rows})}catch(e){console.error("Error fetching vehicle types:",e),a.status(500).json({error:"Failed to fetch vehicle types"})}},getVehicleTypeById=(exports.getVehicleTypes=getVehicleTypes,async(e,a)=>{try{var r=e.params.id,s=await database_1.default.query("SELECT id, vehicle_name, rate_per_km, description FROM vehicle_types WHERE id = $1 AND is_active = true",[r]);if(0===s.rows.length)return a.status(404).json({error:"Vehicle type not found"});a.json({vehicleType:s.rows[0]})}catch(e){console.error("Error fetching vehicle type:",e),a.status(500).json({error:"Failed to fetch vehicle type"})}}),createTravelExpense=(exports.getVehicleTypeById=getVehicleTypeById,async(e,a)=>{try{var r,s,t,o,n,i,l,d,u,p,_,c,E,m,v,y,x,g,h,f,w=e.user?.id;return w?({vehicle_type_id:r,travel_date:s,distance_km:t,gps_km:o,rate_per_km:n,fuel_charges:i,parking_charges:l,other_expense:d,is_gps_based:u,is_manual_edit:p,remarks:_}=e.body,r&&s&&void 0!==t&&void 0!==n?t<0||n<0?a.status(400).json({error:"Distance and rate must be positive values"}):(c=parseFloat(i??0)||0,E=parseFloat(l??0)||0,m=parseFloat(d??0)||0,v=await getStandardDailyAllowanceByUserId(w),c<0||E<0||m<0||v<0?a.status(400).json({error:"Additional charges must be positive values"}):(y=parseFloat((t*n).toFixed(2)),x=parseFloat((y+c+E+m+v).toFixed(2)),(h=(g=await database_1.default.query("SELECT setting_value FROM settings WHERE setting_key = 'ta_max_daily_km'")).rows[0]?.setting_value?parseFloat(g.rows[0].setting_value):500)<t?a.status(400).json({error:`Distance exceeds daily limit of ${h} km`}):0<(await database_1.default.query("SELECT id FROM travel_expenses WHERE user_id = $1 AND travel_date = $2",[w,s])).rows.length?a.status(400).json({error:"Travel expense already exists for this date. Please update the existing record."}):(f=await database_1.default.query(`INSERT INTO travel_expenses 
        (user_id, vehicle_type_id, travel_date, distance_km, gps_km, rate_per_km, total_amount,
         fuel_charges, parking_charges, other_expense, daily_allowance,
         is_gps_based, is_manual_edit, remarks, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending')
      RETURNING *`,[w,r,s,t,o,n,x,c,E,m,v,u,p,_]),void a.status(201).json({success:!0,expense:f.rows[0],message:"Travel expense created successfully"})))):a.status(400).json({error:"Missing required fields"})):a.status(401).json({error:"Unauthorized"})}catch(e){console.error("Error creating travel expense:",e),a.status(500).json({error:"Failed to create travel expense"})}}),updateTravelExpense=(exports.createTravelExpense=createTravelExpense,async(r,s)=>{try{var t=r.user?.id;if(!t)return s.status(401).json({error:"Unauthorized"});var o=r.params.id,{vehicle_type_id:n,distance_km:i,gps_km:l,rate_per_km:d,fuel_charges:u,parking_charges:p,other_expense:_,is_manual_edit:c,remarks:E,_resubmit:m}=r.body,v=await database_1.default.query("SELECT * FROM travel_expenses WHERE id = $1 AND user_id = $2",[o,t]);if(0===v.rows.length)return s.status(404).json({error:"Travel expense not found"});var y=v.rows[0].status;if("approved"===y)return s.status(400).json({error:"Cannot edit approved expenses"});if("rejected"===y)return s.status(400).json({error:"Cannot edit rejected expenses"});var x=void 0!==u?parseFloat(u)||0:parseFloat(v.rows[0].fuel_charges??0)||0,g=void 0!==p?parseFloat(p)||0:parseFloat(v.rows[0].parking_charges??0)||0,h=void 0!==_?parseFloat(_)||0:parseFloat(v.rows[0].other_expense??0)||0,f=await getStandardDailyAllowanceByUserId(t);if(x<0||g<0||h<0||f<0)return s.status(400).json({error:"Additional charges must be positive values"});var w=void 0!==i?i:v.rows[0].distance_km,T=void 0!==d?d:v.rows[0].rate_per_km;if(!Number.isFinite(Number(w))||!Number.isFinite(Number(T)))return s.status(400).json({error:"Distance and rate must be valid numbers"});if(Number(w)<0||Number(T)<0)return s.status(400).json({error:"Distance and rate must be positive values"});var N=parseFloat((w*T).toFixed(2)),A=parseFloat((N+x+g+h+f).toFixed(2));let e=y,a=v.rows[0].modification_reason;m&&"pending_modification"===y&&(e="pending",a=null);var R=await database_1.default.query(`UPDATE travel_expenses 
      SET vehicle_type_id = COALESCE($1, vehicle_type_id),
          distance_km = COALESCE($2, distance_km),
          gps_km = COALESCE($3, gps_km),
          rate_per_km = COALESCE($4, rate_per_km),
          total_amount = $5,
          fuel_charges = COALESCE($6, fuel_charges),
          parking_charges = COALESCE($7, parking_charges),
          other_expense = COALESCE($8, other_expense),
          daily_allowance = COALESCE($9, daily_allowance),
          is_manual_edit = COALESCE($10, is_manual_edit),
          remarks = COALESCE($11, remarks),
          status = $13,
          modification_reason = $14,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $12 AND user_id = $15
      RETURNING *`,[n,i,l,d,A,u,p,_,f,c,E,o,e,a,t]);s.json({success:!0,expense:R.rows[0],message:m&&"pending_modification"===y?"Travel expense resubmitted for approval":"Travel expense updated successfully"})}catch(e){console.error("Error updating travel expense:",e),s.status(500).json({error:"Failed to update travel expense"})}}),getDailyAllowanceForCurrentUser=(exports.updateTravelExpense=updateTravelExpense,async(e,a)=>{try{var r,s,t=e.user?.id;return t?0===(r=await database_1.default.query(`SELECT
          r.id AS role_id,
          r.name AS role_name,
          COALESCE(trda.allowance_amount, 0) AS daily_allowance
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN ta_role_daily_allowance trda ON trda.role_id = r.id
       WHERE u.id = $1`,[t])).rows.length?a.status(404).json({error:"User not found"}):(s=r.rows[0],void a.json({role_id:s.role_id,role_name:s.role_name,daily_allowance:parseFloat(s.daily_allowance)||0})):a.status(401).json({error:"Unauthorized"})}catch(e){console.error("Error fetching daily allowance:",e),a.status(500).json({error:"Failed to fetch daily allowance"})}}),getRoleDailyAllowances=(exports.getDailyAllowanceForCurrentUser=getDailyAllowanceForCurrentUser,async(e,a)=>{try{var r=await database_1.default.query(`SELECT
          r.id AS role_id,
          r.name AS role_name,
          COALESCE(trda.allowance_amount, 0) AS allowance_amount
       FROM roles r
       LEFT JOIN ta_role_daily_allowance trda ON trda.role_id = r.id
       ORDER BY r.name ASC`);a.json({allowances:r.rows.map(e=>({role_id:e.role_id,role_name:e.role_name,allowance_amount:parseFloat(e.allowance_amount)||0}))})}catch(e){console.error("Error fetching role daily allowances:",e),a.status(500).json({error:"Failed to fetch role daily allowances"})}}),updateRoleDailyAllowance=(exports.getRoleDailyAllowances=getRoleDailyAllowances,async(e,a)=>{try{var r,s,t=e.params.roleId,o=e.body.allowance_amount,n=parseInt(t,10);return Number.isNaN(n)?a.status(400).json({error:"Invalid role ID"}):(r=parseFloat(o),Number.isNaN(r)||r<0?a.status(400).json({error:"allowance_amount must be a non-negative number"}):0===(s=await database_1.default.query("SELECT id, name FROM roles WHERE id = $1",[n])).rows.length?a.status(404).json({error:"Role not found"}):(await database_1.default.query(`INSERT INTO ta_role_daily_allowance (role_id, allowance_amount)
       VALUES ($1, $2)
       ON CONFLICT (role_id)
       DO UPDATE SET allowance_amount = EXCLUDED.allowance_amount, updated_at = CURRENT_TIMESTAMP`,[n,r]),void a.json({success:!0,role_id:n,role_name:s.rows[0].name,allowance_amount:r,message:"Role daily allowance updated successfully"})))}catch(e){console.error("Error updating role daily allowance:",e),a.status(500).json({error:"Failed to update role daily allowance"})}}),getTravelExpenses=(exports.updateRoleDailyAllowance=updateRoleDailyAllowance,async(a,r)=>{try{var s=a.user?.id;if(!s)return r.status(401).json({error:"Unauthorized"});var{start_date:t,end_date:o,status:n}=a.query;let e=`
      SELECT te.*, vt.vehicle_name, vt.description as vehicle_description,
             u.name as user_name, u.email as user_email,
             mu.name as modification_requested_by_name
      FROM travel_expenses te
      JOIN vehicle_types vt ON te.vehicle_type_id = vt.id
      JOIN users u ON te.user_id = u.id
      LEFT JOIN users mu ON te.modification_requested_by = mu.id
      WHERE te.user_id = $1
    `;var i=[s],l=(t&&(i.push(t),e+=" AND te.travel_date >= $"+i.length),o&&(i.push(o),e+=" AND te.travel_date <= $"+i.length),n&&(i.push(n),e+=" AND te.status = $"+i.length),e+=" ORDER BY te.travel_date DESC, te.created_at DESC",await database_1.default.query(e,i));r.json({expenses:l.rows})}catch(e){console.error("Error fetching travel expenses:",e),r.status(500).json({error:"Failed to fetch travel expenses"})}}),getTravelExpenseById=(exports.getTravelExpenses=getTravelExpenses,async(e,a)=>{try{var r,s,t=e.user?.id;return t?(r=e.params.id,0===(s=await database_1.default.query(`SELECT te.*, vt.vehicle_name, vt.description as vehicle_description,
              u.name as user_name, u.email as user_email,
              mu.name as modification_requested_by_name
       FROM travel_expenses te
       JOIN vehicle_types vt ON te.vehicle_type_id = vt.id
       JOIN users u ON te.user_id = u.id
       LEFT JOIN users mu ON te.modification_requested_by = mu.id
       WHERE te.id = $1 AND te.user_id = $2`,[r,t])).rows.length?a.status(404).json({error:"Travel expense not found"}):void a.json({expense:s.rows[0]})):a.status(401).json({error:"Unauthorized"})}catch(e){console.error("Error fetching travel expense:",e),a.status(500).json({error:"Failed to fetch travel expense"})}}),deleteTravelExpense=(exports.getTravelExpenseById=getTravelExpenseById,async(e,a)=>{try{var r,s,t=e.user?.id;return t?(r=e.params.id,0===(s=await database_1.default.query("SELECT status FROM travel_expenses WHERE id = $1 AND user_id = $2",[r,t])).rows.length?a.status(404).json({error:"Travel expense not found"}):"approved"===s.rows[0].status?a.status(400).json({error:"Cannot delete approved expenses"}):(await database_1.default.query("DELETE FROM travel_expenses WHERE id = $1 AND user_id = $2",[r,t]),void a.json({success:!0,message:"Travel expense deleted successfully"}))):a.status(401).json({error:"Unauthorized"})}catch(e){console.error("Error deleting travel expense:",e),a.status(500).json({error:"Failed to delete travel expense"})}}),getExpenseSummary=(exports.deleteTravelExpense=deleteTravelExpense,async(a,r)=>{try{var s=a.user?.id;if(!s)return r.status(401).json({error:"Unauthorized"});var{start_date:t,end_date:o}=a.query;let e=`
      SELECT 
        COUNT(*) as total_claims,
        SUM(distance_km) as total_km,
        SUM(total_amount) as total_amount,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_claims,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_claims,
        SUM(CASE WHEN status = 'approved' THEN total_amount ELSE 0 END) as approved_amount
      FROM travel_expenses
      WHERE user_id = $1
    `;var n=[s],i=(t&&(n.push(t),e+=" AND travel_date >= $"+n.length),o&&(n.push(o),e+=" AND travel_date <= $"+n.length),await database_1.default.query(e,n));r.json({summary:i.rows[0]})}catch(e){console.error("Error fetching expense summary:",e),r.status(500).json({error:"Failed to fetch expense summary"})}}),getPendingExpensesByUser=(exports.getExpenseSummary=getExpenseSummary,async(e,a)=>{try{var r,s,t=e.user?.id;return t?0===(r=await(0,roleAccess_1.getAccessibleUserIds)(t)).length?a.json({users:[]}):(s=await database_1.default.query(`SELECT 
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        COUNT(te.id) as expense_count,
        SUM(te.total_amount) as total_amount,
        MIN(te.travel_date) as earliest_date,
        MAX(te.travel_date) as latest_date
      FROM users u
      INNER JOIN travel_expenses te ON u.id = te.user_id
      WHERE te.status IN ('pending', 'pending_modification')
        AND te.user_id = ANY($1)
      GROUP BY u.id, u.name, u.email
      ORDER BY total_amount DESC, user_name ASC`,[r]),void a.json({users:s.rows})):a.status(401).json({error:"Unauthorized"})}catch(e){console.error("Error fetching pending expenses by user:",e),a.status(500).json({error:"Failed to fetch pending expenses"})}}),getUserExpenses=(exports.getPendingExpensesByUser=getPendingExpensesByUser,async(a,r)=>{try{var s=a.user?.id;if(!s)return r.status(401).json({error:"Unauthorized"});var t=a.params.userId,o=a.query.status,n=parseInt(t);if(Number.isNaN(n))return r.status(400).json({error:"Invalid user ID"});if(!(await(0,roleAccess_1.getAccessibleUserIds)(s)).includes(n))return r.status(403).json({error:"Forbidden"});let e=`
      SELECT te.*, vt.vehicle_name, vt.description as vehicle_description,
             u.name as user_name, u.email as user_email,
             mu.name as modification_requested_by_name
      FROM travel_expenses te
      JOIN vehicle_types vt ON te.vehicle_type_id = vt.id
      JOIN users u ON te.user_id = u.id
      LEFT JOIN users mu ON te.modification_requested_by = mu.id
      WHERE te.user_id = $1
    `;var i=[n],l=(o&&(i.push(o),e+=" AND te.status = $"+i.length),e+=" ORDER BY te.travel_date DESC, te.created_at DESC",await database_1.default.query(e,i));r.json({expenses:l.rows})}catch(e){console.error("Error fetching user expenses:",e),r.status(500).json({error:"Failed to fetch user expenses"})}}),approveExpenses=(exports.getUserExpenses=getUserExpenses,async(s,t)=>{try{var o=s.user?.id;if(!o)return t.status(401).json({error:"Unauthorized"});var{expense_ids:n,action:i,reason:l}=s.body;if(!n||!Array.isArray(n)||0===n.length)return t.status(400).json({error:"expense_ids array is required"});if(!["approve","reject","modify"].includes(i))return t.status(400).json({error:'Invalid action. Must be "approve", "reject", or "modify"'});if("modify"===i&&(!l||""===l.trim()))return t.status(400).json({error:"Reason is required for modify action"});let e,a=(e="approve"===i?"approved":"reject"===i?"rejected":"pending_modification",`
      UPDATE travel_expenses 
      SET status = $1,
          approved_by = $2,
          approved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP`),r=[e,o,n];"modify"===i&&(a+=`,
          modification_reason = $4,
          modification_requested_by = $2,
          modification_requested_at = CURRENT_TIMESTAMP`,r=[e,o,n,l.trim()]),a+=`
      WHERE id = ANY($3::int[]) AND status = 'pending'
      RETURNING id, user_id, total_amount, status`;var d=await database_1.default.query(a,r),u=d.rows.length;if(0===u)return t.status(404).json({error:"No pending expenses found with the provided IDs"});t.json({success:!0,message:"modify"===i?`Successfully sent ${u} expense(s) back for modification`:`Successfully ${i}d ${u} expense(s)`,updated_expenses:d.rows})}catch(e){console.error("Error approving expenses:",e),t.status(500).json({error:"Failed to approve expenses"})}});exports.approveExpenses=approveExpenses;