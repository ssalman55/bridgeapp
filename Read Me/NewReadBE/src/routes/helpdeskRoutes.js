const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Import controllers
const helpdeskController = require('../controllers/helpdeskController');
const helpdeskCategoryController = require('../controllers/helpdeskCategoryController');
const knowledgeController = require('../controllers/knowledgeController');

// Import models
const HelpdeskTicket = require('../models/HelpdeskTicket');

// Import middleware
const { authenticateToken } = require('../middleware/auth');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const permissions = require('../middleware/permissions');

// Configure multer for memory storage (for S3 uploads)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, documents, and archives are allowed.'));
    }
  }
});

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Apply subscription middleware to all helpdesk routes
router.use(checkSubscriptionStatus);

// Add cache control headers to prevent caching
router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// ===== TICKET ROUTES =====

// Get all tickets with filtering and pagination
router.get('/tickets', helpdeskController.getTickets);

// Get ticket statistics (must come before /:id route)
router.get('/tickets/stats/overview', permissions('Helpdesk', 'view', 'Dashboard'), helpdeskController.getTicketStats);

// Get overdue tickets (must come before /:id route)
router.get('/tickets/overdue', helpdeskController.getOverdueTickets);

// Get single ticket
router.get('/tickets/:id', helpdeskController.getTicket);

// Create new ticket
router.post('/tickets', upload.array('attachments', 5), helpdeskController.createTicket);

// Update ticket
router.put('/tickets/:id', helpdeskController.updateTicket);

// Download attachment with signed URL
router.get('/tickets/:ticketId/attachments/:attachmentIndex/download', async (req, res) => {
  try {
    const { ticketId, attachmentIndex } = req.params;
    
    // Find the ticket
    const ticket = await HelpdeskTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    // Check if user has access to this ticket
    const hasAccess = req.user.role === 'admin' || 
                     ticket.requester.toString() === req.user._id.toString() ||
                     ticket.assignedTo?.toString() === req.user._id.toString();
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Get the attachment
    const attachment = ticket.attachments[attachmentIndex];
    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' });
    }
    
    // Extract S3 key from URL
    let s3Key;
    if (attachment.url.startsWith('http')) {
      const match = attachment.url.match(/amazonaws\.com\/(.+)$/);
      s3Key = match ? decodeURIComponent(match[1]) : null;
    } else {
      s3Key = attachment.url;
    }
    
    if (!s3Key) {
      console.error('Helpdesk attachment S3 key extraction failed:', attachment.url);
      return res.status(400).json({ message: 'Invalid attachment URL' });
    }
    
    // Generate signed URL
    const { getSignedUrl } = require('../utils/s3');
    const signedUrl = getSignedUrl(s3Key, 3600); // 1 hour expiry
    
    res.json({ downloadUrl: signedUrl });
  } catch (error) {
    console.error('Error generating helpdesk attachment signed URL:', error);
    res.status(500).json({ message: 'Failed to generate download link' });
  }
});

// Add comment to ticket
router.post('/tickets/:id/comments', helpdeskController.addComment);

// Close ticket
router.patch('/tickets/:id/close', helpdeskController.closeTicket);

// ===== CATEGORY ROUTES =====

// Get all categories
router.get('/categories', helpdeskCategoryController.getCategories);

// Get available users for assignment (must come before /:id route)
router.get('/categories/available-users', helpdeskCategoryController.getAvailableUsers);

// Get category statistics
router.get('/categories/stats/overview', permissions('Helpdesk', 'view', 'Dashboard'), helpdeskCategoryController.getCategoryStats);

// Get single category
router.get('/categories/:id', helpdeskCategoryController.getCategory);

// Create new category
router.post('/categories', permissions('Helpdesk', 'full', 'Categories'), helpdeskCategoryController.createCategory);

// Update category
router.put('/categories/:id', permissions('Helpdesk', 'full', 'Categories'), helpdeskCategoryController.updateCategory);

// Delete category
router.delete('/categories/:id', permissions('Helpdesk', 'full', 'Categories'), helpdeskCategoryController.deleteCategory);

// ===== KNOWLEDGE BASE ROUTES =====

// Get all knowledge articles
router.get('/knowledge', knowledgeController.getArticles);

// Search articles (must come before /:id route)
router.get('/knowledge/search', knowledgeController.searchArticles);

// Get featured articles (must come before /:id route)
router.get('/knowledge/featured', knowledgeController.getFeaturedArticles);

// Get article statistics (must come before /:id route)
router.get('/knowledge/stats/overview', permissions('Helpdesk', 'view', 'Knowledge Base'), knowledgeController.getArticleStats);

// Get available users for assignment (must come before /:id route)
router.get('/knowledge/available-users', knowledgeController.getAvailableUsers);

// Get single article
router.get('/knowledge/:id', knowledgeController.getArticle);

// Create new article
router.post('/knowledge', upload.array('attachments', 5), knowledgeController.createArticle);

// Update article
router.put('/knowledge/:id', knowledgeController.updateArticle);

// Delete article
router.delete('/knowledge/:id', knowledgeController.deleteArticle);

