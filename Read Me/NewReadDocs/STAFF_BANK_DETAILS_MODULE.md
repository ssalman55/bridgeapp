# Staff Bank Details Module

## Overview

The Staff Bank Details Module is a comprehensive solution for securely collecting, storing, and managing staff IBAN and bank account details with full integration into the existing payroll system. This module supports multi-tenant architecture and follows industry best practices for security, UI/UX, and Role-Based Access Control (RBAC).

## Features

### 🔐 Security Features
- **AES-256 Encryption**: All sensitive fields (IBAN, account number) are encrypted at rest
- **IBAN Validation**: Real-time validation using regex patterns for common IBAN formats
- **Masked Display**: IBANs are masked in UI (showing only last 4 digits) for non-admin users
- **Tenant Isolation**: All data is scoped by `organization_id` for multi-tenant security
- **Audit Trail**: Complete audit logging for all create, update, delete, and verification actions

### 👥 User Management
- **Staff Self-Service**: Staff can add/edit their own bank details through their profile
- **Admin Management**: Admins can view, edit, verify, and manage all staff bank details
- **RBAC Integration**: Full integration with existing role-based permissions system
- **Status Management**: Three status levels: pending_verification, active, rejected

### 💰 Payroll Integration
- **Automatic Integration**: Bank details are automatically included in payroll generation
- **Payment Method Selection**: System automatically selects Bank Transfer if verified bank details exist
- **Export Functionality**: CSV export for payroll processing with full bank details

### 📊 Admin Features
- **Comprehensive Dashboard**: Table view with search, filters, and pagination
- **Bulk Operations**: Export functionality for payroll processing
- **Verification Workflow**: Admin verification with notes and status updates
- **Notifications**: Automatic notifications for staff and admins on status changes

## Database Schema

### StaffBankDetails Model

```javascript
{
  _id: ObjectId,
  organization_id: ObjectId,     // Multi-tenant isolation
  staff_id: ObjectId,            // Linked to staff user
  account_holder_name: String,   // Required
  bank_name: String,             // Required
  IBAN: String,                  // Required, encrypted
  SWIFT_code: String,            // Optional
  account_number: String,        // Optional, encrypted
  currency: String,              // Default: "QAR"
  status: String,                // Enum: ["pending_verification", "active", "rejected"]
  verification_notes: String,    // Admin notes for verification
  verified_by: ObjectId,         // Admin who verified
  verified_at: Date,             // Verification timestamp
  created_at: Date,
  updated_at: Date
}
```

### Indexes
- `{ staff_id: 1, organization_id: 1 }` - Unique constraint per staff per organization
- `{ organization_id: 1, status: 1 }` - Efficient filtering
- `{ staff_id: 1 }` - Staff-specific queries

## API Endpoints

### Staff Endpoints
- `POST /api/bank-details` - Create or update bank details
- `GET /api/bank-details/staff/me` - Get own bank details

### Admin Endpoints
- `GET /api/bank-details` - Get all bank details with filters and pagination
- `GET /api/bank-details/staff/:staff_id` - Get specific staff bank details
- `PUT /api/bank-details/:id/verify` - Verify/reject bank details
- `DELETE /api/bank-details/:id` - Delete bank details
- `GET /api/bank-details/export` - Export for payroll processing

## Frontend Implementation

### Admin Bank Details Management Page
**Location**: `/admin/payroll/bank-details`

**Features**:
- Table view with columns: Staff, Account Holder, Bank, IBAN (masked), Currency, Status, Actions
- Search by staff name, IBAN, or bank name
- Filter by status (pending_verification, active, rejected)
- Pagination support
- Actions: View, Edit, Verify, Delete
- Export to CSV functionality

### Staff Bank Details Form
**Location**: `/my-profile` (integrated as a section)

**Features**:
- Form for entering/editing bank details
- Real-time IBAN validation and formatting
- Status display with verification notes
- Edit mode for updating details
- Secure account number field with show/hide toggle

## Security Implementation

### Encryption
```javascript
// AES-256-CBC encryption for sensitive fields
const ENCRYPTION_KEY = process.env.BANK_DETAILS_SECRET || 'changemechangemechangeme12';
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}
```

### IBAN Validation
```javascript
// IBAN validation regex for common formats
const IBAN_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/;

// Pre-save validation
staffBankDetailsSchema.pre('save', function(next) {
  if (this.isModified('IBAN') && this.IBAN) {
    const cleanIBAN = this.IBAN.replace(/\s/g, '').toUpperCase();
    if (!IBAN_REGEX.test(cleanIBAN)) {
      return next(new Error('Invalid IBAN format'));
    }
  }
  next();
});
```

