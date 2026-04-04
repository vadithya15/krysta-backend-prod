var __createBinding=this&&this.__createBinding||(Object.create?function(e,t,r,a){void 0===a&&(a=r);var o=Object.getOwnPropertyDescriptor(t,r);o&&("get"in o?t.__esModule:!o.writable&&!o.configurable)||(o={enumerable:!0,get:function(){return t[r]}}),Object.defineProperty(e,a,o)}:function(e,t,r,a){e[a=void 0===a?r:a]=t[r]}),__setModuleDefault=this&&this.__setModuleDefault||(Object.create?function(e,t){Object.defineProperty(e,"default",{enumerable:!0,value:t})}:function(e,t){e.default=t}),__importStar=this&&this.__importStar||(()=>{var o=function(e){return(o=Object.getOwnPropertyNames||function(e){var t,r=[];for(t in e)Object.prototype.hasOwnProperty.call(e,t)&&(r[r.length]=t);return r})(e)};return function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r=o(e),a=0;a<r.length;a++)"default"!==r[a]&&__createBinding(t,e,r[a]);return __setModuleDefault(t,e),t}})(),__importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0}),exports.generateOrderPdf=exports.updateOrderPaymentWithReceipt=exports.getReceipt=exports.getDealerPaymentSummary=exports.getPaymentTransactions=exports.updateOrderApproval=exports.getPendingApprovals=exports.updateOrderPayment=exports.getOrderById=exports.getOrders=exports.createOrder=void 0;let database_1=__importDefault(require("../config/database")),socketService_1=require("../services/socketService"),role_access_1=require("../middleware/role-access"),fs=__importStar(require("fs")),path=__importStar(require("path")),pdfkit_1=__importDefault(require("pdfkit")),createOrder=async(e,t)=>{var r=await database_1.default.connect();try{var a=e.user?.id,{dealer_id:o,items:n,subtotal:s,discount:i,tax:d,total:u,payment_method:c,payment_type:l,advance_amount:p,notes:_}=e.body;if(!n||0===n.length)return t.status(400).json({error:"Order must contain items"});await r.query("BEGIN");var m,y="ORD-"+Date.now(),E="advance"===l?u-p:0,f=(await r.query(`INSERT INTO orders (order_number, user_id, dealer_id, subtotal, discount, tax, total, payment_method, payment_type, advance_amount, remaining_balance, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending')
       RETURNING *`,[y,a,o,s,i,d,u,c,l,p||0,E,_])).rows[0];for(m of n){if(0===(await r.query("SELECT id FROM products WHERE id = $1",[m.product_id])).rows.length)throw new Error(`Product ${m.product_id} not found`);await r.query(`INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5, $6)`,[f.id,m.product_id,m.product_name,m.quantity,m.unit_price,m.total_price])}0<E&&await r.query(`INSERT INTO payment_transactions 
         (order_id, dealer_id, user_id, amount, payment_method, payment_mode, notes, status_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1)`,[f.id,o,a,E,c||"cash","invoice",_||"Order placed. Amount due: ₹"+E]),p&&0<p&&await r.query(`INSERT INTO payment_transactions 
         (order_id, dealer_id, user_id, amount, payment_method, payment_mode, notes, status_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 3)`,[f.id,o,a,p,c||"cash","advance","Advance payment received: ₹"+p]),await r.query("COMMIT");var v,O=await getOrderDetails(f.id);t.status(201).json({message:"Order submitted for approval",order:O});try{for(v of(await r.query(`SELECT u.id, u.name, u.push_notification_token
               FROM users u
               JOIN roles r ON u.role_id = r.id
               WHERE r.name IN ('Manager', 'Admin') AND u.is_active = true`)).rows)await r.query(`INSERT INTO notifications (user_id, title, body, type, created_at)
                 VALUES ($1, $2, $3, $4, NOW())`,[v.id,"Order Approval Required",`Order ${O.order_number} requires approval`,"order_approval"])}catch(e){console.error("Error notifying approvers:",e)}(0,socketService_1.emitOrderCreated)(O)}catch(e){await r.query("ROLLBACK"),console.error("Create order error:",e),t.status(500).json({error:e.message||"Server error creating order"})}finally{r.release()}},getOrders=(exports.createOrder=createOrder,async(r,a)=>{try{var o=r.user?.id,{status:n,limit:s=50,offset:i=0}=r.query;if(!o)return a.status(401).json({error:"Unauthorized"});var d=await(0,role_access_1.getAccessibleUserIds)(o);if(0===d.length)return a.json({orders:[]});let e=`
      SELECT o.*, 
             u.name as sales_rep_name,
             dv.name as dealer_name,
             dv.city as dealer_city
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN dealers_view dv ON o.dealer_id = dv.id
      WHERE o.user_id = ANY($1)
    `;var u=[d];let t=1;n&&(t++,e+=" AND o.status = $"+t,u.push(n)),e+=` ORDER BY o.created_at DESC LIMIT $${t+1} OFFSET $`+(t+2),u.push(s,i);var c=await database_1.default.query(e,u);a.json({orders:c.rows})}catch(e){console.error("Get orders error:",e),a.status(500).json({error:"Server error fetching orders"})}}),getOrderById=(exports.getOrders=getOrders,async(e,t)=>{try{var r,a,o=e.params.id,n=e.user?.id;return n?(r=await(0,role_access_1.getAccessibleUserIds)(n),(a=await getOrderDetails(parseInt(o),r))?void t.json({order:a}):t.status(404).json({error:"Order not found"})):t.status(401).json({error:"Unauthorized"})}catch(e){console.error("Get order error:",e),t.status(500).json({error:"Server error fetching order"})}}),getOrderDetails=(exports.getOrderById=getOrderById,async(e,t)=>{let r=`
    SELECT o.*, 
           u.name as sales_rep_name,
           dv.name as dealer_name,
           dv.phone as dealer_phone,
           dv.address as dealer_address
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    LEFT JOIN dealers_view dv ON o.dealer_id = dv.id
    WHERE o.id = $1
  `;var a=[e],t=(t&&0<t.length&&(r+=" AND o.user_id = ANY($2)",a.push(t)),await database_1.default.query(r,a));return 0===t.rows.length?null:(a=t.rows[0],t=await database_1.default.query("SELECT * FROM order_items WHERE order_id = $1",[e]),a.items=t.rows,t=await database_1.default.query(`SELECT pt.id, pt.amount, pt.payment_mode, pt.payment_method, pt.reference_number, 
            pt.notes, pt.receipt_uri, pt.receipt_name, pt.created_at,
            pt.status_id, ps.name as status
     FROM payment_transactions pt
     LEFT JOIN payment_status ps ON pt.status_id = ps.id
     WHERE pt.order_id = $1 
     ORDER BY pt.created_at ASC`,[e]),a.payment_transactions=t.rows,a)}),updateOrderPayment=async(e,t)=>{var r=await database_1.default.connect();try{var a=e.params.id,{amount:o,payment_method:n="cash",payment_mode:s="cash",reference_number:i,notes:d,receipt_uri:u,receipt_name:c}=e.body,l=e.user?.id,p=await r.query("SELECT * FROM orders WHERE id = $1",[a]);if(0===p.rows.length)return t.status(404).json({error:"Order not found"});var _=p.rows[0];if(o<=0||o>_.remaining_balance)return t.status(400).json({error:"Invalid payment amount"});await r.query("BEGIN");try{let e=null;if(u&&c)try{var m=path.join(process.cwd(),"uploads","receipts"),y=(fs.existsSync(m)||fs.mkdirSync(m,{recursive:!0}),Date.now()),E=`receipt_${_.id}_${y}_`+c,f=path.join(m,E),v=Buffer.from(u,"base64");fs.writeFileSync(f,v),e="uploads/receipts/"+E,console.log("Receipt saved: "+e)}catch(e){console.error("Error saving receipt file:",e)}var O=(_.balance_paid||0)+o,g=_.remaining_balance-o,w=(await r.query(`UPDATE orders 
         SET balance_paid = $1, 
             remaining_balance = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,[O,g,a]),await r.query(`INSERT INTO payment_transactions 
         (order_id, dealer_id, user_id, amount, payment_method, payment_mode, reference_number, notes, receipt_uri, receipt_name, status_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 2)`,[_.id,_.dealer_id,l,o,n,s,i||null,d||null,e||null,c||null]),await r.query("COMMIT"),l?await(0,role_access_1.getAccessibleUserIds)(l):void 0),R=await getOrderDetails(parseInt(a),w);t.json({message:"Payment collected successfully",order:R,transaction:{amount:o,payment_mode:s,reference_number:i,receipt_saved:!!e,timestamp:(new Date).toISOString()}})}catch(e){throw await r.query("ROLLBACK"),e}}catch(e){console.error("Update payment error:",e),t.status(500).json({error:e.message||"Server error updating payment"})}finally{r.release()}},getPendingApprovals=(exports.updateOrderPayment=updateOrderPayment,async(e,t)=>{try{var r,a,o,n,s,i,d,u=e.user?.id;return u?(r=await(0,role_access_1.getUserRole)(u),a=[role_access_1.ROLES.ADMIN,role_access_1.ROLES.DIRECTOR,role_access_1.ROLES.REGIONAL_MANAGER,role_access_1.ROLES.MANAGER],r&&a.includes(r)?0===(o=await(0,role_access_1.getAccessibleUserIds)(u)).length?t.json({orders:[]}):({limit:n=50,offset:s=0}=e.query,i=await database_1.default.query(`SELECT DISTINCT o.*, 
              u.name as sales_rep_name,
              dv.name as dealer_name,
              dv.city as dealer_city,
              dv.phone as dealer_phone,
              dv.address as dealer_address
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN dealers_view dv ON o.dealer_id = dv.id
       LEFT JOIN payment_transactions pt ON o.id = pt.order_id
       WHERE (o.status = 'pending' OR pt.status_id = 1)
         AND o.user_id = ANY($1)
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,[o,n,s]),d=await Promise.all(i.rows.map(async e=>{var t=await database_1.default.query("SELECT * FROM order_items WHERE order_id = $1",[e.id]),r=await database_1.default.query(`SELECT pt.id, pt.amount, pt.payment_mode, pt.payment_method, pt.reference_number, 
                  pt.notes, pt.receipt_uri, pt.receipt_name, pt.created_at,
                  pt.status_id, ps.name as status
           FROM payment_transactions pt
           LEFT JOIN payment_status ps ON pt.status_id = ps.id
           WHERE pt.order_id = $1 
           ORDER BY pt.created_at ASC`,[e.id]);return{...e,items:0<t.rows.length?t.rows:[],payment_transactions:0<r.rows.length?r.rows:null}})),void t.json({orders:d})):t.status(403).json({error:"Access denied"})):t.status(401).json({error:"Unauthorized"})}catch(e){console.error("Get pending approvals error:",e),t.status(500).json({error:"Server error fetching pending approvals"})}}),updateOrderApproval=(exports.getPendingApprovals=getPendingApprovals,async(e,t)=>{var r=await database_1.default.connect();try{var a=e.user?.role;if(!a||"Manager"!==a&&"Admin"!==a)return t.status(403).json({error:"Access denied"});var o=e.params.id,n=e.body.action;if(!n||"approve"!==n&&"reject"!==n)return t.status(400).json({error:"Invalid action. Use approve or reject."});await r.query("BEGIN");var s=await r.query("SELECT * FROM orders WHERE id = $1",[o]);if(0===s.rows.length)return await r.query("ROLLBACK"),t.status(404).json({error:"Order not found"});var i,d=s.rows[0];if("pending"!==d.status)return await r.query("ROLLBACK"),t.status(400).json({error:"Only pending orders can be approved or rejected"});if("approve"===n){for(i of(await r.query("SELECT * FROM order_items WHERE order_id = $1",[o])).rows)await r.query("UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",[i.quantity,i.product_id]);await r.query(`UPDATE payment_transactions SET status_id = 2, updated_at = CURRENT_TIMESTAMP 
         WHERE order_id = $1 AND status_id = 1`,[o]),await r.query("UPDATE orders SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = $1",[o])}else await r.query(`UPDATE payment_transactions SET status_id = 3, updated_at = CURRENT_TIMESTAMP 
         WHERE order_id = $1 AND status_id = 1`,[o]),await r.query("UPDATE orders SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = $1",[o]);await r.query("COMMIT");var u=await getOrderDetails(parseInt(o));try{d.user_id&&await r.query(`INSERT INTO notifications (user_id, title, body, type, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,[d.user_id,"approve"===n?"Order Approved":"Order Rejected",`Order ${u.order_number} has been ${n}d`,"order_status"])}catch(e){console.error("Error notifying sales rep:",e)}(0,socketService_1.emitOrderUpdate)(d.id,"approve"===n?"confirmed":"rejected"),t.json({message:`Order ${n}d successfully`,order:u})}catch(e){await r.query("ROLLBACK"),console.error("Update approval error:",e),t.status(500).json({error:e.message||"Server error updating approval"})}finally{r.release()}}),getPaymentTransactions=(exports.updateOrderApproval=updateOrderApproval,async(t,r)=>{try{var{orderId:a,dealerId:o}=t.query,n=t.user?.id;if(!n)return r.status(401).json({error:"Unauthorized"});var s=await(0,role_access_1.getAccessibleUserIds)(n);if(0===s.length)return r.json({transactions:[],total_transactions:0,total_amount:0});let e=`
      SELECT 
        pt.*,
        o.order_number,
        o.created_at as order_created_at,
        dv.name as dealer_name,
        u.name as collected_by,
        o.total,
        o.remaining_balance,
        o.balance_paid
      FROM payment_transactions pt
      JOIN orders o ON pt.order_id = o.id
      JOIN dealers_view dv ON pt.dealer_id = dv.id
      LEFT JOIN users u ON pt.user_id = u.id
      WHERE pt.user_id = ANY($1)
    `;var i=[s],d=(a&&(e+=" AND pt.order_id = $"+(i.length+1),i.push(a)),o&&(e+=" AND pt.dealer_id = $"+(i.length+1),i.push(o)),e+=" ORDER BY pt.created_at DESC",await database_1.default.query(e,i));r.json({transactions:d.rows,total_transactions:d.rows.length,total_amount:d.rows.reduce((e,t)=>e+parseFloat(t.amount),0)})}catch(e){console.error("Get payment transactions error:",e),r.status(500).json({error:e.message||"Server error fetching transactions"})}}),getDealerPaymentSummary=(exports.getPaymentTransactions=getPaymentTransactions,async(e,t)=>{try{var r=e.params.dealerId,a=e.user?.id;if(!a)return t.status(401).json({error:"Unauthorized"});var o=await(0,role_access_1.getAccessibleUserIds)(a),n=await database_1.default.query(`
      SELECT 
        o.id,
        o.order_number,
        o.total,
        o.advance_amount,
        o.remaining_balance,
        o.balance_paid,
        o.created_at,
        COALESCE(SUM(pt.amount), 0) as collected_amount
      FROM orders o
      LEFT JOIN payment_transactions pt ON o.id = pt.order_id
      WHERE o.user_id = ANY($1) AND o.dealer_id = $2 AND o.status = 'confirmed'
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `,[o,r]),s=await database_1.default.query(`
      SELECT 
        pt.*,
        o.order_number
      FROM payment_transactions pt
      JOIN orders o ON pt.order_id = o.id
      WHERE pt.user_id = ANY($1) AND pt.dealer_id = $2
      ORDER BY pt.created_at DESC
      LIMIT 20
    `,[o,r]),i=n.rows,d=s.rows,u={dealer_id:r,total_orders:i.length,total_order_value:i.reduce((e,t)=>e+parseFloat(t.total),0),total_pending:i.reduce((e,t)=>e+parseFloat(t.remaining_balance||0),0),total_collected:d.reduce((e,t)=>e+parseFloat(t.amount),0),total_advance:i.reduce((e,t)=>e+parseFloat(t.advance_amount||0),0),orders:i,recent_transactions:d};t.json(u)}catch(e){console.error("Get dealer payment summary error:",e),t.status(500).json({error:e.message||"Server error fetching summary"})}}),getReceipt=(exports.getDealerPaymentSummary=getDealerPaymentSummary,async(e,t)=>{try{var r,a,o,n,s,i=e.params.transactionId,d=e.user?.id;return d?(r=await(0,role_access_1.getAccessibleUserIds)(d),0===(a=await database_1.default.query(`SELECT receipt_uri, receipt_name FROM payment_transactions 
       WHERE id = $1 AND user_id = ANY($2)`,[i,r])).rows.length?t.status(404).json({error:"Transaction not found"}):({receipt_uri:o,receipt_name:n}=a.rows[0],o?(s=path.join(process.cwd(),o),fs.existsSync(s)?void t.download(s,n||"receipt",e=>{e&&console.error("Error sending receipt file:",e)}):t.status(404).json({error:"Receipt file not found on server"})):t.status(404).json({error:"No receipt file found for this transaction"}))):t.status(401).json({error:"Unauthorized"})}catch(e){console.error("Get receipt error:",e),t.status(500).json({error:e.message||"Server error fetching receipt"})}}),updateOrderPaymentWithReceipt=(exports.getReceipt=getReceipt,async(e,r)=>{var a=await database_1.default.connect();try{var o=e.params.id,{amount:t,payment_method:n="cash",payment_mode:s="cash",reference_number:i,notes:d}=e.body,u=e.file,c=e.user?.id,l=await a.query("SELECT * FROM orders WHERE id = $1",[o]);if(0===l.rows.length)return r.status(404).json({error:"Order not found"});var p=l.rows[0],_=parseFloat(t);if(_<=0||_>p.remaining_balance)return r.status(400).json({error:"Invalid payment amount"});await a.query("BEGIN");try{let e=null,t=null;if(u)try{var m=path.join(process.cwd(),"uploads","receipts"),y=(fs.existsSync(m)||fs.mkdirSync(m,{recursive:!0}),Date.now()),E=u.originalname,f=`receipt_${p.id}_${y}_`+E,v=path.join(m,f);fs.writeFileSync(v,u.buffer),e="uploads/receipts/"+f,t=E}catch(e){console.error("Error saving receipt file:",e)}var O=(p.balance_paid||0)+_,g=p.remaining_balance-_,w=(await a.query(`UPDATE orders 
         SET balance_paid = $1, 
             remaining_balance = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,[O,g,o]),await a.query(`INSERT INTO payment_transactions 
         (order_id, dealer_id, user_id, amount, payment_method, payment_mode, reference_number, notes, receipt_uri, receipt_name, status_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 2)
         RETURNING *`,[p.id,p.dealer_id,c,_,n,s,i||null,d||null,e||null,t||null]),await a.query("COMMIT"),c?await(0,role_access_1.getAccessibleUserIds)(c):void 0),R=await getOrderDetails(parseInt(o),w);r.json({message:"Payment collected successfully with receipt",order:R,transaction:{amount:_,paymentMode:s,newBalance:g,receiptPath:e}})}catch(e){throw await a.query("ROLLBACK"),e}}catch(e){console.error("Update payment error:",e),r.status(500).json({error:e.message||"Server error updating payment"})}finally{a.release()}}),generateOrderPdf=(exports.updateOrderPaymentWithReceipt=updateOrderPaymentWithReceipt,async(e,a)=>{try{var o=e.params.id,n=await getOrderDetails(parseInt(o));if(!n)return a.status(404).json({error:"Order not found"});let t=new pdfkit_1.default({size:"A4",margin:40});a.setHeader("Content-Type","application/pdf"),a.setHeader("Content-Disposition",`attachment; filename="Order-${n.order_number}.pdf"`),t.pipe(a),t.fontSize(20).font("Helvetica-Bold").text("ORDER APPROVAL DOCUMENT",{align:"center"}),t.moveDown(.5),t.fontSize(11).font("Helvetica").text("─".repeat(80),{align:"center"}),t.moveDown(),t.fontSize(12).font("Helvetica-Bold").text("ORDER INFORMATION"),t.fontSize(10).font("Helvetica"),t.text("Order Number: "+n.order_number,{indent:20}),t.text("Order Date: "+new Date(n.created_at).toLocaleDateString(),{indent:20}),t.text("Status: "+n.status.toUpperCase(),{indent:20}),t.moveDown(),t.fontSize(12).font("Helvetica-Bold").text("DEALER INFORMATION"),t.fontSize(10).font("Helvetica"),t.text("Dealer: "+n.dealer_name,{indent:20}),n.dealer_phone&&t.text("Phone: "+n.dealer_phone,{indent:20}),n.dealer_address&&t.text("Address: "+n.dealer_address,{indent:20}),t.moveDown(),t.fontSize(12).font("Helvetica-Bold").text("SALES REPRESENTATIVE"),t.fontSize(10).font("Helvetica"),t.text("Name: "+(n.sales_rep_name||"N/A"),{indent:20}),t.moveDown(),t.fontSize(12).font("Helvetica-Bold").text("PRODUCTS ORDERED"),t.moveDown(.3);var s=t.y;t.fontSize(9).font("Helvetica-Bold"),t.text("Product Name",50,s),t.text("Qty",360,s),t.text("Unit Price",450,s),t.text("Total",530,s),t.moveTo(40,s+15).lineTo(570,s+15).stroke(),t.fontSize(9).font("Helvetica");let r=s+25;n.items&&0<n.items.length&&n.items.forEach(e=>{t.text(e.product_name,50,r,{width:200}),t.text(e.quantity.toString(),360,r),t.text("₹"+Number(e.unit_price).toFixed(2),450,r),t.text("₹"+Number(e.total_price).toFixed(2),530,r),r+=15}),t.moveTo(40,r+5).lineTo(570,r+5).stroke(),r+=15,t.fontSize(12).font("Helvetica-Bold").text("PAYMENT SUMMARY"),t.fontSize(10).font("Helvetica"),t.text("Subtotal: ₹"+Number(n.subtotal).toFixed(2),{indent:20}),0<n.discount&&t.text("Discount: -₹"+Number(n.discount).toFixed(2),{indent:20}),t.text("Tax (18%): ₹"+Number(n.tax).toFixed(2),{indent:20}),t.fontSize(11).font("Helvetica-Bold"),t.text("Total Amount: ₹"+Number(n.total).toFixed(2),{indent:20}),t.moveDown(),n.payment_type&&(t.fontSize(11).font("Helvetica-Bold").text("PAYMENT TYPE"),t.fontSize(10).font("Helvetica"),t.text("Type: "+n.payment_type.toUpperCase(),{indent:20}),n.advance_amount&&0<n.advance_amount&&(t.text("Advance Collected: ₹"+Number(n.advance_amount).toFixed(2),{indent:20}),n.remaining_balance)&&0<n.remaining_balance&&t.text("Outstanding Due: ₹"+Number(n.remaining_balance).toFixed(2),{indent:20}),t.moveDown()),n.notes&&(t.fontSize(11).font("Helvetica-Bold").text("NOTES"),t.fontSize(10).font("Helvetica"),t.text(n.notes,{indent:20,width:500}),t.moveDown()),t.fontSize(9).font("Helvetica").text("─".repeat(80),{align:"center"}),t.text("Document Generated: "+(new Date).toLocaleString(),{align:"center"}),t.text("Krysta Sales Tracker - Approval System",{align:"center"}),t.end()}catch(e){console.error("Generate PDF error:",e),a.status(500).json({error:e.message||"Server error generating PDF"})}});exports.generateOrderPdf=generateOrderPdf;