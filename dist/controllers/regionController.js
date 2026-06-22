"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRegion = exports.updateRegion = exports.createRegion = exports.getRegionById = exports.getAllRegions = void 0;
const database_1 = __importDefault(require("../config/database"));
const hasTableColumn = async (tableName, columnName) => {
    const result = await database_1.default.query(`SELECT 1
     FROM information_schema.columns
     WHERE table_name = $1 AND column_name = $2
     LIMIT 1`, [tableName, columnName]);
    return result.rows.length > 0;
};
const getRegionSelectableColumns = async () => {
    const columns = ['id', 'name'];
    if (await hasTableColumn('regions', 'code'))
        columns.push('code');
    if (await hasTableColumn('regions', 'description'))
        columns.push('description');
    if (await hasTableColumn('regions', 'is_active'))
        columns.push('is_active');
    if (await hasTableColumn('regions', 'created_at'))
        columns.push('created_at');
    if (await hasTableColumn('regions', 'updated_at'))
        columns.push('updated_at');
    return columns.join(', ');
};
const getAllRegions = async (req, res) => {
    try {
        const selectedColumns = await getRegionSelectableColumns();
        const hasOrgColumn = await hasTableColumn('regions', 'organization_id');
        const organizationId = req.organization?.id;
        const result = hasOrgColumn && organizationId
            ? await database_1.default.query(`SELECT ${selectedColumns}
           FROM regions
           WHERE organization_id = $1
           ORDER BY name ASC`, [organizationId])
            : await database_1.default.query(`SELECT ${selectedColumns}
           FROM regions
           ORDER BY name ASC`);
        res.json({ data: result.rows });
    }
    catch (error) {
        console.error('Error fetching regions:', error);
        res.status(500).json({
            error: 'Server error',
            message: error.message || 'Failed to fetch regions',
        });
    }
};
exports.getAllRegions = getAllRegions;
const getRegionById = async (req, res) => {
    try {
        const { id } = req.params;
        const selectedColumns = await getRegionSelectableColumns();
        const hasOrgColumn = await hasTableColumn('regions', 'organization_id');
        const organizationId = req.organization?.id;
        const result = hasOrgColumn && organizationId
            ? await database_1.default.query(`SELECT ${selectedColumns}
           FROM regions
           WHERE id = $1 AND organization_id = $2`, [id, organizationId])
            : await database_1.default.query(`SELECT ${selectedColumns}
           FROM regions
           WHERE id = $1`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Region not found',
            });
        }
        res.json({ data: result.rows[0] });
    }
    catch (error) {
        console.error('Error fetching region:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to fetch region',
        });
    }
};
exports.getRegionById = getRegionById;
const createRegion = async (req, res) => {
    try {
        const { name, code, description, is_active = true } = req.body;
        const organizationId = req.organization?.id;
        if (!name) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'Region name is required',
            });
        }
        const hasCodeColumn = await hasTableColumn('regions', 'code');
        const hasDescriptionColumn = await hasTableColumn('regions', 'description');
        const hasIsActiveColumn = await hasTableColumn('regions', 'is_active');
        const hasOrgColumn = await hasTableColumn('regions', 'organization_id');
        const insertColumns = ['name'];
        const insertValues = [name];
        if (hasCodeColumn) {
            insertColumns.push('code');
            insertValues.push(code ?? null);
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
        const result = await database_1.default.query(`INSERT INTO regions (${insertColumns.join(', ')})
       VALUES (${placeholders})
       RETURNING *`, insertValues);
        res.status(201).json({
            data: result.rows[0],
            message: 'Region created successfully',
        });
    }
    catch (error) {
        console.error('Error creating region:', error);
        if (error.code === '23505') {
            return res.status(400).json({
                error: 'Conflict',
                message: 'Region with this name already exists',
            });
        }
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to create region',
        });
    }
};
exports.createRegion = createRegion;
const updateRegion = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, description, is_active } = req.body;
        const organizationId = req.organization?.id;
        const hasCodeColumn = await hasTableColumn('regions', 'code');
        const hasDescriptionColumn = await hasTableColumn('regions', 'description');
        const hasIsActiveColumn = await hasTableColumn('regions', 'is_active');
        const hasUpdatedAtColumn = await hasTableColumn('regions', 'updated_at');
        const hasOrgColumn = await hasTableColumn('regions', 'organization_id');
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
                message: 'No fields to update',
            });
        }
        if (hasUpdatedAtColumn) {
            updateFields.push('updated_at = NOW()');
        }
        updateValues.push(id);
        const whereClause = hasOrgColumn && organizationId
            ? `WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1}`
            : `WHERE id = $${paramIndex}`;
        if (hasOrgColumn && organizationId) {
            updateValues.push(organizationId);
        }
        const result = await database_1.default.query(`UPDATE regions
       SET ${updateFields.join(', ')}
       ${whereClause}
       RETURNING *`, updateValues);
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Region not found',
            });
        }
        res.json({
            data: result.rows[0],
            message: 'Region updated successfully',
        });
    }
    catch (error) {
        console.error('Error updating region:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to update region',
        });
    }
};
exports.updateRegion = updateRegion;
const deleteRegion = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.organization?.id;
        const hasOrgColumn = await hasTableColumn('regions', 'organization_id');
        const result = hasOrgColumn && organizationId
            ? await database_1.default.query('DELETE FROM regions WHERE id = $1 AND organization_id = $2 RETURNING *', [id, organizationId])
            : await database_1.default.query('DELETE FROM regions WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Region not found',
            });
        }
        res.json({ message: 'Region deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting region:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to delete region',
        });
    }
};
exports.deleteRegion = deleteRegion;
exports.default = {
    getAllRegions: exports.getAllRegions,
    getRegionById: exports.getRegionById,
    createRegion: exports.createRegion,
    updateRegion: exports.updateRegion,
    deleteRegion: exports.deleteRegion,
};
