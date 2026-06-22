"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteArea = exports.updateArea = exports.createArea = exports.getAreaById = exports.getAllAreas = void 0;
const database_1 = __importDefault(require("../config/database"));
const hasTableColumn = async (tableName, columnName) => {
    const result = await database_1.default.query(`SELECT 1
     FROM information_schema.columns
     WHERE table_name = $1 AND column_name = $2
     LIMIT 1`, [tableName, columnName]);
    return result.rows.length > 0;
};
const getAreasSelectableColumns = async () => {
    const columns = ['id', 'name'];
    if (await hasTableColumn('areas', 'region_id'))
        columns.push('region_id');
    if (await hasTableColumn('areas', 'code'))
        columns.push('code');
    if (await hasTableColumn('areas', 'description'))
        columns.push('description');
    if (await hasTableColumn('areas', 'is_active'))
        columns.push('is_active');
    if (await hasTableColumn('areas', 'created_at'))
        columns.push('created_at');
    if (await hasTableColumn('areas', 'updated_at'))
        columns.push('updated_at');
    return columns.join(', ');
};
/**
 * Get all areas
 */
const getAllAreas = async (req, res) => {
    try {
        const organizationId = req.organization?.id;
        const selectedColumns = await getAreasSelectableColumns();
        const hasOrgColumn = await hasTableColumn('areas', 'organization_id');
        let result;
        if (hasOrgColumn && organizationId) {
            // Filter by organization if column exists
            result = await database_1.default.query(`SELECT ${selectedColumns}
         FROM areas
         WHERE organization_id = $1
         ORDER BY name ASC`, [organizationId]);
        }
        else {
            // Get all areas (organization-agnostic)
            result = await database_1.default.query(`SELECT ${selectedColumns}
         FROM areas
         ORDER BY name ASC`);
        }
        res.json({
            data: result.rows,
        });
    }
    catch (error) {
        console.error('Error fetching areas:', error);
        res.status(500).json({
            error: 'Server error',
            message: error.message || 'Failed to fetch areas'
        });
    }
};
exports.getAllAreas = getAllAreas;
/**
 * Get a single area by ID
 */
const getAreaById = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.organization?.id;
        const selectedColumns = await getAreasSelectableColumns();
        const hasOrgColumn = await hasTableColumn('areas', 'organization_id');
        let result;
        if (organizationId && hasOrgColumn) {
            result = await database_1.default.query(`SELECT ${selectedColumns}
         FROM areas
         WHERE id = $1 AND organization_id = $2`, [id, organizationId]);
        }
        else {
            result = await database_1.default.query(`SELECT ${selectedColumns}
         FROM areas
         WHERE id = $1`, [id]);
        }
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Area not found'
            });
        }
        res.json({
            data: result.rows[0],
        });
    }
    catch (error) {
        console.error('Error fetching area:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to fetch area'
        });
    }
};
exports.getAreaById = getAreaById;
/**
 * Create a new area
 */
const createArea = async (req, res) => {
    try {
        const organizationId = req.organization?.id;
        const { name, region_id, code, description, is_active = true } = req.body;
        if (!name) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Area name is required'
            });
        }
        const hasCodeColumn = await hasTableColumn('areas', 'code');
        const hasRegionColumn = await hasTableColumn('areas', 'region_id');
        const hasDescriptionColumn = await hasTableColumn('areas', 'description');
        const hasIsActiveColumn = await hasTableColumn('areas', 'is_active');
        const hasOrgColumn = await hasTableColumn('areas', 'organization_id');
        const insertColumns = ['name'];
        const insertValues = [name];
        if (hasCodeColumn) {
            insertColumns.push('code');
            insertValues.push(code ?? null);
        }
        if (hasRegionColumn) {
            insertColumns.push('region_id');
            insertValues.push(region_id || null);
        }
        if (hasDescriptionColumn) {
            insertColumns.push('description');
            insertValues.push(description ?? null);
        }
        if (hasIsActiveColumn) {
            insertColumns.push('is_active');
            insertValues.push(is_active);
        }
        if (hasOrgColumn && organizationId) {
            insertColumns.push('organization_id');
            insertValues.push(organizationId);
        }
        const placeholders = insertValues.map((_, index) => `$${index + 1}`).join(', ');
        const result = await database_1.default.query(`INSERT INTO areas (${insertColumns.join(', ')})
       VALUES (${placeholders})
       RETURNING *`, insertValues);
        res.status(201).json({
            data: result.rows[0],
            message: 'Area created successfully',
        });
    }
    catch (error) {
        console.error('Error creating area:', error);
        if (error.code === '23505') {
            return res.status(400).json({
                error: 'Conflict',
                message: 'Area with this name already exists'
            });
        }
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to create area'
        });
    }
};
exports.createArea = createArea;
/**
 * Update an area
 */
