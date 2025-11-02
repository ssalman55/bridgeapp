const PerformanceEvaluation = require('../models/PerformanceEvaluation');
const notificationService = require('../services/notificationService');
const Document = require('../models/Document');

// Admin/Academic Admin: Create a new evaluation for a staff member
exports.createEvaluation = async (req, res) => {
  try {
    const { staffId, goals } = req.body;
    const evaluation = new PerformanceEvaluation({
      staff: staffId,
      evaluator: req.user._id,
      goals,
      status: 'pending',
      organization: req.user.organization._id,
    });
    await evaluation.save();
    // Notify the staff member
    await notificationService.notifyUser({
      userId: staffId,
      organization: req.user.organization._id,
      message: 'A new performance evaluation has been created for you.',
      type: 'performance',
      link: `/my-evaluations?id=${evaluation._id}`,
      sender: req.user._id
    });
    res.status(201).json(evaluation);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create evaluation', error: err.message });
  }
};

// Admin/Academic Admin: Update evaluation (goals, feedback, status)
exports.updateEvaluation = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      goals,
      feedback,
      status,
      initialFeedback,
      midyearFeedback,
      yearendFeedback
    } = req.body;
    const evaluation = await PerformanceEvaluation.findById(id);
    if (!evaluation) return res.status(404).json({ message: 'Evaluation not found' });

    if (goals) {
      const mongoose = require('mongoose');
      console.log('Incoming goals payload:', JSON.stringify(goals, null, 2));
      goals.forEach(goal => {
        ['specificDocs', 'measurableDocs', 'achievableDocs', 'relevantDocs', 'timeBoundDocs'].forEach(field => {
          if (Array.isArray(goal[field])) {
            goal[field] = goal[field].map(id => (typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id));
          }
        });
      });
      evaluation.goals = goals;
    }
    if (typeof feedback !== 'undefined') evaluation.feedback = feedback;
    if (typeof status !== 'undefined') evaluation.status = status;
    if (typeof initialFeedback !== 'undefined') evaluation.initialFeedback = initialFeedback;
    if (typeof midyearFeedback !== 'undefined') evaluation.midyearFeedback = midyearFeedback;
    if (typeof yearendFeedback !== 'undefined') evaluation.yearendFeedback = yearendFeedback;

    await evaluation.save();

    // Populate document references for all SMART goal doc fields
    await evaluation.populate([
      { path: 'goals.specificDocs', select: 'title fileUrl fileType uploadedBy createdAt' },
      { path: 'goals.measurableDocs', select: 'title fileUrl fileType uploadedBy createdAt' },
      { path: 'goals.achievableDocs', select: 'title fileUrl fileType uploadedBy createdAt' },
      { path: 'goals.relevantDocs', select: 'title fileUrl fileType uploadedBy createdAt' },
      { path: 'goals.timeBoundDocs', select: 'title fileUrl fileType uploadedBy createdAt' }
    ]);

    res.json(evaluation);
  } catch (err) {
    console.error('Update evaluation error:', err);
    res.status(500).json({ message: 'Failed to update evaluation', error: err.message });
  }
};

// Get evaluations (admin/academic admin: all, staff: own)
exports.getEvaluations = async (req, res) => {
  try {
    let query = { organization: req.user.organization };
    if (req.user.role === 'staff') {
      query.staff = req.user._id;
    } else if (req.query.staffId) {
      query.staff = req.query.staffId;
    }
    const evaluations = await PerformanceEvaluation.find(query)
      .populate('staff', 'fullName email profileImage')
      .populate('evaluator', 'fullName email profileImage')
      .sort({ evaluationDate: -1 });
    res.json(evaluations);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch evaluations', error: err.message });
  }
};

// Get a single evaluation (admin/academic admin/staff)
exports.getEvaluationById = async (req, res) => {
  try {
    const { id } = req.params;
    const evaluation = await PerformanceEvaluation.findOne({
      _id: id,
      organization: req.user.organization
    })
      .populate('staff', 'fullName email profileImage')
      .populate('evaluator', 'fullName email profileImage');
    if (!evaluation) return res.status(404).json({ message: 'Evaluation not found' });
    
    // Allow access if user is staff member being evaluated, or has permission (checked by middleware)
    if (req.user.role === 'staff' && evaluation.staff._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    await evaluation.populate([
      { path: 'goals.specificDocs', select: 'title fileUrl fileType uploadedBy createdAt' },
      { path: 'goals.measurableDocs', select: 'title fileUrl fileType uploadedBy createdAt' },
      { path: 'goals.achievableDocs', select: 'title fileUrl fileType uploadedBy createdAt' },
      { path: 'goals.relevantDocs', select: 'title fileUrl fileType uploadedBy createdAt' },
      { path: 'goals.timeBoundDocs', select: 'title fileUrl fileType uploadedBy createdAt' }
    ]);
    res.json(evaluation);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch evaluation', error: err.message });
  }
};

// Staff: Add a comment to their evaluation (with optional evidence)
exports.addStaffComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, goalIndex, documents, parentCommentId } = req.body;
    const evaluation = await PerformanceEvaluation.findById(id);
    if (!evaluation) return res.status(404).json({ message: 'Evaluation not found' });
    const isStaff = req.user.role === 'staff' && evaluation.staff.toString() === req.user._id.toString();
    const isEvaluator = req.user._id.toString() === evaluation.evaluator.toString();
    if (!isStaff && !isEvaluator) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const docIds = Array.isArray(documents) ? documents : (documents ? [documents] : []);

    function findAndReply(comments) {
      for (let c of comments) {
        if (c._id && c._id.toString() === parentCommentId) {
          c.replies.push({
            author: req.user._id,
            role: isStaff ? 'staff' : 'admin',
            text: comment,
            date: new Date(),
            replies: [],
            documents: docIds
          });
          return true;
        }
        if (c.replies && c.replies.length > 0) {
          if (findAndReply(c.replies)) return true;
        }
      }
      return false;
    }

    if (typeof goalIndex === 'number' && goalIndex >= 0 && goalIndex < evaluation.goals.length) {
      if (parentCommentId) {
        // Add as a reply to a specific comment
        if (!findAndReply(evaluation.goals[goalIndex].comments)) {
          return res.status(404).json({ message: 'Parent comment not found' });
        }
      } else {
        // Add comment to specific goal (top-level)
        evaluation.goals[goalIndex].comments.push({
          author: req.user._id,
          role: isStaff ? 'staff' : 'admin',
          text: comment,
          date: new Date(),
          replies: [],
          documents: docIds
        });
      }
    } else {
      // Add comment to overall evaluation (legacy, no evidence)
      evaluation.staffComments.push({ comment, date: new Date() });
    }

    await evaluation.save();
    await evaluation.populate([
      { path: 'goals.comments.documents', select: 'title fileUrl fileType uploadedBy createdAt' },
      { path: 'goals.comments.replies.documents', select: 'title fileUrl fileType uploadedBy createdAt' }
    ]);
    res.json(evaluation);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add comment', error: err.message });
  }
}; 