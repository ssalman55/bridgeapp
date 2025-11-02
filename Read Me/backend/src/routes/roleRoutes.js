const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { authenticateToken } = require('../middleware/auth');
const permissions = require('../middleware/permissions');
const Role = require('../models/Role');

router.post('/roles', authenticateToken, permissions('Role Management', 'full', 'Role Management'), roleController.createRole);
router.get('/roles', authenticateToken, permissions('Role Management', 'view', 'Role Management'), roleController.getRoles);
router.put('/roles/:id', authenticateToken, permissions('Role Management', 'full', 'Role Management'), roleController.updateRole);
router.delete('/roles/:id', authenticateToken, permissions('Role Management', 'full', 'Role Management'), roleController.deleteRole);

router.get('/roles/my-role', authenticateToken, async (req, res) => {
  try {
    const roleName = req.user.role ? req.user.role.toLowerCase() : '';
    const role = await Role.findOne({ name: new RegExp('^' + roleName + '$', 'i') });
    if (!role) return res.status(404).json({ message: 'Role not found' });
    res.json(role);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch role', error: err.message });
  }
});

module.exports = router; 