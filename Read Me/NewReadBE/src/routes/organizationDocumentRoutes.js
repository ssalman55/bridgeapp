const express = require('express');
const router = express.Router();
const organizationDocumentController = require('../controllers/organizationDocumentController');
const { authenticateToken } = require('../middleware/auth');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const permissions = require('../middleware/permissions');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription middleware to all organization document routes
router.use(checkSubscriptionStatus);

// Get all documents (accessible to all authenticated users)
router.get('/',
  organizationDocumentController.getDocuments
);

// Get document statistics
router.get('/stats',
  organizationDocumentController.getDocumentStats
);

// Get document categories
router.get('/categories',
  organizationDocumentController.getCategories
);

// Get single document by ID
router.get('/:id',
  organizationDocumentController.getDocumentById
);

// Upload new document (requires full access to Document Library)
router.post('/',
  permissions('Main', 'full', 'Document Library'),
  organizationDocumentController.uploadDocument
);

// Update document metadata (requires full access to Document Library)
router.put('/:id',
  permissions('Main', 'full', 'Document Library'),
  organizationDocumentController.updateDocument
);

// Delete document (requires full access to Document Library)
router.delete('/:id',
  permissions('Main', 'full', 'Document Library'),
  organizationDocumentController.deleteDocument
);

// Download document (accessible to all authenticated users)
router.get('/:id/download',
  organizationDocumentController.downloadDocument
);

module.exports = router;











