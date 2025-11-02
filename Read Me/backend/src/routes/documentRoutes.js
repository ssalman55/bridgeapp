const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
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

router.get('/recent', protect, getRecentDocuments);
router.get('/', protect, getAllDocuments);
router.post('/', protect, createDocument);
router.delete('/:id', protect, deleteDocument);
router.post('/upload', protect, upload.single('file'), uploadDocument);

// Secure download endpoint for documents
router.get('/:id/download', protect, async (req, res) => {
  try {
    console.log('AWS_S3_BUCKET:', process.env.AWS_S3_BUCKET);
    console.log('AWS_REGION:', process.env.AWS_REGION);
    console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID);
    console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '***set***' : '***missing***');
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
    console.log('S3 key:', key);
    console.log('Signed URL:', signedUrl);
    res.json({ url: signedUrl });
  } catch (err) {
    console.error('Document signed URL error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 