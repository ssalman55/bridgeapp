const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

/**
 * Upload a file buffer to S3
 * @param {object} file - Multer file object (with buffer, mimetype, originalname)
 * @param {string} key - S3 key (path/filename in bucket)
 * @returns {Promise<AWS.S3.ManagedUpload.SendData>}
 */
const uploadFile = (file, key) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ContentDisposition: 'attachment', // Force download instead of display
    // ACL: 'public-read', // Removed for Bucket owner enforced
  };
  return s3.upload(params).promise();
};

/**
 * Get the public URL for a file in S3
 * @param {string} key - S3 key (path/filename in bucket)
 * @returns {string} - Public URL
 */
const getFileUrl = (key) => {
  return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

const getSignedUrl = (key, expiresInSeconds = 300) => {
  return s3.getSignedUrl('getObject', {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Expires: expiresInSeconds, // default: 5 minutes
  });
};

/**
 * Get a signed URL for a profile image in S3
 * @param {string} key - S3 key (path/filename in bucket)
 * @param {number} expiresInSeconds - URL expiration time in seconds (default: 1 hour)
 * @returns {string} - Signed URL
 */
const getProfileImageUrl = (key, expiresInSeconds = 3600) => {
  return getSignedUrl(key, expiresInSeconds);
};

/**
 * Delete a file from S3
 * @param {string} key - S3 key (path/filename in bucket)
 * @returns {Promise<AWS.S3.DeleteObjectOutput>}
 */
const deleteFile = (key) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
  };
  return s3.deleteObject(params).promise();
};

/**
 * Download a file from S3 as a buffer
 * @param {string} key - S3 key (path/filename in bucket)
 * @returns {Promise<Buffer>} - File buffer
 */
const downloadFile = async (key) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
  };
  
  try {
    const data = await s3.getObject(params).promise();
    return data.Body;
  } catch (error) {
    console.error(`Error downloading file from S3 (key: ${key}):`, error);
    throw error;
  }
};

/**
 * Upload a file to S3 with automatic key generation
 * @param {object} file - Multer file object
 * @param {string} folder - Folder name in S3 bucket
 * @returns {Promise<string>} - Public URL of uploaded file
 */
const uploadToS3 = async (file, folder) => {
  const timestamp = Date.now();
  const fileExtension = file.originalname.split('.').pop() || 'file';
  const fileName = file.originalname.replace(/\.[^/.]+$/, ""); // Remove extension
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9-_]/g, '_'); // Sanitize filename
  
  // Truncate filename aggressively to avoid S3 key length issues
  // S3 key max length is 1024 bytes, keep filename under 30 chars to be extra safe
  const maxFileNameLength = 30;
  const truncatedFileName = sanitizedFileName.length > maxFileNameLength 
    ? sanitizedFileName.substring(0, maxFileNameLength) 
    : sanitizedFileName;
  
  // Generate a short random string for uniqueness
  const randomString = Math.random().toString(36).substring(2, 8);
  
  const key = `${folder}/${truncatedFileName}-${timestamp}-${randomString}.${fileExtension}`;
  
  // Debug logging to identify key length issues
  console.log('[S3 Upload] Key length:', key.length, 'Key:', key);
  
  // Safety check - if key is still too long, use fallback
  if (key.length > 200) {
    const fallbackKey = `${folder}/doc-${timestamp}-${randomString}.${fileExtension}`;
    console.log('[S3 Upload] Key too long, using fallback:', fallbackKey);
    const result = await uploadFile(file, fallbackKey);
    return result.Location;
  }
  
  const result = await uploadFile(file, key);
  return result.Location; // Return the public URL
};

/**
 * Upload a file stream to S3
 * @param {ReadableStream} stream - File stream
 * @param {object} options - Upload options { s3Key, contentType, metadata }
 * @returns {Promise<string>} - Public URL of uploaded file
 */
const uploadFileStream = async (stream, options) => {
  const { s3Key, contentType, metadata } = options;
  
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: s3Key,
    Body: stream,
    ContentType: contentType,
    ContentDisposition: 'attachment',
    Metadata: metadata || {}
  };
  
  const result = await s3.upload(params).promise();
  return result.Location;
};

module.exports = { 
  uploadFile, 
  uploadToS3,
  uploadFileStream,
  getFileUrl, 
  getSignedUrl, 
  getProfileImageUrl, 
  deleteFile,
  downloadFile
}; 