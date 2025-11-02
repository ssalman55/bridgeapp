# WPS Feature Testing Guide

## ✅ **Integration Complete!**

The WPS (Wage Protection System) feature has been successfully integrated into the existing **Generate Payroll File** page. No new routes or menu items were needed - the feature is now part of the existing payroll workflow.

## 🎯 **How to Test the WPS Feature**

### Step 1: Access the Page
1. Login to your StaffBridge account as an **Admin**
2. Navigate to: **Payroll → Generate Payroll File** from the left menu

### Step 2: You Should Now See
Instead of just seeing "CSV, Excel, PDF" options, you'll now see:

#### **New Export Type Selection:**
- **Spreadsheet** (CSV, Excel, PDF formats) - The original functionality
- **WPS** (Wage Protection System compliance) - NEW!

### Step 3: Test Spreadsheet Export (Original Functionality)
1. Select **Month** and **Year**
2. Choose your **Organization**
3. Select **Export Type**: **Spreadsheet**
4. Choose **File Format**: CSV, Excel, or PDF
5. Click **Generate Payroll File**
6. Download the file as before

✅ This should work exactly as it did before!

### Step 4: Test WPS Export (NEW Feature)
1. Select **Month** and **Year**
2. Choose your **Organization**
3. Select **Export Type**: **WPS**
4. A **Country** dropdown will appear with options:
   - Qatar (QAR) - SIF
   - UAE (AED) - SIF
   - Saudi Arabia (SAR) - CSV
   - And more...
5. Select a **Country** (e.g., Qatar)
6. A **Bank Preset** dropdown will appear (if applicable for that country)
7. Select a bank preset or keep the default
8. Click **Generate Payroll File**

### Expected Behavior:

#### **If WPS Data Not Seeded Yet:**
You'll see: **"No WPS countries available"** or an empty dropdown

**Solution:** Run the seed script on the backend:
```bash
cd backend
node seed-wps-data.js
```

#### **If Data Validation Fails:**
You'll see detailed error messages like:
- "Invalid IBAN format for QA"
- "National ID is required"
- "Employee is not in active status"

Each error will include:
- Employee ID
- Field name
- Suggested fix

#### **If Generation Succeeds:**
You'll see:
- Success message
- Download button
- File information (name, size, expiry time)
- Warnings (if any staff were excluded)

## 🔍 **What's Different in the UI**

### Stats Cards (Top of Page)
- **Export Types**: Shows "2" (Spreadsheet & WPS)
- **WPS Countries**: Shows number of supported countries
- **Organizations**: Shows your organizations

### Instructions Section
Now shows:
- "Select export type (Spreadsheet or WPS)"
- Dynamic step 4 that changes based on selection
- Updated requirements mentioning WPS compliance

### Export Type Selection (NEW)
Two radio button cards:
- **Spreadsheet**: CSV, Excel, PDF formats
- **WPS**: Wage Protection System compliance

### Conditional Fields
- When **Spreadsheet** is selected → Shows format selection (CSV/Excel/PDF)
- When **WPS** is selected → Shows:
  - Country dropdown
  - Bank preset dropdown (for Saudi Arabia and others)
  - Output settings (packaging, encryption, retention)

## 📋 **Prerequisites for Testing**

### Backend Requirements:
1. ✅ New models deployed
2. ✅ New routes registered
3. ✅ Controllers deployed
4. ⚠️ **Seed data must be run**: `node backend/seed-wps-data.js`
5. ⚠️ **Organizations must be migrated**: `node backend/migrate-organizations-wps.js`

### Data Requirements:
For successful WPS file generation, ensure:
1. **Organization** has country set
2. **Employees** have:
   - National ID (QID for Qatar, Emirates ID for UAE, etc.)
   - Verified bank account details
   - IBAN in correct format
   - Active employment status
3. **Payroll data** exists for the selected period

## 🐛 **Troubleshooting**

### Problem: "No WPS countries available"
**Solution:** Run `node backend/seed-wps-data.js`

### Problem: "WPS export is not enabled for this organization"
**Solution:** Run `node backend/migrate-organizations-wps.js`

### Problem: Validation errors for all employees
**Check:**
- Do employees have national IDs?
- Are IBANs in the correct format?
- Are employees in "active" status?

### Problem: Backend errors
**Check logs for:**
- Database connection
- Model loading
- Route registration
- S3 configuration

## 📊 **Testing Checklist**

- [ ] Can access Generate Payroll File page
- [ ] See two export type options (Spreadsheet & WPS)
- [ ] Spreadsheet export works as before (CSV/Excel/PDF)
- [ ] WPS option shows country dropdown
- [ ] Can select Qatar, UAE, or Saudi Arabia
- [ ] Bank preset dropdown appears (for KSA)
- [ ] Validation errors are clear and actionable
- [ ] File generates successfully
- [ ] Download link works
- [ ] File format is correct (SIF for Qatar/UAE, CSV for KSA)

## 🎉 **Success Indicators**

You'll know it's working when:
1. ✅ Stats show "Export Types: 2" and "WPS Countries: 3+"
2. ✅ Export type selector shows Spreadsheet & WPS options
3. ✅ Selecting WPS shows country dropdown
4. ✅ Validation provides detailed, helpful error messages
5. ✅ Generated files can be downloaded
6. ✅ Files are in the correct format for the selected country

## 📞 **Need Help?**

If you encounter any issues:
1. Check browser console for errors
2. Check backend logs for API errors
3. Verify seed scripts were run
4. Ensure employee data has required fields
5. Test with different countries to isolate the issue

---

**Note:** The WPS feature is now seamlessly integrated into the existing workflow. Users don't need to learn a new page or menu - it's just an enhanced version of what they already use! 🚀








