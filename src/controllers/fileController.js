// const path = require('path');
// const fs = require('fs');
// const File = require('../models/File');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Document = require('../models/Document');
const notificationService = require('../services/notificationService');

// Upload file (Staff)
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }
    const { title, description } = req.body;
    const fileUrl = `/uploads/${req.file.filename}`;
    const document = new Document({
      title,
      description,
      fileUrl,
      fileType: req.file.mimetype,
      organization: req.user.organization,
      uploadedBy: req.user._id
    });
    await document.save();

    // Notify all admins in the same organization
    const admins = await User.find({ organization: req.user.organization, role: 'admin', status: { $ne: 'archived' } });
    const staffName = req.user.fullName;
    const message = `${staffName} uploaded a file: ${title || req.file.originalname}`;
    const link = '/admin/documents';
    await Promise.all(admins.map(admin => Notification.create({
      message,
      type: 'file',
      link,
      recipient: admin._id,
      sender: req.user._id,
      organization: req.user.organization
    })));

    // New: Notify all users (including custom admins)
    await notificationService.notifyAllUsers({
      organization: req.user.organization,
      message: `${staffName} posted a new bulletin: ${title || req.file.originalname}`,
      type: 'bulletin',
      link: '/bulletin-board',
      sender: req.user._id
    });

    res.status(201).json({ message: 'File uploaded successfully.', document });
  } catch (err) {
    res.status(500).json({ message: 'File upload failed.', error: err.message });
  }
};

// List all files (Admin)
// exports.getAllFiles = async (req, res) => {
//   try {
//     const files = await File.find({ organization: req.user.organization }).populate('staffId', 'fullName email');
//     res.json(files);
//   } catch (err) {
//     res.status(500).json({ message: 'Failed to fetch files.', error: err.message });
//   }
// };

// Delete file (Admin)
// exports.deleteFile = async (req, res) => {
//   try {
//     const file = await File.findById(req.params.id);
//     if (!file) return res.status(404).json({ message: 'File not found.' });
//     // Remove physical file
//     fs.unlink(file.filePath, (err) => {
//       // Ignore error if file already deleted
//     });
//     await file.deleteOne();
//     res.json({ message: 'File deleted successfully.' });
//   } catch (err) {
//     res.status(500).json({ message: 'Failed to delete file.', error: err.message });
//   }
// };

// Download file (Admin)
// exports.downloadFile = async (req, res) => {
//   try {
//     const file = await File.findById(req.params.id);
//     if (!file) return res.status(404).json({ message: 'File not found.' });
//     res.download(file.filePath, file.originalFilename);
//   } catch (err) {
//     res.status(500).json({ message: 'Failed to download file.', error: err.message });
//   }
// }; 