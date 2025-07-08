# StaffBridge Mobile Client

## Project Overview

StaffBridge Mobile Client is a modern, full-featured mobile application for Android and iOS platforms. Its primary objective is to mirror all functionalities available in the staff interface of the StaffBridge system, providing staff users with a seamless, elegant, and responsive experience on their mobile devices.

---

## Table of Contents
1. Project Overview
2. Frontend (Mobile App) Details
3. Backend Details
4. Code References
5. Development and Deployment
6. Testing and Debugging
7. Additional Information

---

## 1. Project Overview
- **Objective:** Build a cross-platform mobile app (Android/iOS) that replicates all staff-side features of StaffBridge.
- **Scope:** All staff functionalities (attendance, leave, payroll, bulletins, documents, training, performance, etc.)
- **Tech Stack:**
  - **Frontend:** React Native (recommended), Expo, or Flutter (alternative)
  - **Backend:** Node.js/Express (existing), MongoDB

---

## 2. Frontend (Mobile App) Details

### UI/UX Features
- Clean, modern design inspired by the existing StaffBridge web interface
- Responsive layouts for all device sizes
- Navigation drawer or bottom tab navigation for main sections:
  - Dashboard
  - Attendance
  - Leave Management
  - Payroll
  - Bulletins
  - Documents
  - Training Requests
  - Performance Evaluations
  - Notifications
  - Profile & Settings
- Consistent theming (colors, fonts, icons) matching StaffBridge branding
- Smooth transitions and animations
- Toasts/snackbars for feedback (success, error, permission denied)
- Accessibility best practices

### Design & Navigation Guidelines
- Use React Navigation (or Flutter's Navigator) for stack/tab navigation
- Follow platform-specific UI conventions (Material Design for Android, Cupertino for iOS)
- Use context or Redux for global state (auth, user, permissions)
- Modularize UI into reusable components (e.g., Card, List, Modal, Button)

### Required Frameworks/Libraries
- React Native (with Expo for rapid development)
- react-navigation
- axios or fetch for API calls
- Context API or Redux for state management
- react-native-paper or native-base for UI components
- react-native-vector-icons for icons
- AsyncStorage or SecureStore for token storage

### Frontend-Backend Integration
- All data is fetched via RESTful API calls to the existing StaffBridge backend
- JWT-based authentication (token stored securely on device)
- API error handling and user feedback
- State management for user session, permissions, and data caching
- File/document downloads via secure, presigned S3 URLs

---

## 3. Backend Details

### Key Components
- **API Endpoints:**
  - `/api/auth` (login, profile, permissions)
  - `/api/attendance` (mark, view, report)
  - `/api/leave` (request, status, history)
  - `/api/payroll` (view payslips, summaries)
  - `/api/bulletin` (list, details)
  - `/api/documents` (list, upload, download)
  - `/api/training-requests` (submit, view, status)
  - `/api/performance-evaluations` (view, submit reflections)
  - `/api/notifications` (list, mark as read)
- **HTTP Methods:**
  - `GET` for fetching data
  - `POST` for creating new records (requests, uploads)
  - `PUT/PATCH` for updates
  - `DELETE` for removals (where allowed)
- **Authentication:**
  - JWT tokens (sent via Authorization header)
  - Middleware for auth and role/permission checks
- **Database:**
  - MongoDB (Mongoose models: Staff, Attendance, LeaveRequest, Document, etc.)
  - Connection string via environment variable (`MONGODB_URI`)
- **Critical Services:**
  - Amazon S3 for document storage (presigned URLs for secure download)
  - Email notifications (via backend services)
  - Role-based access control (RBAC) enforced in middleware and controllers

---

## 4. Code References

### Backend
- **API Route Definitions:** `backend/src/routes/`
- **Controllers:** `backend/src/controllers/`
- **Models (Database Schemas):** `backend/src/models/`
- **Middleware (Auth, Security):** `backend/src/middleware/`
- **Services (Business Logic):** `backend/src/services/`
- **Utils (Helpers):** `backend/src/utils/`
- **Database Config:** `backend/src/config/db.js`

### Frontend (Mobile)
- **Pages/Screens:** `src/screens/` (to be created)
- **Components:** `src/components/`
- **Context/State:** `src/context/` or `src/store/`
- **API Service:** `src/services/api.ts`
- **Theme:** `src/theme/`
- **Types:** `src/types/`
- **Utils:** `src/utils/`

---

## 5. Development and Deployment

### Prerequisites
- Node.js (LTS)
- npm or yarn
- Expo CLI (if using Expo)
- Android Studio/Xcode for emulators/simulators

### Setup Instructions
1. **Clone the repository**
2. **Install dependencies:**
   - `npm install` or `yarn` (in both backend and mobile directories)
3. **Configure environment variables:**
   - Backend: `.env` file with API keys, DB URI, S3 credentials, etc.
   - Mobile: `.env` or config file for API base URL
4. **Run the backend:**
   - `npm run dev` or `node src/index.js` (in backend directory)
5. **Run the mobile app:**
   - `expo start` (for React Native/Expo)
   - Use Android/iOS emulator or physical device
6. **Build for production:**
   - Backend: Deploy to cloud (Render, Heroku, etc.)
   - Mobile: `expo build:android` / `expo build:ios` or use EAS Build

---

## 6. Testing and Debugging

### Backend
- Unit and integration tests (Jest, Supertest) in `backend/tests/`
- Test endpoints with Postman or Insomnia
- Debug logs available in backend console

### Mobile Frontend
- Use Jest and React Native Testing Library for unit/component tests
- Manual testing on emulators and devices
- Debug with React Native Debugger, Flipper, or Expo tools

### Troubleshooting
- CORS issues: Ensure mobile app uses correct API base URL and backend CORS allows mobile origins
- Auth issues: Check JWT token storage and header usage
- Network errors: Use device logs and backend logs for diagnosis

---

## 7. Additional Information

### Assumptions & Constraints
- The mobile app is for staff users only (admin features are not included)
- All backend APIs are already implemented and documented
- Mobile app will use the same authentication and permission model as the web app
- All document/file uploads/downloads use secure S3 URLs

### Contact & Further Documentation
- For backend/API details: See `upload/StaffBridge_Documentation.md`
- For design/UI guidelines: Refer to the existing StaffBridge web interface
- For questions or support, contact the StaffBridge development team

---

This README serves as the single source of truth for all developers working on the StaffBridge Mobile Client. Please keep it updated as the project evolves. 