// Get articles by category
router.get('/knowledge/category/:categoryId', knowledgeController.getArticlesByCategory);

// Rate article helpfulness
router.post('/knowledge/:id/rate', knowledgeController.rateArticle);

// Increment article view count
router.post('/knowledge/:id/view', knowledgeController.incrementView);

// Assign article to users/roles
router.put('/knowledge/:id/assign', knowledgeController.assignArticle);

// ===== DASHBOARD ROUTES =====

// Get dashboard data
router.get('/dashboard', permissions('Helpdesk', 'view', 'Dashboard'), async (req, res) => {
  try {
    const organizationId = req.user.organization;
    const userRole = req.user.role;

    // Get basic statistics
    const [
      ticketStats,
      categoryStats,
      articleStats,
      overdueTickets,
      recentTickets,
      featuredArticles
    ] = await Promise.all([
      helpdeskController.getTicketStats(req, { json: () => {} }),
      helpdeskCategoryController.getCategoryStats(req, { json: () => {} }),
      knowledgeController.getArticleStats(req, { json: () => {} }),
      helpdeskController.getOverdueTickets(req, { json: () => {} }),
      helpdeskController.getTickets(req, { json: () => {} }),
      knowledgeController.getFeaturedArticles(req, { json: () => {} })
    ]);

    // Get recent tickets (last 5)
    const recentTicketsData = await helpdeskController.getTickets({
      ...req,
      query: { ...req.query, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }
    }, { json: () => {} });

    res.json({
      ticketStats,
      categoryStats,
      articleStats,
      overdueTickets,
      recentTickets: recentTicketsData.tickets,
      featuredArticles,
      userRole
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard data', error: error.message });
  }
});

// ===== REPORTS ROUTES =====

// Get comprehensive reports
router.get('/reports', permissions('Helpdesk', 'view', 'Reports'), async (req, res) => {
  try {
    const organizationId = req.user.organization;
    const { 
      startDate, 
      endDate, 
      category, 
      priority, 
      status,
      format = 'json' // json, csv, excel
    } = req.query;

    // Build date filter
    let dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    // Build base filter
    let filter = { organization: organizationId };
    if (Object.keys(dateFilter).length > 0) {
      filter.createdAt = dateFilter;
    }
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (status) filter.status = status;

    // Role-based filtering - Import helper function
    const helpdeskController = require('../controllers/helpdeskController');
    const hasFullAccess = await helpdeskController.hasFullHelpdeskAccess(req.user, organizationId);
    
    if (!hasFullAccess) {
      if (req.user.role === 'staff') {
        filter.requester = req.user._id;
      } else {
        // Department users
        const userCategories = await require('../models/HelpdeskCategory').find({
          organization: organizationId,
          $or: [
            { assignedRoles: req.user.role },
            { assignedUsers: req.user._id }
          ]
        }).select('_id');
        
        filter.category = { $in: userCategories.map(cat => cat._id) };
      }
    }

    // Get tickets for report
    const tickets = await require('../models/HelpdeskTicket').find(filter)
      .populate('category', 'name')
      .populate('requester', 'fullName email')
      .populate('assignedTo', 'fullName email')
      .sort({ createdAt: -1 });

    // Generate report data
    const reportData = {
      summary: {
        total: tickets.length,
        byStatus: {},
        byPriority: {},
        byCategory: {},
        avgResolutionTime: 0
      },
      tickets: tickets.map(ticket => ({
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        category: ticket.category?.name || 'N/A',
        priority: ticket.priority,
        status: ticket.status,
        requester: ticket.requester?.fullName || 'N/A',
        assignedTo: ticket.assignedTo?.fullName || 'Unassigned',
        createdAt: ticket.createdAt,
        resolvedAt: ticket.resolvedAt,
        resolutionTime: ticket.resolutionTime
      }))
    };

    // Calculate summary statistics
    tickets.forEach(ticket => {
      // By status
      reportData.summary.byStatus[ticket.status] = (reportData.summary.byStatus[ticket.status] || 0) + 1;
      
      // By priority
      reportData.summary.byPriority[ticket.priority] = (reportData.summary.byPriority[ticket.priority] || 0) + 1;
      
      // By category
      const categoryName = ticket.category?.name || 'Uncategorized';
      reportData.summary.byCategory[categoryName] = (reportData.summary.byCategory[categoryName] || 0) + 1;
    });

    // Calculate average resolution time
    const resolvedTickets = tickets.filter(t => t.resolutionTime);
    if (resolvedTickets.length > 0) {
      const totalTime = resolvedTickets.reduce((sum, ticket) => sum + ticket.resolutionTime, 0);
      reportData.summary.avgResolutionTime = totalTime / resolvedTickets.length;
    }

    if (format === 'csv') {
      // Generate CSV
      const csv = generateCSV(reportData.tickets);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="helpdesk-report.csv"');
      res.send(csv);
    } else {
      res.json(reportData);
    }
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ message: 'Failed to generate report', error: error.message });
  }
});

// Helper function to generate CSV
function generateCSV(data) {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  // Add headers
  csvRows.push(headers.join(','));
  
  // Add data rows
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      // Escape commas and quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

module.exports = router;



