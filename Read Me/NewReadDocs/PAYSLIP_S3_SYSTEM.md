# Payslip S3 Storage System

## Overview

The StaffBridge payslip system has been updated to use Amazon S3 for secure, permanent storage of payslip PDFs. This eliminates duplicate generation and ensures consistent data across all payslip downloads.

## Key Features

### 🔐 **Security**
- **Signed URLs**: All payslip downloads use time-limited signed URLs (5 minutes expiry)
- **Access Control**: Users can only access their own payslips (staff) or all payslips (admin/owner)
- **S3 Bucket Security**: Files stored in private S3 bucket with proper IAM policies

### 📁 **File Organization**
- **Unique Filenames**: `payslips/{userId}/{yyyy-mm}.pdf`
- **No Duplicates**: Each payslip is generated once and stored permanently
- **Traceable**: Easy to identify which payslip belongs to which user and period

### ⚡ **Performance**
- **No Real-time Generation**: Payslips are pre-generated and served from S3
- **Fast Downloads**: Direct S3 access with signed URLs
- **Reduced Server Load**: No PDF generation on each request

## Implementation Details

### Backend Changes

#### 1. **Payslip Generation Functions**
```javascript
// Helper function to generate PDF buffer
const generatePayslipPDFBuffer = async (payroll) => {
  // Generates PDF using PDFKit with all styling and layout
  // Returns Buffer for S3 upload
};

// Helper function to store payslip in S3
const generateAndStorePayslip = async (payroll) => {
  const s3Key = `payslips/${userId}/${payPeriod}.pdf`;
  const pdfBuffer = await generatePayslipPDFBuffer(payroll);
  await uploadFile({ buffer: pdfBuffer, mimetype: 'application/pdf' }, s3Key);
  return s3Key;
};
```

#### 2. **Automatic Generation Trigger**
```javascript
// In markAsPaid function
exports.markAsPaid = async (req, res) => {
  // ... update payment status
  
  // Generate payslip when marked as paid
  try {
    await generateAndStorePayslip(payroll);
    console.log(`Payslip generated for ${payroll.payPeriod}`);
  } catch (error) {
    console.error('Payslip generation failed:', error);
    // Don't fail the entire operation
  }
};
```

#### 3. **S3-Served Downloads**
```javascript
// Updated getPayslipPDF function
exports.getPayslipPDF = async (req, res) => {
  // Security check
  if (req.user.role !== 'admin' && payroll.staff._id !== req.user._id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  const s3Key = `payslips/${userId}/${payPeriod}.pdf`;
  
  try {
    // Try to get signed URL for existing payslip
    const signedUrl = getSignedUrl(s3Key, 300);
    res.json({ signedUrl, message: 'Payslip available' });
  } catch (error) {
    // Fallback: generate on-demand if missing
    if (payroll.paymentStatus === 'Paid') {
      await generateAndStorePayslip(payroll);
      const signedUrl = getSignedUrl(s3Key, 300);
      res.json({ signedUrl, message: 'Payslip generated' });
    }
  }
};
```

### Frontend Changes

#### 1. **My Payroll Page (Staff View)**
```javascript
const handleDownloadPayslip = async (id: string) => {
  try {
    const res = await api.get(`/payroll/${id}/payslip/pdf`);
    
    if (res.data?.signedUrl) {
      // Open signed URL in new tab
      window.open(res.data.signedUrl, '_blank');
    } else {
      setError('Failed to get download link');
    }
  } catch (err) {
    setError(err.response?.data?.error || 'Download failed');
  }
};
```

#### 2. **Payroll Management Page (Admin View)**
- Same implementation as staff view
- Admin can access all payslips
- Uses same signed URL approach

## Migration Process

### For Existing Paid Payrolls

Run the migration script to generate payslips for existing paid payrolls:

```bash
cd backend
npm run generate-payslips
```

This script will:
1. Find all payrolls with `paymentStatus: 'Paid'`
2. Generate and store payslips in S3
3. Provide a summary of successful/failed generations

### Migration Script Details
```javascript
// scripts/generate-existing-payslips.js
const generateExistingPayslips = async () => {
  const paidPayrolls = await Payroll.find({ paymentStatus: 'Paid' });
  
  for (const payroll of paidPayrolls) {
    try {
      await generateAndStorePayslip(payroll);
      console.log(`✅ Generated: ${payroll.staff.fullName} - ${payroll.payPeriod}`);
    } catch (error) {
      console.error(`❌ Failed: ${payroll.staff.fullName} - ${payroll.payPeriod}`);
    }
  }
};
```

## File Structure

### S3 Bucket Organization
```
payslips/
├── {userId1}/
│   ├── 2025-01.pdf
│   ├── 2025-02.pdf
│   └── 2025-03.pdf
├── {userId2}/
│   ├── 2025-01.pdf
│   └── 2025-02.pdf
└── ...
```

