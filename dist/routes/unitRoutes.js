"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const unitController_1 = require("../controllers/unitController");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_1.authenticateToken);
// Get all units
router.get('/', unitController_1.getAllUnits);
// Get single unit
router.get('/:id', unitController_1.getUnitById);
// Create new unit
router.post('/', unitController_1.createUnit);
// Update unit
router.put('/:id', unitController_1.updateUnit);
// Delete unit
router.delete('/:id', unitController_1.deleteUnit);
exports.default = router;
