var __importDefault=this&&this.__importDefault||function(t){return t&&t.__esModule?t:{default:t}};Object.defineProperty(exports,"__esModule",{value:!0}),exports.getProductSalesReport=void 0;let database_1=__importDefault(require("../config/database")),getProductSalesReport=async(e,o)=>{try{var r=e.organization?.id;if(!r)return o.status(400).json({error:"Organization not set"});var{from:a,to:i,status:s,limit:u=50,offset:d=0}=e.query,n=[r];let t="WHERE o.organization_id = $1";a&&(n.push(a),t+=" AND o.created_at >= $"+n.length),i&&(n.push(i),t+=" AND o.created_at <= $"+n.length),s&&(n.push(s),t+=" AND o.status = $"+n.length);var l=Number.isFinite(Number(u))?Math.min(Math.max(Number(u),1),500):50,_=Number.isFinite(Number(d))?Math.max(Number(d),0):0,p=await database_1.default.query(`SELECT
         COUNT(DISTINCT oi.product_id) AS total_products,
         COALESCE(SUM(oi.quantity), 0) AS total_quantity,
         COALESCE(SUM(oi.total_price), 0) AS total_revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       `+t,n),c=(n.push(l),n.push(_),await database_1.default.query(`SELECT
         oi.product_id,
         oi.product_name,
         COALESCE(SUM(oi.quantity), 0) AS quantity_sold,
         COALESCE(SUM(oi.total_price), 0) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       ${t}
       GROUP BY oi.product_id, oi.product_name
       ORDER BY revenue DESC
       LIMIT $${n.length-1} OFFSET $`+n.length,n));o.json({data:c.rows,summary:{total_products:parseInt(p.rows[0]?.total_products||"0",10),total_quantity:parseInt(p.rows[0]?.total_quantity||"0",10),total_revenue:parseFloat(p.rows[0]?.total_revenue||"0")},pagination:{limit:l,offset:_}})}catch(t){console.error("Error fetching product sales report:",t),o.status(500).json({error:"Failed to fetch product sales report"})}};exports.getProductSalesReport=getProductSalesReport;