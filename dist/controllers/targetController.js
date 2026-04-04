var __importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0}),exports.deleteTarget=exports.getTargetByType=exports.getAllTargets=exports.getUserTargets=exports.setUserTarget=void 0;let database_1=__importDefault(require("../config/database")),role_access_1=require("../middleware/role-access"),setUserTarget=async(t,a)=>{try{var r=parseInt(t.params.userId),{collection_plan_old:s,collection_plan_new:o,abs:l,sales:n,target_type:u,target_month:i,target_date:d}=t.body;if(!u||!["monthly","daily"].includes(u))return a.status(400).json({error:"Invalid target type",message:'target_type must be either "monthly" or "daily"'});var _="monthly"===u?i:d;if(!_)return a.status(400).json({error:"Missing date",message:`target_${"monthly"===u?"month":"date"} is required`});var g,c=`
      SELECT id FROM targets 
      WHERE user_id = $1 
      AND target_type = $2 
      AND ${"monthly"===u?"target_month":"target_date"} = $3
    `,p=await database_1.default.query(c,[r,u,_]);let e;var m=(e=0<p.rows.length?await database_1.default.query(`
        UPDATE targets 
        SET 
          collection_plan_old = $1,
          collection_plan_new = $2,
          abs = $3,
          sales = $4,
          updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `,[s||0,o||0,l||0,n||0,p.rows[0].id]):(g=`
        INSERT INTO targets (
          user_id,
          collection_plan_old,
          collection_plan_new,
          abs,
          sales,
          target_type,
          ${"monthly"===u?"target_month":"target_date"},
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *
      `,await database_1.default.query(g,[r,s||0,o||0,l||0,n||0,u,_]))).rows[0];a.json({message:"Target set successfully",target:{...m,collection_plan_old:Number(m.collection_plan_old||0),collection_plan_new:Number(m.collection_plan_new||0),abs:Number(m.abs||0),sales:Number(m.sales||0)}})}catch(e){console.error("Set target error:",e),a.status(500).json({error:"Failed to set target",message:e.message})}},getUserTargets=(exports.setUserTarget=setUserTarget,async(e,t)=>{try{var a=parseInt(e.params.userId),r=e.user?.id;if(r)if(!(await(0,role_access_1.getAccessibleUserIds)(r)).includes(a))return t.status(403).json({error:"Forbidden",message:"You do not have permission to access this user targets"});var s=await database_1.default.query(`
      SELECT * FROM targets 
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,[a]),o=s.rows.map(e=>({...e,collection_plan_old:Number(e.collection_plan_old||0),collection_plan_new:Number(e.collection_plan_new||0),abs:Number(e.abs||0),sales:Number(e.sales||0)}));t.json({targets:o,total:s.rowCount})}catch(e){console.error("Get user targets error:",e),t.status(500).json({error:"Failed to get targets",message:e.message})}}),getAllTargets=(exports.getUserTargets=getUserTargets,async(a,r)=>{try{var s=a.user?.id||a.userId,{user_id:o,target_type:l,limit:n=100,offset:u=0}=a.query;if(!s)return r.status(401).json({error:"Unauthorized"});var i=await(0,role_access_1.getAccessibleUserIds)(s);if(0===i.length)return r.json({targets:[],total:0});let e=`
      SELECT t.*, u.name as user_name, u.email as user_email
      FROM targets t
      JOIN users u ON t.user_id = u.id
      WHERE t.user_id = ANY($1)
    `;var d=[i];let t=2;o&&(e+=" AND t.user_id = $"+t,d.push(o),t++),l&&["monthly","daily"].includes(l)&&(e+=" AND t.target_type = $"+t,d.push(l),t++),e+=` ORDER BY t.created_at DESC LIMIT $${t} OFFSET $`+(t+1),d.push(n,u);var _=await database_1.default.query(e,d),g=_.rows.map(e=>({...e,collection_plan_old:Number(e.collection_plan_old||0),collection_plan_new:Number(e.collection_plan_new||0),abs:Number(e.abs||0),sales:Number(e.sales||0)}));r.json({targets:g,total:_.rowCount})}catch(e){console.error("Get all targets error:",e),r.status(500).json({error:"Failed to get targets",message:e.message})}}),getTargetByType=(exports.getAllTargets=getAllTargets,async(t,a)=>{try{var r=parseInt(t.params.userId),{type:s,date:o}=t.query,l=t.user?.id;if(l)if(!(await(0,role_access_1.getAccessibleUserIds)(l)).includes(r))return a.status(403).json({error:"Forbidden",message:"You do not have permission to access this user target"});if(!s||!["monthly","daily"].includes(s))return a.status(400).json({error:"Invalid type",message:'type must be either "monthly" or "daily"'});let e=`
      SELECT * FROM targets 
      WHERE user_id = $1 
      AND target_type = $2
    `;var n=[r,s],u=("monthly"===s&&o?(e+=" AND target_month = $3",n.push(o)):"daily"===s&&o&&(e+=" AND target_date = $3",n.push(o)),await database_1.default.query(e,n)),i=0<u.rows.length?{...u.rows[0],collection_plan_old:Number(u.rows[0].collection_plan_old||0),collection_plan_new:Number(u.rows[0].collection_plan_new||0),abs:Number(u.rows[0].abs||0),sales:Number(u.rows[0].sales||0)}:null;a.json({target:i})}catch(e){console.error("Get target by type error:",e),a.status(500).json({error:"Failed to get target",message:e.message})}}),deleteTarget=(exports.getTargetByType=getTargetByType,async(e,t)=>{try{var a=parseInt(e.params.targetId),r=await database_1.default.query(`
      DELETE FROM targets 
      WHERE id = $1
      RETURNING *
    `,[a]);if(0===r.rows.length)return t.status(404).json({error:"Not found",message:"Target not found"});var s=r.rows[0];t.json({message:"Target deleted successfully",target:{...s,collection_plan_old:Number(s.collection_plan_old||0),collection_plan_new:Number(s.collection_plan_new||0),abs:Number(s.abs||0),sales:Number(s.sales||0)}})}catch(e){console.error("Delete target error:",e),t.status(500).json({error:"Failed to delete target",message:e.message})}});exports.deleteTarget=deleteTarget;