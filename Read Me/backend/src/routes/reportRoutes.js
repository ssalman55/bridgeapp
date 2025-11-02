const express = require('express');
const router = express.Router();
const { generateCustomReport } = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');

// POST /api/reports/custom
router.post('/custom', protect, generateCustomReport);

module.exports = router; 