const updateArea = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.organization?.id;
        const { name, region_id, code, description, is_active } = req.body;
        const hasCodeColumn = await hasTableColumn('areas', 'code');
        const hasRegionColumn = await hasTableColumn('areas', 'region_id');
        const hasDescriptionColumn = await hasTableColumn('areas', 'description');
        const hasIsActiveColumn = await hasTableColumn('areas', 'is_active');
        const hasUpdatedAtColumn = await hasTableColumn('areas', 'updated_at');
        const hasOrgColumn = await hasTableColumn('areas', 'organization_id');
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;
        if (name !== undefined) {
            updateFields.push(`name = $${paramIndex}`);
            updateValues.push(name);
            paramIndex++;
        }
        if (hasCodeColumn && code !== undefined) {
            updateFields.push(`code = $${paramIndex}`);
            updateValues.push(code);
            paramIndex++;
        }
        if (hasRegionColumn && region_id !== undefined) {
            updateFields.push(`region_id = $${paramIndex}`);
            updateValues.push(region_id || null);
            paramIndex++;
        }
        if (hasDescriptionColumn && description !== undefined) {
            updateFields.push(`description = $${paramIndex}`);
            updateValues.push(description);
            paramIndex++;
        }
        if (hasIsActiveColumn && is_active !== undefined) {
            updateFields.push(`is_active = $${paramIndex}`);
            updateValues.push(is_active);
            paramIndex++;
        }
        if (updateFields.length === 0) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'No fields to update'
            });
        }
        if (hasUpdatedAtColumn) {
            updateFields.push(`updated_at = NOW()`);
        }
        updateValues.push(id);
        const whereClause = organizationId && hasOrgColumn
            ? `WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1}`
            : `WHERE id = $${paramIndex}`;
        if (organizationId && hasOrgColumn) {
            updateValues.push(organizationId);
        }
        const result = await database_1.default.query(`UPDATE areas 
       SET ${updateFields.join(', ')}
       ${whereClause}
       RETURNING *`, updateValues);
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Area not found'
            });
        }
        res.json({
            data: result.rows[0],
            message: 'Area updated successfully',
        });
    }
    catch (error) {
        console.error('Error updating area:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to update area'
        });
    }
};
exports.updateArea = updateArea;
/**
 * Delete an area
 */
const deleteArea = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.organization?.id;
        const hasOrgColumn = await hasTableColumn('areas', 'organization_id');
        let result;
        if (organizationId && hasOrgColumn) {
            result = await database_1.default.query('DELETE FROM areas WHERE id = $1 AND organization_id = $2 RETURNING *', [id, organizationId]);
        }
        else {
            result = await database_1.default.query('DELETE FROM areas WHERE id = $1 RETURNING *', [id]);
        }
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Area not found'
            });
        }
        res.json({
            message: 'Area deleted successfully',
        });
    }
    catch (error) {
        console.error('Error deleting area:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to delete area'
        });
    }
};
exports.deleteArea = deleteArea;
exports.default = {
    getAllAreas: exports.getAllAreas,
    getAreaById: exports.getAreaById,
    createArea: exports.createArea,
    updateArea: exports.updateArea,
    deleteArea: exports.deleteArea,
};
