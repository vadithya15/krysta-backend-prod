var __importDefault=this&&this.__importDefault||function(t){return t&&t.__esModule?t:{default:t}};Object.defineProperty(exports,"__esModule",{value:!0}),exports.updateTrackingSettings=exports.getTrackingSettings=exports.getAllUsersLocations=exports.getLocationHistory=exports.saveLocation=void 0;let database_1=__importDefault(require("../config/database")),saveLocation=async(t,e)=>{try{var a=t.user.id,{latitude:s,longitude:r,accuracy:o,timestamp:i}=t.body;if(!s||!r)return e.status(400).json({error:"Latitude and longitude are required"});var n=i?new Date(i):new Date,c=await database_1.default.query(`
      INSERT INTO location_tracks (user_id, latitude, longitude, accuracy, recorded_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,[a,s,r,o||null,n]);e.json({message:"Location saved successfully",location:c.rows[0]})}catch(t){console.error("Save location error:",t),e.status(500).json({error:"Failed to save location",message:t.message})}},getLocationHistory=(exports.saveLocation=saveLocation,async(a,s)=>{try{var r=a.user.id,{startDate:o,endDate:i,limit:n=100,offset:c=0}=a.query;let t=`
      SELECT * FROM location_tracks 
      WHERE user_id = $1
    `;var l=[r];let e=2;o&&(t+=" AND recorded_at >= $"+e,l.push(o),e++),i&&(t+=" AND recorded_at <= $"+e,l.push(i),e++),t+=` ORDER BY recorded_at DESC LIMIT $${e} OFFSET $`+(e+1),l.push(n,c);var u=await database_1.default.query(t,l);s.json({locations:u.rows,total:u.rowCount})}catch(t){console.error("Get location history error:",t),s.status(500).json({error:"Failed to get location history",message:t.message})}}),getAllUsersLocations=(exports.getLocationHistory=getLocationHistory,async(t,e)=>{try{var a=await database_1.default.query(`
      SELECT DISTINCT ON (lt.user_id)
        lt.user_id,
        lt.latitude,
        lt.longitude,
        lt.accuracy,
        lt.recorded_at,
        u.name as user_name,
        u.email as user_email,
        u.phone as user_phone,
        c.status as checkpoint_status,
        c.check_in_time,
        c.check_in_location
      FROM location_tracks lt
      INNER JOIN users u ON lt.user_id = u.id
      LEFT JOIN checkpoints c ON u.id = c.user_id AND c.status = 'active'
      WHERE u.is_active = true
      ORDER BY lt.user_id, lt.recorded_at DESC
    `);e.json({locations:a.rows,total:a.rowCount})}catch(t){console.error("Get all users locations error:",t),e.status(500).json({error:"Failed to get users locations",message:t.message})}}),getTrackingSettings=(exports.getAllUsersLocations=getAllUsersLocations,async(t,a)=>{try{var s=await database_1.default.query(`
      SELECT setting_key, setting_value, description 
      FROM settings 
      WHERE setting_key = 'location_tracking_interval'
    `);if(0===s.rows.length)return a.json({location_tracking_interval:6e5});let e={};s.rows.forEach(t=>{e[t.setting_key]=parseInt(t.setting_value)}),a.json(e)}catch(t){console.error("Get tracking settings error:",t),a.status(500).json({error:"Failed to get tracking settings",message:t.message})}}),updateTrackingSettings=(exports.getTrackingSettings=getTrackingSettings,async(t,e)=>{try{var a=t.body.location_tracking_interval;if(!a||a<6e4)return e.status(400).json({error:"Invalid interval",message:"Tracking interval must be at least 60000ms (1 minute)"});var s=await database_1.default.query(`
      INSERT INTO settings (setting_key, setting_value, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (setting_key) 
      DO UPDATE SET setting_value = $2, updated_at = NOW()
      RETURNING *
    `,["location_tracking_interval",a.toString(),"GPS tracking interval in milliseconds"]);e.json({message:"Tracking settings updated successfully",setting:s.rows[0]})}catch(t){console.error("Update tracking settings error:",t),e.status(500).json({error:"Failed to update tracking settings",message:t.message})}});exports.updateTrackingSettings=updateTrackingSettings;