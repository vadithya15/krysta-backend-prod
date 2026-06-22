"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRegions = exports.bulkUpsertDealers = exports.deleteDealer = exports.updateDealer = exports.createDealer = exports.getDealerById = exports.getDealers = void 0;
const database_1 = __importDefault(require("../config/database"));
const geocodingService_1 = require("../services/geocodingService");
const XLSX = __importStar(require("xlsx"));
const hasTableColumn = async (tableName, columnName) => {
    const result = await database_1.default.query(`SELECT 1
     FROM information_schema.columns
     WHERE table_name = $1 AND column_name = $2
     LIMIT 1`, [tableName, columnName]);
    return result.rows.length > 0;
};
const tableExists = async (tableName) => {
    const result = await database_1.default.query(`SELECT to_regclass($1) as table_name`, [`public.${tableName}`]);
    return !!result.rows[0]?.table_name;
};
const getTableColumns = async (tableName) => {
    const result = await database_1.default.query(`SELECT column_name
     FROM information_schema.columns
     WHERE table_name = $1`, [tableName]);
    return new Set(result.rows.map((row) => row.column_name));
};
const normalizeUploadHeader = (header) => {
    const key = String(header || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    const aliases = {
        dealer_name: 'name',
        dealer: 'name',
        contact: 'contact_person',
        contact_name: 'contact_person',
        mobile: 'phone',
        mobile_number: 'phone',
        phone_number: 'phone',
        mail: 'email',
        email_id: 'email',
        pin: 'pincode',
        pin_code: 'pincode',
        zipcode: 'pincode',
        zip_code: 'pincode',
        licence_no: 'lno',
        license_no: 'lno',
        licence_number: 'lno',
        license_number: 'lno',
        gst: 'gst_number',
        gstin: 'gst_number',
        gst_no: 'gst_number',
        credit: 'credit_limit',
        limit: 'credit_limit',
        outstanding: 'outstanding_balance',
        balance: 'outstanding_balance',
        active: 'is_active',
        status: 'is_active',
        lat: 'latitude',
        lng: 'longitude',
        lon: 'longitude',
        long: 'longitude',
    };
    return aliases[key] || key;
};
const normalizeUploadRow = (row) => {
    return Object.entries(row).reduce((acc, [header, value]) => {
        const key = normalizeUploadHeader(header);
        if (key)
            acc[key] = typeof value === 'string' ? value.trim() : value;
        return acc;
    }, {});
};
const emptyToNull = (value) => {
    if (value === undefined || value === null)
        return null;
    if (typeof value === 'string' && value.trim() === '')
        return null;
    return value;
};
const toNumberOrNull = (value) => {
    const normalized = emptyToNull(value);
    if (normalized === null)
        return null;
    const numberValue = Number(String(normalized).replace(/,/g, ''));
    return Number.isFinite(numberValue) ? numberValue : null;
};
const toBooleanOrDefault = (value, fallback) => {
    const normalized = emptyToNull(value);
    if (normalized === null)
        return fallback;
    const text = String(normalized).trim().toLowerCase();
    if (['true', 'yes', 'y', '1', 'active'].includes(text))
        return true;
    if (['false', 'no', 'n', '0', 'inactive'].includes(text))
        return false;
    return fallback;
};
const getDealerUploadValue = (row, column) => {
    if (['city_id', 'state_id', 'area_id', 'region_id'].includes(column)) {
        return toNumberOrNull(row[column]);
    }
    if (['latitude', 'longitude', 'credit_limit', 'outstanding_balance'].includes(column)) {
        return toNumberOrNull(row[column]);
    }
    if (column === 'is_active') {
        return toBooleanOrDefault(row[column], true);
    }
    return emptyToNull(row[column]);
};
const getDealerMatch = async (row, dealerColumns, organizationId) => {
    const orgFilter = dealerColumns.has('organization_id') && organizationId
        ? { clause: ' AND organization_id = $2', value: organizationId }
        : null;
    const findOne = async (column, value) => {
        const normalized = emptyToNull(value);
        if (normalized === null || !dealerColumns.has(column))
            return null;
        const params = orgFilter ? [normalized, orgFilter.value] : [normalized];
        const result = await database_1.default.query(`SELECT *
       FROM dealers
       WHERE ${column} = $1${orgFilter ? orgFilter.clause : ''}
       LIMIT 1`, params);
        return result.rows[0] || null;
    };
    const byId = await findOne('id', toNumberOrNull(row.id));
    if (byId)
        return byId;
    for (const column of ['gst_number', 'email', 'phone']) {
        const existing = await findOne(column, row[column]);
        if (existing)
            return existing;
    }
    const name = emptyToNull(row.name);
    const city = emptyToNull(row.city);
    const state = emptyToNull(row.state);
    if (name && city && state) {
        const params = [name, city, state];
        let orgClause = '';
        if (orgFilter) {
            params.push(orgFilter.value);
            orgClause = ` AND organization_id = $${params.length}`;
        }
        const result = await database_1.default.query(`SELECT *
       FROM dealers
       WHERE LOWER(name) = LOWER($1)
         AND LOWER(COALESCE(city, '')) = LOWER($2)
         AND LOWER(COALESCE(state, '')) = LOWER($3)
         ${orgClause}
       LIMIT 1`, params);
        return result.rows[0] || null;
    }
    return null;
};
const upsertDealerUploadRow = async (row, dealerColumns, organizationId) => {
    const allowedColumns = [
        'name',
        'contact_person',
        'phone',
        'email',
        'address',
        'city',
        'state',
        'pincode',
        'lno',
        'area',
        'region',
        'city_id',
        'state_id',
        'area_id',
        'region_id',
        'latitude',
        'longitude',
        'gst_number',
        'credit_limit',
        'outstanding_balance',
        'is_active',
    ].filter((column) => dealerColumns.has(column));
    const existing = await getDealerMatch(row, dealerColumns, organizationId);
    if (existing) {
        const updateColumns = allowedColumns.filter((column) => row[column] !== undefined && column !== 'name');
        if (row.name !== undefined)
            updateColumns.unshift('name');
        if (updateColumns.length === 0) {
            return { action: 'updated', dealer: existing };
        }
        const values = updateColumns.map((column) => getDealerUploadValue(row, column));
        const setClause = updateColumns.map((column, index) => `${column} = $${index + 1}`);
        if (dealerColumns.has('updated_at')) {
            setClause.push('updated_at = CURRENT_TIMESTAMP');
        }
        values.push(existing.id);
        const result = await database_1.default.query(`UPDATE dealers
       SET ${setClause.join(', ')}
       WHERE id = $${values.length}
       RETURNING *`, values);
        return { action: 'updated', dealer: result.rows[0] };
    }
    const insertColumns = allowedColumns.filter((column) => row[column] !== undefined && column !== 'id');
    if (dealerColumns.has('organization_id') && organizationId) {
        insertColumns.push('organization_id');
    }
    const values = insertColumns.map((column) => {
        if (column === 'organization_id')
            return organizationId;
        return getDealerUploadValue(row, column);
    });
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    const result = await database_1.default.query(`INSERT INTO dealers (${insertColumns.join(', ')})
     VALUES (${placeholders})
     RETURNING *`, values);
    return { action: 'created', dealer: result.rows[0] };
};
const getDealers = async (req, res) => {
    try {
        // Pagination parameters - support both offset and page-based pagination
        const limit = parseInt(req.query.limit) || 10;
        let offset = parseInt(req.query.offset);
        // If offset not provided, calculate from page parameter (for backward compatibility)
        if (isNaN(offset)) {
            const page = parseInt(req.query.page) || 1;
            offset = (page - 1) * limit;
        }
        // Search/filter parameters
        const queryParam = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        const regionIdParam = typeof req.query.region_id === 'string' ? req.query.region_id.trim() : '';
        const userId = req.user?.id;
        const params = [];
        let whereClause = 'WHERE dv.is_active = true';
        // For admin users (superadmin role_id = 3), show all dealers
        // For regular users, filter by their assigned regions
        if (userId) {
            // Check if user is admin/superadmin (role_id = 3 or has admin role)
            const userResult = await database_1.default.query(`SELECT roles.name as role_name FROM users u 
         LEFT JOIN roles ON u.role_id = roles.id 
         WHERE u.id = $1`, [userId]);
            const userRole = userResult.rows[0]?.role_name?.toLowerCase();
            const isAdmin = userRole === 'superadmin' || userRole === 'admin' || userRole === 'director';
            // Only apply region filter for non-admin users
            if (!isAdmin) {
                // Access order:
                // 1) If user has area mappings -> filter by user_areas.area_id.
                // 2) If no area mappings -> fallback to user_regions.region_id.
                // 3) If neither exists -> return no dealers.
                const canFilterByArea = await hasTableColumn('dealers', 'area_id');
                const hasUserAreasTable = await tableExists('user_areas');
                let areaIds = [];
                if (canFilterByArea && hasUserAreasTable) {
                    const userAreasResult = await database_1.default.query('SELECT ARRAY_AGG(area_id) as area_ids FROM user_areas WHERE user_id = $1', [userId]);
                    areaIds = userAreasResult.rows[0]?.area_ids || [];
                }
                if (areaIds.length > 0) {
                    whereClause += ` AND dv.id IN (SELECT id FROM dealers WHERE area_id = ANY($${params.length + 1}::int[]))`;
                    params.push(areaIds);
                }
                else {
                    const userRegionsResult = await database_1.default.query('SELECT ARRAY_AGG(region_id) as region_ids FROM user_regions WHERE user_id = $1', [userId]);
                    const regionIds = userRegionsResult.rows[0]?.region_ids || [];
                    if (regionIds.length > 0) {
                        whereClause += ` AND dv.id IN (SELECT id FROM dealers WHERE region_id = ANY($${params.length + 1}::int[]))`;
                        params.push(regionIds);
                    }
                    else {
                        whereClause += ' AND 1=0';
                        console.warn(`User ${userId} has no area or region mapping, returning no dealers`);
                    }
                }
            }
        }
        // Filter by region_id if provided (explicit region filter)
        if (regionIdParam) {
            params.push(parseInt(regionIdParam));
            const index = params.length;
            whereClause += ` AND dv.id IN (SELECT id FROM dealers WHERE region_id = $${index})`;
        }
        if (queryParam) {
            params.push(`%${queryParam}%`);
            const index = params.length;
            whereClause += ` AND (
        dv.name ILIKE $${index}
        OR dv.city ILIKE $${index}
        OR dv.state ILIKE $${index}
        OR dv.phone ILIKE $${index}
        OR dv.address ILIKE $${index}
      )`;
        }
        const countResult = await database_1.default.query(`SELECT COUNT(*) as count FROM dealers_view dv ${whereClause}`, params);
        const total = parseInt(countResult.rows[0]?.count || '0', 10);
        params.push(limit);
        params.push(offset);
        const dataResult = await database_1.default.query(`SELECT * FROM dealers_view dv ${whereClause} ORDER BY dv.name LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        const page = Math.floor(offset / limit) + 1;
        const pages = limit > 0 ? Math.ceil(total / limit) : 1;
        res.json({
            data: dataResult.rows,
            pagination: {
                total,
                page,
                limit,
                pages,
            },
        });
    }
    catch (error) {
        console.error('Get dealers error:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to fetch dealers'
        });
    }
};
exports.getDealers = getDealers;
const getDealerById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(403).json({ error: 'User not available' });
        }
        // Check if user is admin
        const userResult = await database_1.default.query(`SELECT roles.name as role_name FROM users u 
       LEFT JOIN roles ON u.role_id = roles.id 
       WHERE u.id = $1`, [userId]);
        const userRole = userResult.rows[0]?.role_name?.toLowerCase();
        const isAdmin = userRole === 'superadmin' || userRole === 'admin' || userRole === 'director';
        let query = `SELECT * FROM dealers_view WHERE id = $1 AND is_active = true`;
        const params = [id];
        // Only apply region filter for non-admin users
        if (!isAdmin) {
            const canFilterByArea = await hasTableColumn('dealers', 'area_id');
            const hasUserAreasTable = await tableExists('user_areas');
            params.push(userId);
            if (canFilterByArea && hasUserAreasTable) {
                query += ` AND (
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
        )`;
            }
            else {
                query += ` AND EXISTS (
          SELECT 1 FROM user_regions ur
          WHERE ur.user_id = $2
            AND ur.region_id = (SELECT region_id FROM dealers WHERE id = dealers_view.id)
        )`;
            }
        }
        const result = await database_1.default.query(query, params);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Dealer not found' });
        }
        res.json({ data: result.rows[0] });
    }
    catch (error) {
        console.error('Get dealer error:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to fetch dealer'
        });
    }
};
exports.getDealerById = getDealerById;
const createDealer = async (req, res) => {
    try {
        const { name, contact_person, phone, email, address, city, state, pincode, lno, area, region, city_id, state_id, area_id, region_id, gst_number, credit_limit, } = req.body;
        // Validate required fields
        if (!name) {
            return res.status(400).json({ error: 'Dealer name is required' });
        }
        // Geocode the address if provided
        let latitude = null;
        let longitude = null;
        if (address || city || state || pincode) {
            const geocodingResult = await (0, geocodingService_1.geocodeAddress)(address, city, state, pincode);
            latitude = geocodingResult.latitude;
            longitude = geocodingResult.longitude;
            if (latitude && longitude) {
                console.log(`Geocoded dealer location: ${latitude}, ${longitude}`);
            }
            else {
                console.log('Could not geocode dealer address, location will be null');
            }
        }
        // Insert dealer with location
        const result = await database_1.default.query(`INSERT INTO dealers (
        name, contact_person, phone, email, address, 
        city, state, pincode, lno, area, region, city_id, state_id, area_id, region_id,
        gst_number, credit_limit, latitude, longitude
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`, [
            name,
            contact_person || null,
            phone || null,
            email || null,
            address || null,
            city || null,
            state || null,
            pincode || null,
            lno || null,
            area || null,
            region || null,
            city_id || null,
            state_id || null,
            area_id || null,
            region_id || null,
            gst_number || null,
            credit_limit || 0,
            latitude,
            longitude,
        ]);
        res.status(201).json({
            message: 'Dealer created successfully',
            data: result.rows[0],
        });
    }
    catch (error) {
        console.error('Create dealer error:', error);
        res.status(500).json({ error: 'Server error creating dealer' });
    }
};
exports.createDealer = createDealer;
const updateDealer = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, contact_person, phone, email, address, city, state, pincode, lno, area, region, city_id, state_id, area_id, region_id, gst_number, credit_limit, is_active, } = req.body;
        // Check if dealer exists
        const existingDealer = await database_1.default.query('SELECT * FROM dealers WHERE id = $1', [id]);
        if (existingDealer.rows.length === 0) {
            return res.status(404).json({ error: 'Dealer not found' });
        }
        const oldDealer = existingDealer.rows[0];
        // Check if address changed - if so, re-geocode
        let latitude = oldDealer.latitude;
        let longitude = oldDealer.longitude;
        const addressChanged = address !== oldDealer.address ||
            city !== oldDealer.city ||
            state !== oldDealer.state ||
            pincode !== oldDealer.pincode;
        if (addressChanged && (address || city || state || pincode)) {
            const geocodingResult = await (0, geocodingService_1.geocodeAddress)(address, city, state, pincode);
            latitude = geocodingResult.latitude;
            longitude = geocodingResult.longitude;
            if (latitude && longitude) {
                console.log(`Re-geocoded dealer location: ${latitude}, ${longitude}`);
            }
            else {
                console.log('Could not geocode updated dealer address');
            }
        }
        // Update dealer
        const result = await database_1.default.query(`UPDATE dealers SET
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
      RETURNING *`, [
            name !== undefined ? name : oldDealer.name,
            contact_person !== undefined ? contact_person : oldDealer.contact_person,
            phone !== undefined ? phone : oldDealer.phone,
            email !== undefined ? email : oldDealer.email,
            address !== undefined ? address : oldDealer.address,
            city !== undefined ? city : oldDealer.city,
            state !== undefined ? state : oldDealer.state,
            pincode !== undefined ? pincode : oldDealer.pincode,
            lno !== undefined ? lno : oldDealer.lno,
            area !== undefined ? area : oldDealer.area,
            region !== undefined ? region : oldDealer.region,
            city_id !== undefined ? city_id : oldDealer.city_id,
            state_id !== undefined ? state_id : oldDealer.state_id,
            area_id !== undefined ? area_id : oldDealer.area_id,
            region_id !== undefined ? region_id : oldDealer.region_id,
            gst_number !== undefined ? gst_number : oldDealer.gst_number,
            credit_limit !== undefined ? credit_limit : oldDealer.credit_limit,
            latitude,
            longitude,
            is_active !== undefined ? is_active : oldDealer.is_active,
            id,
        ]);
        res.json({
            message: 'Dealer updated successfully',
            data: result.rows[0],
        });
    }
    catch (error) {
        console.error('Update dealer error:', error);
        res.status(500).json({ error: 'Server error updating dealer' });
    }
};
exports.updateDealer = updateDealer;
const deleteDealer = async (req, res) => {
    try {
        const { id } = req.params;
        // Check if dealer exists
        const existingDealer = await database_1.default.query('SELECT * FROM dealers WHERE id = $1', [id]);
        if (existingDealer.rows.length === 0) {
            return res.status(404).json({ error: 'Dealer not found' });
        }
        // Soft-delete: mark as inactive
        await database_1.default.query(`UPDATE dealers SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
        res.json({ message: 'Dealer deleted successfully (soft delete)' });
    }
    catch (error) {
        console.error('Delete dealer error:', error);
        res.status(500).json({ error: 'Server error deleting dealer' });
    }
};
exports.deleteDealer = deleteDealer;
const bulkUpsertDealers = async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Dealer upload file is required',
            });
        }
        const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: false });
        const firstSheet = workbook.SheetNames[0];
        if (!firstSheet) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Upload file does not contain any sheets',
            });
        }
        const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
            defval: '',
            raw: false,
        });
        if (rawRows.length === 0) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Upload file does not contain dealer rows',
            });
        }
        const dealerColumns = await getTableColumns('dealers');
        const organizationId = req.organization?.id;
        const errors = [];
        const dealers = [];
        let created = 0;
        let updated = 0;
        for (let index = 0; index < rawRows.length; index++) {
            const rowNumber = index + 2;
            const row = normalizeUploadRow(rawRows[index]);
            try {
                if (!emptyToNull(row.name)) {
                    errors.push({
                        row: rowNumber,
                        key: row.email || row.phone || row.gst_number || undefined,
                        error: 'Dealer name is required',
                    });
                    continue;
                }
                const result = await upsertDealerUploadRow(row, dealerColumns, organizationId);
                if (result.action === 'created')
                    created++;
                if (result.action === 'updated')
                    updated++;
                dealers.push({
                    id: result.dealer.id,
                    name: result.dealer.name,
                    action: result.action,
                });
            }
            catch (error) {
                errors.push({
                    row: rowNumber,
                    key: row.email || row.phone || row.gst_number || row.name || undefined,
                    error: error.message || 'Failed to upsert dealer',
                });
            }
        }
        res.json({
            message: 'Dealer upload processed',
            total: rawRows.length,
            created,
            updated,
            failed: errors.length,
            dealers,
            errors,
            match_order: ['id', 'gst_number', 'email', 'phone', 'name+city+state'],
        });
    }
    catch (error) {
        console.error('Bulk dealer upload error:', error);
        res.status(500).json({
            error: 'Server error',
            message: error.message || 'Failed to process dealer upload',
        });
    }
};
exports.bulkUpsertDealers = bulkUpsertDealers;
const getRegions = async (req, res) => {
    try {
        const result = await database_1.default.query(`SELECT id, name 
       FROM regions 
       ORDER BY name`);
        res.json({
            data: result.rows,
        });
    }
    catch (error) {
        console.error('Get regions error:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to fetch regions'
        });
    }
};
exports.getRegions = getRegions;
