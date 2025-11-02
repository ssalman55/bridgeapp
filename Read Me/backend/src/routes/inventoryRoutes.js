const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { adminOrInventoryManager } = require('../middleware/authMiddleware');
const {
  addInventory,
  getAllInventory,
  editInventory,
  deleteInventory,
  bulkDeleteInventory,
  assignInventory,
  unassignInventory,
  getMyInventory,
  getInventoryItem,
  getInventorySummary,
  getItemNames,
  createItemName,
  deleteItemName,
  createInventoryRequest,
  getAllInventoryRequests,
  decisionInventoryRequest
} = require('../controllers/inventoryController');
const permissions = require('../middleware/permissions');

// Staff routes
router.get('/my', authenticateToken, getMyInventory);
router.get('/my/:id', authenticateToken, getInventoryItem);

// Admin and Inventory Manager routes
router.post('/', authenticateToken, adminOrInventoryManager, addInventory);
router.get('/', authenticateToken, permissions('Inventory', 'view', 'Inventory Management'), getAllInventory);
router.get('/summary', authenticateToken, permissions('Inventory', 'view', 'Inventory Summary'), getInventorySummary);
router.put('/:id', authenticateToken, adminOrInventoryManager, editInventory);
router.delete('/:id', authenticateToken, adminOrInventoryManager, deleteInventory);
router.post('/bulk-delete', authenticateToken, adminOrInventoryManager, bulkDeleteInventory);
router.patch('/:id/assign', authenticateToken, adminOrInventoryManager, assignInventory);
router.patch('/:id/unassign', authenticateToken, adminOrInventoryManager, unassignInventory);

// Item Names endpoints
router.get('/item-names', authenticateToken, permissions('Inventory', 'view', 'Create Items'), getItemNames);
router.post('/item-names', authenticateToken, adminOrInventoryManager, createItemName);
router.delete('/item-names/:id', authenticateToken, adminOrInventoryManager, deleteItemName);

// Inventory Requests endpoints
router.post('/requests', authenticateToken, createInventoryRequest); // Staff submit
router.get('/requests', authenticateToken, permissions('Inventory', 'view', 'View Requests'), getAllInventoryRequests); // Admin view/filter
router.patch('/requests/:id/decision', authenticateToken, adminOrInventoryManager, decisionInventoryRequest); // Admin approve/reject

router.get('/:id', authenticateToken, adminOrInventoryManager, getInventoryItem);

module.exports = router; 