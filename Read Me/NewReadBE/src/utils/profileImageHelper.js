const { getSignedUrl } = require('./s3');

/**
 * Convert a profile image S3 key to a signed URL
 * @param {string|null|undefined} profileImage - Profile image S3 key or URL
 * @param {number} expiresInSeconds - URL expiration time in seconds (default: 1 hour)
 * @returns {string|null} - Signed URL or null if no valid image
 */
const convertProfileImageToSignedUrl = (profileImage, expiresInSeconds = 3600) => {
  if (!profileImage) {
    return null;
  }

  // If it's already a full URL (signed or otherwise), return as-is
  if (profileImage.startsWith('http://') || profileImage.startsWith('https://')) {
    return profileImage;
  }

  // If it's an S3 key (starts with profile-images/), convert to signed URL
  if (profileImage.startsWith('profile-images/')) {
    try {
      return getSignedUrl(profileImage, expiresInSeconds);
    } catch (error) {
      console.warn('Could not generate signed URL for profile image:', error.message);
      return null;
    }
  }

  // If it doesn't match expected patterns, return null
  return null;
};

/**
 * Process a single object and convert profileImage fields to signed URLs
 * Supports nested objects with staff.profileImage, user.profileImage, etc.
 * @param {object} obj - Object to process
 * @param {number} expiresInSeconds - URL expiration time in seconds
 * @returns {object} - Object with converted profile images
 */
const processProfileImages = (obj, expiresInSeconds = 3600) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Handle direct profileImage field
  if (obj.profileImage) {
    obj.profileImage = convertProfileImageToSignedUrl(obj.profileImage, expiresInSeconds);
  }

  // Handle nested staff object
  if (obj.staff && obj.staff.profileImage) {
    obj.staff.profileImage = convertProfileImageToSignedUrl(obj.staff.profileImage, expiresInSeconds);
  }

  // Handle nested user object
  if (obj.user && obj.user.profileImage) {
    obj.user.profileImage = convertProfileImageToSignedUrl(obj.user.profileImage, expiresInSeconds);
  }

  // Handle nested staffId object
  if (obj.staffId && obj.staffId.profileImage) {
    obj.staffId.profileImage = convertProfileImageToSignedUrl(obj.staffId.profileImage, expiresInSeconds);
  }

  // Handle populated fields that might be objects
  if (obj.populated && typeof obj.populated === 'object') {
    Object.keys(obj.populated).forEach(key => {
      if (obj.populated[key] && obj.populated[key].profileImage) {
        obj.populated[key].profileImage = convertProfileImageToSignedUrl(
          obj.populated[key].profileImage,
          expiresInSeconds
        );
      }
    });
  }

  return obj;
};

/**
 * Process an array of objects and convert profileImage fields to signed URLs
 * @param {Array} array - Array of objects to process
 * @param {number} expiresInSeconds - URL expiration time in seconds
 * @returns {Array} - Array with converted profile images
 */
const processProfileImagesInArray = (array, expiresInSeconds = 3600) => {
  if (!Array.isArray(array)) {
    return array;
  }

  return array.map(item => processProfileImages(item, expiresInSeconds));
};

module.exports = {
  convertProfileImageToSignedUrl,
  processProfileImages,
  processProfileImagesInArray
};

