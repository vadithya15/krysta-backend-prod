"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const dynamicPermission_1 = require("../middleware/dynamicPermission");
const areaController_1 = __importDefault(require("../controllers/areaController"));
const router = express_1.default.Router();
/**
 * Area Management Routes
 * All routes require authentication
 */
// Apply middleware
router.use(dynamicPermission_1.organizationContext);
router.use(auth_1.authenticateToken);
/**
 * GET /api/areas
 * Get all areas
 */
router.get('/', areaController_1.default.getAllAreas);
/**
 * GET /api/areas/:id
 * Get a single area by ID
 */
router.get('/:id', areaController_1.default.getAreaById);
/**
 * POST /api/areas
 * Create a new area
 * Body: { name, code?, description?, is_active? }
 */
router.post('/', areaController_1.default.createArea);
/**
 * PUT /api/areas/:id
 * Update an area
 * Body: { name?, code?, description?, is_active? }
 */
router.put('/:id', areaController_1.default.updateArea);
/**
 * DELETE /api/areas/:id
 * Delete an area
 */
router.delete('/:id', areaController_1.default.deleteArea);
exports.default = router;
