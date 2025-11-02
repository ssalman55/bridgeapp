# 🚀 StaffBridge Onboarding Module

A comprehensive, template-driven onboarding system that guides new hires from **Offer Accepted** to **Day 90 Complete** with automated workflows, task management, and mobile-friendly preboarding.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Frontend Components](#frontend-components)
- [Automation System](#automation-system)
- [Preboarding Portal](#preboarding-portal)
- [Mock Integrations](#mock-integrations)
- [Database Schema](#database-schema)
- [Configuration](#configuration)
- [Development](#development)
- [Production Deployment](#production-deployment)
- [Contributing](#contributing)

## 🎯 Overview

The onboarding module transforms the new hire experience by providing:

- **Template-driven workflows** with role/location-specific checklists
- **Automated task assignment** with SLAs, dependencies, and escalations
- **Mobile-first preboarding portal** for document collection and forms
- **Pipeline visualization** with Kanban and table views
- **Real-time automation** for IT provisioning, equipment, and training
- **KPI tracking** and comprehensive reporting
- **Mock integrations** ready for production providers

## ✨ Features

### 🏗️ Template Management
- Create reusable onboarding templates by role/department/location
- Define task types: Forms, Documents, E-signatures, IT Provisioning, Equipment, Training, etc.
- Set relative due dates (D-14, D-7, D+30, etc.) and SLA hours
- Configure task dependencies and automation rules
- Assign default owners (HR, IT, Facilities, Manager, New Hire)

### 📊 Pipeline Management
- **Kanban Board**: Drag-and-drop stage management with visual progress
- **Table View**: Sortable, filterable list with bulk operations
- **Stage Progression**: Offer Accepted → Preboarding → Provisioning → Ready to Start → Day 1/30/60/90 → Complete
- **Progress Tracking**: Real-time completion percentages and task counts
- **Blocker Management**: Track and resolve onboarding obstacles

### 📱 Mobile Preboarding Portal
- **Tokenized Access**: Secure, single-use URLs for new hires
- **Progressive Checklist**: Step-by-step task completion
- **File Uploads**: Document collection with progress tracking
- **Form Management**: Personal info, emergency contacts, bank details
- **Schedule Preview**: First-week calendar and key contacts
- **Progress Visualization**: Completion percentage and time estimates

### 🤖 Automation Engine
- **Event-driven Triggers**: Stage changes, task completion, overdue items, day offsets
- **Smart Actions**: Email notifications, account provisioning, equipment assignment, training enrollment
- **Background Workers**: Cron-based SLA monitoring and escalations
- **Rule Builder**: Flexible condition/action configuration
- **Execution History**: Full audit trail with success/failure tracking

### 📈 Analytics & Reporting
- **Dashboard KPIs**: Active onboardings, completion rates, overdue tasks, upcoming starts
- **Time-to-Ready Metrics**: Track efficiency from offer to first day
- **SLA Compliance**: Monitor task completion within defined timeframes
- **Stage Distribution**: Visual breakdown of pipeline status
- **Export Capabilities**: CSV/Excel reports for further analysis

## 🏛️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Integrations  │
│   (React/TS)    │    │  (Node/Express) │    │    (Mock)       │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • Dashboard     │◄──►│ • REST APIs     │◄──►│ • E-Signature   │
│ • Pipeline      │    │ • Auth/RBAC     │    │ • Identity      │
│ • Tasks         │    │ • Automation    │    │ • Equipment     │
│ • Templates     │    │ • Workers       │    │ • Training/LMS  │
│ • Portal        │    │ • Database      │    │ • Webhooks      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Core Components

- **Data Models**: Template, Pipeline, Task, Document, Automation
- **API Controllers**: CRUD operations with validation and auth
- **Automation Service**: Event processing and action execution
- **Integration Adapters**: Mock implementations for external services
- **Background Workers**: Cron jobs for SLA monitoring and scheduled tasks

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm
- MongoDB 4.4+
- Existing StaffBridge installation

### Installation

1. **Install Dependencies**
   ```bash
   cd backend
   npm install node-cron uuid
   ```

2. **Seed Demo Data**
   ```bash
   npm run seed-onboarding
   ```

3. **Start Automation Worker** (Optional)
   ```bash
   npm run onboarding-worker
   ```

4. **Access the Module**
   - Navigate to **People > Onboarding** in the admin panel
   - View the dashboard, pipelines, and templates
   - Use the generated preboarding URL for the demo new hire

### Environment Variables

```bash
# Required
MONGODB_URI=mongodb://localhost:27017/staffbridge
FRONTEND_URL=http://localhost:3000

# Optional (for production integrations)
DOCUSIGN_API_KEY=your_docusign_key
OKTA_DOMAIN=your_okta_domain
SMTP_HOST=your_smtp_host
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
```

## 📚 API Documentation

### Core Endpoints

#### Templates
```
GET    /api/onboarding/templates              # List templates
POST   /api/onboarding/templates              # Create template
GET    /api/onboarding/templates/:id          # Get template
PUT    /api/onboarding/templates/:id          # Update template
DELETE /api/onboarding/templates/:id          # Delete template
```

#### Pipelines
```
GET    /api/onboarding/pipelines              # List onboardings
POST   /api/onboarding/pipelines              # Start onboarding
GET    /api/onboarding/pipelines/:id          # Get onboarding
PUT    /api/onboarding/pipelines/:id/stage    # Update stage
DELETE /api/onboarding/pipelines/:id          # Delete onboarding
```

#### Tasks
```
GET    /api/onboarding/tasks                  # List tasks
GET    /api/onboarding/tasks/:id              # Get task
PUT    /api/onboarding/tasks/:id/status       # Update status
PUT    /api/onboarding/tasks/:id/assign       # Reassign task
PUT    /api/onboarding/tasks/bulk             # Bulk operations
```

#### Preboarding (Public)
```
GET    /api/onboarding/preboarding/:token     # Get portal data
PUT    /api/onboarding/preboarding/:token/tasks/:taskId  # Update task
POST   /api/onboarding/preboarding/:token/tasks/:taskId/files  # Upload file
POST   /api/onboarding/preboarding/:token/personal-info  # Submit info
```

#### Analytics
```
GET    /api/onboarding/dashboard              # Dashboard data
GET    /api/onboarding/reports                # Generate reports
```

### Request Examples

**Create Template:**
```javascript
POST /api/onboarding/templates
{
  "name": "Software Developer Onboarding",
  "description": "Complete onboarding for dev team",
  "department": "Engineering",
  "role": "Software Developer",
  "checklistItems": [
    {
      "title": "Setup Development Environment",
      "taskType": "it-provisioning",
      "ownerRole": "it",
      "relativeDueDate": -2,
      "slaHours": 24,
      "isRequired": true
    }
  ]
}
```

**Start Onboarding:**
```javascript
POST /api/onboarding/pipelines
{
  "templateId": "60f7b1b9b9b9b9b9b9b9b9b9",
  "newHireId": "60f7b1b9b9b9b9b9b9b9b9b8",
  "startDate": "2024-02-01",
  "position": "Software Developer",
  "department": "Engineering",
  "managerId": "60f7b1b9b9b9b9b9b9b9b9b7"
}
```

## 🎨 Frontend Components

### Pages
- **OnboardingDashboard**: Overview with KPIs and quick actions
- **OnboardingPipeline**: Kanban/table views with drag-and-drop
- **PreboardingPortal**: Mobile-first new hire experience

### Key Features
- **Responsive Design**: Mobile-first approach
- **Real-time Updates**: Live progress tracking
- **Drag & Drop**: Intuitive stage management
- **File Handling**: Upload/download with progress
- **Form Validation**: Client-side validation with TypeScript

### Navigation Integration
The module integrates into the existing **People** menu:
```
People
├── Create
├── Profiles
├── Documents
├── Assign a Task
├── View Tasks
├── Onboarding  ← New module entry
├── Give Recognition
└── Recognition Approvals
```

## 🤖 Automation System

### Trigger Events
- `onboarding-created`: New pipeline started
- `stage-changed`: Pipeline stage updated
- `task-completed`: Task marked complete
- `task-overdue`: Task past due date
- `document-signed`: E-signature completed
- `cron-daily`: Daily scheduled checks
- `cron-hourly`: Hourly monitoring

### Action Types
- **send-email**: Automated notifications
- **provision-account**: IT system setup
- **assign-equipment**: Hardware allocation
- **enroll-training**: LMS enrollment
- **escalate**: Management notifications
- **webhook**: External system integration

### Configuration Example
```javascript
{
  "name": "New Developer Setup",
  "trigger": {
    "event": "stage-changed",
    "conditions": [
      { "type": "stage-change", "value": "provisioning" }
    ]
  },
  "actions": [
    {
      "type": "provision-account",
      "config": { "includeEmail": true }
    },
    {
      "type": "assign-equipment",
      "config": { "equipmentCategories": ["laptop", "monitor"] }
    }
  ]
}
```

### Background Workers
The automation worker runs scheduled tasks:
```bash
# Start worker
npm run onboarding-worker

# Schedules:
# - Daily checks: 6:00 AM
# - Hourly checks: Every hour
# - SLA monitoring: Every 15 minutes
```

## 📱 Preboarding Portal

### Access Flow
1. Admin creates onboarding → System generates secure token
2. New hire receives email with preboarding URL
3. Portal provides mobile-optimized experience
4. Tasks completed → System updates pipeline automatically

### Features
- **Progress Tracking**: Visual completion percentage
- **Task Management**: Start, complete, upload files
- **Schedule Preview**: First week calendar
- **Contact Directory**: Key people and departments
- **Responsive Design**: Works on all devices

### Security
- **Token-based Access**: Unique, secure URLs
- **Time-limited Sessions**: Automatic expiration
- **File Upload Validation**: Type and size restrictions
- **Audit Logging**: Complete activity tracking

## 🔌 Mock Integrations

### E-Signature Service
```javascript
const eSignService = new ESignatureService('mock');
const envelope = await eSignService.createEnvelope(document, signers);
```
**Production**: Replace with DocuSign, HelloSign, Adobe Sign

### Identity Provisioning
```javascript
const identityService = new IdentityProvisioningService('mock');
const account = await identityService.createUserAccount(userData);
```
**Production**: Integrate with Active Directory, Okta, Azure AD

### Equipment Management
```javascript
const equipmentService = new EquipmentService();
const reservation = await equipmentService.reserveEquipment(items, user);
```
**Production**: Connect to asset management systems

### Training/LMS
```javascript
const trainingService = new TrainingService('mock');
const enrollment = await trainingService.enrollInCourse(user, courseId);
```
**Production**: Integrate with LMS platforms

### Email/SMS Notifications
```javascript
const notificationService = new NotificationService();
await notificationService.sendEmail(to, subject, template, data);
```
**Production**: Use SendGrid, AWS SES, Twilio

## 🗄️ Database Schema

### OnboardingTemplate
```javascript
{
  name: String,
  description: String,
  organization: ObjectId,
  department: String,
  role: String,
  location: String,
  isActive: Boolean,
  checklistItems: [{
    id: String,
    title: String,
    taskType: Enum,
    ownerRole: Enum,
    relativeDueDate: Number,
    slaHours: Number,
    dependencies: [String]
  }],
  documentPackages: [Object],
  equipmentKits: [Object],
  defaultAssignees: Object
}
```

### OnboardingPipeline
```javascript
{
  newHire: ObjectId,
  organization: ObjectId,
  template: ObjectId,
  currentStage: Enum,
  startDate: Date,
  tasks: [Object],
  progressPercentage: Number,
  preboardingToken: String,
  equipmentAssigned: [Object],
  stageHistory: [Object],
  kpis: Object,
  auditLog: [Object]
}
```

### OnboardingTask
```javascript
{
  onboarding: ObjectId,
  title: String,
  taskType: Enum,
  status: Enum,
  assignedTo: ObjectId,
  dueDate: Date,
  isOverdue: Boolean,
  dependencies: [Object],
  files: [Object],
  notes: [Object],
  auditLog: [Object]
}
```

## ⚙️ Configuration

### Template Configuration
```javascript
// Task Types
'form', 'document', 'e-sign', 'it-provisioning', 
'equipment', 'orientation', 'manager-task', 
'training', 'generic-hr', 'facilities'

// Owner Roles  
'hr', 'it', 'facilities', 'manager', 'new-hire', 'admin'

// Stages
'offer-accepted', 'preboarding', 'provisioning', 
'ready-to-start', 'day-1', 'day-30', 'day-60', 
'day-90', 'completed', 'on-hold', 'withdrawn'
```

### Automation Rules
```javascript
// Conditions
{ type: 'stage-change', value: 'provisioning' }
{ type: 'day-offset', operator: 'equals', value: 1 }
{ type: 'task-status', operator: 'equals', value: 'completed' }

// Actions
{ type: 'send-email', config: { template: 'welcome' } }
{ type: 'provision-account', config: { includeEmail: true } }
{ type: 'webhook', config: { url: 'https://api.example.com/notify' } }
```

## 🛠️ Development

### Running Tests
```bash
# Backend tests
cd backend
npm test

# Frontend tests  
cd frontend
npm test
```

### Development Workflow
1. **Backend**: Start with `npm run dev`
2. **Frontend**: Start with `npm run dev`
3. **Worker**: Optional `npm run onboarding-worker`
4. **Database**: Ensure MongoDB is running

### Adding New Task Types
1. Update enum in models (`OnboardingTemplate.js`, `OnboardingTask.js`)
2. Add UI handling in `taskController.js`
3. Update frontend types in `onboarding.ts`
4. Add automation actions in `automationService.js`

### Creating New Integrations
1. Implement service in `onboardingIntegrationService.js`
2. Add action type to automation service
3. Update configuration options
4. Add environment variables for production

## 🚀 Production Deployment

### Environment Setup
```bash
# Production environment variables
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db
FRONTEND_URL=https://your-domain.com

# Integration credentials
DOCUSIGN_API_KEY=your_key
OKTA_DOMAIN=your_domain
SENDGRID_API_KEY=your_key
```

### Deployment Steps
1. **Deploy Backend**: Update with onboarding routes
2. **Deploy Frontend**: Include new pages and components
3. **Database Migration**: Run seed script for initial data
4. **Worker Setup**: Configure automation worker as service
5. **Integration Setup**: Replace mock services with real providers

### Monitoring
- **Worker Health**: Monitor cron job execution
- **API Performance**: Track response times and errors
- **Automation Success**: Monitor rule execution rates
- **User Experience**: Track preboarding completion rates

## 🔒 Security Considerations

### Access Control
- **RBAC Integration**: Uses existing permission system
- **Token Security**: Crypto-secure preboarding tokens
- **File Upload**: Size/type validation and scanning
- **Audit Trail**: Complete action history

### Data Protection
- **PII Handling**: Secure storage and transmission
- **Document Security**: Encrypted file storage
- **Session Management**: Secure token lifecycle
- **GDPR Compliance**: Data retention policies

## 📊 Performance

### Optimization Features
- **Pagination**: All list endpoints support paging
- **Filtering**: Server-side filtering reduces data transfer
- **Caching**: Template and pipeline caching
- **Background Processing**: Async automation execution

### Scalability
- **Worker Distribution**: Multiple worker instances
- **Database Indexing**: Optimized queries
- **File Storage**: S3 integration for scalability
- **CDN Ready**: Static asset optimization

## 🤝 Contributing

### Development Guidelines
1. Follow existing code patterns and conventions
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure mobile responsiveness for UI changes

### Issue Reporting
- Use GitHub issues for bug reports
- Include reproduction steps and environment details
- Attach screenshots for UI issues

### Feature Requests
- Describe use case and business value
- Consider impact on existing workflows
- Propose implementation approach

## 📝 License

This onboarding module is part of StaffBridge and follows the same licensing terms.

## 🎉 Conclusion

The StaffBridge Onboarding Module provides a production-ready foundation for managing the complete new hire journey. With its template-driven approach, automation capabilities, and mobile-first design, it transforms the onboarding experience for both HR teams and new employees.

**Key Benefits:**
- ⚡ **Faster Onboarding**: Automated workflows reduce manual effort
- 📱 **Better Experience**: Mobile-friendly preboarding portal
- 📊 **Data-Driven**: KPIs and analytics for continuous improvement
- 🔧 **Flexible**: Template system adapts to any role or department
- 🚀 **Scalable**: Mock integrations ready for production providers

Ready to transform your onboarding process? Start with the demo data and customize templates for your organization's needs!







