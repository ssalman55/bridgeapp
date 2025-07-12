import express from 'express';
import {
  getAuthorizedNetworks,
  createAuthorizedNetwork,
  updateAuthorizedNetwork,
  deleteAuthorizedNetwork,
  validateIpAddress,
} from '../controllers/authorizedNetworkController';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Admin-only routes
router.get('/', requireAdmin, getAuthorizedNetworks);
router.post('/', requireAdmin, createAuthorizedNetwork);
router.put('/:id', requireAdmin, updateAuthorizedNetwork);
router.delete('/:id', requireAdmin, deleteAuthorizedNetwork);

// Route for validating IP address (available to all authenticated users)
router.post('/validate-ip', validateIpAddress);

export default router; 