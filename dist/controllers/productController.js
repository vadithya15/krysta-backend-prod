var __importDefault=this&&this.__importDefault||function(t){return t&&t.__esModule?t:{default:t}};Object.defineProperty(exports,"__esModule",{value:!0}),exports.updateProductStock=exports.getProductById=exports.getProducts=void 0;let database_1=__importDefault(require("../config/database")),getProducts=async(r,a)=>{try{var o=r.query.page,i=r.query.limit,s=void 0!==o||void 0!==i,d=s?Math.max(parseInt(o||"1",10)||1,1):1,u=s?Math.max(parseInt(i||"10",10)||10,1):0,c=s?(d-1)*u:0,n=r.query.category_id;let t="WHERE is_active = true";var _=[],p=(n&&"1"!==n&&(_.push(n),t+=" AND category_id = $"+_.length),await database_1.default.query("SELECT COUNT(*) FROM products_view "+t,_)),y=parseInt(p.rows[0]?.count||"0",10);let e=`SELECT 
        id, 
        name, 
        category_id, 
        category_name as category, 
        description, 
        unit, 
        price, 
      discount,
      billing_price,
      per_box,
        stock_quantity as quantity_in_stock, 
        min_order_quantity, 
        is_active, 
        created_at, 
        updated_at 
       FROM products_view ${t} ORDER BY name`;s&&(_.push(u),_.push(c),e+=` LIMIT $${_.length-1} OFFSET $`+_.length);var g=await database_1.default.query(e,_);a.json({data:g.rows,pagination:{total:y,page:d,limit:s?u:y,pages:s?Math.ceil(y/u):1}})}catch(t){console.error("Get products error:",t),a.status(500).json({error:"Server error fetching products"})}},getProductById=(exports.getProducts=getProducts,async(t,e)=>{try{var r=t.params.id,a=await database_1.default.query(`SELECT 
        id, 
        name, 
        category_id, 
        category_name as category, 
        description, 
        unit, 
        price, 
        discount,
        billing_price,
        per_box,
        stock_quantity as quantity_in_stock, 
        min_order_quantity, 
        is_active, 
        created_at, 
        updated_at 
       FROM products_view
       WHERE id = $1 AND is_active = true`,[r]);if(0===a.rows.length)return e.status(404).json({error:"Product not found"});e.json({data:a.rows[0]})}catch(t){console.error("Get product error:",t),e.status(500).json({error:"Server error fetching product"})}}),updateProductStock=(exports.getProductById=getProductById,async(t,e)=>(await database_1.default.query("UPDATE products SET stock_quantity = stock_quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",[e,t])).rows[0]);exports.updateProductStock=updateProductStock;