# 🧪 Onboarding Module - Complete Test Checklist

## 📋 **Pre-Test Setup**
- [ ] Backend and frontend are deployed with latest changes
- [ ] Clear browser cache and cookies
- [ ] Login as admin user
- [ ] Navigate to Onboarding module

---

## 🎯 **Test 1: Template Management**

### **Create Template**
- [ ] Go to **Onboarding → Manage Templates**
- [ ] Click **"+ New Template"**
- [ ] Fill template details:
  - [ ] Name: "Test Teacher Template"
  - [ ] Department: "Teachers"
  - [ ] Description: "Test template for verification"
- [ ] Add tasks:
  - [ ] **Task 1:** "Contact Information" (Type: HR Task, Owner: New Hire)
  - [ ] **Task 2:** "Upload Documents" (Type: HR Task, Owner: New Hire)
  - [ ] **Task 3:** "IT Setup" (Type: IT Provisioning, Owner: IT Team)
- [ ] Save template
- [ ] Verify template appears in list

---

## 🎯 **Test 2: Pipeline Creation**

### **Create New Onboarding**
- [ ] Go to **Onboarding → New Onboarding**
- [ ] Fill new hire details:
  - [ ] First Name: "Test"
  - [ ] Last Name: "User"
  - [ ] Email: "test.user@example.com"
  - [ ] Phone: "1234567890"
  - [ ] Position: "Teacher"
  - [ ] Department: "Teachers"
  - [ ] Start Date: Tomorrow's date
- [ ] Select the template created in Test 1
- [ ] Submit onboarding
- [ ] Verify pipeline is created
- [ ] Check that email is sent to new hire

---

## 🎯 **Test 3: Task List Display**

### **Verify Task List Shows Correct Names**
- [ ] Go to **Onboarding → Manage Tasks**
- [ ] Verify tasks show: **"New Hire: Test User • Teacher"** (NOT "Unknown")
- [ ] Check task details:
  - [ ] Contact Information task shows correct new hire name
  - [ ] Upload Documents task shows correct new hire name
  - [ ] IT Setup task shows correct assignee
- [ ] Verify task statuses are "Pending"

---

## 🎯 **Test 4: Preboarding Portal (New Hire Experience)**

### **Access Preboarding Portal**
- [ ] Check email sent to test.user@example.com
- [ ] Click preboarding link in email
- [ ] Verify portal loads correctly
- [ ] Check progress shows 0%

### **Complete Contact Information Task**
- [ ] Click **"Start"** on Contact Information task
- [ ] Fill out contact form:
  - [ ] Phone: "9876543210"
  - [ ] Address: "123 Test Street, Test City"
  - [ ] Emergency Contact: Name: "Emergency Person", Phone: "1111111111", Relationship: "Spouse"
  - [ ] Bank Details: Account: "123456789", Bank: "Test Bank", Routing: "987654321"
  - [ ] Tax Information: SSN: "123456789", Tax ID: "987654321"
- [ ] Submit form
- [ ] Verify task status changes to "Completed"
- [ ] Check progress updates to 33%

### **Complete Document Upload Task**
- [ ] Click **"Start"** on Upload Documents task
- [ ] Upload a test PDF file
- [ ] Verify file appears in "Already Uploaded Files" section
- [ ] Click **"Mark Complete"** button
- [ ] Verify task status changes to "Completed"
- [ ] Check progress updates to 67%

---

## 🎯 **Test 5: Admin View - Task Details**

### **View Submitted Contact Information**
- [ ] Go back to **Onboarding → Manage Tasks**
- [ ] Click **eye icon** on Contact Information task
- [ ] Verify task details modal opens
- [ ] Check **"Details" tab** shows:
  - [ ] **"New Hire: Test User • Teacher"** (NOT "Unknown")
  - [ ] Task status: "Completed"
  - [ ] Started At: Shows timestamp
  - [ ] Completed At: Shows timestamp
