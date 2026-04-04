var __importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0}),exports.getTodayVisits=exports.getVisitHistory=exports.getActiveVisit=exports.endDealerVisit=exports.startDealerVisit=void 0;let database_1=__importDefault(require("../config/database")),role_access_1=require("../middleware/role-access"),parseCoordinatesFromLocationText=e=>{var t;return!e||"string"!=typeof e||!(e=e.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/))||(t=Number(e[1]),e=Number(e[2]),!Number.isFinite(t))||!Number.isFinite(e)||t<-90||90<t||e<-180||180<e?null:{latitude:t,longitude:e}},startDealerVisit=async(e,t)=>{try{var i,s,r,a=e.user.id,{dealerId:d,checkInLocation:o,checkInTime:u,checkInCoordinates:n}=e.body;return d?0===(await database_1.default.query("SELECT id FROM dealers WHERE id = $1 AND is_active = true",[d])).rows.length?t.status(404).json({error:"Dealer not found"}):0<(await database_1.default.query("SELECT id FROM dealer_visits WHERE user_id = $1 AND dealer_id = $2 AND check_out_time IS NULL",[a,d])).rows.length?t.status(400).json({error:"Active visit already exists",message:"Please check out from the current visit first"}):(i=u?new Date(u):new Date,s=await database_1.default.query(`
      INSERT INTO dealer_visits (user_id, dealer_id, check_in_time, check_in_location, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,[a,d,i,o||"Unknown","active"]),(r=n&&Number.isFinite(Number(n.latitude))&&Number.isFinite(Number(n.longitude))?{latitude:Number(n.latitude),longitude:Number(n.longitude)}:parseCoordinatesFromLocationText(o))&&await database_1.default.query(`UPDATE dealers
         SET latitude = $1,
             longitude = $2,
             updated_at = NOW()
         WHERE id = $3`,[r.latitude,r.longitude,d]),void t.json({message:"Visit started successfully",visit:s.rows[0]})):t.status(400).json({error:"Dealer ID is required"})}catch(e){console.error("Start dealer visit error:",e),t.status(500).json({error:"Failed to start visit",message:e.message})}},endDealerVisit=(exports.startDealerVisit=startDealerVisit,async(e,t)=>{try{var i,s,r,a=e.user.id,{visitId:d,checkOutLocation:o,checkOutTime:u,visitReason:n,orderRequired:c}=e.body;return(console.log("🔍 endDealerVisit request:",{visitId:d,visitId_type:typeof d,checkOutLocation:o,checkOutLocation_type:typeof o,checkOutTime:u,checkOutTime_type:typeof u,visitReason:n,visitReason_type:typeof n,orderRequired:c,orderRequired_type:typeof c,userId:a}),d&&"number"==typeof d)?o?u?0===(i=await database_1.default.query("SELECT * FROM dealer_visits WHERE id = $1 AND user_id = $2",[d,a])).rows.length?t.status(404).json({error:"Visit not found"}):i.rows[0].check_out_time?t.status(400).json({error:"Visit already checked out"}):(s=u?new Date(u):new Date,console.log("✅ Executing endDealerVisit update:",{checkOutDate:s,checkOutLocation:o,visitReason:n,orderRequired:c||!1,visitId:d}),r=await database_1.default.query(`
      UPDATE dealer_visits 
      SET check_out_time = $1, 
          check_out_location = $2, 
          visit_reason = $3, 
          order_required = $4,
          status = $5
      WHERE id = $6
      RETURNING *
    `,[s,o||"Unknown",n||null,c||!1,"completed",d]),void t.json({message:"Visit ended successfully",visit:r.rows[0]})):t.status(400).json({error:"Checkout time is required"}):t.status(400).json({error:"Checkout location is required"}):t.status(400).json({error:"Visit ID is required and must be a number",received:{visitId:d,type:typeof d}})}catch(e){console.error("❌ End dealer visit error:",e),console.error("   Error message:",e.message),console.error("   Error stack:",e.stack),t.status(500).json({error:"Failed to end visit",message:e.message})}}),getActiveVisit=(exports.endDealerVisit=endDealerVisit,async(e,t)=>{try{var i=e.user.id,s=await database_1.default.query(`
      SELECT dv.*, dview.name, dview.address, dview.phone
      FROM dealer_visits dv
      JOIN dealers_view dview ON dv.dealer_id = dview.id
      WHERE dv.user_id = $1 AND dv.check_out_time IS NULL
      ORDER BY dv.check_in_time DESC
      LIMIT 1
    `,[i]);if(0===s.rows.length)return t.json({active:!1,visit:null});t.json({active:!0,visit:s.rows[0]})}catch(e){console.error("Get active visit error:",e),t.status(500).json({error:"Failed to get active visit",message:e.message})}}),getVisitHistory=(exports.getActiveVisit=getActiveVisit,async(s,r)=>{try{var a=s.user.id,{dealerId:d,startDate:o,endDate:u,limit:n=50,offset:c=0}=s.query,l=await(0,role_access_1.getAccessibleUserIds)(a);if(0===l.length)return r.json({visits:[],total:0,limit:n,offset:c});let e=`
      SELECT dv.*, dview.name, dview.address, dview.phone, dview.latitude, dview.longitude,
             u.name as checked_in_by_name, u.email as checked_in_by_email, u.phone as checked_in_by_phone
      FROM dealer_visits dv
      JOIN dealers_view dview ON dv.dealer_id = dview.id
      LEFT JOIN users u ON dv.user_id = u.id
      WHERE dv.user_id = ANY($1)
    `;var v=[l];let t=2;d&&(e+=" AND dv.dealer_id = $"+t,v.push(d),t++),o&&(e+=" AND dv.check_in_time >= $"+t,v.push(o),t++),u&&(e+=" AND dv.check_in_time <= $"+t,v.push(u),t++),e+=` ORDER BY dv.check_in_time DESC LIMIT $${t} OFFSET $`+(t+1),v.push(n,c);var _=await database_1.default.query(e,v);let i="SELECT COUNT(*) FROM dealer_visits WHERE user_id = ANY($1)";var m=[l],h=(d&&(i+=" AND dealer_id = $2",m.push(d)),await database_1.default.query(i,m));r.json({visits:_.rows,total:parseInt(h.rows[0].count),limit:n,offset:c})}catch(e){console.error("Get visit history error:",e),r.status(500).json({error:"Failed to get visit history",message:e.message})}}),getTodayVisits=(exports.getVisitHistory=getVisitHistory,async(e,t)=>{try{var i=e.user.id,s=await(0,role_access_1.getAccessibleUserIds)(i);if(0===s.length)return t.json({visits:[],total:0});var r=await database_1.default.query(`
      SELECT dv.*, dview.name, dview.address, dview.phone, dview.latitude, dview.longitude,
             u.name as checked_in_by_name, u.email as checked_in_by_email, u.phone as checked_in_by_phone
      FROM dealer_visits dv
      JOIN dealers_view dview ON dv.dealer_id = dview.id
      LEFT JOIN users u ON dv.user_id = u.id
      WHERE dv.user_id = ANY($1)
      AND DATE(dv.check_in_time) = CURRENT_DATE
      ORDER BY dv.check_in_time DESC
    `,[s]);t.json({visits:r.rows,total:r.rows.length})}catch(e){console.error("Get today visits error:",e),t.status(500).json({error:"Failed to get today visits",message:e.message})}});exports.getTodayVisits=getTodayVisits;