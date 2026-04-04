var __importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0}),exports.getMyReporteesCount=exports.getAllRoles=exports.getUserRegions=exports.deleteUser=exports.updateUser=exports.createUser=exports.getUserById=exports.getAllUsers=void 0;let bcryptjs_1=__importDefault(require("bcryptjs")),database_1=__importDefault(require("../config/database")),role_access_1=require("../middleware/role-access"),hasTableColumn=async(e,r)=>0<(await database_1.default.query(`SELECT 1
     FROM information_schema.columns
     WHERE table_name = $1 AND column_name = $2
     LIMIT 1`,[e,r])).rows.length,findRoleByName=async(e,r)=>await hasTableColumn("roles","organization_id")?database_1.default.query("SELECT id, name FROM roles WHERE LOWER(name) = LOWER($1) AND organization_id = $2",[e,r]):database_1.default.query("SELECT id, name FROM roles WHERE LOWER(name) = LOWER($1)",[e]),getAllUsers=async(r,a)=>{try{var s=r.organization?.id;if(!s)return a.status(400).json({error:"Organization context required"});var t=parseInt(r.query.page)||1,i=parseInt(r.query.limit)||10,o=(t-1)*i,n=r.query.search,u=r.query.role,d=r.query.is_active,l=["u.organization_id = $1"],_=[s];let e=2;var g=r.user?.id;if(g){var c=await(0,role_access_1.getAccessibleUserIds)(g);if(0===c.length)return a.json({data:[],pagination:{total:0,page:t,limit:i,pages:0}});l.push(`u.id = ANY($${e})`),_.push(c),e++}n&&(l.push(`(u.name ILIKE $${e} OR u.email ILIKE $${e})`),_.push(`%${n}%`),e++),u&&(l.push("r.name = $"+e),_.push(u),e++),void 0!==d&&(l.push("u.is_active = $"+e),_.push("true"===d),e++);var E=l.join(" AND "),m=await database_1.default.query(`SELECT COUNT(*) as count 
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE `+E,_),p=parseInt(m.rows[0].count),h=(await database_1.default.query(`SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.organization_id,
        u.is_active,
        u.created_at,
        u.hierarchy_level,
        u.assigned_regional_manager_id,
        r.name as role,
        r.id as role_id,
        mgr.name as manager_name,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object('id', r2.id, 'name', r2.name)
              ORDER BY r2.name
            )
            FROM user_regions ur2
            INNER JOIN regions r2 ON r2.id = ur2.region_id
            WHERE ur2.user_id = u.id
          ),
          '[]'::json
        ) as regions
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN users mgr ON u.assigned_regional_manager_id = mgr.id
       WHERE ${E}
       ORDER BY u.created_at DESC
       LIMIT $${e} OFFSET $`+(e+1),[..._,i,o])).rows.map(e=>({...e,is_director_locked:"director"===String(e.role||"").toLowerCase()}));a.json({data:h,pagination:{total:p,page:t,limit:i,pages:Math.ceil(p/i)}})}catch(e){console.error("Error fetching users:",e),a.status(500).json({error:"Server error",message:"Failed to fetch users"})}},getUserById=(exports.getAllUsers=getAllUsers,async(e,r)=>{try{var a=e.organization?.id,s=e.params.id;if(!a)return r.status(400).json({error:"Organization context required"});var t=e.user?.id;if(t){var i=await(0,role_access_1.getAccessibleUserIds)(t),o=parseInt(s,10);if(!Number.isNaN(o)&&!i.includes(o))return r.status(403).json({error:"Forbidden",message:"You do not have permission to access this user"})}var n=await database_1.default.query(`SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.organization_id,
        u.is_active,
        u.created_at,
        u.hierarchy_level,
        u.assigned_regional_manager_id,
        r.name as role,
        r.id as role_id,
        mgr.name as manager_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN users mgr ON u.assigned_regional_manager_id = mgr.id
       WHERE u.id = $1 AND u.organization_id = $2`,[s,a]);if(0===n.rows.length)return r.status(404).json({error:"Not found",message:"User not found"});var u=n.rows[0],d=await database_1.default.query(`SELECT r.id, r.name FROM regions r
       INNER JOIN user_regions ur ON r.id = ur.region_id
       WHERE ur.user_id = $1`,[s]),l=await database_1.default.query(`SELECT a.id, a.name FROM areas a
       INNER JOIN user_areas ua ON a.id = ua.area_id
       WHERE ua.user_id = $1`,[s]);r.json({data:{...u,regions:d.rows,areas:l.rows,is_director_locked:"director"===String(u.role||"").toLowerCase()}})}catch(e){console.error("Error fetching user:",e),r.status(500).json({error:"Server error",message:"Failed to fetch user"})}}),createUser=(exports.getUserById=getUserById,async(e,r)=>{try{var a=e.organization?.id;if(!a)return r.status(400).json({error:"Organization context required"});var{name:s,email:t,phone:i,password:o,role:n,hierarchy_level:u,assigned_regional_manager_id:d,region_ids:l,area_ids:_}=e.body;if(!(s&&t&&i&&o&&n))return r.status(400).json({error:"Validation error",message:"Name, email, phone, password, and role are required"});if(0<(await database_1.default.query("SELECT id FROM users WHERE email = $1",[t])).rows.length)return r.status(400).json({error:"Conflict",message:"User with this email already exists"});var g=await findRoleByName(n,a);if(0===g.rows.length)return r.status(400).json({error:"Validation error",message:"Invalid role"});var c=g.rows[0].id,E=String(g.rows[0].name||n),m="director"===E.toLowerCase(),p=m?1:u||0,h=!m&&d||null,N=!m&&Array.isArray(l)?l:[],R=Array.isArray(_)?_:[],f=await bcryptjs_1.default.hash(o,10),O=(await database_1.default.query(`INSERT INTO users (name, email, phone, password, role_id, organization_id, hierarchy_level, assigned_regional_manager_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
       RETURNING id, name, email, phone, organization_id, is_active, created_at, hierarchy_level, assigned_regional_manager_id`,[s,t,i,f,c,a,p,h])).rows[0];if(0<N.length)for(var y of N)await database_1.default.query("INSERT INTO user_regions (user_id, region_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",[O.id,y]);if(0<R.length)for(var v of R)await database_1.default.query("INSERT INTO user_areas (user_id, area_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",[O.id,v]);var w=await database_1.default.query(`SELECT r.id, r.name FROM regions r
       INNER JOIN user_regions ur ON r.id = ur.region_id
       WHERE ur.user_id = $1`,[O.id]),I=await database_1.default.query(`SELECT a.id, a.name FROM areas a
       INNER JOIN user_areas ua ON a.id = ua.area_id
       WHERE ua.user_id = $1`,[O.id]);r.status(201).json({data:{...O,role:E,role_id:c,regions:w.rows,areas:I.rows,is_director_locked:m},message:"User created successfully"})}catch(e){console.error("Error creating user:",e),r.status(500).json({error:"Server error",message:"Failed to create user"})}}),updateUser=(exports.createUser=createUser,async(r,a)=>{try{var s=r.organization?.id,t=r.params.id;if(!s)return a.status(400).json({error:"Organization context required"});var{name:i,email:o,phone:n,role:u,hierarchy_level:d,is_active:l,assigned_regional_manager_id:_,region_ids:g,area_ids:c}=r.body,E=await database_1.default.query(`SELECT u.id, r.name as current_role
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1 AND u.organization_id = $2`,[t,s]);if(0===E.rows.length)return a.status(404).json({error:"Not found",message:"User not found"});var m,p="director"===String(u??E.rows[0].current_role??"").toLowerCase(),h=[],N=[];let e=1;if(void 0!==i&&(h.push("name = $"+e),N.push(i),e++),void 0!==o&&(h.push("email = $"+e),N.push(o),e++),void 0!==n&&(h.push("phone = $"+e),N.push(n),e++),p||void 0===d||(h.push("hierarchy_level = $"+e),N.push(d),e++),void 0!==l&&(h.push("is_active = $"+e),N.push(l),e++),p||void 0===_||(h.push("assigned_regional_manager_id = $"+e),N.push(_||null),e++),void 0!==u){var R=await findRoleByName(u,s);if(0===R.rows.length)return a.status(400).json({error:"Validation error",message:"Invalid role"});m=R.rows[0].id,h.push("role_id = $"+e),N.push(m),e++}if(p&&(h.push("hierarchy_level = $"+e),N.push(1),e++,h.push("assigned_regional_manager_id = $"+e),N.push(null),e++),0===h.length)return a.status(400).json({error:"Validation error",message:"No fields to update"});N.push(t);var f=(await database_1.default.query(`UPDATE users 
       SET ${h.join(", ")}
       WHERE id = $${e}
       RETURNING id, name, email, phone, organization_id, is_active, created_at, hierarchy_level, role_id`,N)).rows[0],O=p||void 0!==g,y=!p&&Array.isArray(g)?g:[];if(O&&(await database_1.default.query("DELETE FROM user_regions WHERE user_id = $1",[t]),0<y.length))for(var v of y)await database_1.default.query("INSERT INTO user_regions (user_id, region_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",[t,v]);if(void 0!==c){var w=Array.isArray(c)?c:[];if(await database_1.default.query("DELETE FROM user_areas WHERE user_id = $1",[t]),0<w.length)for(var I of w)await database_1.default.query("INSERT INTO user_areas (user_id, area_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",[t,I])}var $=await database_1.default.query("SELECT name FROM roles WHERE id = $1",[f.role_id]),T=String($.rows[0]?.name||""),U=await database_1.default.query(`SELECT r.id, r.name FROM regions r
       INNER JOIN user_regions ur ON r.id = ur.region_id
       WHERE ur.user_id = $1`,[t]),C=await database_1.default.query(`SELECT a.id, a.name FROM areas a
       INNER JOIN user_areas ua ON a.id = ua.area_id
       WHERE ua.user_id = $1`,[t]);a.json({data:{...f,role:T,regions:U.rows,areas:C.rows,is_director_locked:"director"===T.toLowerCase()},message:"User updated successfully"})}catch(e){console.error("Error updating user:",e),a.status(500).json({error:"Server error",message:"Failed to update user"})}}),deleteUser=(exports.updateUser=updateUser,async(e,r)=>{try{var a=e.organization?.id,s=e.params.id;return a?0===(await database_1.default.query("SELECT id FROM users WHERE id = $1 AND organization_id = $2",[s,a])).rows.length?r.status(404).json({error:"Not found",message:"User not found"}):(await database_1.default.query("UPDATE users SET is_active = false WHERE id = $1",[s]),void r.json({message:"User deleted successfully"})):r.status(400).json({error:"Organization context required"})}catch(e){console.error("Error deleting user:",e),r.status(500).json({error:"Server error",message:"Failed to delete user"})}}),getUserRegions=(exports.deleteUser=deleteUser,async(e,r)=>{try{var a=e.organization?.id,s=e.user?.id,t=e.params.id,i=parseInt(t,10);if(!a)return r.status(400).json({error:"Organization context required"});if(Number.isNaN(i))return r.status(400).json({error:"Invalid user id"});if(s)if(!(await(0,role_access_1.getAccessibleUserIds)(s)).includes(i))return r.status(403).json({error:"Forbidden",message:"You do not have permission to access this user regions"});var o=["r.id","r.name"],n=(await hasTableColumn("regions","code")&&o.push("r.code"),await hasTableColumn("regions","description")&&o.push("r.description"),await database_1.default.query(`SELECT ${o.join(", ")}
       FROM regions r
       INNER JOIN user_regions ur ON r.id = ur.region_id
       INNER JOIN users u ON u.id = ur.user_id
       WHERE ur.user_id = $1 AND u.organization_id = $2
       ORDER BY r.name`,[i,a]));r.json({data:n.rows})}catch(e){console.error("Error fetching user regions:",e),r.status(500).json({error:"Server error",message:"Failed to fetch user regions"})}}),getAllRoles=(exports.getUserRegions=getUserRegions,async(r,a)=>{try{var s=r.organization?.id;if(!s)return a.status(400).json({error:"Organization context required"});var t=await hasTableColumn("roles","organization_id");let e;e=t?await database_1.default.query("SELECT id, name FROM roles WHERE organization_id = $1 ORDER BY name ASC",[s]):await database_1.default.query("SELECT id, name FROM roles ORDER BY name ASC"),a.json({data:e.rows})}catch(e){console.error("Error fetching roles:",e),a.status(500).json({error:"Server error",message:"Failed to fetch roles"})}}),getMyReporteesCount=(exports.getAllRoles=getAllRoles,async(e,r)=>{try{var a,s,t=e.user?.id;return t?(a=await database_1.default.query(`SELECT COUNT(*) as count
       FROM users
       WHERE assigned_regional_manager_id = $1
         AND is_active = true`,[t]),s=parseInt(a.rows[0]?.count||"0",10),r.json({count:s,has_reportees:0<s})):r.status(401).json({error:"Unauthorized"})}catch(e){return console.error("Error fetching reportees count:",e),r.status(500).json({error:"Server error",message:"Failed to fetch reportees count"})}});exports.getMyReporteesCount=getMyReporteesCount,exports.default={getAllUsers:exports.getAllUsers,getUserById:exports.getUserById,createUser:exports.createUser,updateUser:exports.updateUser,deleteUser:exports.deleteUser,getUserRegions:exports.getUserRegions,getAllRoles:exports.getAllRoles,getMyReporteesCount:exports.getMyReporteesCount};