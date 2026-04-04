var __importDefault=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(exports,"__esModule",{value:!0});let database_1=__importDefault(require("./database")),setupMenuPermissions=async()=>{var a=await database_1.default.connect();try{console.log("Setting up menu permissions..."),await a.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        label VARCHAR(100) NOT NULL,
        screen VARCHAR(50) NOT NULL,
        icon_name VARCHAR(50) NOT NULL,
        icon_family VARCHAR(50) NOT NULL,
        color VARCHAR(20) NOT NULL,
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `),console.log("✓ Created menu_items table"),await a.query(`
      CREATE TABLE IF NOT EXISTS role_menu_permissions (
        id SERIAL PRIMARY KEY,
        role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
        menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(role_id, menu_item_id)
      );
    `),console.log("✓ Created role_menu_permissions table"),await a.query(`
      DELETE FROM menu_items WHERE key = 'distanceTracking';
    `),await a.query(`
      INSERT INTO menu_items (key, label, screen, icon_name, icon_family, color, display_order) VALUES
        ('dashboard', 'Dashboard', 'Dashboard', 'dashboard', 'MaterialIcons', '#00C896', 0),
        ('startDay', 'Start Day', 'StartDay', 'play-circle-outline', 'MaterialIcons', '#FF9800', 1),
        ('dealerVisit', 'Dealer Visit', 'DealerVisit', 'store', 'FontAwesome5', '#FF9800', 2),
        ('orderBooking', 'Order Booking', 'OrderBooking', 'assignment', 'MaterialIcons', '#3F51B5', 3),
        ('paymentCollection', 'Payment Collection', 'PaymentCollection', 'money-bill-wave', 'FontAwesome5', '#E91E63', 4),
        ('targetTracking', 'Target Tracking', 'TargetTracking', 'bullseye', 'FontAwesome5', '#9C27B0', 5),
        ('daCalculation', 'DA Calculation', 'DACalculation', 'calculate', 'MaterialIcons', '#607D8B', 6),
        ('taCalculation', 'TA Calculation', 'TACalculation', 'calculate', 'MaterialIcons', '#795548', 7),
        ('manualExpense', 'Manual Expense', 'ManualExpense', 'file-invoice-dollar', 'FontAwesome5', '#F44336', 8),
        ('endDay', 'End Day', 'EndDay', 'stop-circle', 'MaterialIcons', '#4CAF50', 9),
        ('approval', 'Approval', 'Approval', 'check-circle', 'MaterialIcons', '#2196F3', 10),
        ('usersLocation', 'Distance Tracking', 'UsersMap', 'map', 'MaterialIcons', '#00BCD4', 11)
      ON CONFLICT (key) DO NOTHING;
    `),console.log("✓ Inserted menu items");var i=await a.query("SELECT id, name FROM roles;"),o=i.rows.find(e=>"Sales Agent"===e.name),r=i.rows.find(e=>"Manager"===e.name),n=i.rows.find(e=>"Admin"===e.name);let e=await a.query("SELECT id, key FROM menu_items;");var s;if(o){for(s of["dashboard","startDay","dealerVisit","orderBooking","paymentCollection","manualExpense"]){var t=(a=>e.rows.find(e=>e.key===a)?.id)(s);t&&await a.query(`
            INSERT INTO role_menu_permissions (role_id, menu_item_id)
            VALUES ($1, $2)
            ON CONFLICT (role_id, menu_item_id) DO NOTHING;
          `,[o.id,t])}console.log("✓ Set Sales Agent permissions")}if(r){for(var l of e.rows)await a.query(`
          INSERT INTO role_menu_permissions (role_id, menu_item_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, menu_item_id) DO NOTHING;
        `,[r.id,l.id]);console.log("✓ Set Manager permissions (all items)")}if(n){for(var m of e.rows)await a.query(`
          INSERT INTO role_menu_permissions (role_id, menu_item_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, menu_item_id) DO NOTHING;
        `,[n.id,m.id]);console.log("✓ Set Admin permissions (all items)")}console.log("Menu permissions setup completed successfully!")}catch(e){throw console.error("Error setting up menu permissions:",e),e}finally{a.release()}};require.main===module&&setupMenuPermissions().then(()=>{console.log("Setup complete"),process.exit(0)}).catch(e=>{console.error("Setup failed:",e),process.exit(1)}),exports.default=setupMenuPermissions;