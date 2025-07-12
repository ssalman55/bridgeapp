const mongoose = require('mongoose');
const User = require('../models/User');
const ExpenseClaim = require('../models/ExpenseClaim');
const TrainingRequest = require('../models/TrainingRequest');

// Map field IDs to their source and path
const FIELD_MAPS = {
  user: {
    emp_name: { path: 'fullName' },
    emp_id: { path: '_id' },
    department: { path: 'department' },
    role: { path: 'role' },
    employmentType: { path: 'role' },
    // ... add more as needed ...
  },
  expenseclaim: {
    title: { path: 'title' },
    expenseDate: { path: 'expenseDate' },
    category: { path: 'category' },
    itemizedExpenses: { path: 'itemizedExpenses' },
    totalAmount: { path: 'totalAmount' },
    justification: { path: 'justification' },
    declaration: { path: 'declaration' },
    status: { path: 'status' },
    submittedAt: { path: 'submittedAt' },
    decisionDate: { path: 'decisionDate' },
    approvalLogs: { path: 'approvalLogs' },
    documents: { path: 'documents' },
    createdAt: { path: 'createdAt' },
    updatedAt: { path: 'updatedAt' },
    staffId: { path: 'staffId' },
    organization: { path: 'organization' },
  },
  trainingrequest: {
    trainingTitle: { path: 'trainingTitle' },
    hostedBy: { path: 'hostedBy' },
    location: { path: 'location' },
    numberOfDays: { path: 'numberOfDays' },
    costBreakdown: { path: 'costBreakdown' },
    justification: { path: 'justification' },
    expectedOutcomes: { path: 'expectedOutcomes' },
    benefitToOrg: { path: 'benefitToOrg' },
    coverRequirements: { path: 'coverRequirements' },
    additionalNotes: { path: 'additionalNotes' },
    attachment: { path: 'attachment' },
    documents: { path: 'documents' },
    status: { path: 'status' },
    adminComment: { path: 'adminComment' },
    requestedDate: { path: 'requestedDate' },
    decisionDate: { path: 'decisionDate' },
    approvedRejectedBy: { path: 'approvedRejectedBy' },
    currency: { path: 'currency' },
    createdAt: { path: 'createdAt' },
    updatedAt: { path: 'updatedAt' },
    staffId: { path: 'staffId' },
    organization: { path: 'organization' },
  },
};

const MODEL_MAP = {
  user: User,
  expenseclaim: ExpenseClaim,
  trainingrequest: TrainingRequest,
};

const generateCustomReport = async (req, res) => {
  try {
    const { columns = [], groupBy = [], filters = [], source = 'user' } = req.body;
    const src = (source || 'user').toLowerCase();
    const FIELD_MAP = FIELD_MAPS[src];
    const Model = MODEL_MAP[src];
    if (!columns.length || !Model || !FIELD_MAP) {
      return res.status(400).json({ error: 'Invalid source or columns specified' });
    }
    // Build filter $match
    const filterMatch = {};
    filters.forEach(f => {
      const map = FIELD_MAP[f.id];
      if (!map || f.value === undefined || f.value === null || f.value === '') return;
      filterMatch[map.path] = f.value;
    });
    // Build groupBy _id
    let groupStage = null;
    if (groupBy.length > 0) {
      const groupId = {};
      groupBy.forEach(g => {
        const map = FIELD_MAP[g.id];
        if (map) groupId[g.id] = `$${map.path}`;
      });
      const groupFields = {};
      columns.forEach(col => {
        const map = FIELD_MAP[col.id];
        if (!map) return;
        groupFields[col.id] = { $first: `$${map.path}` };
      });
      groupStage = {
        $group: {
          _id: groupId,
          ...groupFields
        }
      };
    }
    // Build $project
    const project = {};
    columns.forEach(col => {
      if (groupBy.length > 0) {
        if (groupBy.find(g => g.id === col.id)) {
          project[col.id] = `$_id.${col.id}`;
        } else {
          project[col.id] = `$${col.id}`;
        }
      } else {
        const map = FIELD_MAP[col.id];
        if (!map) return;
        project[col.id] = `$${map.path}`;
      }
    });
    // Build pipeline
    const pipeline = [
      { $match: { organization: new mongoose.Types.ObjectId(req.user.organization._id) } },
      ...(Object.keys(filterMatch).length ? [{ $match: filterMatch }] : []),
      ...(groupStage ? [groupStage] : []),
      { $project: project }
    ];
    // Run aggregation
    const data = await Model.aggregate(pipeline);
    return res.json({ data });
  } catch (err) {
    console.error('Custom report error:', err);
    return res.status(500).json({ error: 'Failed to generate report' });
  }
};

module.exports = { generateCustomReport }; 