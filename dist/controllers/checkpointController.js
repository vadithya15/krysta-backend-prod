var __importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0}),exports.getCheckpointHistory=exports.getCurrentCheckpoint=exports.endDay=exports.startDay=void 0;let database_1=__importDefault(require("../config/database")),startDay=async(e,t)=>{try{var a=e.user.id,{location:r,timestamp:s}=e.body;if(0<(await database_1.default.query(`
      SELECT * FROM checkpoints 
      WHERE user_id = $1 AND check_out_time IS NULL 
      ORDER BY check_in_time DESC 
      LIMIT 1
    `,[a])).rows.length)return t.status(400).json({error:"Day already started",message:"Please end your current day before starting a new one"});var o=s?new Date(s):new Date,i=await database_1.default.query(`
      INSERT INTO checkpoints (user_id, check_in_time, check_in_location, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,[a,o,r||"Unknown","active"]);t.json({message:"Day started successfully",checkpoint:i.rows[0]})}catch(e){console.error("Start day error:",e),t.status(500).json({error:"Failed to start day",message:e.message})}},endDay=(exports.startDay=startDay,async(e,a)=>{try{var r=e.user.id,{location:s,timestamp:o,totalDistance:i}=e.body,c=await database_1.default.query(`
      SELECT * FROM checkpoints 
      WHERE user_id = $1 AND check_out_time IS NULL 
      ORDER BY check_in_time DESC 
      LIMIT 1
    `,[r]);if(0===c.rows.length)return a.status(400).json({error:"No active day",message:"Please start your day first"});var n=c.rows[0],d=new Date(n.check_in_time),u=o?new Date(o):new Date,l=Number(i),h=Number.isFinite(l)&&0<l;let t=h?l:0;if(!h)try{var _=await database_1.default.query(`
          SELECT latitude, longitude, recorded_at 
          FROM location_tracks 
          WHERE user_id = $1 
          AND recorded_at >= $2 
          AND recorded_at <= $3
          ORDER BY recorded_at ASC
        `,[r,d,u]);if(1<_.rows.length)for(let e=1;e<_.rows.length;e++){var y=_.rows[e-1],k=_.rows[e];t+=calculateDistance(y.latitude,y.longitude,k.latitude,k.longitude)}}catch(e){console.error("Error calculating distance from location tracks:",e)}var E=await database_1.default.query(`
      UPDATE checkpoints 
      SET check_out_time = $1, check_out_location = $2, status = $3, total_distance_km = $4
      WHERE id = $5
      RETURNING *
    `,[u,s||"Unknown","completed",Number(t.toFixed(2)),n.id]);a.json({message:"Day ended successfully",checkpoint:E.rows[0]})}catch(e){console.error("End day error:",e),a.status(500).json({error:"Failed to end day",message:e.message})}}),calculateDistance=(exports.endDay=endDay,(e,t,a,r)=>{var s=toRad(a-e),r=toRad(r-t),t=Math.sin(s/2)*Math.sin(s/2)+Math.cos(toRad(e))*Math.cos(toRad(a))*Math.sin(r/2)*Math.sin(r/2);return 6371*(2*Math.atan2(Math.sqrt(t),Math.sqrt(1-t)))}),toRad=e=>e*Math.PI/180,getCurrentCheckpoint=async(e,t)=>{try{var a=e.user.id,r=await database_1.default.query(`
      SELECT * FROM checkpoints 
      WHERE user_id = $1 AND check_out_time IS NULL 
      ORDER BY check_in_time DESC 
      LIMIT 1
    `,[a]);if(0===r.rows.length)return t.json({active:!1,checkpoint:null});t.json({active:!0,checkpoint:r.rows[0]})}catch(e){console.error("Get checkpoint error:",e),t.status(500).json({error:"Failed to get checkpoint",message:e.message})}},getCheckpointHistory=(exports.getCurrentCheckpoint=getCurrentCheckpoint,async(e,t)=>{try{var a=e.user.id,{limit:r=10,offset:s=0}=e.query,o=await database_1.default.query(`
      SELECT * FROM checkpoints 
      WHERE user_id = $1 
      ORDER BY check_in_time DESC 
      LIMIT $2 OFFSET $3
    `,[a,r,s]);t.json({checkpoints:o.rows,total:o.rowCount})}catch(e){console.error("Get checkpoint history error:",e),t.status(500).json({error:"Failed to get checkpoint history",message:e.message})}});exports.getCheckpointHistory=getCheckpointHistory;