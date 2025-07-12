const SalaryGrade = require('../models/SalaryGrade');
const SalaryStructure = require('../models/SalaryStructure');
const User = require('../models/User');
const { Parser } = require('json2csv');
const PayrollAuditLog = require('../models/PayrollAuditLog');

// Salary Grade CRUD
exports.createGrade = async (req, res) => {
  try {
    const grade = await SalaryGrade.create(req.body);
    res.status(201).json(grade);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getGrades = async (req, res) => {
  try {
    const grades = await SalaryGrade.find({ organization: req.user.organization });
    res.json(grades);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateGrade = async (req, res) => {
  try {
    const grade = await SalaryGrade.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      req.body,
      { new: true }
    );
    if (!grade) return res.status(404).json({ error: 'Salary grade not found' });
    res.json(grade);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteGrade = async (req, res) => {
  try {
    const grade = await SalaryGrade.findOneAndDelete({ 
      _id: req.params.id,
      organization: req.user.organization 
    });
    if (!grade) return res.status(404).json({ error: 'Salary grade not found' });
    res.json({ message: 'Grade deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Salary Structure CRUD
exports.createOrUpdateStructure = async (req, res) => {
  try {
    const {
      staff,
      basic = 0,
      housing = 0,
      utility = 0,
      bonus = 0,
      transport = 0,
      reimbursements = 0,
      deductions = 0,
      taxes = 0,
      notes = '',
      paymentMethod = 'Bank Transfer',
      bankDetails = {},
      status = 'draft',
      locked = false
    } = req.body;

    // Auto-calculate netSalary
    const netSalary =
      Number(basic) +
      Number(housing) +
      Number(utility) +
      Number(bonus) +
      Number(transport) +
      Number(reimbursements) -
      (Number(deductions) + Number(taxes));

    // Find or create structure for staff
    let structure = await SalaryStructure.findOne({ staff });
    const data = {
      staff,
      organization: req.user.organization,
      basic,
      housing,
      utility,
      bonus,
      transport,
      reimbursements,
      deductions,
      taxes,
      notes,
      netSalary,
      paymentMethod,
      bankDetails,
      status,
      locked
    };
    let prevValue = structure ? `Basic: ${structure.basic}` : '';
    let newValue = `Basic: ${basic}`;
    if (structure) {
      structure = await SalaryStructure.findOneAndUpdate({ staff }, data, { new: true });
    } else {
      structure = await SalaryStructure.create(data);
    }
    // Audit log
    await PayrollAuditLog.create({
      date: new Date(),
      action: 'edit',
      performedBy: req.user._id,
      staff,
      prevValue,
      newValue,
      notes: 'Salary structure edited',
      organization: req.user.organization
    });
    res.status(201).json(structure);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Toggle status (submitted/unsubmitted)
exports.toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const structure = await SalaryStructure.findOne({ 
      _id: id,
      organization: req.user.organization 
    });
    if (!structure) return res.status(404).json({ error: 'Salary structure not found' });
    const prevValue = structure.status;
    structure.status = structure.status === 'submitted' ? 'draft' : 'submitted';
    await structure.save();
    // Audit log
    await PayrollAuditLog.create({
      date: new Date(),
      action: structure.status === 'submitted' ? 'approve' : 'edit',
      performedBy: req.user._id,
      staff: structure.staff,
      prevValue,
      newValue: structure.status,
      notes: 'Status toggled',
      organization: req.user.organization
    });
    res.json(structure);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Lock/unlock salary structure
exports.toggleLock = async (req, res) => {
  try {
    const { id } = req.params;
    const structure = await SalaryStructure.findOne({ 
      _id: id,
      organization: req.user.organization 
    });
    if (!structure) return res.status(404).json({ error: 'Salary structure not found' });
    const prevValue = structure.locked ? 'Locked' : 'Unlocked';
    structure.locked = !structure.locked;
    await structure.save();
    // Audit log
    await PayrollAuditLog.create({
      date: new Date(),
      action: structure.locked ? 'lock' : 'unlock',
      performedBy: req.user._id,
      staff: structure.staff,
      prevValue,
      newValue: structure.locked ? 'Locked' : 'Unlocked',
      notes: 'Lock status toggled',
      organization: req.user.organization
    });
    res.json(structure);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getStructure = async (req, res) => {
  try {
    const structure = await SalaryStructure.findOne({ 
      staff: req.params.staffId,
      organization: req.user.organization 
    }).populate('staff', 'fullName email department profileImage');
    if (!structure) return res.status(404).json({ error: 'Salary structure not found' });
    res.json(structure);
  } catch (err) {
    res.status(404).json({ error: 'Salary structure not found' });
  }
};

exports.getAllStructures = async (req, res) => {
  try {
    const structures = await SalaryStructure.find({ organization: req.user.organization })
      .populate('staff', 'fullName email department profileImage');
    res.json(structures);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteStructure = async (req, res) => {
  try {
    const structure = await SalaryStructure.findOneAndDelete({ 
      _id: req.params.id,
      organization: req.user.organization 
    });
    if (!structure) return res.status(404).json({ error: 'Salary structure not found' });
    res.json({ message: 'Salary structure deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// CSV Import for Salary Structures
exports.importSalaryCSV = async (req, res) => {
  try {
    const records = req.body.records;
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'Invalid data format. Expected an array of records.' });
    }
    const results = { inserted: [], updated: [], failed: [] };
    for (const [i, rec] of records.entries()) {
      const {
        staff,
        basic = 0,
        housing = 0,
        utility = 0,
        bonus = 0,
        transport = 0,
        reimbursements = 0,
        deductions = 0,
        taxes = 0,
        notes = '',
      } = rec;
      // Validate required fields
      if (!staff) {
        results.failed.push({ row: i + 1, reason: 'Missing staff ID' });
        continue;
      }
      // Validate staff exists
      const user = await User.findById(staff);
      if (!user) {
        results.failed.push({ row: i + 1, staff, reason: 'Staff not found' });
        continue;
      }
      // Calculate net salary
      const netSalary =
        Number(basic) +
        Number(housing) +
        Number(utility) +
        Number(bonus) +
        Number(transport) +
        Number(reimbursements) -
        (Number(deductions) + Number(taxes));
      // Upsert salary structure
      let structure = await SalaryStructure.findOne({ staff });
      const data = {
        staff,
        organization: user.organization,
        basic,
        housing,
        utility,
        bonus,
        transport,
        reimbursements,
        deductions,
        taxes,
        notes,
        netSalary,
      };
      try {
        if (structure) {
          structure = await SalaryStructure.findOneAndUpdate({ staff }, data, { new: true });
          results.updated.push({ row: i + 1, staff });
        } else {
          structure = await SalaryStructure.create(data);
          results.inserted.push({ row: i + 1, staff });
        }
      } catch (err) {
        results.failed.push({ row: i + 1, staff, reason: err.message });
      }
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Download CSV Template with staff and salary data
exports.downloadSalaryCSVTemplate = async (req, res) => {
  try {
    // Get all staff for the admin's organization
    const staffList = await User.find({ organization: req.user.organization, role: 'staff', status: { $ne: 'archived' } })
      .select('_id fullName')
      .sort({ fullName: 1 });
    // Get all salary structures
    const structures = await SalaryStructure.find({ organization: req.user.organization });
    // Map staff to their salary structure
    const structureMap = {};
    structures.forEach(s => { structureMap[s.staff.toString()] = s; });
    // Prepare CSV rows
    const rows = staffList.map(staff => {
      const s = structureMap[staff._id.toString()] || {};
      return {
        'Staff ID': staff._id,
        'Staff Name': staff.fullName,
        'Basic Salary': s.basic || '',
        'Housing Allowance': s.housing || '',
        'Utility Allowance': s.utility || '',
        'Bonus': s.bonus || '',
        'Transport Allowance': s.transport || '',
        'Reimbursements': s.reimbursements || '',
        'Deductions': s.deductions || '',
        'Taxes': s.taxes || '',
        'Notes': s.notes || ''
      };
    });
    // CSV headers
    const fields = [
      'Staff ID',
      'Staff Name',
      'Basic Salary',
      'Housing Allowance',
      'Utility Allowance',
      'Bonus',
      'Transport Allowance',
      'Reimbursements',
      'Deductions',
      'Taxes',
      'Notes'
    ];
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);
    res.header('Content-Type', 'text/csv');
    res.attachment('salary_template.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Set status directly (draft/submitted)
exports.setStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['draft', 'submitted'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    const structure = await SalaryStructure.findOne({
      _id: id,
      organization: req.user.organization
    });
    if (!structure) return res.status(404).json({ error: 'Salary structure not found' });
    const prevValue = structure.status;
    structure.status = status;
    await structure.save();
    // Audit log
    await PayrollAuditLog.create({
      date: new Date(),
      action: status === 'submitted' ? 'approve' : 'edit',
      performedBy: req.user._id,
      staff: structure.staff,
      prevValue,
      newValue: status,
      notes: 'Status set directly',
      organization: req.user.organization
    });
    res.json(structure);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Set lock directly
exports.setLock = async (req, res) => {
  try {
    const { id } = req.params;
    const structure = await SalaryStructure.findOne({
      _id: id,
      organization: req.user.organization
    });
    if (!structure) return res.status(404).json({ error: 'Salary structure not found' });
    const prevValue = structure.locked ? 'Locked' : 'Unlocked';
    structure.locked = true;
    await structure.save();
    // Audit log
    await PayrollAuditLog.create({
      date: new Date(),
      action: 'lock',
      performedBy: req.user._id,
      staff: structure.staff,
      prevValue,
      newValue: 'Locked',
      notes: 'Locked directly',
      organization: req.user.organization
    });
    res.json(structure);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Set unlock directly
exports.setUnlock = async (req, res) => {
  try {
    const { id } = req.params;
    const structure = await SalaryStructure.findOne({
      _id: id,
      organization: req.user.organization
    });
    if (!structure) return res.status(404).json({ error: 'Salary structure not found' });
    const prevValue = structure.locked ? 'Locked' : 'Unlocked';
    structure.locked = false;
    await structure.save();
    // Audit log
    await PayrollAuditLog.create({
      date: new Date(),
      action: 'unlock',
      performedBy: req.user._id,
      staff: structure.staff,
      prevValue,
      newValue: 'Unlocked',
      notes: 'Unlocked directly',
      organization: req.user.organization
    });
    res.json(structure);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}; 