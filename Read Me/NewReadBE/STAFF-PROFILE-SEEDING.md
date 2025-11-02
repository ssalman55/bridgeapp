# Staff Profile Seeding Script

This script creates comprehensive mock profile data for all staff members in your StaffBridge system, including banking information with Qatar IBAN numbers.

## Features

- **Complete Profile Data**: Personal info, work experience, education, medical history
- **Banking Information**: Qatar IBAN numbers for all staff members
- **Realistic Data**: Uses Qatari names, local banks, and regional institutions
- **Smart Updates**: Updates existing profiles or creates new ones
- **Multi-Organization Support**: Works across all organizations in your system

## What Gets Seeded

### Personal Information
- Date of birth (18-65 years old)
- Gender, nationality, marital status
- Emergency contact details

### Work Experience
- 1-4 previous job experiences
- Realistic company names (Qatar Petroleum, Qatar Airways, etc.)
- Professional designations
- Job responsibilities

### Education
- 1-3 education records
- Degrees from local and international universities
- Graduation years

### Medical Information
- Pre-existing conditions
- Allergies
- Insurance providers

### Family Information
- 0-3 children with names and schools
- School names from Qatar

### Professional Development
- Professional certifications (PMP, ITIL, etc.)
- Professional memberships
- Industry associations

### Banking Information
- **Qatar IBAN numbers** (QA + check digits + bank code + account)
- Realistic bank names (QNB, Commercial Bank, Doha Bank, etc.)

## Usage

### Prerequisites
1. Make sure your MongoDB database is running
2. Ensure you have staff members in your system
3. Set up your environment variables (MONGODB_URI)

### Running the Script

```bash
# Navigate to the backend directory
cd backend

# Run the seeding script
node run-seed-profiles.js
```

### Alternative Method

```bash
# Run the main seeding file directly
node seed-staff-profiles.js
```

## Sample Output

```
🚀 Starting Staff Profile Seeding Script...
📋 This will create/update mock profile data for all staff members
💳 Including banking information with Qatar IBAN numbers

🌱 Starting staff profile seeding...
✅ Connected to MongoDB
📊 Found 1 organization(s)

🏢 Processing organization: ACS Doha (507f1f77bcf86cd799439011)
👥 Found 62 staff members

🆕 Creating new profile for Ahmed Al-Thani...
🆕 Creating new profile for Fatima Al-Mahmoud...
📝 Updating existing profile for Salman Ahmad...
...

🎉 Seeding completed!
📊 Summary:
   • Profiles created: 45
   • Profiles updated: 17
   • Total processed: 62
```

## Sample IBAN Numbers Generated

The script generates realistic Qatar IBAN numbers in the format:
- `QA123456789012345678901234567890`
- `QA987654321098765432109876543210`

These follow the Qatar IBAN structure:
- **QA**: Country code
- **12**: Check digits
- **3456**: Bank code
- **7890**: Branch code
- **1234567890123456**: Account number

## Data Quality

- **Realistic Names**: Uses authentic Qatari and regional names
- **Local Context**: Banks, universities, and companies from Qatar
- **Proper Relationships**: Emergency contacts with appropriate relationships
- **Varied Data**: Different completion percentages, experience levels, etc.
- **No Duplicates**: Removes duplicate certifications and memberships

## Safety Features

- **Non-Destructive**: Updates existing profiles instead of deleting them
- **Error Handling**: Continues processing even if individual profiles fail
- **Validation**: Ensures data integrity and proper relationships
- **Logging**: Detailed progress reporting

## Customization

You can modify the mock data arrays in `seed-staff-profiles.js` to:
- Add more names, companies, or institutions
- Customize the data generation logic
- Adjust the completion percentage calculation
- Add more fields or data types

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Check your MONGODB_URI environment variable
   - Ensure MongoDB is running

2. **No Organizations Found**
   - Create an organization first through the admin panel
   - Ensure you have staff members in the system

3. **Permission Errors**
   - Ensure the script has write access to the database
   - Check your MongoDB user permissions

### Getting Help

If you encounter issues:
1. Check the console output for specific error messages
2. Verify your database connection
3. Ensure all required models are properly set up
4. Check that staff members exist in your system

## Next Steps

After running the script:
1. Check the Staff Profiles page in your admin panel
2. Verify that profile completion percentages are showing
3. Test the profile viewing functionality
4. Ensure banking information is properly displayed

The seeded data will make your Staff Profiles section fully functional for testing and demonstration purposes.




