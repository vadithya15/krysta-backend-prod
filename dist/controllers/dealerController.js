var __importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0}),exports.getRegions=exports.updateDealer=exports.createDealer=exports.getDealerById=exports.getDealers=void 0;let database_1=__importDefault(require("../config/database")),geocodingService_1=require("../services/geocodingService"),hasTableColumn=async(e,a)=>0<(await database_1.default.query(`SELECT 1
     FROM information_schema.columns
     WHERE table_name = $1 AND column_name = $2
     LIMIT 1`,[e,a])).rows.length,tableExists=async e=>!!(await database_1.default.query("SELECT to_regclass($1) as table_name",["public."+e])).rows[0]?.table_name,getDealers=async(r,t)=>{try{var s,i=parseInt(r.query.limit)||10;let e=parseInt(r.query.offset);isNaN(e)&&(s=parseInt(r.query.page)||1,e=(s-1)*i);var d,o,l="string"==typeof r.query.q?r.query.q.trim():"",n="string"==typeof r.query.region_id?r.query.region_id.trim():"",u=r.user?.id,_=[];let a="WHERE dv.is_active = true";if(u){var c=(await database_1.default.query(`SELECT roles.name as role_name FROM users u 
         LEFT JOIN roles ON u.role_id = roles.id 
         WHERE u.id = $1`,[u])).rows[0]?.role_name?.toLowerCase();if(!("superadmin"===c||"admin"===c||"director"===c)){var E,g,$=await hasTableColumn("dealers","area_id"),v=await tableExists("user_areas");let e=[];$&&v&&(E=await database_1.default.query("SELECT ARRAY_AGG(area_id) as area_ids FROM user_areas WHERE user_id = $1",[u]),e=E.rows[0]?.area_ids||[]),0<e.length?(a+=` AND dv.id IN (SELECT id FROM dealers WHERE area_id = ANY($${_.length+1}::int[]))`,_.push(e)):0<(g=(await database_1.default.query("SELECT ARRAY_AGG(region_id) as region_ids FROM user_regions WHERE user_id = $1",[u])).rows[0]?.region_ids||[]).length?(a+=` AND dv.id IN (SELECT id FROM dealers WHERE region_id = ANY($${_.length+1}::int[]))`,_.push(g)):(a+=" AND 1=0",console.warn(`User ${u} has no area or region mapping, returning no dealers`))}}n&&(_.push(parseInt(n)),d=_.length,a+=` AND dv.id IN (SELECT id FROM dealers WHERE region_id = $${d})`),l&&(_.push(`%${l}%`),o=_.length,a+=` AND (
        dv.name ILIKE $${o}
        OR dv.city ILIKE $${o}
        OR dv.state ILIKE $${o}
        OR dv.phone ILIKE $${o}
        OR dv.address ILIKE $${o}
      )`);var R=await database_1.default.query("SELECT COUNT(*) as count FROM dealers_view dv "+a,_),p=parseInt(R.rows[0]?.count||"0",10),m=(_.push(i),_.push(e),await database_1.default.query(`SELECT * FROM dealers_view dv ${a} ORDER BY dv.name LIMIT $${_.length-1} OFFSET $`+_.length,_));t.json({dealers:m.rows,total:p,limit:i,offset:e})}catch(e){console.error("Get dealers error:",e),t.status(500).json({error:"Server error",message:"Failed to fetch dealers"})}},getDealerById=(exports.getDealers=getDealers,async(a,r)=>{try{var t=a.params.id,s=a.user?.id;if(!s)return r.status(403).json({error:"User not available"});var i=(await database_1.default.query(`SELECT roles.name as role_name FROM users u 
       LEFT JOIN roles ON u.role_id = roles.id 
       WHERE u.id = $1`,[s])).rows[0]?.role_name?.toLowerCase();let e="SELECT * FROM dealers_view WHERE id = $1 AND is_active = true";var d,o,l=[t],n=("superadmin"===i||"admin"===i||"director"===i||(d=await hasTableColumn("dealers","area_id"),o=await tableExists("user_areas"),l.push(s),e+=d&&o?` AND (
          EXISTS (
            SELECT 1 FROM user_areas ua
            WHERE ua.user_id = $2
              AND ua.area_id = (SELECT area_id FROM dealers WHERE id = dealers_view.id)
          )
          OR (
            NOT EXISTS (
              SELECT 1 FROM user_areas ua2
              WHERE ua2.user_id = $2
            )
            AND EXISTS (
              SELECT 1 FROM user_regions ur
              WHERE ur.user_id = $2
                AND ur.region_id = (SELECT region_id FROM dealers WHERE id = dealers_view.id)
            )
          )
        )`:` AND EXISTS (
          SELECT 1 FROM user_regions ur
          WHERE ur.user_id = $2
            AND ur.region_id = (SELECT region_id FROM dealers WHERE id = dealers_view.id)
        )`),await database_1.default.query(e,l));if(0===n.rows.length)return r.status(404).json({error:"Dealer not found"});r.json({data:n.rows[0]})}catch(e){console.error("Get dealer error:",e),r.status(500).json({error:"Server error",message:"Failed to fetch dealer"})}}),createDealer=(exports.getDealerById=getDealerById,async(r,t)=>{try{var s,{name:i,contact_person:d,phone:o,email:l,address:n,city:u,state:_,pincode:c,lno:E,area:g,region:$,city_id:v,state_id:R,area_id:p,region_id:m,gst_number:y,credit_limit:w}=r.body;if(!i)return t.status(400).json({error:"Dealer name is required"});let e=null,a=null;(n||u||_||c)&&(s=await(0,geocodingService_1.geocodeAddress)(n,u,_,c),e=s.latitude,a=s.longitude,e&&a?console.log(`Geocoded dealer location: ${e}, `+a):console.log("Could not geocode dealer address, location will be null"));var T=await database_1.default.query(`INSERT INTO dealers (
        name, contact_person, phone, email, address, 
        city, state, pincode, lno, area, region, city_id, state_id, area_id, region_id,
        gst_number, credit_limit, latitude, longitude
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,[i,d||null,o||null,l||null,n||null,u||null,_||null,c||null,E||null,g||null,$||null,v||null,R||null,p||null,m||null,y||null,w||0,e,a]);t.status(201).json({message:"Dealer created successfully",data:T.rows[0]})}catch(e){console.error("Create dealer error:",e),t.status(500).json({error:"Server error creating dealer"})}}),updateDealer=(exports.createDealer=createDealer,async(r,t)=>{try{var s=r.params.id,{name:i,contact_person:d,phone:o,email:l,address:n,city:u,state:_,pincode:c,lno:E,area:g,region:$,city_id:v,state_id:R,area_id:p,region_id:m,gst_number:y,credit_limit:w,is_active:T}=r.body,S=await database_1.default.query("SELECT * FROM dealers WHERE id = $1",[s]);if(0===S.rows.length)return t.status(404).json({error:"Dealer not found"});var f=S.rows[0];let e=f.latitude,a=f.longitude;(n!==f.address||u!==f.city||_!==f.state||c!==f.pincode)&&(n||u||_||c)&&(D=await(0,geocodingService_1.geocodeAddress)(n,u,_,c),e=D.latitude,a=D.longitude,e&&a?console.log(`Re-geocoded dealer location: ${e}, `+a):console.log("Could not geocode updated dealer address"));var D,h=await database_1.default.query(`UPDATE dealers SET
        name = $1,
        contact_person = $2,
        phone = $3,
        email = $4,
        address = $5,
        city = $6,
        state = $7,
        pincode = $8,
        lno = $9,
        area = $10,
        region = $11,
        city_id = $12,
        state_id = $13,
        area_id = $14,
        region_id = $15,
        gst_number = $16,
        credit_limit = $17,
        latitude = $18,
        longitude = $19,
        is_active = $20,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $21
      RETURNING *`,[void 0!==i?i:f.name,void 0!==d?d:f.contact_person,void 0!==o?o:f.phone,void 0!==l?l:f.email,void 0!==n?n:f.address,void 0!==u?u:f.city,void 0!==_?_:f.state,void 0!==c?c:f.pincode,void 0!==E?E:f.lno,void 0!==g?g:f.area,void 0!==$?$:f.region,void 0!==v?v:f.city_id,void 0!==R?R:f.state_id,void 0!==p?p:f.area_id,void 0!==m?m:f.region_id,void 0!==y?y:f.gst_number,void 0!==w?w:f.credit_limit,e,a,void 0!==T?T:f.is_active,s]);t.json({message:"Dealer updated successfully",data:h.rows[0]})}catch(e){console.error("Update dealer error:",e),t.status(500).json({error:"Server error updating dealer"})}}),getRegions=(exports.updateDealer=updateDealer,async(e,a)=>{try{var r=await database_1.default.query(`SELECT id, name 
       FROM regions 
       ORDER BY name`);a.json({data:r.rows})}catch(e){console.error("Get regions error:",e),a.status(500).json({error:"Server error",message:"Failed to fetch regions"})}});exports.getRegions=getRegions;