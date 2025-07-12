const ExpenseClaim = require('../models/ExpenseClaim');
const notificationService = require('../services/notificationService');
const Document = require('../models/Document');

// Staff: Create or update claim (draft/submit)
exports.createOrUpdateClaim = async (req, res) => {
  try {
    const { id, documents } = req.body;
    let claim;
    if (id) {
      claim = await ExpenseClaim.findOne({ _id: id, staffId: req.user._id, organization: req.user.organization });
      if (!claim) return res.status(404).json({ message: 'Claim not found' });
      Object.assign(claim, req.body, { status: req.body.status || claim.status });
    } else {
      claim = new ExpenseClaim({ ...req.body, staffId: req.user._id, organization: req.user.organization });
    }
    // Handle file uploads
    if (req.files && req.files.length > 0) {
      claim.receipts = req.files.map(f => ({
        filename: f.filename,
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        url: `/uploads/expense-claims/${f.filename}`
      }));
    }
    // --- Document attachment logic ---
    let newDocIds = Array.isArray(documents) ? documents : (documents ? [documents] : []);
    // Only allow attaching documents owned by the user and in the same org
    if (newDocIds.length > 0) {
      const validDocs = await Document.find({ _id: { $in: newDocIds }, uploadedBy: req.user._id, organization: req.user.organization });
      newDocIds = validDocs.map(doc => doc._id.toString());
    }
    // Compare previous and new document arrays for audit logs
    const prevDocIds = (claim.documents || []).map(id => id.toString());
    // Attach new docs
    const attachedNow = newDocIds.filter(id => !prevDocIds.includes(id));
    // Removed docs
    const removedNow = prevDocIds.filter(id => !newDocIds.includes(id));
    // Update claim documents
    claim.documents = newDocIds;
    // Audit log
    if (!claim.documentAuditLogs) claim.documentAuditLogs = [];
    attachedNow.forEach(docId => {
      claim.documentAuditLogs.push({
        document: docId,
        attachedBy: req.user._id,
        action: 'attached',
        attachedAt: new Date()
      });
    });
    removedNow.forEach(docId => {
      claim.documentAuditLogs.push({
        document: docId,
        attachedBy: req.user._id,
        action: 'removed',
        attachedAt: new Date()
      });
    });
    // --- End document logic ---
    if (claim.status === 'Pending' && !claim.submittedAt) {
      claim.submittedAt = new Date();
    }
    await claim.save();
    // Notify all admins if claim is submitted (status === 'Pending')
    if (claim.status === 'Pending') {
      await notificationService.notifyAllUsers({
        organization: claim.organization,
        message: `${req.user.fullName} submitted a new expense claim.`,
        type: 'expense',
        link: '/admin/expense-claims/pending',
        sender: req.user._id,
        roles: ['admin']
      });
    }
    res.status(201).json(claim);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Staff: List my claims
exports.getMyClaims = async (req, res) => {
  try {
    const claims = await ExpenseClaim.find({ staffId: req.user._id, organization: req.user.organization })
      .populate('documents')
      .sort({ createdAt: -1 });
    res.json(claims);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: List claims with filters
exports.getAllClaims = async (req, res) => {
  try {
    const { status, staffId, category } = req.query;
    const query = { organization: req.user.organization };
    if (status) query.status = status;
    if (staffId) query.staffId = staffId;
    if (category) query.category = category;
    const claims = await ExpenseClaim.find(query)
      .populate('staffId', 'fullName email department profileImage')
      .populate('approvedRejectedBy', 'fullName profileImage')
      .populate('documents')
      .sort({ createdAt: -1 });
    res.json(claims);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: Approve or reject
exports.approveOrReject = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminComment } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const claim = await ExpenseClaim.findOne({ _id: id, organization: req.user.organization });
    if (!claim) return res.status(404).json({ message: 'Claim not found' });
    claim.status = status;
    claim.decisionDate = new Date();
    claim.approvedRejectedBy = req.user._id;
    claim.approvalLogs.push({
      status,
      adminId: req.user._id,
      comment: adminComment,
      date: new Date()
    });
    await claim.save();
    // Notify the user whose claim was actioned
    await notificationService.notifyUser({
      userId: claim.staffId,
      organization: claim.organization,
      message: `Your expense claim has been ${status.toLowerCase()}.`,
      type: 'expense',
      link: '/expense-claims',
      sender: req.user._id
    });
    res.json(claim);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin/Staff: Get claim by ID
exports.getClaimById = async (req, res) => {
  try {
    const { id } = req.params;
    const claim = await ExpenseClaim.findOne({ _id: id, organization: req.user.organization })
      .populate('staffId', 'fullName email department')
      .populate('documents');
    if (!claim) return res.status(404).json({ message: 'Claim not found' });
    res.json(claim);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Staff: Delete own claim
exports.deleteClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const claim = await ExpenseClaim.findOne({ _id: id, staffId: req.user._id, organization: req.user.organization });
    if (!claim) return res.status(404).json({ message: 'Claim not found' });
    if (['Approved', 'Rejected'].includes(claim.status)) {
      return res.status(400).json({ message: 'Cannot delete an approved or rejected claim' });
    }
    await claim.deleteOne();
    res.json({ success: true, message: 'Expense claim deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}; 