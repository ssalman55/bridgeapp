# Super Admin Setup for Default Role Management

## Overview

This update allows super admins (organization owners) to edit and delete the default "Admin" and "Staff" roles that are automatically created for each organization. Previously, these roles were locked and could not be modified.

## What Changed

### Backend Changes
1. **User Model**: Added `isSuperAdmin` field to identify super admin users
2. **Role Controller**: Modified to allow super admins to edit/delete default roles
3. **Auth Controller**: Updated to mark the first admin user as super admin during registration
4. **New Endpoints**: Added endpoints to check super admin status and promote users

### Frontend Changes
1. **Role Management UI**: Updated to show edit/delete options for super admins
2. **Enhanced Warnings**: Added warnings when editing/deleting default roles
3. **Visual Indicators**: Shows "Editable" badge for default roles when user is super admin

## Setup Instructions

### Step 1: Run the Migration Script

The migration script will automatically identify and mark the first admin user in each organization as the super admin:

```bash
cd backend
npm run migrate-super-admin
```

This script will:
- Find all organizations
- Identify the first admin user in each organization (by creation date)
- Mark them as super admin (`isSuperAdmin: true`)
- Set all other users to not be super admin (`isSuperAdmin: false`)

### Step 2: Verify the Migration

After running the migration, you should see output like:
```
Super admin migration completed successfully!

Verification: Found 1 super admins:
  - admin@acsdoha.com (Admin User) in ACS Doha International School
```

### Step 3: Test the Functionality

1. **Login as the super admin** (the user who was marked as super admin)
2. **Navigate to Role Management** page
3. **You should now see**:
   - "System Role (Editable)" instead of just "System Role"
   - "Editable" badge next to default roles
   - Edit and Delete buttons for default roles
   - Warning messages when editing default roles

## How It Works

### Super Admin Detection
- The system automatically identifies the first admin user in each organization as the super admin
- This happens during user registration (for new organizations)
- For existing organizations, the migration script handles this

### Default Role Management
- **Super Admins can**:
  - Edit permissions for Admin and Staff roles
  - Delete Admin and Staff roles (with appropriate warnings)
  - Promote other admin users to super admin status

- **Regular Admins cannot**:
  - Edit or delete default roles
  - See edit/delete options for default roles

### Security Features
- Only super admins can modify default roles
- Clear warnings when performing significant actions
- Confirmation dialogs for deleting default roles
- Permission checks at both frontend and backend levels

## API Endpoints

### New Endpoints
- `GET /api/roles/super-admin-status` - Check if current user is super admin
- `POST /api/roles/promote-super-admin` - Promote a user to super admin (super admin only)

### Modified Endpoints
- `PUT /api/roles/:id` - Now allows super admins to edit default roles
- `DELETE /api/roles/:id` - Now allows super admins to delete default roles

## Troubleshooting

### If Default Roles Still Can't Be Edited
1. **Check if migration ran successfully**:
   ```bash
   npm run migrate-super-admin
   ```

2. **Verify super admin status**:
   - Check the browser console for any errors
   - Verify the user has `isSuperAdmin: true` in the database

3. **Check user permissions**:
   - Ensure the user has "Role Management" permissions
   - Verify the user is logged in as an admin

### If Migration Fails
1. **Check MongoDB connection**:
   - Ensure `MONGODB_URI` environment variable is set
   - Verify database connectivity

2. **Check user data**:
   - Ensure there are admin users in the organization
   - Verify the User model has the `isSuperAdmin` field

## Rollback (If Needed)

If you need to rollback these changes:

1. **Remove the `isSuperAdmin` field** from all users:
   ```javascript
   // In MongoDB shell or through Mongoose
   db.users.updateMany({}, { $unset: { isSuperAdmin: "" } })
   ```

2. **Revert the code changes** in:
   - `backend/src/models/User.js`
   - `backend/src/controllers/roleController.js`
   - `backend/src/controllers/authController.js`
   - `frontend/src/pages/RoleManagement.tsx`

## Benefits

1. **Flexibility**: Organizations can now customize default roles to match their specific needs
2. **Control**: Super admins have full control over role management
3. **Security**: Only designated super admins can make these critical changes
4. **Backward Compatibility**: Existing functionality remains unchanged for regular admins

## Future Enhancements

Potential future improvements:
1. **Role Templates**: Pre-defined role templates for common organizational structures
2. **Role Inheritance**: Allow roles to inherit permissions from other roles
3. **Audit Logging**: Track all role modifications for compliance purposes
4. **Bulk Role Management**: Manage multiple roles simultaneously









