const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticateToken } = require('../middleware/auth');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { featureAccess } = require('../middleware/featureAccessMiddleware');
const permissions = require('../middleware/permissions');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user
// 3. Feature access check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription and feature access middleware to all inventory routes
// Asset management is available for Professional and Enterprise plans only
router.use(checkSubscriptionStatus);
router.use(featureAccess('asset_management'));

// Staff routes
router.get('/my', inventoryController.getMyInventory);
router.get('/my/:id', inventoryController.getInventoryItem);

// Admin and Inventory Manager routes
router.post('/', permissions('Assets', 'full', 'Create Items'), inventoryController.addInventory);
router.get('/', permissions('Assets', 'view', 'Assets Management'), inventoryController.getAllInventory);
router.get('/summary', permissions('Assets', 'view', 'Assets Summary'), inventoryController.getInventorySummary);
router.put('/:id', permissions('Assets', 'full', 'Assets Management'), inventoryController.editInventory);
router.delete('/:id', permissions('Assets', 'full', 'Assets Management'), inventoryController.deleteInventory);
router.post('/bulk-delete', permissions('Assets', 'full', 'Assets Management'), inventoryController.bulkDeleteInventory);
router.patch('/:id/assign', permissions('Assets', 'full', 'Assets Management'), inventoryController.assignInventory);
router.patch('/:id/unassign', permissions('Assets', 'full', 'Assets Management'), inventoryController.unassignInventory);

// Item Names endpoints
router.get('/item-names', permissions('Assets', 'view', 'Create Items'), inventoryController.getItemNames);
router.post('/item-names', permissions('Assets', 'full', 'Create Items'), inventoryController.createItemName);
router.delete('/item-names/:id', permissions('Assets', 'full', 'Create Items'), inventoryController.deleteItemName);

// Category endpoints
router.get('/categories', inventoryController.getCategories);
router.post('/categories', permissions('Assets', 'full', 'Create Items'), inventoryController.createCategory);
router.put('/categories/:id', permissions('Assets', 'full', 'Create Items'), inventoryController.updateCategory);
router.delete('/categories/:id', permissions('Assets', 'full', 'Create Items'), inventoryController.deleteCategory);

// Inventory Requests endpoints
router.post('/requests', inventoryController.createInventoryRequest); // Staff submit
router.get('/requests', permissions('Assets', 'view', 'Assets Requests'), inventoryController.getAllInventoryRequests); // Admin view/filter
router.patch('/requests/:id/decision', permissions('Assets', 'full', 'Assets Requests'), inventoryController.decisionInventoryRequest); // Admin approve/reject

router.get('/:id', permissions('Assets', 'view', 'Assets Management'), inventoryController.getInventoryItem);

module.exports = router; 