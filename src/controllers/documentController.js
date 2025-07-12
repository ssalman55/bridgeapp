const asyncHandler = require('express-async-handler');
const Document = require('../models/Document');
const { uploadFile } = require('../utils/s3');

// Get recent documents for the organization
const getRecentDocuments = asyncHandler(async (req, res) => {
  const documents = await Document.find({ organization: req.user.organization })
    .populate('uploadedBy', 'fullName')
    .sort({ createdAt: -1 })
    .limit(5);

  res.json(documents);
});

// Get all documents for the organization (optionally filter by uploadedBy)
const getAllDocuments = asyncHandler(async (req, res) => {
  const filter = { organization: req.user.organization };
  if (req.query.uploadedBy) {
    filter.uploadedBy = req.query.uploadedBy;
  }
  const documents = await Document.find(filter)
    .populate('uploadedBy', 'fullName')
    .sort({ createdAt: -1 });

  res.json(documents);
});

// Create a new document
const createDocument = asyncHandler(async (req, res) => {
  const { title, description, fileUrl, fileType } = req.body;

  if (!title || !fileUrl || !fileType) {
    return res.status(400).json({ message: 'Title, file URL, and file type are required' });
  }

  const document = await Document.create({
    title,
    description,
    fileUrl,
    fileType,
    organization: req.user.organization,
    uploadedBy: req.user._id
  });

  const populatedDocument = await document.populate('uploadedBy', 'fullName');
  res.status(201).json(populatedDocument);
});

// Delete a document
const deleteDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const document = await Document.findOneAndDelete({
    _id: id,
    organization: req.user.organization
  });

  if (!document) {
    return res.status(404).json({ message: 'Document not found' });
  }

  res.json({ message: 'Document deleted successfully' });
});

// Upload a document (with file)
const uploadDocument = asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }
    const { title, description } = req.body;
    // Upload to S3
    const s3Key = `documents/${Date.now()}-${req.file.originalname}`;
    const s3Result = await uploadFile(req.file, s3Key);
    const fileUrl = s3Result.Location;
    const document = new Document({
      title,
      description,
      fileUrl,
      fileType: req.file.mimetype,
      organization: req.user.organization,
      uploadedBy: req.user._id
    });
    await document.save();
    res.status(201).json({ message: 'Document uploaded successfully.', document });
  } catch (err) {
    res.status(500).json({ message: 'Document upload failed.', error: err.message });
  }
});

module.exports = {
  getRecentDocuments,
  getAllDocuments,
  createDocument,
  deleteDocument,
  uploadDocument
}; 