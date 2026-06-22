"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OlaMapsService = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
class OlaMapsService {
    constructor(apiKey, baseUrl) {
        this.apiKey = apiKey;
        // Use custom URL from settings if provided, otherwise use default
        this.baseUrl = baseUrl || 'https://api.olamaps.io/routing/v1/routeOptimizer';
    }
    /**
     * Generate a signature for the route based on sorted dealer IDs
     * DEPRECATED: Use generateRouteSignatureWithCoordinates for better cache validity
     */
    generateRouteSignature(dealerIds) {
        const sorted = [...dealerIds].sort((a, b) => a - b);
        return crypto_1.default.createHash('md5').update(sorted.join(',')).digest('hex');
    }
    /**
     * Generate a hardened route signature including coordinates and date
     * This prevents false cache hits when dealer coordinates change
     * Format: sorted(dealer_id_lat_lng_rounded) + plan_date
     * @param waypoints Array of waypoints with lat/lng
     * @param planDate Date string (YYYY-MM-DD)
     */
    generateRouteSignatureWithCoordinates(waypoints, planDate) {
        // Build signature components from waypoints with rounded coordinates
        // Round to 4 decimal places (~11 meters precision) to avoid floating point issues
        const components = waypoints
            .map(wp => `${wp.dealer_id || 'unknown'}_${wp.lat.toFixed(4)}_${wp.lng.toFixed(4)}`)
            .sort()
            .join('|');
        // Include plan date in signature
        const signatureInput = `${components}|${planDate}`;
        return crypto_1.default.createHash('md5').update(signatureInput).digest('hex');
    }
    /**
     * Optimize route using Ola Maps Route Optimizer API
     * @param waypoints Array of waypoints with lat/lng
     * @param startPoint Optional start point (defaults to first waypoint)
     * @param endPoint Optional end point (defaults to start point for round trip)
     */
    async optimizeRoute(waypoints, startPoint, endPoint) {
        try {
            if (waypoints.length === 0) {
                throw new Error('At least one waypoint is required');
            }
            if (waypoints.length > 24) {
                throw new Error('Maximum 24 waypoints allowed');
            }
            // Prepare coordinates for Ola Maps API
            // Format: Build locations string from all waypoints using pipe separator
            const start = startPoint || waypoints[0];
            const end = endPoint || start; // Round trip by default
            // Build locations string: all waypoints in format "lat,lng|lat,lng|..."
            const locationsString = waypoints
                .map(wp => `${wp.lat},${wp.lng}`)
                .join('|');
            // Use the configured URL with proper parameters according to API docs
            const params = new URLSearchParams({
                locations: locationsString,
                source: 'first',
                destination: 'last',
                round_trip: (!endPoint).toString(), // true for round trip
                mode: 'driving',
                steps: 'true',
                overview: 'full',
                language: 'en',
                traffic_metadata: 'false',
                route_preference: 'fastest',
                api_key: this.apiKey
            });
            const urlWithParams = `${this.baseUrl}?${params.toString()}`;
            const requestBody = {};
            const response = await axios_1.default.post(urlWithParams, requestBody, {
                headers: {
                    'x-request-id': `req-${Date.now()}`,
                    'x-correlation-id': `corr-${Date.now()}`
                },
                timeout: 30000, // 30 second timeout
            });
            if (response.data.status !== 'SUCCESS') {
                throw new Error(`Ola Maps API error: ${response.data.status}`);
            }
            // Parse the optimized route
            // API returns routes array with legs inside
            const route = response.data.routes[0];
            // Sum up all legs for total distance and duration
            let totalDistance = 0;
            let totalDuration = 0;
            if (route.legs && route.legs.length > 0) {
                route.legs.forEach((leg) => {
                    totalDistance += leg.distance || 0;
                    totalDuration += leg.duration || 0;
                });
            }
            // DEBUG: Log Ola response structure including overview_polyline
            console.log('📍 Ola Maps Response Structure:', {
                status: response.data.status,
                routes_count: response.data.routes?.length,
                waypoint_order: response.data.waypoint_order,
                waypoint_order_count: response.data.waypoint_order?.length,
                legs_count: route.legs?.length,
                has_overview_polyline: !!route.overview_polyline,
                overview_polyline_length: route.overview_polyline?.length || 0,
                overview_polyline_value: route.overview_polyline ? route.overview_polyline.substring(0, 50) + '...' : 'MISSING',
                all_route_keys: Object.keys(route),
            });
            const orderedWaypoints = (response.data.waypoint_order || []).map((index) => {
                return waypoints[index];
            });
            console.log('📦 Ordered Waypoints Mapped:', {
                count: orderedWaypoints.length,
                sample: orderedWaypoints[0],
            });
            return {
                waypoints,
                orderedWaypoints,
                totalDistance: totalDistance / 1000, // Convert meters to km
                totalDuration: totalDuration,
                geometry: route.overview_polyline || '', // Use overview_polyline for full route geometry
                provider: 'ola',
                rawResponse: response.data,
            };
        }
        catch (error) {
            if (error.response) {
                throw new Error(`Ola Maps API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            }
            throw error;
        }
    }
    /**
     * Get route between two points (not optimized, just A to B)
     * Uses same routeOptimizer endpoint with 2 waypoints
     */
    async getRoute(from, to) {
        try {
            // Validate coordinates
            if (!this.isValidCoordinate(from) || !this.isValidCoordinate(to)) {
                throw new Error('Invalid coordinates provided');
            }
            // Build locations string (same format as optimizeRoute)
            const locationsString = `${from.lat},${from.lng}|${to.lat},${to.lng}`;
            const params = new URLSearchParams({
                locations: locationsString,
                source: 'first',
                destination: 'last',
                round_trip: 'false',
                mode: 'driving',
                steps: 'true',
                overview: 'full',
                language: 'en',
                api_key: this.apiKey
            });
            const urlWithParams = `${this.baseUrl}?${params.toString()}`;
            console.log(`🗺️ Ola Maps Route API: from (${from.lat},${from.lng}) to (${to.lat},${to.lng})`);
            const response = await axios_1.default.post(urlWithParams, {}, {
                headers: {
                    'x-request-id': `req-${Date.now()}`,
                    'x-correlation-id': `corr-${Date.now()}`
                },
                timeout: 30000
            });
            if (response.data.status !== 'SUCCESS') {
                throw new Error(`Ola Maps API error: ${response.data.status}`);
            }
            if (!response.data.routes || !response.data.routes[0]) {
                throw new Error('No route found between these coordinates');
            }
            const route = response.data.routes[0];
            // Sum up legs for total distance and duration
            let totalDistance = 0;
            let totalDuration = 0;
            if (route.legs && route.legs.length > 0) {
                route.legs.forEach((leg) => {
                    totalDistance += leg.distance || 0;
                    totalDuration += leg.duration || 0;
                });
            }
            return {
                distance: totalDistance,
                duration: totalDuration,
                geometry: route.overview_polyline || '', // Use overview_polyline
            };
        }
        catch (error) {
            if (error.response?.status === 404) {
                const apiError = error.response?.data?.error_msg || 'Route not found';
                console.error(`❌ Ola Maps 404 Error: ${apiError}`);
                throw new Error(`Route not found: Coordinates may be outside service area or unreachable. ` +
                    `From (${from.lat},${from.lng}) to (${to.lat},${to.lng})`);
            }
            if (error.response) {
                throw new Error(`Ola Maps API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            }
            throw error;
        }
    }
    /**
     * Validate coordinate is in valid range
     */
    isValidCoordinate(waypoint) {
        const lat = waypoint.lat;
        const lng = waypoint.lng;
        if (typeof lat !== 'number' || typeof lng !== 'number') {
            return false;
        }
        // Valid latitude: -90 to 90, longitude: -180 to 180
        return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    }
    /**
     * Calculate distance between two points
     */
    async getDistance(from, to) {
        const route = await this.getRoute(from, to);
        return route.distance / 1000; // Convert to km
    }
    /**
     * Get distance matrix for multiple origins and destinations
     */
    async getDistanceMatrix(origins, destinations) {
        try {
            const url = `${this.baseUrl}/distancematrix`;
            const originsStr = origins.map(w => `${w.lat},${w.lng}`).join('|');
            const destinationsStr = destinations.map(w => `${w.lat},${w.lng}`).join('|');
            const params = {
                origins: originsStr,
                destinations: destinationsStr,
                api_key: this.apiKey
            };
            const response = await axios_1.default.get(url, { params, timeout: 30000 });
            // Parse distance matrix response
            const matrix = [];
            if (response.data.rows) {
                for (const row of response.data.rows) {
                    const distances = row.elements.map((el) => el.distance ? el.distance / 1000 : 0 // Convert to km
                    );
                    matrix.push(distances);
                }
            }
            return matrix;
        }
        catch (error) {
            if (error.response) {
                throw new Error(`Ola Maps API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            }
            throw error;
        }
    }
}
exports.OlaMapsService = OlaMapsService;
exports.default = OlaMapsService;