### RBAC Integration
```javascript
// Route protection with permissions
router.get('/', authenticateToken, permissions('Payroll', 'view', 'Salary Management'), bankDetailsController.getBankDetails);
router.put('/:id/verify', authenticateToken, permissions('Payroll', 'full', 'Salary Management'), bankDetailsController.verifyBankDetails);
```

## Payroll Integration

### Automatic Bank Details Inclusion
When generating payroll, the system automatically:
1. Fetches active bank details for each staff member
2. Includes bank details in the payroll record
3. Sets payment method to "Bank Transfer" if bank details are verified
4. Falls back to "Cash" if no verified bank details exist

```javascript
// In payroll generation
const bankDetails = await StaffBankDetails.findOne({
  staff_id: structure.staff._id,
  organization_id: req.user.organization._id || req.user.organization,
  status: 'active'
});

const payroll = await Payroll.create({
  // ... other fields
  paymentMethod: bankDetails ? 'Bank Transfer' : 'Cash',
  bankDetails: bankDetails ? {
    bankName: bankDetails.bank_name,
    accountNumber: bankDetails.account_number,
    accountHolderName: bankDetails.account_holder_name,
    IBAN: bankDetails.IBAN,
    SWIFT_code: bankDetails.SWIFT_code,
    currency: bankDetails.currency
  } : {},
});
```

## Notifications & Audit Trail

### Notifications
- Staff notification when bank details are verified/rejected
- Admin notification when staff updates bank details
- Email notifications for status changes

### Audit Trail
All actions are logged in the PayrollAuditLog:
- Create bank details
- Update bank details
- Verify bank details
- Reject bank details
- Delete bank details

## Environment Variables

```bash
# Required for encryption (32 characters)
BANK_DETAILS_SECRET=your-secure-encryption-key-here

# Optional: Override default encryption key
# If not set, uses fallback key (not recommended for production)
```

## Testing

### Backend Testing
Run the test script to verify functionality:
```bash
cd backend
node test-bank-details.js
```

### Manual Testing Checklist
- [ ] Staff can add bank details through profile
- [ ] IBAN validation works correctly
- [ ] Admin can view all bank details
- [ ] Admin can verify/reject bank details
- [ ] Notifications are sent on status changes
- [ ] Payroll generation includes bank details
- [ ] Export functionality works
- [ ] RBAC permissions are enforced

## Deployment

### Backend Deployment
1. Set `BANK_DETAILS_SECRET` environment variable
2. Deploy updated backend code
3. Verify database indexes are created
4. Test API endpoints

### Frontend Deployment
1. Deploy updated frontend code
2. Verify admin sidebar includes "Bank Details" menu item
3. Test staff profile bank details form
4. Verify admin bank details management page

## Security Considerations

### Production Checklist
- [ ] Set strong `BANK_DETAILS_SECRET` environment variable
- [ ] Enable HTTPS for all API calls
- [ ] Implement rate limiting on bank details endpoints
- [ ] Regular security audits of encryption implementation
- [ ] Monitor audit logs for suspicious activity
- [ ] Implement data retention policies

### Compliance
- GDPR compliance for personal data handling
- PCI DSS considerations for financial data
- Local banking regulations compliance
- Data protection and privacy laws

## Troubleshooting

### Common Issues

1. **IBAN Validation Errors**
   - Check IBAN format matches supported patterns
   - Ensure IBAN is not too long or too short
   - Verify country code is supported

2. **Encryption Errors**
   - Verify `BANK_DETAILS_SECRET` is set correctly
   - Check encryption key length (32 characters)
   - Ensure consistent encryption key across deployments

3. **Permission Errors**
   - Verify user has correct role permissions
   - Check RBAC configuration
   - Ensure organization context is correct

4. **Payroll Integration Issues**
   - Verify bank details status is "active"
   - Check organization_id matches
   - Ensure staff_id is correct

## Future Enhancements

### Planned Features
- **Multi-Currency Support**: Enhanced currency handling
- **Bank API Integration**: Direct bank verification
- **Bulk Import**: CSV import for bank details
- **Advanced Validation**: Country-specific IBAN validation
- **Mobile App Support**: Bank details management in mobile app

### Technical Improvements
- **Performance Optimization**: Database query optimization
- **Caching**: Redis caching for frequently accessed data
- **Monitoring**: Enhanced logging and monitoring
- **Backup**: Automated backup of encrypted data

## Support

For technical support or questions about the Staff Bank Details Module:
- Check the audit logs for detailed error information
- Review the API documentation
- Contact the development team for assistance

---

**Version**: 1.0.0  
**Last Updated**: January 2025  
**Compatibility**: StaffBridge v2.0+ 