"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearRouteCache = exports.getDistance = exports.getRoute = exports.optimizeRouteFromPlan = void 0;
const database_1 = __importDefault(require("../config/database"));
const olaMapsService_1 = __importDefault(require("../services/olaMapsService"));
const cache_1 = require("../utils/cache");
function toCoordinate(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
function sanitizeWaypoints(waypoints) {
    return waypoints
        .map((wp) => ({
        lat: toCoordinate(wp.lat),
        lng: toCoordinate(wp.lng),
        dealer_id: wp.dealer_id,
        name: wp.name,
    }))
        .filter((wp) => wp.lat !== null && wp.lng !== null && isValidCoordinate({ lat: wp.lat, lng: wp.lng }));
}
/**
 * Validate coordinate is in valid range
 */
function isValidCoordinate(waypoint) {
    const lat = waypoint.lat;
    const lng = waypoint.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
        return false;
    }
    // Valid latitude: -90 to 90, longitude: -180 to 180
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
/**
 * Optimize route from dealer plan
 * POST /api/routes/optimize-from-plan
 * Body: { user_id, plan_date }
 */
const optimizeRouteFromPlan = async (req, res) => {
    try {
        const { user_id, plan_date } = req.body;
        if (!user_id || !plan_date) {
            return res.status(400).json({ error: 'user_id and plan_date are required' });
        }
        // Get Ola Maps API key from settings
        const apiKeyResult = await database_1.default.query(`SELECT setting_value FROM settings WHERE setting_key = 'ola_maps_api_key' LIMIT 1`);
        if (apiKeyResult.rows.length === 0) {
            return res.status(500).json({ error: 'Ola Maps API key not configured' });
        }
        const apiKey = apiKeyResult.rows[0].setting_value;
        // Get Ola Maps URL from settings
        const urlResult = await database_1.default.query(`SELECT setting_value FROM settings WHERE setting_key = 'ola_maps_url' LIMIT 1`);
        const olaUrl = urlResult.rows.length > 0 ? urlResult.rows[0].setting_value : undefined;
        // Get route caching setting
        const cacheEnabledResult = await database_1.default.query(`SELECT setting_value FROM settings WHERE setting_key = 'route_cache_enabled' LIMIT 1`);
        const cacheEnabled = cacheEnabledResult.rows.length > 0
            ? cacheEnabledResult.rows[0].setting_value === 'true'
            : true;
        // Get dealer plans for this user and date with dealer details
        const plansResult = await database_1.default.query(`SELECT dp.*, d.name AS dealer_name, d.latitude, d.longitude, d.id as dealer_id
       FROM dealer_plans dp
       INNER JOIN dealers d ON d.id = dp.dealer_id
       WHERE dp.user_id = $1 AND dp.plan_date = $2
       ORDER BY dp.id`, [user_id, plan_date]);
        if (plansResult.rows.length === 0) {
            return res.status(404).json({ error: 'No dealer plans found for this date' });
        }
        const plans = plansResult.rows;
        const planVersion = plans[0].plan_version || 1;
        // Convert to waypoints and remove missing/invalid coordinates before optimization
        const rawWaypoints = plans.map((plan) => ({
            lat: plan.latitude,
            lng: plan.longitude,
            dealer_id: plan.dealer_id,
            name: plan.dealer_name,
        }));
        const waypoints = sanitizeWaypoints(rawWaypoints);
        const invalidDealers = rawWaypoints.filter((wp) => toCoordinate(wp.lat) === null ||
            toCoordinate(wp.lng) === null ||
            !isValidCoordinate({ lat: toCoordinate(wp.lat), lng: toCoordinate(wp.lng) }));
        if (invalidDealers.length > 0) {
            console.warn(`⚠️ Skipping ${invalidDealers.length} dealers with missing/invalid coordinates:`, invalidDealers.map(wp => `${wp.name} (dealer_id=${wp.dealer_id})`));
        }
        if (waypoints.length < 2) {
            return res.status(400).json({
                error: 'Not enough dealers with valid coordinates to optimize route',
                details: `Only ${waypoints.length} of ${plans.length} planned dealers have valid GPS coordinates. Please update dealer locations.`,
            });
        }
        // Generate enhanced route signature (includes coordinates + date)
        const olaMapsService = new olaMapsService_1.default(apiKey, olaUrl);
        const routeSignature = olaMapsService.generateRouteSignatureWithCoordinates(waypoints, plan_date);
        const cacheKey = `route:${user_id}:${plan_date}:${routeSignature}`;
        // LAYER 1: Check in-memory cache first (fast, 5-15 min TTL)
        const inMemoryCached = cache_1.routeCache.get(cacheKey);
        if (inMemoryCached) {
            console.log(`✅ In-memory CACHE HIT for route ${routeSignature}`, {
                geometry_length: inMemoryCached.geometry?.length || 0,
            });
            return res.json({
                source: 'memory-cache',
                optimized_route: inMemoryCached.optimized_route,
                total_distance: inMemoryCached.total_distance,
                total_duration: inMemoryCached.total_duration,
                waypoints: inMemoryCached.waypoints,
                ordered_waypoints: inMemoryCached.ordered_waypoints,
                plan_version: inMemoryCached.plan_version,
                geometry: inMemoryCached.geometry,
                cached_at: inMemoryCached.cached_at,
            });
        }
        // CACHE STAMPEDE PREVENTION: Check if request already in flight
        const inFlightKey = `inFlight:${user_id}:${plan_date}:${routeSignature}`;
        const inFlightPromise = cache_1.inFlightCache.get(inFlightKey);
        if (inFlightPromise) {
            console.log(`⏳ Request already in-flight for route ${routeSignature}, waiting for existing promise`);
            try {
                const result = await inFlightPromise;
                return res.json(result);
            }
            catch (error) {
                console.error('In-flight promise rejected:', error);
                throw error;
            }
        }
        // Create promise for this request and cache it
        const optimizationPromise = (async () => {
            // LAYER 2: Check database cache (persistent, survives restart)
            if (cacheEnabled) {
                const dbCacheResult = await database_1.default.query(`SELECT * FROM planned_routes 
           WHERE user_id = $1 AND plan_date = $2 AND route_signature = $3
           LIMIT 1`, [user_id, plan_date, routeSignature]);
                if (dbCacheResult.rows.length > 0) {
                    const cached = dbCacheResult.rows[0];
                    // VERSION-SAFE CHECK: Only return cache if plan version matches current version
                    if (cached.plan_version === planVersion) {
                        console.log(`✅ DB CACHE HIT for route ${routeSignature} (plan_version ${planVersion})`, {
                            geometry_length: cached.optimized_route?.geometry?.length || 0,
                            has_overview_polyline: !!cached.optimized_route?.overview_polyline,
                        });
                        const result = {
                            source: 'db-cache',
                            optimized_route: cached.optimized_route,
                            total_distance: parseFloat(cached.total_distance),
                            total_duration: cached.total_duration,
                            waypoints: cached.waypoints,
                            ordered_waypoints: cached.ordered_waypoints || cached.optimized_route?.orderedWaypoints,
                            plan_version: cached.plan_version,
                            geometry: cached.optimized_route?.geometry || cached.optimized_route?.overview_polyline || '',
                            cached_at: cached.created_at,
                        };
                        // Populate in-memory cache for next request
                        cache_1.routeCache.set(cacheKey, result, 10);
                        return result;
                    }
                    else {
                        console.log(`⚠️ DB CACHE INVALID: plan_version mismatch (cached=${cached.plan_version}, current=${planVersion}), invalidating`);
                        // Invalidate stale cache entry
                        await database_1.default.query(`DELETE FROM planned_routes WHERE id = $1`, [cached.id]);
                    }
                }
            }
            console.log(`❌ CACHE MISS for route ${routeSignature}, calling Ola Maps API`);
            // Call Ola Maps to optimize route
            const optimizedRoute = await olaMapsService.optimizeRoute(waypoints);
            console.log('🎯 Optimized Route Result:', {
                waypoints_count: optimizedRoute.waypoints.length,
                orderedWaypoints_count: optimizedRoute.orderedWaypoints.length,
                sample_waypoint: optimizedRoute.orderedWaypoints[0],
                totalDistance: optimizedRoute.totalDistance,
                totalDuration: optimizedRoute.totalDuration,
                geometry_length: optimizedRoute.geometry?.length || 0,
                geometry_value: optimizedRoute.geometry ? optimizedRoute.geometry.substring(0, 50) + '...' : 'MISSING',
            });
            // Store in database cache if enabled
            if (cacheEnabled) {
                await database_1.default.query(`INSERT INTO planned_routes 
           (user_id, plan_date, plan_version, route_signature, waypoints, optimized_route, total_distance, total_duration, provider)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (user_id, plan_date, route_signature) 
           DO UPDATE SET 
             plan_version = EXCLUDED.plan_version,
             waypoints = EXCLUDED.waypoints,
             optimized_route = EXCLUDED.optimized_route,
             total_distance = EXCLUDED.total_distance,
             total_duration = EXCLUDED.total_duration,
             created_at = CURRENT_TIMESTAMP`, [
                    user_id,
                    plan_date,
                    planVersion,
                    routeSignature,
                    JSON.stringify(waypoints),
                    JSON.stringify(optimizedRoute),
                    optimizedRoute.totalDistance,
                    optimizedRoute.totalDuration,
                    'ola',
                ]);
                console.log(`📦 Cached route ${routeSignature} to database`);
            }
            console.log('✅ Final API Response Geometry:', {
                geometry_length: optimizedRoute.geometry?.length || 0,
                geometry_present: !!optimizedRoute.geometry && optimizedRoute.geometry.length > 0,
            });
            return {
                source: 'api',
                optimized_route: optimizedRoute,
                total_distance: optimizedRoute.totalDistance,
                total_duration: optimizedRoute.totalDuration,
                waypoints: optimizedRoute.waypoints,
                ordered_waypoints: optimizedRoute.orderedWaypoints,
                plan_version: planVersion,
                geometry: optimizedRoute.geometry,
            };
        })();
        // Cache the in-flight promise (2 minute TTL for request deduplication)
        cache_1.inFlightCache.set(inFlightKey, optimizationPromise, 2);
        try {
            const result = await optimizationPromise;
            // Populate in-memory cache for future requests
            cache_1.routeCache.set(cacheKey, result, 10);
            return res.json(result);
        }
        finally {
            // Remove from in-flight cache when done
            cache_1.inFlightCache.delete(inFlightKey);
        }
    }
    catch (error) {
        console.error('Route optimization error:', error);
        // Handle specific error cases
        if (error.message.includes('Route not found') || error.message.includes('outside service area')) {
            return res.status(404).json({
                error: 'Cannot optimize this route',
                details: 'One or more dealer locations may be outside the service area or unreachable. Please verify dealer coordinates.',
                type: 'ROUTE_NOT_FOUND'
            });
        }
        if (error.message.includes('No waypoint')) {
            return res.status(400).json({
                error: 'Invalid dealer plan',
                details: error.message
            });
        }
        res.status(500).json({
            error: 'Failed to optimize route',
            details: error.message
        });
    }
};
exports.optimizeRouteFromPlan = optimizeRouteFromPlan;
/**
 * Get route between two points
 * POST /api/routes/get-route
 * Body: { from: {lat, lng}, to: {lat, lng} }
 */
const getRoute = async (req, res) => {
    try {
        const { from, to } = req.body;
        if (!from || !to || !from.lat || !from.lng || !to.lat || !to.lng) {
            return res.status(400).json({ error: 'from and to coordinates (lat, lng) are required' });
        }
        // Validate coordinates
        if (!isValidCoordinate(from) || !isValidCoordinate(to)) {
            return res.status(400).json({
                error: 'Invalid coordinates. Latitude must be -90 to 90, longitude must be -180 to 180.',
                from,
                to
            });
        }
        // Get Ola Maps API key from settings
        const apiKeyResult = await database_1.default.query(`SELECT setting_value FROM settings WHERE setting_key = 'ola_maps_api_key' LIMIT 1`);
        if (apiKeyResult.rows.length === 0) {
            return res.status(500).json({ error: 'Ola Maps API key not configured' });
        }
        const apiKey = apiKeyResult.rows[0].setting_value;
        // Get Ola Maps URL from settings
        const urlResult = await database_1.default.query(`SELECT setting_value FROM settings WHERE setting_key = 'ola_maps_url' LIMIT 1`);
        const olaUrl = urlResult.rows.length > 0 ? urlResult.rows[0].setting_value : undefined;
        const olaMapsService = new olaMapsService_1.default(apiKey, olaUrl);
        console.log(`[Route] Getting route from (${from.lat},${from.lng}) to (${to.lat},${to.lng})`);
        const route = await olaMapsService.getRoute(from, to);
        res.json({
            distance: route.distance / 1000, // Convert to km
            duration: route.duration,
            geometry: route.geometry,
            provider: 'ola',
        });
    }
    catch (error) {
        console.error('Get route error:', error);
        // Handle specific error cases
        if (error.message.includes('Route not found')) {
            return res.status(404).json({
                error: 'No route found',
                details: error.message,
                type: 'ROUTE_NOT_FOUND'
            });
        }
        if (error.message.includes('Invalid coordinates')) {
            return res.status(400).json({
                error: 'Invalid coordinates',
                details: error.message
            });
        }
        res.status(500).json({
            error: 'Failed to get route',
            details: error.message
        });
    }
};
exports.getRoute = getRoute;
/**
 * Get distance between two points
 * POST /api/routes/get-distance
 * Body: { from: {lat, lng}, to: {lat, lng} }
 */
const getDistance = async (req, res) => {
    try {
        const { from, to } = req.body;
        if (!from || !to || !from.lat || !from.lng || !to.lat || !to.lng) {
            return res.status(400).json({ error: 'from and to coordinates (lat, lng) are required' });
        }
        // Validate coordinates
        if (!isValidCoordinate(from) || !isValidCoordinate(to)) {
            return res.status(400).json({
                error: 'Invalid coordinates. Latitude must be -90 to 90, longitude must be -180 to 180.',
                from,
                to
            });
        }
        // Get Ola Maps API key from settings
        const apiKeyResult = await database_1.default.query(`SELECT setting_value FROM settings WHERE setting_key = 'ola_maps_api_key' LIMIT 1`);
        if (apiKeyResult.rows.length === 0) {
            return res.status(500).json({ error: 'Ola Maps API key not configured' });
        }
        const apiKey = apiKeyResult.rows[0].setting_value;
        // Get Ola Maps URL from settings
        const urlResult = await database_1.default.query(`SELECT setting_value FROM settings WHERE setting_key = 'ola_maps_url' LIMIT 1`);
        const olaUrl = urlResult.rows.length > 0 ? urlResult.rows[0].setting_value : undefined;
        const olaMapsService = new olaMapsService_1.default(apiKey, olaUrl);
        console.log(`[Distance] Calculating distance from (${from.lat},${from.lng}) to (${to.lat},${to.lng})`);
        const distance = await olaMapsService.getDistance(from, to);
        res.json({
            distance, // in km
            provider: 'ola',
        });
    }
    catch (error) {
        console.error('Get distance error:', error);
        // Handle specific error cases
        if (error.message.includes('Route not found')) {
            return res.status(404).json({
                error: 'No route found',
                details: error.message,
                type: 'ROUTE_NOT_FOUND'
            });
        }
        if (error.message.includes('Invalid coordinates')) {
            return res.status(400).json({
                error: 'Invalid coordinates',
                details: error.message
            });
        }
        res.status(500).json({
            error: 'Failed to get distance',
            details: error.message
        });
    }
};
exports.getDistance = getDistance;
/**
 * Clear route cache for a user/date
 * DELETE /api/routes/cache
 */
const clearRouteCache = async (req, res) => {
    try {
        const { user_id, plan_date } = req.query;
        if (!user_id || !plan_date) {
            return res.status(400).json({ error: 'user_id and plan_date are required' });
        }
        const result = await database_1.default.query(`DELETE FROM planned_routes WHERE user_id = $1 AND plan_date = $2`, [user_id, plan_date]);
        // Also clear in-memory cache for this user/date
        const cacheKeyPattern = `route:${user_id}:${plan_date}:`;
        cache_1.routeCache.deleteByPattern(cacheKeyPattern);
        res.json({
            message: 'Route cache cleared',
            deleted_count: result.rowCount
        });
    }
    catch (error) {
        console.error('Clear cache error:', error);
        res.status(500).json({
            error: 'Failed to clear cache',
            details: error.message
        });
    }
};
exports.clearRouteCache = clearRouteCache;
