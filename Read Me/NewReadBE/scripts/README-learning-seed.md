# Learning Data Seeding Script

This script seeds the Learning section with realistic mock data for testing and development purposes.

## Overview

The script creates comprehensive test data for:
- **Training Requests** - Various training programs with different statuses
- **Performance Evaluations** - Complete performance reviews with SMART goals

## Features

### Training Requests
- **8 Different Training Types**: Project Management, Digital Marketing, Leadership, Data Analytics, Cybersecurity, Customer Service, Financial Analysis, Agile Project Management
- **Realistic Cost Breakdowns**: Registration fees, travel, accommodation, meals, and other costs
- **Multiple Statuses**: Draft, Pending, Approved, Rejected
- **Comprehensive Details**: Justification, expected outcomes, benefits to organization, cover requirements
- **Multiple Currencies**: QAR, USD, EUR
- **Time-based Data**: Requests spread over the last 6 months

### Performance Evaluations
- **SMART Goals**: Specific, Measurable, Achievable, Relevant, Time-bound objectives
- **Multiple Statuses**: Pending, In Progress, Completed, Cancelled
- **Comprehensive Feedback**: Initial, mid-year, year-end, and general feedback
- **Staff Comments**: Self-reflections and responses
- **Realistic Scenarios**: Goals related to training, productivity, leadership, customer service
- **Time-based Data**: Evaluations spread over the last year

## Data Consistency

The script ensures data consistency by:
- **Using Existing Staff**: Only creates data for active staff members
- **Organization Alignment**: All data is linked to existing organizations
- **Realistic Relationships**: Evaluators are admins/managers from the same organization
- **Proper References**: All foreign key relationships are maintained

## Usage

### Prerequisites
1. Ensure you have active staff members in your database
2. Ensure you have at least one organization in your database
3. Make sure your MongoDB connection is properly configured

### Running the Script

```bash
# Navigate to the backend directory
cd backend

# Run the seeding script
npm run seed-learning
```

### Manual Execution

```bash
# Run directly with Node.js
node scripts/seed-learning-data.js
```

## Data Generated

### Training Requests
- **1-3 requests per staff member** (randomly assigned)
- **Total requests**: Approximately 20-60 depending on staff count
- **Status distribution**: Mix of Draft, Pending, Approved, Rejected
- **Cost variations**: ±20% variation in costs for realism
- **Admin assignments**: Approved/Rejected requests have admin comments

### Performance Evaluations
- **1 evaluation per staff member** (up to 15 staff)
- **SMART Goals**: 2 goals per evaluation with realistic scenarios
- **Feedback progression**: Initial → Mid-year → Year-end feedback
- **Staff engagement**: Self-reflections and comments
- **Status tracking**: Progress through evaluation lifecycle

## Sample Data Examples

### Training Request Example
```javascript
{
  trainingTitle: "Advanced Project Management Certification",
  hostedBy: "Project Management Institute (PMI)",
  location: "Dubai, UAE",
  numberOfDays: 5,
  costBreakdown: {
    registrationFee: 2500,
    travelCost: 800,
    accommodationCost: 1200,
    mealCost: 400,
    otherCost: 200
  },
  status: "Approved",
  justification: "This certification will enhance my project management skills...",
  expectedOutcomes: "Gain PMP certification, learn advanced methodologies...",
  benefitToOrg: "Improved project success rates, better resource allocation..."
}
```

### Performance Evaluation Example
```javascript
{
  goals: [
    {
      specific: "Complete customer service training and achieve 95% satisfaction",
      measurable: "Track satisfaction scores monthly",
      achievable: "Attend training and implement techniques",
      relevant: "Aligns with company customer experience goals",
      timeBound: "Complete by end of Q2, maintain throughout Q3",
      status: "in progress"
    }
  ],
  initialFeedback: "Shows excellent customer service skills...",
  midyearFeedback: "Great progress on satisfaction goals...",
  yearendFeedback: "Outstanding performance this year...",
  status: "completed"
}
```

## Customization

### Adding New Training Types
Edit the `trainingData` array in the script to add new training programs:

```javascript
const trainingData = [
  // ... existing data
  {
    trainingTitle: "Your New Training Program",
    hostedBy: "Training Provider",
    location: "Location",
    numberOfDays: 3,
    costBreakdown: { /* cost details */ },
    justification: "Why this training is needed",
    expectedOutcomes: "What will be learned",
    benefitToOrg: "How it helps the organization",
    coverRequirements: "Who will cover during training",
    additionalNotes: "Any additional information",
    currency: "QAR"
  }
];
```

### Adding New Performance Scenarios
Edit the `performanceData` array to add new evaluation templates:

```javascript
const performanceData = [
  // ... existing data
  {
    goals: [
      {
        specific: "Your specific goal",
        measurable: "How to measure success",
        achievable: "Why it's achievable",
        relevant: "Why it's relevant",
        timeBound: "When to complete",
        status: "pending"
      }
    ],
    initialFeedback: "Initial feedback text",
    midyearFeedback: "Mid-year feedback text",
    yearendFeedback: "Year-end feedback text",
    feedback: "General feedback text",
    staffComments: [
      {
        comment: "Staff member's comment",
        date: new Date('2024-06-15')
      }
    ],
    status: "completed"
  }
];
```

## Troubleshooting

### Common Issues

1. **No staff found**: Ensure you have active staff members in your database
2. **No organizations found**: Ensure you have at least one organization
3. **Database connection error**: Check your MongoDB connection string
4. **Permission errors**: Ensure the script has write access to the database

### Data Cleanup

To clear existing learning data before re-seeding:

```javascript
// The script automatically clears existing data before seeding
await TrainingRequest.deleteMany({});
await PerformanceEvaluation.deleteMany({});
```

## Output

The script provides detailed console output:

```
🚀 Starting Learning Data Seeding...
🧹 Clearing existing learning data...
✅ Existing data cleared
🌱 Seeding Training Requests...
✅ Created 45 training requests
🌱 Seeding Performance Evaluations...
✅ Created 15 performance evaluations
🎉 Learning data seeding completed successfully!

📊 Summary:
- Training Requests: Seeded with realistic data
- Performance Evaluations: Seeded with comprehensive evaluations
- All data is consistent with existing staff and organizations
```

## Notes

- The script is safe to run multiple times (clears existing data first)
- All data is realistic and suitable for testing
- Data relationships are properly maintained
- The script handles edge cases (no staff, no organizations, etc.)
- All timestamps are realistic and spread over appropriate time periods


































