"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const visitReasonController_1 = require("../controllers/visitReasonController");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_1.authenticateToken);
// Get all visit reasons
router.get('/', visitReasonController_1.getAllVisitReasons);
// Get single visit reason
router.get('/:id', visitReasonController_1.getVisitReasonById);
// Create new visit reason
router.post('/', visitReasonController_1.createVisitReason);
// Update visit reason
router.put('/:id', visitReasonController_1.updateVisitReason);
// Delete visit reason
router.delete('/:id', visitReasonController_1.deleteVisitReason);
exports.default = router;
