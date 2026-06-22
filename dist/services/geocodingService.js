"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDistance = exports.geocodeAddress = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * Geocode an address to latitude and longitude using OpenStreetMap Nominatim API
 * Free service, no API key required
 */
const geocodeAddress = async (address, city, state, pincode) => {
    try {
        // Build complete address string
        const addressParts = [address, city, state, pincode].filter(Boolean);
        const fullAddress = addressParts.join(', ');
        if (!fullAddress.trim()) {
            return { latitude: null, longitude: null };
        }
        // Use OpenStreetMap Nominatim API (free, no API key needed)
        const response = await axios_1.default.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: fullAddress,
                format: 'json',
                limit: 1,
                countrycodes: 'in', // Limit to India
            },
            headers: {
                'User-Agent': 'Krysta-Sales-Tracker', // Required by Nominatim
            },
            timeout: 5000, // 5 second timeout
        });
        if (response.data && response.data.length > 0) {
            const result = response.data[0];
            return {
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon),
            };
        }
        console.log('No geocoding results found for address:', fullAddress);
        return { latitude: null, longitude: null };
    }
    catch (error) {
        console.error('Geocoding error:', error);
        // Return null instead of throwing error - location is optional
        return { latitude: null, longitude: null };
    }
};
exports.geocodeAddress = geocodeAddress;
/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
            Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return Math.round(distance * 100) / 100; // Round to 2 decimal places
};
exports.calculateDistance = calculateDistance;
const toRadians = (degrees) => {
    return degrees * (Math.PI / 180);
};
