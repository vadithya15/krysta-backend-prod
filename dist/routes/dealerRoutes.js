"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer = require('multer');
const dealerController_1 = require("../controllers/dealerController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = new Set([
            'text/csv',
            'application/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
        const allowedExtensions = /\.(csv|xlsx|xls)$/i;
        if (allowedMimeTypes.has(file.mimetype) || allowedExtensions.test(file.originalname)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only CSV, XLS, or XLSX files are allowed'));
        }
    },
});
router.get('/regions', auth_1.authenticateToken, dealerController_1.getRegions);
router.post('/bulk-upsert', auth_1.authenticateToken, upload.single('file'), dealerController_1.bulkUpsertDealers);
router.get('/', auth_1.authenticateToken, dealerController_1.getDealers);
router.get('/:id', auth_1.authenticateToken, dealerController_1.getDealerById);
router.post('/', auth_1.authenticateToken, dealerController_1.createDealer);
router.put('/:id', auth_1.authenticateToken, dealerController_1.updateDealer);
router.delete('/:id', auth_1.authenticateToken, dealerController_1.deleteDealer);
exports.default = router;
