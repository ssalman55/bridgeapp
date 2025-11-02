const OrganizationDocument = require('../models/OrganizationDocument');
const { uploadToS3, getSignedUrl, deleteFile } = require('../utils/s3');
const multer = require('multer');

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, Excel, PowerPoint, text, and image files are allowed.'));
    }
  }
}).single('file');

// Get all documents for organization
exports.getDocuments = async (req, res) => {
  try {
    const { category, status, search, page = 1, limit = 20 } = req.query;
    const organization = req.user.organization;
    
    // Build filter
    const filter = { organization };
    
    if (category) {
      filter.category = category;
    }
    
    if (status) {
      filter.status = status;
    } else {
      // By default, only show active documents
      filter.status = 'active';
    }
    
    // Text search
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const documents = await OrganizationDocument.find(filter)
      .populate('uploadedBy', 'fullName email')
      .populate('lastModifiedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await OrganizationDocument.countDocuments(filter);
    
    // Generate signed URLs for documents
    const documentsWithUrls = documents.map(doc => {
      const docObj = doc.toObject();
      try {
        // Only generate signed URL if s3Key is valid
        if (doc.s3Key && typeof doc.s3Key === 'string' && doc.s3Key.length > 0) {
          docObj.downloadUrl = getSignedUrl(doc.s3Key, 3600); // 1 hour expiry
        } else {
          console.warn('[Document List] Invalid s3Key for document:', doc._id);
          docObj.downloadUrl = null;
        }
      } catch (error) {
        console.error('[Document List] Error generating signed URL for document:', doc._id, error);
        docObj.downloadUrl = null;
      }
      return docObj;
    });
    
    res.json({
      documents: documentsWithUrls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: 'Error fetching documents', error: error.message });
  }
};

// Get single document by ID
exports.getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = req.user.organization;
    
    const document = await OrganizationDocument.findOne({
      _id: id,
      organization
    })
      .populate('uploadedBy', 'fullName email profileImage')
      .populate('lastModifiedBy', 'fullName email')
      .populate('downloadHistory.user', 'fullName email');
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Record view
    await document.recordView();
    
    // Generate signed URL
    const docObj = document.toObject();
    docObj.downloadUrl = getSignedUrl(document.s3Key, 3600);
    
    res.json(docObj);
    
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ message: 'Error fetching document', error: error.message });
  }
};

// Upload new document
exports.uploadDocument = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ message: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    try {
      const { title, description, category, version, tags, expiryDate, effectiveDate } = req.body;
      const organization = req.user.organization;
      const uploadedBy = req.user._id;
      
      if (!title) {
        return res.status(400).json({ message: 'Title is required' });
      }
      
      if (!category) {
        return res.status(400).json({ message: 'Category is required' });
      }
      
      // Upload file to S3
      // Use very short folder path to avoid S3 key length issues
      // MongoDB ObjectId is 24 chars, so keep folder structure minimal
      let orgIdString = '';
      if (typeof organization === 'string') {
        orgIdString = organization;
      } else if (organization && organization._id) {
        orgIdString = organization._id.toString();
      } else if (organization && organization.toString) {
        orgIdString = organization.toString();
      } else {
        orgIdString = String(organization);
      }
      
      // Clean and validate the organization ID
      orgIdString = orgIdString.trim().replace(/[^a-zA-Z0-9]/g, '');
      if (!orgIdString || orgIdString.length < 12) {
        console.error('[Upload] Invalid organization ID:', organization);
        return res.status(500).json({ message: 'Invalid organization context' });
      }
      
      const orgIdShort = orgIdString.slice(-12); // Use last 12 chars of org ID
      const folder = `docs/${orgIdShort}`;
      
      console.log('[Upload] Organization:', organization);
      console.log('[Upload] Organization ID String:', orgIdString);
      console.log('[Upload] Folder:', folder);
      
      const fileUrl = await uploadToS3(req.file, folder);
      
      // Extract S3 key from URL
      // URL format: https://bucket.s3.region.amazonaws.com/key
      const urlObj = new URL(fileUrl);
      const s3Key = urlObj.pathname.substring(1); // Remove leading slash
      
      console.log('[Document Upload] File URL:', fileUrl);
      console.log('[Document Upload] Extracted S3 Key:', s3Key);
      
      // Parse tags
      let parsedTags = [];
      if (tags) {
        try {
          parsedTags = JSON.parse(tags);
        } catch (e) {
          // If not JSON, split by comma
          parsedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
        }
      }
      
      // Create document record
      const document = new OrganizationDocument({
        title,
        description,
        category,
        fileName: req.file.originalname,
        originalFileName: req.file.originalname,
        fileUrl,
        s3Key,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        organization,
        uploadedBy,
        version: version || '1.0',
        tags: parsedTags,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date()
      });
      
      await document.save();
      
      // Populate user info
      await document.populate('uploadedBy', 'fullName email');
      
      const docObj = document.toObject();
      docObj.downloadUrl = getSignedUrl(document.s3Key, 3600);
      
      res.status(201).json({
        message: 'Document uploaded successfully',
        document: docObj
      });
      
    } catch (error) {
      console.error('Error uploading document:', error);
      res.status(500).json({ message: 'Error uploading document', error: error.message });
    }
  });
};

