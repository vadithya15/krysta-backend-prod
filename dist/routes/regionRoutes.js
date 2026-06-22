"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const dynamicPermission_1 = require("../middleware/dynamicPermission");
const regionController_1 = __importDefault(require("../controllers/regionController"));
const router = express_1.default.Router();
router.use(dynamicPermission_1.organizationContext);
router.use(auth_1.authenticateToken);
router.get('/', regionController_1.default.getAllRegions);
router.get('/:id', regionController_1.default.getRegionById);
router.post('/', regionController_1.default.createRegion);
router.put('/:id', regionController_1.default.updateRegion);
router.delete('/:id', regionController_1.default.deleteRegion);
exports.default = router;