### Backend File Structure
```
backend/
├── src/
│   ├── controllers/
│   │   └── payrollController.js (updated)
│   ├── utils/
│   │   └── s3.js (existing)
│   └── models/
│       └── Payroll.js (existing)
├── scripts/
│   └── generate-existing-payslips.js (new)
└── package.json (updated scripts)
```

## Security Considerations

### 1. **Access Control**
- **Staff**: Can only access their own payslips
- **Admin/Owner**: Can access all payslips
- **Role-based checks** in backend before generating signed URLs

### 2. **Signed URL Security**
- **5-minute expiry**: URLs expire quickly to prevent unauthorized access
- **Unique per request**: Each download gets a new signed URL
- **S3 bucket policies**: Ensure bucket is private and secure

### 3. **Data Integrity**
- **Payment status check**: Only generate payslips for "Paid" status
- **Fallback generation**: Regenerate if file missing from S3
- **Error handling**: Graceful degradation if S3 operations fail

## Error Handling

### 1. **S3 Errors**
```javascript
try {
  const signedUrl = getSignedUrl(s3Key, 300);
  res.json({ signedUrl });
} catch (s3Error) {
  // Fallback: generate on-demand
  if (payroll.paymentStatus === 'Paid') {
    await generateAndStorePayslip(payroll);
    const signedUrl = getSignedUrl(s3Key, 300);
    res.json({ signedUrl });
  }
}
```

### 2. **Generation Errors**
```javascript
// In markAsPaid function
try {
  await generateAndStorePayslip(payroll);
} catch (payslipError) {
  console.error('Payslip generation failed:', payslipError);
  // Don't fail the entire payment operation
}
```

### 3. **Frontend Error Handling**
```javascript
try {
  const res = await api.get(`/payroll/${id}/payslip/pdf`);
  if (res.data?.signedUrl) {
    window.open(res.data.signedUrl, '_blank');
  } else {
    setError('Failed to get download link');
  }
} catch (err) {
  setError(err.response?.data?.error || 'Download failed');
}
```

## Monitoring and Logging

### 1. **Generation Logs**
```javascript
console.log(`Payslip generated for payroll ${payroll._id} (${payroll.payPeriod})`);
console.log(`Payslip stored: ${s3Key}`);
```

### 2. **Error Logs**
```javascript
console.error('Error generating payslip:', error);
console.error('Error serving payslip:', error);
```

### 3. **Access Logs**
```javascript
console.log(`Payslip accessed by ${req.user.role} for ${payroll.staff.fullName}`);
```

## Benefits

### 1. **Performance**
- ✅ **Faster downloads**: No PDF generation on each request
- ✅ **Reduced server load**: S3 handles file serving
- ✅ **Better scalability**: Can handle more concurrent users

### 2. **Data Consistency**
- ✅ **No duplicate data**: Each payslip generated once
- ✅ **Accurate information**: Uses data from payment time
- ✅ **Consistent formatting**: Same layout for all payslips

### 3. **Security**
- ✅ **Secure access**: Signed URLs with expiry
- ✅ **Access control**: Role-based permissions
- ✅ **Audit trail**: S3 access logs for monitoring

### 4. **Reliability**
- ✅ **Fallback generation**: Regenerate if missing
- ✅ **Error handling**: Graceful degradation
- ✅ **Permanent storage**: No data loss

## Future Enhancements

### 1. **Batch Operations**
- Generate payslips for multiple staff at once
- Bulk download functionality for admins

### 2. **Caching**
- Cache frequently accessed payslips
- CDN integration for global access

### 3. **Analytics**
- Track payslip download patterns
- Usage analytics and reporting

### 4. **Notifications**
- Email notifications when payslips are ready
- Push notifications for mobile app

## Troubleshooting

### Common Issues

#### 1. **Payslip Not Found**
- Check if payment status is "Paid"
- Verify S3 bucket permissions
- Run migration script for existing payrolls

#### 2. **Access Denied**
- Verify user role and permissions
- Check if user is accessing their own payslip
- Ensure proper authentication

#### 3. **Generation Failed**
- Check S3 credentials and bucket configuration
- Verify PDF generation dependencies
- Check server logs for specific errors

#### 4. **Signed URL Expired**
- URLs expire after 5 minutes
- Generate new URL by refreshing the page
- Implement retry logic in frontend

### Debug Commands

```bash
# Check S3 bucket access
aws s3 ls s3://your-bucket-name/payslips/

# Generate payslips for existing data
npm run generate-payslips

# Check server logs
tail -f logs/app.log
```

## Conclusion

The new payslip S3 system provides a robust, secure, and scalable solution for payslip management. It eliminates data inconsistencies, improves performance, and ensures proper access control while maintaining backward compatibility and providing fallback mechanisms for reliability. 