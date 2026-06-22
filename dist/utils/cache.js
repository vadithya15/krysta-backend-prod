"use strict";
/**
 * Simple in-memory cache with TTL support
 * Used for short-lived route optimization results (5-15 minutes)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.inFlightCache = exports.routeCache = void 0;
class InMemoryCache {
    constructor(defaultTTLMinutes = 10) {
        this.cache = new Map();
        this.defaultTTL = defaultTTLMinutes * 60 * 1000;
    }
    /**
     * Set a value in the cache
     */
    set(key, data, ttlMinutes) {
        const ttl = (ttlMinutes || (this.defaultTTL / 60000)) * 60 * 1000;
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + ttl,
        });
        console.log(`[Cache] SET key=${key}, expires in ${ttlMinutes || this.defaultTTL / 60000} min`);
    }
    /**
     * Get a value from the cache
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            console.log(`[Cache] MISS for key=${key}`);
            return null;
        }
        if (Date.now() > entry.expiresAt) {
            console.log(`[Cache] EXPIRED key=${key}`);
            this.cache.delete(key);
            return null;
        }
        console.log(`[Cache] HIT for key=${key}`);
        return entry.data;
    }
    /**
     * Check if a key exists and hasn't expired
     */
    has(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return false;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }
    /**
     * Delete a specific key
     */
    delete(key) {
        return this.cache.delete(key);
    }
    /**
     * Delete all keys matching a pattern (prefix)
     */
    deleteByPattern(pattern) {
        let deleted = 0;
        for (const key of this.cache.keys()) {
            if (key.startsWith(pattern)) {
                this.cache.delete(key);
                deleted++;
            }
        }
        console.log(`[Cache] Deleted ${deleted} keys matching pattern=${pattern}`);
        return deleted;
    }
    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
        console.log(`[Cache] Cleared all entries`);
    }
    /**
     * Get cache statistics
     */
    getStats() {
        // Remove expired entries
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
        };
    }
}
// Export singleton instances for different cache types
/**
 * Route optimization result cache (5-15 minute TTL)
 * Key format: "route:${user_id}:${plan_date}:${route_signature}"
 */
exports.routeCache = new InMemoryCache(10);
/**
 * In-flight route optimization requests cache
 * Key format: "inFlight:${user_id}:${plan_date}:${route_signature}"
 * Prevents cache stampede by returning existing promise if request already in progress
 */
exports.inFlightCache = new InMemoryCache(2);
exports.default = InMemoryCache;