// Update document metadata
exports.updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, version, tags, expiryDate, effectiveDate, status } = req.body;
    const organization = req.user.organization;
    const userId = req.user._id;
    
    const document = await OrganizationDocument.findOne({
      _id: id,
      organization
    });
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Update fields
    if (title) document.title = title;
    if (description !== undefined) document.description = description;
    if (category) document.category = category;
    if (version) document.version = version;
    if (status) document.status = status;
    if (expiryDate !== undefined) document.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (effectiveDate !== undefined) document.effectiveDate = effectiveDate ? new Date(effectiveDate) : null;
    
    if (tags !== undefined) {
      let parsedTags = [];
      if (typeof tags === 'string') {
        try {
          parsedTags = JSON.parse(tags);
        } catch (e) {
          parsedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
        }
      } else if (Array.isArray(tags)) {
        parsedTags = tags;
      }
      document.tags = parsedTags;
    }
    
    document.lastModifiedBy = userId;
    document.lastModifiedAt = new Date();
    
    await document.save();
    await document.populate('uploadedBy', 'fullName email');
    await document.populate('lastModifiedBy', 'fullName email');
    
    const docObj = document.toObject();
    docObj.downloadUrl = getSignedUrl(document.s3Key, 3600);
    
    res.json({
      message: 'Document updated successfully',
      document: docObj
    });
    
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ message: 'Error updating document', error: error.message });
  }
};

// Delete document
exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = req.user.organization;
    
    const document = await OrganizationDocument.findOne({
      _id: id,
      organization
    });
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Delete file from S3
    try {
      await deleteFile(document.s3Key);
    } catch (s3Error) {
      console.error('Error deleting file from S3:', s3Error);
      // Continue with database deletion even if S3 deletion fails
    }
    
    // Delete from database
    await OrganizationDocument.deleteOne({ _id: id });
    
    res.json({ message: 'Document deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ message: 'Error deleting document', error: error.message });
  }
};

// Download document
exports.downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = req.user.organization;
    const userId = req.user._id;
    
    const document = await OrganizationDocument.findOne({
      _id: id,
      organization
    });
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Validate and fix s3Key if needed
    let s3Key = document.s3Key;
    if (!s3Key || typeof s3Key !== 'string' || s3Key.includes('Reason:') || s3Key.includes('{') || s3Key.includes('}')) {
      console.warn('[Download] Invalid s3Key detected, attempting to extract from fileUrl');
      console.warn('[Download] Current s3Key:', s3Key);
      console.warn('[Download] File URL:', document.fileUrl);
      
      // Try to extract s3Key from fileUrl as fallback
      if (document.fileUrl) {
        try {
          const urlObj = new URL(document.fileUrl);
          s3Key = urlObj.pathname.substring(1); // Remove leading slash
          console.log('[Download] Extracted s3Key from URL:', s3Key);
          
          // Update the document with corrected s3Key
          document.s3Key = s3Key;
          await document.save();
          console.log('[Download] Updated document with corrected s3Key');
        } catch (urlError) {
          console.error('[Download] Failed to extract s3Key from URL:', urlError);
          return res.status(500).json({ message: 'Document file reference is invalid. Please re-upload the document.' });
        }
      } else {
        console.error('[Download] No fileUrl available for fallback');
        return res.status(500).json({ message: 'Document file reference is invalid. Please re-upload the document.' });
      }
    }
    
    // Record download
    await document.recordDownload(userId);
    
    // Generate signed URL with longer expiry for download
    console.log('[Download] Generating signed URL for s3Key:', s3Key);
    const downloadUrl = getSignedUrl(s3Key, 300); // 5 minutes
    
    res.json({
      downloadUrl,
      fileName: document.originalFileName,
      fileSize: document.fileSize,
      mimeType: document.mimeType
    });
    
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ message: 'Error downloading document', error: error.message });
  }
};

// Get document statistics
exports.getDocumentStats = async (req, res) => {
  try {
    const organization = req.user.organization;
    
    const stats = await OrganizationDocument.aggregate([
      {
        $match: {
          organization: organization,
          status: 'active'
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalSize: { $sum: '$fileSize' },
          totalDownloads: { $sum: '$downloadCount' },
          totalViews: { $sum: '$viewCount' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    const totalDocuments = await OrganizationDocument.countDocuments({
      organization,
      status: 'active'
    });
    
    const recentDocuments = await OrganizationDocument.find({
      organization,
      status: 'active'
    })
      .populate('uploadedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title category createdAt uploadedBy');
    
    const mostDownloaded = await OrganizationDocument.find({
      organization,
      status: 'active'
    })
      .populate('uploadedBy', 'fullName email')
      .sort({ downloadCount: -1 })
      .limit(5)
      .select('title category downloadCount uploadedBy');
    
    res.json({
      totalDocuments,
      categoryStats: stats,
      recentDocuments,
      mostDownloaded
    });
    
  } catch (error) {
    console.error('Error fetching document stats:', error);
    res.status(500).json({ message: 'Error fetching statistics', error: error.message });
  }
};

// Get document categories
exports.getCategories = async (req, res) => {
  try {
    const organization = req.user.organization;
    
    const categories = await OrganizationDocument.distinct('category', {
      organization,
      status: 'active'
    });
    
    // Get count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const count = await OrganizationDocument.countDocuments({
          organization,
          category,
          status: 'active'
        });
        return { category, count };
      })
    );
    
    res.json(categoriesWithCount);
    
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
};

module.exports = exports;

