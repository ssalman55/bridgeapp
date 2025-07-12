const express = require('express');
const router = express.Router();
const { handleAskAIQuery } = require('../controllers/askAIController');
const { protect } = require('../middleware/authMiddleware');

// Use real authentication middleware
router.use(protect);

router.post('/query', handleAskAIQuery);

// Test route to verify router is loaded
router.get('/test', (req, res) => res.json({ ok: true }));

module.exports = router; 
