const mongoose = require('mongoose');

// Knowledge Article Schema
const knowledgeArticleSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000
  },
  summary: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Organization
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  
  // Classification
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HelpdeskCategory'
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  
  // Access Control
  visibility: {
    type: String,
    enum: ['public', 'role-based', 'user-based'],
    default: 'public'
  },
  visibleToRoles: [{
    type: String,
    enum: ['admin', 'it-team', 'hr-team', 'facilities-team', 'security-team', 'av-team', 'general-staff', 'dept_admin']
  }],
  visibleToUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Content Management
  type: {
    type: String,
    enum: ['faq', 'guide', 'policy', 'troubleshooting', 'announcement'],
    default: 'guide'
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  
  // Attachments
  attachments: [{
    filename: String,
    originalName: String,
    url: String,
    size: Number,
    mimeType: String
  }],
  
  // Media
  youtubeUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Optional field
        // Basic YouTube URL validation
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)[\w-]+/;
        return youtubeRegex.test(v);
      },
      message: 'Please provide a valid YouTube URL'
    }
  },
  
  // External Links
  externalLinks: [{
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    url: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v) {
          // Basic URL validation
          const urlRegex = /^https?:\/\/.+/;
          return urlRegex.test(v);
        },
        message: 'Please provide a valid URL starting with http:// or https://'
      }
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    }
  }],
  
  // Analytics
  views: {
    type: Number,
    default: 0
  },
  helpful: {
    type: Number,
    default: 0
  },
  notHelpful: {
    type: Number,
    default: 0
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  
  // SEO and Search
  keywords: [{
    type: String,
    trim: true,
    maxlength: 100
  }],
  
  // Version Control
  version: {
    type: Number,
    default: 1
  },
  previousVersions: [{
    title: String,
    content: String,
    summary: String,
    updatedAt: Date,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  publishedAt: {
    type: Date
  },
  lastReviewedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
knowledgeArticleSchema.index({ organization: 1, status: 1 });
knowledgeArticleSchema.index({ organization: 1, category: 1 });
knowledgeArticleSchema.index({ organization: 1, type: 1 });
knowledgeArticleSchema.index({ organization: 1, tags: 1 });
knowledgeArticleSchema.index({ organization: 1, isFeatured: 1 });
knowledgeArticleSchema.index({ title: 'text', content: 'text', summary: 'text', tags: 'text' });

// Virtuals
knowledgeArticleSchema.virtual('helpfulness').get(function() {
  const total = this.helpful + this.notHelpful;
  if (total === 0) return 0;
  return Math.round((this.helpful / total) * 100);
});

knowledgeArticleSchema.virtual('isPublished').get(function() {
  return this.status === 'published';
});

// Pre-save middleware
knowledgeArticleSchema.pre('save', function(next) {
  // Set published date when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  // Increment version when content changes
  if (this.isModified('title') || this.isModified('content') || this.isModified('summary')) {
    if (!this.isNew) {
      // Save previous version
      this.previousVersions.push({
        title: this.title,
        content: this.content,
        summary: this.summary,
        updatedAt: new Date(),
        updatedBy: this.updatedBy
      });
      
      // Increment version
      this.version += 1;
    }
  }
  
  next();
});

// Methods
knowledgeArticleSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

knowledgeArticleSchema.methods.markHelpful = function() {
  this.helpful += 1;
  return this.save();
};

knowledgeArticleSchema.methods.markNotHelpful = function() {
  this.notHelpful += 1;
  return this.save();
};

knowledgeArticleSchema.methods.canView = function(userId, userRole) {
  // Admin can view all articles
  if (userRole === 'admin') return true;
  
  // Public articles can be viewed by everyone
  if (this.visibility === 'public') return true;
  
  // Role-based visibility
  if (this.visibility === 'role-based' && this.visibleToRoles.includes(userRole)) {
    return true;
  }
  
  // User-based visibility
  if (this.visibility === 'user-based' && this.visibleToUsers.includes(userId)) {
    return true;
  }
  
  return false;
};

knowledgeArticleSchema.methods.canEdit = function(userId, userRole) {
  // Admin can edit all articles
  if (userRole === 'admin') return true;
  
  // Author can edit their own articles
  if (this.createdBy.toString() === userId.toString()) return true;
  
  // Department admins can edit articles in their categories
  if (userRole === 'dept_admin') {
    // This would need to be checked against the category's assigned roles
    return true;
  }
  
  return false;
};

knowledgeArticleSchema.methods.getYouTubeVideoId = function() {
  if (!this.youtubeUrl) return null;
  
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = this.youtubeUrl.match(regex);
  return match ? match[1] : null;
};

knowledgeArticleSchema.methods.getYouTubeEmbedUrl = function() {
  const videoId = this.getYouTubeVideoId();
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
};

// Static methods
knowledgeArticleSchema.statics.search = function(query, organizationId, userId, userRole) {
  const searchQuery = {
    organization: organizationId,
    status: 'published'
  };
  
  // Add text search
  if (query) {
    searchQuery.$text = { $search: query };
  }
  
  return this.find(searchQuery)
    .populate('category', 'name')
    .populate('createdBy', 'fullName')
    .sort({ score: { $meta: 'textScore' }, isFeatured: -1, views: -1 })
    .then(articles => {
      // Filter by access permissions
      return articles.filter(article => article.canView(userId, userRole));
    });
};

knowledgeArticleSchema.statics.getFeatured = function(organizationId, userId, userRole) {
  return this.find({
    organization: organizationId,
    status: 'published',
    isFeatured: true
  })
    .populate('category', 'name')
    .populate('createdBy', 'fullName')
    .sort({ views: -1, createdAt: -1 })
    .then(articles => {
      // Filter by access permissions
      return articles.filter(article => article.canView(userId, userRole));
    });
};

knowledgeArticleSchema.statics.getByCategory = function(categoryId, organizationId, userId, userRole) {
  return this.find({
    organization: organizationId,
    category: categoryId,
    status: 'published'
  })
    .populate('category', 'name')
    .populate('createdBy', 'fullName')
    .sort({ isFeatured: -1, views: -1, createdAt: -1 })
    .then(articles => {
      // Filter by access permissions
      return articles.filter(article => article.canView(userId, userRole));
    });
};

module.exports = mongoose.model('KnowledgeArticle', knowledgeArticleSchema);

