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

module.exports = { uploadFile, getFileUrl, getSignedUrl }; 