- [ ] Scroll down to **"Submitted Information"** section
- [ ] Verify data is **properly formatted** (NOT raw JSON):
  - [ ] **Phone:** 9876543210
  - [ ] **Address:** 123 Test Street, Test City
  - [ ] **Emergency Contact:**
    - [ ] **Name:** Emergency Person
    - [ ] **Phone:** 1111111111
    - [ ] **Relationship:** Spouse
  - [ ] **Bank Details:**
    - [ ] **Account:** 123456789
    - [ ] **Bank:** Test Bank
    - [ ] **Routing:** 987654321
  - [ ] **Tax Information:**
    - [ ] **SSN:** 123456789
    - [ ] **Tax ID:** 987654321

### **View Uploaded Documents**
- [ ] Click **"Files" tab** in task details modal
- [ ] Verify uploaded file appears in list
- [ ] Check file shows:
  - [ ] File name
  - [ ] File size
  - [ ] "Uploaded by Test User"
- [ ] Click **download icon** (blue arrow)
- [ ] Verify file downloads successfully (NOT "Access Denied")
- [ ] Close modal

---

## 🎯 **Test 6: File Download Functionality**

### **Test Download from Different Tasks**
- [ ] Click **eye icon** on Upload Documents task
- [ ] Go to **"Files" tab**
- [ ] Click **download icon** on uploaded file
- [ ] Verify file downloads without errors
- [ ] Check downloaded file opens correctly
- [ ] Close modal

---

## 🎯 **Test 7: Pipeline Overview**

### **Check Pipeline Status**
- [ ] Go to **Onboarding → Pipelines**
- [ ] Find "Test User" pipeline
- [ ] Verify pipeline shows:
  - [ ] **New Hire:** Test User (NOT "Unknown")
  - [ ] **Position:** Teacher
  - [ ] **Stage:** Appropriate stage
  - [ ] **Progress:** Shows completion percentage

---

## 🎯 **Test 8: Edge Cases**

### **Test Multiple File Uploads**
- [ ] Go back to preboarding portal
- [ ] Click **"Start"** on Upload Documents task again
- [ ] Upload 2-3 additional files
- [ ] Verify all files appear in list
- [ ] Click **"Mark Complete"**
- [ ] Go back to admin view
- [ ] Verify all files are visible and downloadable

### **Test Task Reassignment**
- [ ] Go to **Onboarding → Manage Tasks**
- [ ] Find IT Setup task
- [ ] Click **three dots** → **"Assign"**
- [ ] Assign to different user
- [ ] Verify assignment updates correctly

---

## ✅ **Success Criteria**

### **All Tests Must Pass:**
- [ ] ✅ **No "Unknown" names** anywhere in the system
- [ ] ✅ **Contact form data** displays in readable format (not JSON)
- [ ] ✅ **File downloads** work without "Access Denied" errors
- [ ] ✅ **Task completion** workflow works end-to-end
- [ ] ✅ **Progress tracking** updates correctly
- [ ] ✅ **Admin can view** all submitted data properly

---

## 🚨 **If Any Test Fails:**

1. **"Unknown" names still showing:**
   - Check backend deployment
   - Verify nested population is working
   - Check browser cache

2. **Contact form data shows as JSON:**
   - Check frontend deployment
   - Verify TaskDetailsModal updates
   - Check browser cache

3. **File downloads fail:**
   - Check S3 configuration
   - Verify signed URL generation
   - Check backend logs for errors

4. **Tasks not completing:**
   - Check preboarding portal functionality
   - Verify form submission
   - Check backend API responses

---

## 📊 **Final Verification**

- [ ] **Complete workflow** from template creation to task completion works
- [ ] **All data** is properly stored and displayed
- [ ] **No errors** in browser console
- [ ] **No errors** in backend logs
- [ ] **User experience** is smooth and intuitive

**🎉 If all tests pass, the onboarding module is 100% functional!**





