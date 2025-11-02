# Geofencing & Attendance Integration Guide for Mobile App (Staff Users)

This document describes the geofencing and attendance logic as implemented in the web platform, with a focus on what needs to be implemented in the **mobile app for staff users**. It covers:
- How geofencing settings affect check-in/check-out
- How to interact with the backend APIs
- How to display check-in status and location context to the user

---

## 1. **Geofencing Settings (Admin Web Only, For Reference)**
- Admins can enable/disable geofencing and set whether users can check in outside the geofence.
- These settings are managed via the web interface and stored in the backend (`GeofenceSettings` model):
  - `isEnabled` (boolean): Is geofencing enforced?
  - `allowCheckInOutside` (boolean): If true, users can check in from anywhere, but the system logs if they were inside/outside the geofence.

**Mobile apps do NOT manage these settings, but must respect them.**

---

## 2. **Check-In/Check-Out Logic for Mobile App**

### **A. API Endpoints**
- **Check In:** `POST /api/attendance/checkin`
  - Payload: `{ latitude: number, longitude: number }`
- **Check Out:** `POST /api/attendance/checkout`

### **B. Geofencing Enforcement Logic**
- On check-in, the backend will:
  1. Read the current geofencing settings for the user's organization.
  2. If geofencing is **disabled** (`isEnabled: false`):
     - Check-in is always allowed.
     - `geofenceStatus` is set to `'not_applicable'`.
  3. If geofencing is **enabled** (`isEnabled: true`):
     - The backend checks if the user's location is within any defined geofence.
     - If `allowCheckInOutside: false`:
       - **User must be inside a geofence to check in.**
       - If not, the API returns a 403 error with a message like: `You must be at [Geofence Name] to check in.`
     - If `allowCheckInOutside: true`:
       - **User can check in from anywhere.**
       - The backend logs whether the user was inside (`geofenceStatus: 'inside'`) or outside (`geofenceStatus: 'outside'`) the geofence at check-in.

### **C. Mobile App Implementation Steps**
1. **Get User Location:**
   - Prompt for location permission and get current latitude/longitude.
2. **Send Check-In Request:**
   - POST to `/api/attendance/checkin` with `{ latitude, longitude }`.
3. **Handle API Response:**
   - If success: show confirmation and update UI.
   - If error (403): show the backend-provided error message (e.g., must be at geofence location).
4. **Check-Out:**
   - POST to `/api/attendance/checkout` (no location needed).

---

## 3. **Displaying Check-In Location Status**
- When showing the user's current check-in status (e.g., on Dashboard):
  - Fetch `/api/attendance/status` (GET)
  - The response includes `geofenceStatus`:
    - `'inside'`: Checked In (Geofence Location)
    - `'outside'`: Checked In (Remotely)
    - `'not_applicable'` or `null`: Checked In (Location Not Tracked)
- Display this status clearly to the user.

---

## 4. **Backend Response Fields (for Mobile App)**
- **Check-In/Status API responses include:**
  - `isCheckedIn` (boolean)
  - `isCheckedOut` (boolean)
  - `lastCheckIn` (datetime)
  - `lastCheckOut` (datetime)
  - `geofenceStatus` (`'inside' | 'outside' | 'not_applicable' | null`)

---

## 5. **Summary Table: Mobile App Behaviors**
| Geofencing Enabled | Allow Check-In Outside | User Location | Can Check In? | geofenceStatus | UI Message                |
|--------------------|-----------------------|---------------|---------------|----------------|--------------------------|
| false              | n/a                   | anywhere      | Yes           | not_applicable | Checked In               |
| true               | false                 | inside        | Yes           | inside         | Checked In (Geofence)    |
| true               | false                 | outside       | No            | n/a            | Must be at location      |
| true               | true                  | inside        | Yes           | inside         | Checked In (Geofence)    |
| true               | true                  | outside       | Yes           | outside        | Checked In (Remotely)    |

---

## 6. **Notes for Mobile Developers**
- Always use the backend's error messages for user feedback.
- Do not hardcode geofence logic; always rely on backend enforcement and status fields.
- No admin geofence management is needed in the mobile app.
- If you need to display a list of geofences (for info), use `/api/geofences` (GET).

---

## 7. **References (Web Implementation)**
- Geofence settings are managed by admins on the web and stored in the backend.
- The mobile app only needs to:
  - Get user location
  - Call check-in/check-out APIs
  - Display check-in status and location context

---

For any questions, contact the backend/web team or refer to the web implementation for details. 