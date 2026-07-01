"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttendanceReport = void 0;
const database_1 = __importDefault(require("../config/database"));
const roleAccess_1 = require("../middleware/roleAccess");
const toDateString = (value, fallback) => {
    if (typeof value !== 'string' || !value.trim()) {
        return fallback.toISOString().slice(0, 10);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return fallback.toISOString().slice(0, 10);
    }
    return parsed.toISOString().slice(0, 10);
};
const getAttendanceReport = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
        const from = toDateString(req.query.from, thirtyDaysAgo);
        const to = toDateString(req.query.to, today);
        const status = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : '';
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        const requestedUserId = Number(req.query.user_id);
        const accessibleUserIds = await (0, roleAccess_1.getAccessibleUserIds)(userId);
        if (accessibleUserIds.length === 0) {
            return res.json({
                data: [],
                summary: {
                    total: 0,
                    completed: 0,
                    active: 0,
                    not_started: 0,
                    total_distance_km: 0,
                    total_working_hours: 0,
                },
            });
        }
        const filteredUserIds = Number.isFinite(requestedUserId) && requestedUserId > 0
            ? accessibleUserIds.filter((id) => id === requestedUserId)
            : accessibleUserIds;
        if (filteredUserIds.length === 0) {
            return res.json({
                data: [],
                summary: {
                    total: 0,
                    completed: 0,
                    active: 0,
                    not_started: 0,
                    total_distance_km: 0,
                    total_working_hours: 0,
                },
            });
        }
        const params = [filteredUserIds, from, to];
        let whereClause = '';
        if (status) {
            params.push(status);
            whereClause += ` AND attendance_status = $${params.length}`;
        }
        if (search) {
            params.push(`%${search}%`);
            whereClause += ` AND (employee_name ILIKE $${params.length} OR email ILIKE $${params.length} OR phone ILIKE $${params.length} OR role_name ILIKE $${params.length})`;
        }
        const result = await database_1.default.query(`WITH dates AS (
         SELECT generate_series($2::date, $3::date, interval '1 day')::date AS work_date
       ),
       accessible_users AS (
         SELECT u.id, u.name, u.email, u.phone, r.name AS role_name
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
         WHERE u.id = ANY($1::int[])
           AND u.is_active = true
       ),
       daily_checkpoints AS (
         SELECT
           c.user_id,
           DATE(c.check_in_time) AS work_date,
           MIN(c.check_in_time) AS check_in_time,
           (ARRAY_AGG(c.check_in_location ORDER BY c.check_in_time ASC))[1] AS check_in_location,
           MAX(c.check_out_time) FILTER (WHERE c.check_out_time IS NOT NULL) AS check_out_time,
           (ARRAY_AGG(c.check_out_location ORDER BY c.check_out_time DESC NULLS LAST))[1] AS check_out_location,
           SUM(COALESCE(c.total_distance_km, 0)) AS total_distance_km,
           BOOL_OR(c.check_out_time IS NULL OR c.status = 'active') AS has_active_checkpoint,
           COUNT(c.id) AS checkpoint_count
         FROM checkpoints c
         WHERE c.user_id = ANY($1::int[])
           AND DATE(c.check_in_time) BETWEEN $2::date AND $3::date
         GROUP BY c.user_id, DATE(c.check_in_time)
       ),
       attendance AS (
         SELECT
           au.id AS user_id,
           au.name AS employee_name,
           au.email,
           au.phone,
           au.role_name,
           d.work_date,
           dc.check_in_time,
           dc.check_in_location,
           dc.check_out_time,
           dc.check_out_location,
           COALESCE(dc.total_distance_km, 0)::float AS total_distance_km,
           CASE
             WHEN dc.checkpoint_count IS NULL THEN 'not_started'
             WHEN dc.has_active_checkpoint THEN 'active'
             ELSE 'completed'
           END AS attendance_status,
           CASE
             WHEN dc.check_in_time IS NULL THEN 0
             ELSE ROUND(
               EXTRACT(EPOCH FROM (COALESCE(dc.check_out_time, NOW()) - dc.check_in_time)) / 3600,
               2
             )::float
           END AS working_hours
         FROM dates d
         CROSS JOIN accessible_users au
         LEFT JOIN daily_checkpoints dc ON dc.user_id = au.id AND dc.work_date = d.work_date
       )
       SELECT *
       FROM attendance
       WHERE 1=1 ${whereClause}
       ORDER BY work_date DESC, employee_name ASC`, params);
        const rows = result.rows;
        const summary = rows.reduce((acc, row) => {
            acc.total += 1;
            acc.completed += row.attendance_status === 'completed' ? 1 : 0;
            acc.active += row.attendance_status === 'active' ? 1 : 0;
            acc.not_started += row.attendance_status === 'not_started' ? 1 : 0;
            acc.total_distance_km += Number(row.total_distance_km || 0);
            acc.total_working_hours += Number(row.working_hours || 0);
            return acc;
        }, {
            total: 0,
            completed: 0,
            active: 0,
            not_started: 0,
            total_distance_km: 0,
            total_working_hours: 0,
        });
        res.json({
            data: rows,
            summary: {
                ...summary,
                total_distance_km: Number(summary.total_distance_km.toFixed(2)),
                total_working_hours: Number(summary.total_working_hours.toFixed(2)),
            },
        });
    }
    catch (error) {
        console.error('Get attendance report error:', error);
        res.status(500).json({
            error: 'Failed to fetch attendance report',
            message: error.message,
        });
    }
};
exports.getAttendanceReport = getAttendanceReport;
