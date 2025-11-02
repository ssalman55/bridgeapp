const KnowledgeArticle = require('../models/KnowledgeArticle');
const HelpdeskCategory = require('../models/HelpdeskCategory');

// Get all knowledge articles
exports.getArticles = async (req, res) => {
  try {
    const organizationId = req.user.organization._id || req.user.organization;
    const { 
      page = 1, 
      limit = 10, 
      category, 
      type, 
      status,
      search,
      featured,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    let filter = { organization: organizationId };

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (type) filter.type = type;
    if (featured === 'true') filter.isFeatured = true;

    // Search functionality
    if (search) {
      filter.$text = { $search: search };
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const total = await KnowledgeArticle.countDocuments(filter);

    // Build sort object
    const sort = {};
    if (search) {
      sort.score = { $meta: 'textScore' };
    }
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    sort.isFeatured = -1;

    // Get articles
    const articles = await KnowledgeArticle.find(filter)
      .populate('category', 'name color icon')
      .populate('createdBy', 'fullName')
      .populate('updatedBy', 'fullName')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Filter by access permissions
    const accessibleArticles = articles.filter(article => 
      article.canView(req.user._id, req.user.role)
    );

    res.json({
      articles: accessibleArticles,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ message: 'Failed to fetch articles', error: error.message });
  }
};

// Get single article
exports.getArticle = async (req, res) => {
  try {
    const article = await KnowledgeArticle.findById(req.params.id)
      .populate('category', 'name color icon')
      .populate('createdBy', 'fullName')
      .populate('updatedBy', 'fullName');

    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    // Check access permissions
    if (!article.canView(req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Increment view count
    await article.incrementViews();

    res.json(article);
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ message: 'Failed to fetch article', error: error.message });
  }
};

// Create new article
exports.createArticle = async (req, res) => {
  try {
    const organizationId = req.user.organization._id || req.user.organization;
    const {
      title,
      content,
      summary,
      category,
      tags,
      visibility,
      visibleToRoles,
      visibleToUsers,
      type,
      difficulty,
      attachments,
      keywords,
      isFeatured,
      youtubeUrl,
      externalLinks
    } = req.body;

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({ 
        message: 'Title and content are required' 
      });
    }

    // Create article
    const article = new KnowledgeArticle({
      title,
      content,
      summary,
      category,
      tags,
      visibility,
      visibleToRoles,
      visibleToUsers,
      type,
      difficulty,
      attachments,
      keywords,
      isFeatured,
      youtubeUrl,
      externalLinks,
      status: 'published', // Set to published by default
      organization: organizationId,
      createdBy: req.user._id
    });

    await article.save();

    // Populate the saved article
    await article.populate([
      { path: 'category', select: 'name color icon' },
      { path: 'createdBy', select: 'fullName' }
    ]);

    res.status(201).json(article);
  } catch (error) {
    console.error('Error creating article:', error);
    res.status(500).json({ message: 'Failed to create article', error: error.message });
  }
};

// Update article
exports.updateArticle = async (req, res) => {
  try {
    const article = await KnowledgeArticle.findById(req.params.id);
    
    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    // Check permissions
    if (!article.canEdit(req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const {
      title,
      content,
      summary,
      category,
      tags,
      visibility,
      visibleToRoles,
      visibleToUsers,
      type,
      difficulty,
      attachments,
      keywords,
      isFeatured,
      status,
      youtubeUrl,
      externalLinks
    } = req.body;

    // Update fields
    if (title !== undefined) article.title = title;
    if (content !== undefined) article.content = content;
    if (summary !== undefined) article.summary = summary;
    if (category !== undefined) article.category = category;
    if (tags !== undefined) article.tags = tags;
    if (visibility !== undefined) article.visibility = visibility;
    if (visibleToRoles !== undefined) article.visibleToRoles = visibleToRoles;
    if (visibleToUsers !== undefined) article.visibleToUsers = visibleToUsers;
    if (type !== undefined) article.type = type;
    if (difficulty !== undefined) article.difficulty = difficulty;
    if (attachments !== undefined) article.attachments = attachments;
    if (keywords !== undefined) article.keywords = keywords;
    if (isFeatured !== undefined) article.isFeatured = isFeatured;
    if (status !== undefined) article.status = status;
    if (youtubeUrl !== undefined) article.youtubeUrl = youtubeUrl;
    if (externalLinks !== undefined) article.externalLinks = externalLinks;
    
    article.updatedBy = req.user._id;

    await article.save();

    // Populate the updated article
    await article.populate([
      { path: 'category', select: 'name color icon' },
      { path: 'createdBy', select: 'fullName' },
      { path: 'updatedBy', select: 'fullName' }
    ]);

    res.json(article);
  } catch (error) {
    console.error('Error updating article:', error);
    res.status(500).json({ message: 'Failed to update article', error: error.message });
  }
};

// Delete article
exports.deleteArticle = async (req, res) => {
  try {
    const article = await KnowledgeArticle.findById(req.params.id);
    
    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    // Check permissions
    if (!article.canEdit(req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await KnowledgeArticle.findByIdAndDelete(req.params.id);

    res.json({ message: 'Article deleted successfully' });
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json({ message: 'Failed to delete article', error: error.message });
  }
};

// Search articles
exports.searchArticles = async (req, res) => {
  try {
    const organizationId = req.user.organization._id || req.user.organization;
    const { q, category, type, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const articles = await KnowledgeArticle.search(q, organizationId, req.user._id, req.user.role);

    // Apply additional filters
    let filteredArticles = articles;
    if (category) {
      filteredArticles = filteredArticles.filter(article => 
        article.category && article.category._id.toString() === category
      );
    }
    if (type) {
      filteredArticles = filteredArticles.filter(article => article.type === type);
    }

    // Limit results
    filteredArticles = filteredArticles.slice(0, parseInt(limit));

    res.json(filteredArticles);
  } catch (error) {
    console.error('Error searching articles:', error);
    res.status(500).json({ message: 'Failed to search articles', error: error.message });
  }
};

// Get featured articles
exports.getFeaturedArticles = async (req, res) => {
  try {
    const organizationId = req.user.organization._id || req.user.organization;
    const { limit = 5 } = req.query;

    const articles = await KnowledgeArticle.getFeatured(organizationId, req.user._id, req.user.role);
    const limitedArticles = articles.slice(0, parseInt(limit));

    res.json(limitedArticles);
  } catch (error) {
    console.error('Error fetching featured articles:', error);
    res.status(500).json({ message: 'Failed to fetch featured articles', error: error.message });
  }
};

// Get articles by category
exports.getArticlesByCategory = async (req, res) => {
  try {
    const organizationId = req.user.organization._id || req.user.organization;
    const { categoryId } = req.params;
    const { limit = 10 } = req.query;

    const articles = await KnowledgeArticle.getByCategory(categoryId, organizationId, req.user._id, req.user.role);
    const limitedArticles = articles.slice(0, parseInt(limit));

    res.json(limitedArticles);
  } catch (error) {
    console.error('Error fetching articles by category:', error);
    res.status(500).json({ message: 'Failed to fetch articles by category', error: error.message });
  }
};

// Rate article helpfulness
exports.rateArticle = async (req, res) => {
  try {
    const article = await KnowledgeArticle.findById(req.params.id);
    
    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    // Check access permissions
    if (!article.canView(req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { helpful } = req.body;

    if (helpful === true) {
      await article.markHelpful();
    } else if (helpful === false) {
      await article.markNotHelpful();
    } else {
      return res.status(400).json({ message: 'Helpful value must be true or false' });
    }

    res.json({ 
      message: 'Rating submitted successfully',
      helpfulness: article.helpfulness,
      helpful: article.helpful,
      notHelpful: article.notHelpful
    });
  } catch (error) {
    console.error('Error rating article:', error);
    res.status(500).json({ message: 'Failed to rate article', error: error.message });
  }
};

// Increment article view count
exports.incrementView = async (req, res) => {
  try {
    const article = await KnowledgeArticle.findById(req.params.id);
    
    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    // Check access permissions
    if (!article.canView(req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Increment view count
    article.views = (article.views || 0) + 1;
    await article.save();

    res.json({ 
      message: 'View count incremented',
      views: article.views
    });
  } catch (error) {
    console.error('Error incrementing view count:', error);
    res.status(500).json({ message: 'Failed to increment view count', error: error.message });
  }
};

// Assign article to users
exports.assignArticle = async (req, res) => {
  try {
    const article = await KnowledgeArticle.findById(req.params.id);
    
    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    // Check edit permissions
    if (!article.canEdit(req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { userIds, roleNames } = req.body;

    // Update visibility settings
    if (userIds && userIds.length > 0) {
      article.visibility = 'user-based';
      article.visibleToUsers = userIds;
      article.visibleToRoles = [];
    } else if (roleNames && roleNames.length > 0) {
      article.visibility = 'role-based';
      article.visibleToRoles = roleNames;
      article.visibleToUsers = [];
    } else {
      article.visibility = 'public';
      article.visibleToUsers = [];
      article.visibleToRoles = [];
    }

    article.updatedBy = req.user._id;
    await article.save();

    res.json({ 
      message: 'Article assignment updated successfully',
      article: {
        _id: article._id,
        title: article.title,
        visibility: article.visibility,
        visibleToUsers: article.visibleToUsers,
        visibleToRoles: article.visibleToRoles
      }
    });
  } catch (error) {
    console.error('Error assigning article:', error);
    res.status(500).json({ message: 'Failed to assign article', error: error.message });
  }
};

// Get available users for assignment
exports.getAvailableUsers = async (req, res) => {
  try {
    const organizationId = req.user.organization._id || req.user.organization;
    
    const User = require('../models/User');
    const users = await User.find({
      organization: organizationId,
      status: { $ne: 'archived' }
    }).select('_id fullName email role department');

    res.json(users);
  } catch (error) {
    console.error('Error fetching available users:', error);
    res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
};

// Get article statistics
exports.getArticleStats = async (req, res) => {
  try {
    const organizationId = req.user.organization._id || req.user.organization;
    const { period = '30' } = req.query; // days

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const [
      totalArticles,
      publishedArticles,
      draftArticles,
      featuredArticles,
      articlesByType,
      articlesByCategory,
      topViewedArticles,
      mostHelpfulArticles
    ] = await Promise.all([
      KnowledgeArticle.countDocuments({ organization: organizationId }),
      KnowledgeArticle.countDocuments({ organization: organizationId, status: 'published' }),
      KnowledgeArticle.countDocuments({ organization: organizationId, status: 'draft' }),
      KnowledgeArticle.countDocuments({ organization: organizationId, isFeatured: true }),
      KnowledgeArticle.aggregate([
        { $match: { organization: organizationId } },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]),
      KnowledgeArticle.aggregate([
        { $match: { organization: organizationId } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $lookup: { from: 'helpdeskcategories', localField: '_id', foreignField: '_id', as: 'category' } },
        { $unwind: '$category' },
        { $project: { _id: 1, name: '$category.name', count: 1 } }
      ]),
      KnowledgeArticle.find({ organization: organizationId })
        .populate('category', 'name')
        .sort({ views: -1 })
        .limit(5)
        .select('title views category'),
      KnowledgeArticle.find({ organization: organizationId })
        .populate('category', 'name')
        .sort({ helpful: -1 })
        .limit(5)
        .select('title helpful notHelpful category')
    ]);

    res.json({
      total: totalArticles,
      published: publishedArticles,
      draft: draftArticles,
      featured: featuredArticles,
      byType: articlesByType,
      byCategory: articlesByCategory,
      topViewed: topViewedArticles,
      mostHelpful: mostHelpfulArticles
    });
  } catch (error) {
    console.error('Error fetching article stats:', error);
    res.status(500).json({ message: 'Failed to fetch article statistics', error: error.message });
  }
};
