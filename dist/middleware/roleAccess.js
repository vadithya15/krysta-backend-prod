var __importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0}),exports.checkDataAccess=exports.requireRole=exports.ROLES=void 0,exports.getUserRole=getUserRole,exports.getSalesOfficersUnderRM=getSalesOfficersUnderRM,exports.canAccessUserData=canAccessUserData,exports.getAccessFilterSQL=getAccessFilterSQL,exports.getAccessibleUserIds=getAccessibleUserIds;let database_1=__importDefault(require("../config/database")),normalizeRole=(exports.ROLES={DIRECTOR:"Director",REGIONAL_MANAGER:"Regional Manager",AREA_MANAGER:"Area Manager",MANAGER:"Manager",SALES_OFFICER:"Sales Officer",SALES_AGENT:"Sales Agent",ADMIN:"Admin"},e=>String(e||"").trim().toLowerCase()),hasFullAccessRole=e=>{e=normalizeRole(e);return"admin"===e||"superadmin"===e||"director"===e},hasHierarchyAccessRole=e=>{e=normalizeRole(e);return e===normalizeRole(exports.ROLES.REGIONAL_MANAGER)||e===normalizeRole(exports.ROLES.AREA_MANAGER)||e===normalizeRole(exports.ROLES.MANAGER)},getUserContext=async e=>{e=await database_1.default.query(`SELECT r.name as role_name, u.organization_id
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE u.id = $1`,[e]);return 0===e.rows.length?{roleName:null,organizationId:null}:{roleName:e.rows[0].role_name||null,organizationId:e.rows[0].organization_id||null}};async function getUserRole(e){e=(await getUserContext(e)).roleName;return e}async function getSalesOfficersUnderRM(e){var r=await getUserContext(e);return r.organizationId?(await database_1.default.query(`SELECT u.id
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE u.assigned_regional_manager_id = $1
       AND u.organization_id = $2
       AND u.is_active = true
       AND LOWER(COALESCE(r.name, '')) = LOWER($3)`,[e,r.organizationId,exports.ROLES.SALES_OFFICER])).rows.map(e=>e.id):[]}let getHierarchyDescendants=async(e,r)=>(await database_1.default.query(`WITH RECURSIVE hierarchy AS (
       SELECT u.id
       FROM users u
       WHERE u.assigned_regional_manager_id = $1
         AND u.organization_id = $2
         AND u.is_active = true

       UNION

       SELECT u2.id
       FROM users u2
       INNER JOIN hierarchy h ON u2.assigned_regional_manager_id = h.id
       WHERE u2.organization_id = $2
         AND u2.is_active = true
     )
     SELECT DISTINCT id FROM hierarchy`,[e,r])).rows.map(e=>e.id);async function canAccessUserData(e,r){return(await getAccessibleUserIds(e)).includes(r)}async function getAccessFilterSQL(e){e=await getAccessibleUserIds(e);return 0===e.length?{whereClause:"WHERE 1=0",params:[]}:{whereClause:"WHERE user_id = ANY($1)",params:[e]}}let requireRole=(...t)=>async(e,r,s)=>{try{var a;return e.user?.id?(a=await getUserRole(e.user.id))&&t.map(normalizeRole).includes(normalizeRole(a))?void s():r.status(403).json({error:"Forbidden",message:"You do not have permission to access this resource"}):r.status(401).json({error:"Unauthorized"})}catch(e){console.error("Role check error:",e),r.status(500).json({error:"Server error during authorization"})}},checkDataAccess=(exports.requireRole=requireRole,async(e,r,s)=>{try{var a;return e.user?.id?(a=parseInt(e.params.userId||e.query.userId),isNaN(a)?r.status(400).json({error:"Invalid user ID"}):await canAccessUserData(e.user.id,a)?void s():r.status(403).json({error:"Forbidden",message:"You do not have permission to access this data"})):r.status(401).json({error:"Unauthorized"})}catch(e){console.error("Data access check error:",e),r.status(500).json({error:"Server error during authorization"})}});async function getAccessibleUserIds(e){var{roleName:r,organizationId:s}=await getUserContext(e);return r&&s?hasFullAccessRole(r)?(await database_1.default.query("SELECT id FROM users WHERE organization_id = $1 AND is_active = true",[s])).rows.map(e=>e.id):hasHierarchyAccessRole(r)?(r=await getHierarchyDescendants(e,s),Array.from(new Set([e,...r]))):[e]:[]}exports.checkDataAccess=checkDataAccess,exports.default={ROLES:exports.ROLES,getUserRole:getUserRole,getSalesOfficersUnderRM:getSalesOfficersUnderRM,canAccessUserData:canAccessUserData,getAccessFilterSQL:getAccessFilterSQL,requireRole:exports.requireRole,checkDataAccess:exports.checkDataAccess,getAccessibleUserIds:getAccessibleUserIds};