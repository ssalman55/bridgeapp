# Profile Images on Amazon S3

This document describes the implementation of profile image storage using Amazon S3 for the StaffBridge application.

## Overview

Profile images are now stored on Amazon S3 instead of local file storage, providing:
- Better scalability and reliability
- Reduced server storage requirements
- Faster image delivery through CDN
- Automatic backup and redundancy

## Architecture

### Backend Changes

#### 1. S3 Utility Functions (`backend/src/utils/s3.js`)
- `uploadFile(file, key)` - Upload file buffer to S3
- `getFileUrl(key)` - Get public URL for S3 file
- `getProfileImageUrl(key)` - Get public URL for profile images
- `deleteFile(key)` - Delete file from S3

#### 2. Profile Image Upload Middleware (`backend/src/middleware/profileImageUpload.js`)
- Uses `multer.memoryStorage()` for S3 uploads
- Validates file type (images only)
- Enforces 5MB file size limit
- Provides detailed logging

#### 3. Updated Auth Controller (`backend/src/controllers/authController.js`)
- `updateProfileImage` function now uploads to S3
- Automatic cleanup of old S3 images
- Better error handling and validation
- S3 key structure: `profile-images/{organization}/{userId}-{timestamp}.{extension}`

#### 4. Updated Routes (`backend/src/routes/authRoutes.js`)
- Profile image upload now uses `profileImageUpload` middleware
- Route: `POST /api/auth/profile/image`

### Frontend Changes

#### 1. Image Utils (`frontend/src/utils/imageUtils.ts`)
- `getImageUrl()` function already handles both local and S3 URLs
- Automatically detects absolute URLs (S3) vs relative URLs (local)
- No changes needed - existing code works seamlessly

## S3 Configuration

### Environment Variables Required

```bash
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=your_region
AWS_S3_BUCKET=your_bucket_name
```

### S3 Bucket Setup

1. **Bucket Policy**: Ensure your S3 bucket allows public read access for profile images
2. **CORS Configuration**: Configure CORS if needed for cross-origin requests
3. **Lifecycle Rules**: Consider setting up lifecycle rules for old profile images

Example bucket policy for public read access:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

## File Structure

### S3 Key Naming Convention
```
profile-images/
├── {organization-id}/
│   ├── {user-id}-{timestamp}.jpg
│   ├── {user-id}-{timestamp}.png
│   └── ...
```

### Benefits of This Structure
- **Organization Isolation**: Each organization's images are in separate folders
- **Unique Naming**: Timestamp prevents conflicts
- **Easy Cleanup**: Can delete entire organization folder if needed
- **Scalability**: No single folder becomes too large

## Migration from Local Storage

### Migration Script
A migration script is provided to move existing local profile images to S3:

```bash
cd backend
node scripts/migrate-profile-images-to-s3.js
```

### What the Migration Does
1. Scans all users with local profile images
2. Uploads each image to S3
3. Updates user records with S3 URLs
4. Optionally deletes local files (commented out by default)
5. Provides detailed migration report

### Migration Safety
- **Non-destructive**: Local files are preserved by default
- **Idempotent**: Can be run multiple times safely
- **Error Handling**: Continues processing even if individual images fail
- **Logging**: Detailed logs for troubleshooting

## API Endpoints

### Upload Profile Image
```http
POST /api/auth/profile/image
Content-Type: multipart/form-data
Authorization: Bearer {token}

Form Data:
- profileImage: image file (max 5MB)
```

### Response
```json
{
  "message": "Profile image updated successfully",
  "profileImage": "https://bucket.s3.region.amazonaws.com/profile-images/org/user-timestamp.jpg",
  "fullImageUrl": "https://bucket.s3.region.amazonaws.com/profile-images/org/user-timestamp.jpg"
}
```

## Error Handling

### Common Error Scenarios
1. **File Too Large**: Returns 400 with size limit message
2. **Invalid File Type**: Returns 400 for non-image files
3. **S3 Upload Failure**: Returns 500 with detailed error
4. **Old Image Deletion Failure**: Logs warning but continues processing

### Error Response Format
```json
{
  "message": "Error updating profile image",
  "error": "Detailed error message"
}
```

## Security Considerations

### File Validation
- **Type Checking**: Only image files allowed
- **Size Limits**: 5MB maximum file size
- **Content Validation**: Multer middleware validates file contents

### Access Control
- **Authentication Required**: All uploads require valid JWT token
- **User Isolation**: Users can only update their own profile images
- **Organization Isolation**: Images are stored in organization-specific folders

### S3 Security
- **Public Read Access**: Profile images are publicly readable (required for display)
- **Private Upload**: Only authenticated users can upload
- **No Public Write**: S3 bucket prevents public write access

## Performance Optimizations

### Image Optimization
- **File Size Limits**: 5MB limit prevents oversized uploads
- **Efficient Storage**: Memory storage for S3 uploads
- **CDN Benefits**: S3 provides global content delivery

### Database Optimization
- **Efficient Queries**: Profile images are indexed in User model
- **Minimal Storage**: Only S3 URLs stored in database
- **Fast Retrieval**: Direct S3 URLs for immediate access

## Monitoring and Maintenance

### Logging
- **Upload Logs**: Detailed logging of all profile image operations
- **Error Tracking**: Comprehensive error logging for troubleshooting
- **Performance Metrics**: Upload time and file size tracking

### Cleanup
- **Automatic Cleanup**: Old images are automatically deleted when replaced
- **Manual Cleanup**: Migration script can clean up local files
- **S3 Lifecycle**: Consider S3 lifecycle rules for long-term management

## Troubleshooting

### Common Issues

#### 1. S3 Upload Fails
- Check AWS credentials and permissions
- Verify S3 bucket exists and is accessible
- Check network connectivity to S3

#### 2. Images Not Displaying
- Verify S3 bucket policy allows public read
- Check CORS configuration if needed
- Ensure S3 URLs are correctly formatted

#### 3. Migration Issues
- Check local file paths and permissions
- Verify MongoDB connection
- Review migration logs for specific errors

### Debug Commands
```bash
# Test S3 connection
cd backend
node -e "const { uploadFile } = require('./src/utils/s3'); console.log('S3 utils loaded successfully')"

# Check environment variables
node -e "console.log('AWS_REGION:', process.env.AWS_REGION); console.log('AWS_S3_BUCKET:', process.env.AWS_S3_BUCKET)"
```

## Future Enhancements

### Potential Improvements
1. **Image Resizing**: Automatic thumbnail generation
2. **Format Conversion**: Convert to WebP for better compression
3. **CDN Integration**: CloudFront for global image delivery
4. **Image Optimization**: Automatic compression and optimization
5. **Backup Strategy**: Cross-region replication for disaster recovery

### Monitoring
1. **S3 Metrics**: Track storage usage and costs
2. **Performance Monitoring**: Upload/download times
3. **Error Tracking**: Failed uploads and their causes
4. **Usage Analytics**: Most accessed images and patterns

## Conclusion

The S3 profile image implementation provides a robust, scalable solution for profile image storage. The migration process is safe and can be run multiple times if needed. The existing frontend code continues to work without changes, providing a seamless user experience.

For questions or issues, refer to the logs and error messages, or run the migration script in dry-run mode to identify potential problems before the actual migration. 
 
 