const mongoose = require('mongoose');
const User = require('../models/User');
const SalaryStructure = require('../models/SalaryStructure');
const Payroll = require('../models/Payroll');
const ExpenseClaim = require('../models/ExpenseClaim');
const TrainingRequest = require('../models/TrainingRequest');
const SavedReport = require('../models/SavedReport');
const { uploadToS3, getFileUrl, deleteFile } = require('../utils/s3');

// Map field IDs to their source and path
const FIELD_MAPS = {
  user: {
    emp_name: { path: 'fullName', source: 'user' },
    emp_id: { path: '_id', source: 'user' },
    department: { path: 'department', source: 'user' },
    role: { path: 'role', source: 'user' },
    employmentType: { path: 'role', source: 'user' },
  },
  salarystructure: {
    basic: { path: 'basic', source: 'salarystructure' },
    housing: { path: 'housing', source: 'salarystructure' },
    utility: { path: 'utility', source: 'salarystructure' },
    bonus: { path: 'bonus', source: 'salarystructure' },
    deductions: { path: 'deductions', source: 'salarystructure' },
    taxes: { path: 'taxes', source: 'salarystructure' },
    netSalary: { path: 'netSalary', source: 'salarystructure' },
  },
  payroll: {
    payPeriod: { path: 'payPeriod', source: 'payroll' },
    paymentStatus: { path: 'paymentStatus', source: 'payroll' },
    paymentDate: { path: 'paymentDate', source: 'payroll' },
    grossSalary: { path: 'grossSalary', source: 'payroll' },
    netSalary: { path: 'netSalary', source: 'payroll' },
    totalWorkdays: { path: 'totalWorkdays', source: 'payroll' },
    absences: { path: 'absences', source: 'payroll' },
    overtime: { path: 'overtime', source: 'payroll' },
  },
  allowances: {
    transport: { path: 'transport', source: 'salarystructure' },
    reimbursements: { path: 'reimbursements', source: 'salarystructure' },
    bonus: { path: 'bonus', source: 'salarystructure' },
  },
  deductions: {
    deductions: { path: 'deductions', source: 'salarystructure' },
    taxes: { path: 'taxes', source: 'salarystructure' },
  },
  expenseclaim: {
    title: { path: 'title', source: 'expenseclaim' },
    expenseDate: { path: 'expenseDate', source: 'expenseclaim' },
    category: { path: 'category', source: 'expenseclaim' },
    itemizedExpenses: { path: 'itemizedExpenses', source: 'expenseclaim' },
    totalAmount: { path: 'totalAmount', source: 'expenseclaim' },
    justification: { path: 'justification', source: 'expenseclaim' },
    declaration: { path: 'declaration', source: 'expenseclaim' },
    status: { path: 'status', source: 'expenseclaim' },
    submittedAt: { path: 'submittedAt', source: 'expenseclaim' },
    decisionDate: { path: 'decisionDate', source: 'expenseclaim' },
    approvalLogs: { path: 'approvalLogs', source: 'expenseclaim' },
    documents: { path: 'documents', source: 'expenseclaim' },
    createdAt: { path: 'createdAt', source: 'expenseclaim' },
    updatedAt: { path: 'updatedAt', source: 'expenseclaim' },
    staffId: { path: 'staffId', source: 'expenseclaim' },
    organization: { path: 'organization', source: 'expenseclaim' },
  },
  trainingrequest: {
    trainingTitle: { path: 'trainingTitle', source: 'trainingrequest' },
    hostedBy: { path: 'hostedBy', source: 'trainingrequest' },
    location: { path: 'location', source: 'trainingrequest' },
    numberOfDays: { path: 'numberOfDays', source: 'trainingrequest' },
    costBreakdown: { path: 'costBreakdown', source: 'trainingrequest' },
    justification: { path: 'justification', source: 'trainingrequest' },
    expectedOutcomes: { path: 'expectedOutcomes', source: 'trainingrequest' },
    benefitToOrg: { path: 'benefitToOrg', source: 'trainingrequest' },
    coverRequirements: { path: 'coverRequirements', source: 'trainingrequest' },
    additionalNotes: { path: 'additionalNotes', source: 'trainingrequest' },
    attachment: { path: 'attachment', source: 'trainingrequest' },
    documents: { path: 'documents', source: 'trainingrequest' },
    status: { path: 'status', source: 'trainingrequest' },
    adminComment: { path: 'adminComment', source: 'trainingrequest' },
    requestedDate: { path: 'requestedDate', source: 'trainingrequest' },
    decisionDate: { path: 'decisionDate', source: 'trainingrequest' },
    approvedRejectedBy: { path: 'approvedRejectedBy', source: 'trainingrequest' },
    currency: { path: 'currency', source: 'trainingrequest' },
    createdAt: { path: 'createdAt', source: 'trainingrequest' },
    updatedAt: { path: 'updatedAt', source: 'trainingrequest' },
    staffId: { path: 'staffId', source: 'trainingrequest' },
    organization: { path: 'organization', source: 'trainingrequest' },
  },
};

