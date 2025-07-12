const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Determine the base upload directory from environment variables for production flexibility
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
console.log(`[Uploader] Middleware configured to save files in: ${UPLOAD_DIR}`);

// Ensure the base upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Create storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let dest = UPLOAD_DIR;
    // Save expense claim files in a subdirectory
    if (req.baseUrl && req.baseUrl.includes('expense-claims')) {
      dest = path.join(UPLOAD_DIR, 'expense-claims');
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
    }
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = file.fieldname + '-' + uniqueSuffix + ext;
    console.log('Generated filename:', filename);
    cb(null, filename);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  console.log('Received file:', {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype
  });

  if (file.fieldname === 'profileImage') {
    // Allow only image files for profile pictures
    if (!file.mimetype.startsWith('image/')) {
      console.log('Rejected file - not an image:', file.mimetype);
      return cb(new Error('Only image files are allowed!'), false);
    }
  } else {
    // For other uploads, allow common document types
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      console.log('Rejected file - invalid type:', file.mimetype);
      return cb(new Error('File type not allowed!'), false);
    }
  }
  console.log('File accepted:', file.originalname);
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

module.exports = upload; 