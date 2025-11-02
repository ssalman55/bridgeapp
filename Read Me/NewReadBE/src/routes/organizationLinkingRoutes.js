const express = require('express');
const router = express.Router();
const organizationLinkingController = require('../controllers/organizationLinkingController');

// Middleware to check if user is owner/super admin (you may need to implement this)
const isOwner = (req, res, next) => {
  // This should check if the user is the owner/super admin
  // For now, we'll assume all requests are from owner panel
  // You may want to implement proper authentication here
  next();
};

// Get all organizations with linking status
router.get('/organizations', isOwner, organizationLinkingController.getOrganizationsWithLinkingStatus);

// Get organization network hierarchy
router.get('/network', isOwner, organizationLinkingController.getOrganizationNetwork);

// Get available organizations for linking (standalone organizations only)
router.get('/available-organizations', isOwner, organizationLinkingController.getAvailableOrganizationsForLinking);

// Create head office from existing organization
router.post('/create-head-office', isOwner, organizationLinkingController.createHeadOffice);

// Link organizations to existing head office
router.post('/link-organizations', isOwner, organizationLinkingController.linkOrganizations);

// Unlink organization from head office
router.delete('/unlink/:organizationId', isOwner, organizationLinkingController.unlinkOrganization);

// Update data sharing configuration
router.put('/data-sharing/:organizationId', isOwner, organizationLinkingController.updateDataSharingConfig);

// Get cross-organization analytics
router.get('/analytics/:headOfficeId', isOwner, organizationLinkingController.getCrossOrganizationAnalytics);

module.exports = router;









