const multer = require('multer');

// Use memory storage for S3 uploads
const storage = multer.memoryStorage();

// File filter for profile images
const fileFilter = (req, file, cb) => {
  console.log('[ProfileImageUpload] Received file:', {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  // Only allow image files for profile pictures
  if (!file.mimetype.startsWith('image/')) {
    console.log('[ProfileImageUpload] Rejected file - not an image:', file.mimetype);
    return cb(new Error('Only image files are allowed for profile pictures!'), false);
  }

  // Check file size (max 5MB for profile images)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    console.log('[ProfileImageUpload] Rejected file - too large:', file.size);
    return cb(new Error('Profile image size must be less than 5MB!'), false);
  }

  console.log('[ProfileImageUpload] File accepted:', file.originalname);
  cb(null, true);
};

const profileImageUpload = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
});

module.exports = profileImageUpload; 
 
 