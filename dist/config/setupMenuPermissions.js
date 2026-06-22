"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("./database"));
const setupMenuPermissions = async () => {
    const client = await database_1.default.connect();
    try {
        console.log('Setting up menu permissions...');
        // Create menu_items table
        await client.query(`
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
    `);
        console.log('✓ Created menu_items table');
        // Create role_menu_permissions table
        await client.query(`
      CREATE TABLE IF NOT EXISTS role_menu_permissions (
        id SERIAL PRIMARY KEY,
        role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
        menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(role_id, menu_item_id)
      );
    `);
        console.log('✓ Created role_menu_permissions table');
        // Delete the old distanceTracking menu item if it exists
        await client.query(`
      DELETE FROM menu_items WHERE key = 'distanceTracking';
    `);
        // Insert menu items
        await client.query(`
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
    `);
        console.log('✓ Inserted menu items');
        // Get role IDs
        const rolesResult = await client.query('SELECT id, name FROM roles;');
        const salesAgentRole = rolesResult.rows.find(r => r.name === 'Sales Agent');
        const managerRole = rolesResult.rows.find(r => r.name === 'Manager');
        const adminRole = rolesResult.rows.find(r => r.name === 'Admin');
        // Get menu item IDs
        const menuResult = await client.query('SELECT id, key FROM menu_items;');
        const getMenuId = (key) => menuResult.rows.find(m => m.key === key)?.id;
        // Sales Agent permissions - only specific items
        if (salesAgentRole) {
            const salesAgentMenus = [
                'dashboard',
                'startDay',
                'dealerVisit',
                'orderBooking',
                'paymentCollection',
                'manualExpense'
            ];
            for (const menuKey of salesAgentMenus) {
                const menuId = getMenuId(menuKey);
                if (menuId) {
                    await client.query(`
            INSERT INTO role_menu_permissions (role_id, menu_item_id)
            VALUES ($1, $2)
            ON CONFLICT (role_id, menu_item_id) DO NOTHING;
          `, [salesAgentRole.id, menuId]);
                }
            }
            console.log('✓ Set Sales Agent permissions');
        }
        // Manager permissions - all items
        if (managerRole) {
            for (const menu of menuResult.rows) {
                await client.query(`
          INSERT INTO role_menu_permissions (role_id, menu_item_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, menu_item_id) DO NOTHING;
        `, [managerRole.id, menu.id]);
            }
            console.log('✓ Set Manager permissions (all items)');
        }
        // Admin permissions - all items
        if (adminRole) {
            for (const menu of menuResult.rows) {
                await client.query(`
          INSERT INTO role_menu_permissions (role_id, menu_item_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, menu_item_id) DO NOTHING;
        `, [adminRole.id, menu.id]);
            }
            console.log('✓ Set Admin permissions (all items)');
        }
        console.log('Menu permissions setup completed successfully!');
    }
    catch (error) {
        console.error('Error setting up menu permissions:', error);
        throw error;
    }
    finally {
        client.release();
    }
};
// Run setup if this file is executed directly
if (require.main === module) {
    setupMenuPermissions()
        .then(() => {
        console.log('Setup complete');
        process.exit(0);
    })
        .catch((error) => {
        console.error('Setup failed:', error);
        process.exit(1);
    });
}
exports.default = setupMenuPermissions;
