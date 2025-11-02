const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const {
  getRecentDocuments,
  getAllDocuments,
  createDocument,
  deleteDocument,
  uploadDocument
} = require('../controllers/documentController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { getSignedUrl } = require('../utils/s3');
const Document = require('../models/Document');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// All routes require authentication
router.use(protect);

// Apply subscription middleware to all document routes
router.use(checkSubscriptionStatus);

// Document routes (authentication and subscription already applied)
router.get('/recent', getRecentDocuments);
router.get('/', getAllDocuments);
router.post('/', createDocument);
router.delete('/:id', deleteDocument);
router.post('/upload', upload.single('file'), uploadDocument);

// Secure download endpoint for documents
router.get('/:id/download', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc || !doc.fileUrl) return res.status(404).json({ message: 'Document not found' });
    let key;
    if (doc.fileUrl.startsWith('http')) {
      const match = doc.fileUrl.match(/amazonaws\.com\/(.+)$/);
      key = match ? decodeURIComponent(match[1]) : null;
    } else {
      key = doc.fileUrl.replace(/^\/uploads\//, 'documents/');
    }
    if (!key) {
      console.error('Document S3 key extraction failed:', doc.fileUrl);
      return res.status(400).json({ message: 'Invalid document URL' });
    }
    const signedUrl = getSignedUrl(key);
    res.json({ url: signedUrl });
  } catch (err) {
    console.error('Document signed URL error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 