const MODEL_MAP = {
  user: User,
  salarystructure: SalaryStructure,
  payroll: Payroll,
  allowances: SalaryStructure, // Same as salarystructure
  deductions: SalaryStructure, // Same as salarystructure
  expenseclaim: ExpenseClaim,
  trainingrequest: TrainingRequest,
};

const generateCustomReport = async (req, res) => {
  try {
    const { columns = [], groupBy = [], filters = [], source = 'user' } = req.body;
    
    if (!columns.length) {
      return res.status(400).json({ error: 'No columns specified' });
    }

    // Determine which data sources are needed based on the selected columns
    const requiredSources = new Set();
    const fieldMappings = {};
    
    // Map each column to its source and path
    columns.forEach(col => {
      let found = false;
      for (const [sourceName, fieldMap] of Object.entries(FIELD_MAPS)) {
        if (fieldMap[col.id]) {
          requiredSources.add(fieldMap[col.id].source);
          fieldMappings[col.id] = fieldMap[col.id];
          found = true;
          break;
        }
      }
      if (!found) {
        console.warn(`Field ${col.id} not found in any data source`);
      }
    });

    // Add groupBy fields to required sources
    groupBy.forEach(g => {
      for (const [sourceName, fieldMap] of Object.entries(FIELD_MAPS)) {
        if (fieldMap[g.id]) {
          requiredSources.add(fieldMap[g.id].source);
          fieldMappings[g.id] = fieldMap[g.id];
          break;
        }
      }
    });

    // Add filter fields to required sources
    filters.forEach(f => {
      for (const [sourceName, fieldMap] of Object.entries(FIELD_MAPS)) {
        if (fieldMap[f.id]) {
          requiredSources.add(fieldMap[f.id].source);
          fieldMappings[f.id] = fieldMap[f.id];
          break;
        }
      }
    });

    console.log('Required sources:', Array.from(requiredSources));
    console.log('Field mappings:', fieldMappings);

    // If only one source is required, use the simple approach
    if (requiredSources.size === 1) {
      const singleSource = Array.from(requiredSources)[0];
      const Model = MODEL_MAP[singleSource];
      
      if (!Model) {
        return res.status(400).json({ error: `Model not found for source: ${singleSource}` });
      }

      // Build filter $match
      const filterMatch = {};
      filters.forEach(f => {
        const map = fieldMappings[f.id];
        if (!map || f.value === undefined || f.value === null || f.value === '') return;
        filterMatch[map.path] = f.value;
      });

      // Build groupBy _id
      let groupStage = null;
      if (groupBy.length > 0) {
        const groupId = {};
        groupBy.forEach(g => {
          const map = fieldMappings[g.id];
          if (map) groupId[g.id] = `$${map.path}`;
        });
        const groupFields = {};
        columns.forEach(col => {
          const map = fieldMappings[col.id];
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
          const map = fieldMappings[col.id];
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
    }

    // Multiple sources required - use aggregation with $lookup
    const organizationId = new mongoose.Types.ObjectId(req.user.organization._id);
    
    // Start with User collection as the base
    const pipeline = [
      { $match: { organization: organizationId } }
    ];

    // Add lookups for other required sources
    if (requiredSources.has('salarystructure')) {
      pipeline.push({
        $lookup: {
          from: 'salarystructures',
          localField: '_id',
          foreignField: 'staff',
          as: 'salaryStructure'
        }
      });
      pipeline.push({
        $unwind: { path: '$salaryStructure', preserveNullAndEmptyArrays: true }
      });
    }

    if (requiredSources.has('payroll')) {
      pipeline.push({
        $lookup: {
          from: 'payrolls',
          localField: '_id',
          foreignField: 'staff',
          as: 'payroll'
        }
      });
      pipeline.push({
        $unwind: { path: '$payroll', preserveNullAndEmptyArrays: true }
      });
    }

    if (requiredSources.has('expenseclaim')) {
      pipeline.push({
        $lookup: {
          from: 'expenseclaims',
          localField: '_id',
          foreignField: 'staffId',
          as: 'expenseClaims'
        }
      });
    }

    if (requiredSources.has('trainingrequest')) {
      pipeline.push({
        $lookup: {
          from: 'trainingrequests',
          localField: '_id',
          foreignField: 'staffId',
          as: 'trainingRequests'
        }
      });
    }

    // Build filter $match for joined data
    const filterMatch = {};
    filters.forEach(f => {
      const map = fieldMappings[f.id];
      if (!map || f.value === undefined || f.value === null || f.value === '') return;
      
      if (map.source === 'user') {
        filterMatch[map.path] = f.value;
      } else if (map.source === 'salarystructure') {
        filterMatch[`salaryStructure.${map.path}`] = f.value;
      } else if (map.source === 'payroll') {
        filterMatch[`payroll.${map.path}`] = f.value;
      } else if (map.source === 'expenseclaim') {
        filterMatch[`expenseClaims.${map.path}`] = f.value;
      } else if (map.source === 'trainingrequest') {
        filterMatch[`trainingRequests.${map.path}`] = f.value;
      }
    });

    if (Object.keys(filterMatch).length > 0) {
      pipeline.push({ $match: filterMatch });
    }

    // Build groupBy _id
    let groupStage = null;
    if (groupBy.length > 0) {
      const groupId = {};
      groupBy.forEach(g => {
        const map = fieldMappings[g.id];
        if (!map) return;
        
        if (map.source === 'user') {
          groupId[g.id] = `$${map.path}`;
        } else if (map.source === 'salarystructure') {
          groupId[g.id] = `$salaryStructure.${map.path}`;
        } else if (map.source === 'payroll') {
          groupId[g.id] = `$payroll.${map.path}`;
        } else if (map.source === 'expenseclaim') {
          groupId[g.id] = { $first: `$expenseClaims.${map.path}` };
        } else if (map.source === 'trainingrequest') {
          groupId[g.id] = { $first: `$trainingRequests.${map.path}` };
        }
      });

      const groupFields = {};
      columns.forEach(col => {
        const map = fieldMappings[col.id];
        if (!map) return;
        
        if (map.source === 'user') {
          groupFields[col.id] = { $first: `$${map.path}` };
        } else if (map.source === 'salarystructure') {
          groupFields[col.id] = { $first: `$salaryStructure.${map.path}` };
        } else if (map.source === 'payroll') {
          groupFields[col.id] = { $first: `$payroll.${map.path}` };
        } else if (map.source === 'expenseclaim') {
          groupFields[col.id] = { $first: `$expenseClaims.${map.path}` };
        } else if (map.source === 'trainingrequest') {
          groupFields[col.id] = { $first: `$trainingRequests.${map.path}` };
        }
      });

      groupStage = {
        $group: {
          _id: groupId,
          ...groupFields
        }
      };
      pipeline.push(groupStage);
    }

    // Build $project
    const project = {};
    columns.forEach(col => {
      const map = fieldMappings[col.id];
      if (!map) return;
      
      if (groupBy.length > 0) {
        if (groupBy.find(g => g.id === col.id)) {
          project[col.id] = `$_id.${col.id}`;
        } else {
          project[col.id] = `$${col.id}`;
        }
      } else {
        if (map.source === 'user') {
          project[col.id] = `$${map.path}`;
        } else if (map.source === 'salarystructure') {
          project[col.id] = `$salaryStructure.${map.path}`;
        } else if (map.source === 'payroll') {
          project[col.id] = `$payroll.${map.path}`;
        } else if (map.source === 'expenseclaim') {
          project[col.id] = { $first: `$expenseClaims.${map.path}` };
        } else if (map.source === 'trainingrequest') {
          project[col.id] = { $first: `$trainingRequests.${map.path}` };
        }
      }
    });

    pipeline.push({ $project: project });

    // Run aggregation on User collection
    const data = await User.aggregate(pipeline);
    return res.json({ data });

  } catch (err) {
    console.error('Custom report error:', err);
    return res.status(500).json({ error: 'Failed to generate report' });
  }
};

// Export report as CSV
const exportReport = async (req, res) => {
  try {
    const { columns = [], groupBy = [], filters = [], source = 'user' } = req.body;
    
    if (!columns.length) {
      return res.status(400).json({ error: 'No columns specified' });
    }

    // Generate the report data using the same logic as generateCustomReport
    const requiredSources = new Set();
    const fieldMappings = {};
    
    // Map each column to its source and path
    columns.forEach(col => {
      let found = false;
      for (const [sourceName, fieldMap] of Object.entries(FIELD_MAPS)) {
        if (fieldMap[col.id]) {
          requiredSources.add(fieldMap[col.id].source);
          fieldMappings[col.id] = fieldMap[col.id];
          found = true;
          break;
        }
      }
      if (!found) {
        console.warn(`Field ${col.id} not found in any data source`);
      }
    });

    // Add groupBy and filter fields to required sources
    [...groupBy, ...filters].forEach(f => {
      for (const [sourceName, fieldMap] of Object.entries(FIELD_MAPS)) {
        if (fieldMap[f.id]) {
          requiredSources.add(fieldMap[f.id].source);
          fieldMappings[f.id] = fieldMap[f.id];
          break;
        }
      }
    });

    // Build aggregation pipeline (simplified version of generateCustomReport)
    const pipeline = [
      { $match: { organization: new mongoose.Types.ObjectId(req.user.organization._id) } }
    ];

    // Add lookups for multi-source reports
    if (requiredSources.has('salarystructure')) {
      pipeline.push({
        $lookup: {
          from: 'salarystructures',
          localField: '_id',
          foreignField: 'staff',
          as: 'salaryStructure'
        }
      });
      pipeline.push({ $unwind: { path: '$salaryStructure', preserveNullAndEmptyArrays: true } });
    }

    if (requiredSources.has('payroll')) {
      pipeline.push({
        $lookup: {
          from: 'payrolls',
          localField: '_id',
          foreignField: 'staff',
          as: 'payroll'
        }
      });
      pipeline.push({ $unwind: { path: '$payroll', preserveNullAndEmptyArrays: true } });
    }

    if (requiredSources.has('expenseclaim')) {
      pipeline.push({
        $lookup: {
          from: 'expenseclaims',
          localField: '_id',
          foreignField: 'staffId',
          as: 'expenseClaims'
        }
      });
    }

    if (requiredSources.has('trainingrequest')) {
      pipeline.push({
        $lookup: {
          from: 'trainingrequests',
          localField: '_id',
          foreignField: 'staffId',
          as: 'trainingRequests'
        }
      });
    }

    // Add filters
    const activeFilters = filters.filter(f => f.value !== undefined && f.value !== null && f.value !== '');
    if (activeFilters.length > 0) {
      const filterMatch = {};
      activeFilters.forEach(f => {
        const map = fieldMappings[f.id];
        if (!map) return;
        
        if (map.source === 'user') {
          filterMatch[map.path] = f.value;
        } else if (map.source === 'salarystructure') {
          filterMatch[`salaryStructure.${map.path}`] = f.value;
        } else if (map.source === 'payroll') {
          filterMatch[`payroll.${map.path}`] = f.value;
        } else if (map.source === 'expenseclaim') {
          filterMatch[`expenseClaims.${map.path}`] = f.value;
        } else if (map.source === 'trainingrequest') {
          filterMatch[`trainingRequests.${map.path}`] = f.value;
        }
      });
      if (Object.keys(filterMatch).length > 0) {
        pipeline.push({ $match: filterMatch });
      }
    }

    // Add grouping if specified
    if (groupBy.length > 0) {
      const groupId = {};
      groupBy.forEach(g => {
        const map = fieldMappings[g.id];
        if (map) {
          if (map.source === 'user') {
            groupId[g.id] = `$${map.path}`;
          } else if (map.source === 'salarystructure') {
            groupId[g.id] = `$salaryStructure.${map.path}`;
          } else if (map.source === 'payroll') {
            groupId[g.id] = `$payroll.${map.path}`;
          } else if (map.source === 'expenseclaim') {
            groupId[g.id] = { $first: `$expenseClaims.${map.path}` };
          } else if (map.source === 'trainingrequest') {
            groupId[g.id] = { $first: `$trainingRequests.${map.path}` };
          }
        }
      });
      
      const groupFields = {};
      columns.forEach(col => {
        const map = fieldMappings[col.id];
        if (!map) return;
        
        if (map.source === 'user') {
          groupFields[col.id] = { $first: `$${map.path}` };
        } else if (map.source === 'salarystructure') {
          groupFields[col.id] = { $first: `$salaryStructure.${map.path}` };
        } else if (map.source === 'payroll') {
          groupFields[col.id] = { $first: `$payroll.${map.path}` };
        } else if (map.source === 'expenseclaim') {
          groupFields[col.id] = { $first: `$expenseClaims.${map.path}` };
        } else if (map.source === 'trainingrequest') {
          groupFields[col.id] = { $first: `$trainingRequests.${map.path}` };
        }
      });
      
      pipeline.push({
        $group: {
          _id: groupId,
          ...groupFields
        }
      });
    }

    // Build projection
    const project = {};
    columns.forEach(col => {
      const map = fieldMappings[col.id];
      if (!map) return;
      
      if (groupBy.length > 0) {
        if (groupBy.find(g => g.id === col.id)) {
          project[col.id] = `$_id.${col.id}`;
        } else {
          project[col.id] = `$${col.id}`;
        }
      } else {
        if (map.source === 'user') {
          project[col.id] = `$${map.path}`;
        } else if (map.source === 'salarystructure') {
          project[col.id] = `$salaryStructure.${map.path}`;
        } else if (map.source === 'payroll') {
          project[col.id] = `$payroll.${map.path}`;
        } else if (map.source === 'expenseclaim') {
          project[col.id] = { $first: `$expenseClaims.${map.path}` };
        } else if (map.source === 'trainingrequest') {
          project[col.id] = { $first: `$trainingRequests.${map.path}` };
        }
      }
    });

    pipeline.push({ $project: project });

    // Execute aggregation
    const data = await User.aggregate(pipeline);

    // Convert to CSV
    if (data.length === 0) {
      return res.status(400).json({ error: 'No data to export' });
    }

    // Create CSV headers
    const headers = columns.map(col => col.label || col.id);
    const csvRows = [headers.join(',')];

    // Add data rows
    data.forEach(row => {
      const values = columns.map(col => {
        const value = row[col.id];
        // Handle special characters and wrap in quotes if needed
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csvRows.push(values.join(','));
    });

    const csvContent = csvRows.join('\n');

    // Set response headers for CSV download
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `custom-report-${timestamp}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (err) {
    console.error('Export report error:', err);
    return res.status(500).json({ error: 'Failed to export report' });
  }
};

// Save report to S3
const saveReport = async (req, res) => {
  try {
    const { columns = [], groupBy = [], filters = [], source = 'user', reportName = 'Custom Report' } = req.body;
    
    if (!columns.length) {
      return res.status(400).json({ error: 'No columns specified' });
    }

    // Generate the report data using the same logic as generateCustomReport
    const requiredSources = new Set();
    const fieldMappings = {};
    
    // Map each column to its source and path
    columns.forEach(col => {
      let found = false;
      for (const [sourceName, fieldMap] of Object.entries(FIELD_MAPS)) {
        if (fieldMap[col.id]) {
          requiredSources.add(fieldMap[col.id].source);
          fieldMappings[col.id] = fieldMap[col.id];
          found = true;
          break;
        }
      }
      if (!found) {
        console.warn(`Field ${col.id} not found in any data source`);
      }
    });

    // Add groupBy and filter fields to required sources
    [...groupBy, ...filters].forEach(f => {
      for (const [sourceName, fieldMap] of Object.entries(FIELD_MAPS)) {
        if (fieldMap[f.id]) {
          requiredSources.add(fieldMap[f.id].source);
          fieldMappings[f.id] = fieldMap[f.id];
          break;
        }
      }
    });

    // Build aggregation pipeline (same as exportReport)
    const pipeline = [
      { $match: { organization: new mongoose.Types.ObjectId(req.user.organization._id) } }
    ];

    // Add lookups for multi-source reports
    if (requiredSources.has('salarystructure')) {
      pipeline.push({
        $lookup: {
          from: 'salarystructures',
          localField: '_id',
          foreignField: 'staff',
          as: 'salaryStructure'
        }
      });
      pipeline.push({ $unwind: { path: '$salaryStructure', preserveNullAndEmptyArrays: true } });
    }

    if (requiredSources.has('payroll')) {
      pipeline.push({
        $lookup: {
          from: 'payrolls',
          localField: '_id',
          foreignField: 'staff',
          as: 'payroll'
        }
      });
      pipeline.push({ $unwind: { path: '$payroll', preserveNullAndEmptyArrays: true } });
    }

    if (requiredSources.has('expenseclaim')) {
      pipeline.push({
        $lookup: {
          from: 'expenseclaims',
          localField: '_id',
          foreignField: 'staffId',
          as: 'expenseClaims'
        }
      });
    }

    if (requiredSources.has('trainingrequest')) {
      pipeline.push({
        $lookup: {
          from: 'trainingrequests',
          localField: '_id',
          foreignField: 'staffId',
          as: 'trainingRequests'
        }
      });
    }

    // Add filters
    const activeFilters = filters.filter(f => f.value !== undefined && f.value !== null && f.value !== '');
    if (activeFilters.length > 0) {
      const filterMatch = {};
      activeFilters.forEach(f => {
        const map = fieldMappings[f.id];
        if (!map) return;
        
        if (map.source === 'user') {
          filterMatch[map.path] = f.value;
        } else if (map.source === 'salarystructure') {
          filterMatch[`salaryStructure.${map.path}`] = f.value;
        } else if (map.source === 'payroll') {
          filterMatch[`payroll.${map.path}`] = f.value;
        } else if (map.source === 'expenseclaim') {
          filterMatch[`expenseClaims.${map.path}`] = f.value;
        } else if (map.source === 'trainingrequest') {
          filterMatch[`trainingRequests.${map.path}`] = f.value;
        }
      });
      if (Object.keys(filterMatch).length > 0) {
        pipeline.push({ $match: filterMatch });
      }
    }

    // Add grouping if specified
    if (groupBy.length > 0) {
      const groupId = {};
      groupBy.forEach(g => {
        const map = fieldMappings[g.id];
        if (map) {
          if (map.source === 'user') {
            groupId[g.id] = `$${map.path}`;
          } else if (map.source === 'salarystructure') {
            groupId[g.id] = `$salaryStructure.${map.path}`;
          } else if (map.source === 'payroll') {
            groupId[g.id] = `$payroll.${map.path}`;
          } else if (map.source === 'expenseclaim') {
            groupId[g.id] = { $first: `$expenseClaims.${map.path}` };
          } else if (map.source === 'trainingrequest') {
            groupId[g.id] = { $first: `$trainingRequests.${map.path}` };
          }
        }
      });
      
      const groupFields = {};
      columns.forEach(col => {
        const map = fieldMappings[col.id];
        if (!map) return;
        
        if (map.source === 'user') {
          groupFields[col.id] = { $first: `$${map.path}` };
        } else if (map.source === 'salarystructure') {
          groupFields[col.id] = { $first: `$salaryStructure.${map.path}` };
        } else if (map.source === 'payroll') {
          groupFields[col.id] = { $first: `$payroll.${map.path}` };
        } else if (map.source === 'expenseclaim') {
          groupFields[col.id] = { $first: `$expenseClaims.${map.path}` };
        } else if (map.source === 'trainingrequest') {
          groupFields[col.id] = { $first: `$trainingRequests.${map.path}` };
        }
      });
      
      pipeline.push({
        $group: {
          _id: groupId,
          ...groupFields
        }
      });
    }

    // Build projection
    const project = {};
    columns.forEach(col => {
      const map = fieldMappings[col.id];
      if (!map) return;
      
      if (groupBy.length > 0) {
        if (groupBy.find(g => g.id === col.id)) {
          project[col.id] = `$_id.${col.id}`;
        } else {
          project[col.id] = `$${col.id}`;
        }
      } else {
        if (map.source === 'user') {
          project[col.id] = `$${map.path}`;
        } else if (map.source === 'salarystructure') {
          project[col.id] = `$salaryStructure.${map.path}`;
        } else if (map.source === 'payroll') {
          project[col.id] = `$payroll.${map.path}`;
        } else if (map.source === 'expenseclaim') {
          project[col.id] = { $first: `$expenseClaims.${map.path}` };
        } else if (map.source === 'trainingrequest') {
          project[col.id] = { $first: `$trainingRequests.${map.path}` };
        }
      }
    });

    pipeline.push({ $project: project });

    // Execute aggregation
    const data = await User.aggregate(pipeline);

    if (data.length === 0) {
      return res.status(400).json({ error: 'No data to save' });
    }

    // Create CSV content
    const headers = columns.map(col => col.label || col.id);
    const csvRows = [headers.join(',')];

    data.forEach(row => {
      const values = columns.map(col => {
        const value = row[col.id];
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csvRows.push(values.join(','));
    });

    const csvContent = csvRows.join('\n');

    // Create a mock file object for S3 upload
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const sanitizedName = reportName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `${sanitizedName}-${timestamp}.csv`;
    
    const mockFile = {
      buffer: Buffer.from(csvContent, 'utf8'),
      mimetype: 'text/csv',
      originalname: filename
    };

    // Upload to S3
    const s3Url = await uploadToS3(mockFile, 'reports');
    
    // Extract S3 key from URL for database storage
    const s3Key = s3Url.split('/').slice(-2).join('/'); // Get 'reports/filename.csv'
    
    // Save report metadata to database
    const savedReport = new SavedReport({
      name: reportName,
      filename: filename,
      s3Url: s3Url,
      s3Key: s3Key,
      reportConfig: {
        columns,
        groupBy,
        filters: activeFilters,
        source
      },
      recordCount: data.length,
      fileSize: Buffer.byteLength(csvContent, 'utf8'),
      createdBy: req.user._id,
      organization: req.user.organization._id
    });
    
    await savedReport.save();
    
    return res.json({ 
      success: true, 
      message: 'Report saved successfully',
      url: s3Url,
      filename: filename,
      recordCount: data.length,
      reportId: savedReport._id
    });

  } catch (err) {
    console.error('Save report error:', err);
    return res.status(500).json({ error: 'Failed to save report' });
  }
};

// Get saved reports
const getSavedReports = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const query = {
      organization: req.user.organization._id
    };
    
    // Add search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const reports = await SavedReport.find(query)
      .populate('createdBy', 'fullName email')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();
    
    const total = await SavedReport.countDocuments(query);
    
    return res.json({
      reports,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalReports: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
    
  } catch (err) {
    console.error('Get saved reports error:', err);
    return res.status(500).json({ error: 'Failed to fetch saved reports' });
  }
};

// Download saved report
const downloadSavedReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    
    const report = await SavedReport.findOne({
      _id: reportId,
      organization: req.user.organization._id
    });
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    // Update download count and last downloaded
    await SavedReport.findByIdAndUpdate(reportId, {
      $inc: { downloadCount: 1 },
      lastDownloaded: new Date()
    });
    
    // Redirect to S3 URL for download
    return res.redirect(report.s3Url);
    
  } catch (err) {
    console.error('Download saved report error:', err);
    return res.status(500).json({ error: 'Failed to download report' });
  }
};

// Delete saved report
const deleteSavedReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    
    const report = await SavedReport.findOne({
      _id: reportId,
      organization: req.user.organization._id
    });
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    // Delete from S3
    try {
      await deleteFile(report.s3Key);
    } catch (s3Error) {
      console.warn('Failed to delete from S3:', s3Error);
      // Continue with database deletion even if S3 deletion fails
    }
    
    // Delete from database
    await SavedReport.findByIdAndDelete(reportId);
    
    return res.json({ 
      success: true, 
      message: 'Report deleted successfully' 
    });
    
  } catch (err) {
    console.error('Delete saved report error:', err);
    return res.status(500).json({ error: 'Failed to delete report' });
  }
};

// Get saved report details
const getSavedReportDetails = async (req, res) => {
  try {
    const { reportId } = req.params;
    
    const report = await SavedReport.findOne({
      _id: reportId,
      organization: req.user.organization._id
    }).populate('createdBy', 'fullName email');
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    return res.json({ report });
    
  } catch (err) {
    console.error('Get saved report details error:', err);
    return res.status(500).json({ error: 'Failed to fetch report details' });
  }
};

module.exports = { 
  generateCustomReport, 
  exportReport, 
  saveReport, 
  getSavedReports, 
  downloadSavedReport, 
  deleteSavedReport, 
  getSavedReportDetails 
}; 