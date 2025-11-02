const multer = require('multer');

// Use memory storage for S3 uploads
const storage = multer.memoryStorage();

// File filter for banner images
const fileFilter = (req, file, cb) => {
  console.log('[BannerImageUpload] Received file:', {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  // Only allow image files for banner images
  if (!file.mimetype.startsWith('image/')) {
    console.log('[BannerImageUpload] Rejected file - not an image:', file.mimetype);
    return cb(new Error('Only image files are allowed for banner images!'), false);
  }

  // Check file size (max 5MB for banner images)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    console.log('[BannerImageUpload] Rejected file - too large:', file.size);
    return cb(new Error('Banner image size must be less than 5MB!'), false);
  }

  console.log('[BannerImageUpload] File accepted:', file.originalname);
  cb(null, true);
};

const bannerImageUpload = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

module.exports = bannerImageUpload;
