const PerformanceEvaluation = require('../models/PerformanceEvaluation');
const User = require('../models/User');
const Notification = require('../models/Notification');
const notificationService = require('../services/notificationService');
const Document = require('../models/Document');
const { getSignedUrl } = require('../utils/s3');

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
    
    // Send email to staff member
    try {
      const staff = await User.findById(staffId).select('fullName email');
      const organization = req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id
        ? req.user.organization
        : await require('../models/Organization').findById(req.user.organization._id || req.user.organization).select('name');
      
      if (staff && organization) {
        const { sendPerformanceEvaluationEmail } = require('../services/emailService');
        await sendPerformanceEvaluationEmail({
          organization,
          staff,
          admin: { fullName: req.user.fullName, email: req.user.email },
          evaluation
        });
      }
    } catch (emailErr) {
      console.error('Failed to send performance evaluation email:', emailErr);
    }
    
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
    const evaluation = await PerformanceEvaluation.findById(id).populate('staff evaluator', 'fullName email');
    if (!evaluation) return res.status(404).json({ message: 'Evaluation not found' });

    // Determine who is making the update
    const isStaff = req.user.role === 'staff' && evaluation.staff.toString() === req.user._id.toString();
    const isEvaluator = req.user._id.toString() === evaluation.evaluator.toString();
    
    // Track what changed for notification purposes
    const changes = [];
    if (goals) {
      evaluation.goals = goals;
      changes.push('goals');
    }
    if (typeof feedback !== 'undefined') {
      evaluation.feedback = feedback;
      changes.push('feedback');
    }
    if (typeof status !== 'undefined') {
      evaluation.status = status;
      changes.push('status');
    }
    if (typeof initialFeedback !== 'undefined') {
      evaluation.initialFeedback = initialFeedback;
      changes.push('initial feedback');
    }
    if (typeof midyearFeedback !== 'undefined') {
      evaluation.midyearFeedback = midyearFeedback;
      changes.push('midyear feedback');
    }
    if (typeof yearendFeedback !== 'undefined') {
      evaluation.yearendFeedback = yearendFeedback;
      changes.push('yearend feedback');
    }

    await evaluation.save();

    // Populate document references for all SMART goal doc fields
    await evaluation.populate([
      'goals.specificDocs',
      'goals.measurableDocs',
      'goals.achievableDocs',
      'goals.relevantDocs',
      'goals.timeBoundDocs'
    ]);

    // Send notifications if there were actual changes
    if (changes.length > 0) {
      try {
        const Organization = require('../models/Organization');
        const organization = req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id
          ? req.user.organization
          : await Organization.findById(evaluation.organization).select('name');

        if (isStaff) {
          // Staff updated → notify evaluator/admin
          if (evaluation.evaluator && organization) {
            const evaluator = typeof evaluation.evaluator === 'object' ? evaluation.evaluator : await User.findById(evaluation.evaluator).select('fullName email');
            if (!evaluator) {
              console.error('Evaluator not found for evaluation:', evaluation._id);
            } else {
            const updateType = changes.includes('status') ? 'status' : 
                             changes.includes('feedback') || changes.includes('initial feedback') || changes.includes('midyear feedback') || changes.includes('yearend feedback') ? 'feedback' : 
                             'goals';
            
            await notificationService.notifyUser({
              userId: evaluation.evaluator,
              organization: evaluation.organization,
              message: `${req.user.fullName} updated the performance evaluation (${changes.join(', ')})`,
              type: 'performance',
              link: `/admin/performance-evaluations?id=${evaluation._id}`,
              sender: req.user._id
            });

            // Send email to evaluator
            try {
              const { sendPerformanceEvaluationUpdateEmail } = require('../services/emailService');
              await sendPerformanceEvaluationUpdateEmail({
                organization,
                recipient: evaluator,
                updater: { fullName: req.user.fullName, email: req.user.email },
                evaluation,
                updateType,
                changes
              });
            } catch (emailErr) {
              console.error('Failed to send performance evaluation update email to evaluator:', emailErr);
            }
            }
          }
        } else if (isEvaluator) {
          // Evaluator/admin updated → notify staff
          if (evaluation.staff && organization) {
            const staff = typeof evaluation.staff === 'object' ? evaluation.staff : await User.findById(evaluation.staff).select('fullName email');
            if (!staff) {
              console.error('Staff not found for evaluation:', evaluation._id);
            } else {
            const updateType = changes.includes('status') ? 'status' : 
                             changes.includes('feedback') || changes.includes('initial feedback') || changes.includes('midyear feedback') || changes.includes('yearend feedback') ? 'feedback' : 
                             'goals';
            
            await notificationService.notifyUser({
              userId: evaluation.staff,
              organization: evaluation.organization,
              message: `${req.user.fullName} updated your performance evaluation (${changes.join(', ')})`,
              type: 'performance',
              link: `/my-evaluations?id=${evaluation._id}`,
              sender: req.user._id
            });

            // Send email to staff
            try {
              const { sendPerformanceEvaluationUpdateEmail } = require('../services/emailService');
              await sendPerformanceEvaluationUpdateEmail({
                organization,
                recipient: staff,
                updater: { fullName: req.user.fullName, email: req.user.email },
                evaluation,
                updateType,
                changes
              });
            } catch (emailErr) {
              console.error('Failed to send performance evaluation update email to staff:', emailErr);
            }
            }
          }
        }
      } catch (notifErr) {
        console.error('Failed to send performance evaluation update notifications:', notifErr);
      }
    }

    res.json(evaluation);
  } catch (err) {
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
    
    // Convert profile image S3 keys to signed URLs
    const evaluationsWithSignedUrls = evaluations.map(evaluation => {
      if (evaluation.staff && evaluation.staff.profileImage && evaluation.staff.profileImage.startsWith('profile-images/')) {
        try {
          evaluation.staff.profileImage = getSignedUrl(evaluation.staff.profileImage, 3600);
        } catch (error) {
          console.warn('Could not generate signed URL for profile image:', error.message);
          evaluation.staff.profileImage = null;
        }
      }
      if (evaluation.evaluator && evaluation.evaluator.profileImage && evaluation.evaluator.profileImage.startsWith('profile-images/')) {
        try {
          evaluation.evaluator.profileImage = getSignedUrl(evaluation.evaluator.profileImage, 3600);
        } catch (error) {
          console.warn('Could not generate signed URL for profile image:', error.message);
          evaluation.evaluator.profileImage = null;
        }
      }
      return evaluation;
    });
    
    res.json(evaluationsWithSignedUrls);
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
      { path: 'goals.comments.replies.documents', select: 'title fileUrl fileType uploadedBy createdAt' },
      { path: 'staff', select: 'fullName email' },
      { path: 'evaluator', select: 'fullName email' }
    ]);

    // Send notifications for new comments
    try {
      const Organization = require('../models/Organization');
      const organization = req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id
        ? req.user.organization
        : await Organization.findById(evaluation.organization).select('name');

      if (isStaff) {
        // Staff commented → notify evaluator
        if (organization && evaluation.evaluator) {
          await notificationService.notifyUser({
            userId: evaluation.evaluator._id,
            organization: evaluation.organization,
            message: `${req.user.fullName} added a comment to the performance evaluation`,
            type: 'performance',
            link: `/admin/performance-evaluations?id=${evaluation._id}`,
            sender: req.user._id
          });

          // Send email to evaluator
          try {
            const { sendPerformanceEvaluationCommentEmail } = require('../services/emailService');
            await sendPerformanceEvaluationCommentEmail({
              organization,
              recipient: evaluation.evaluator,
              commenter: { fullName: req.user.fullName, email: req.user.email },
              evaluation,
              comment,
              goalIndex
            });
          } catch (emailErr) {
            console.error('Failed to send performance evaluation comment email to evaluator:', emailErr);
          }
        }
      } else if (isEvaluator) {
        // Evaluator commented → notify staff
        if (organization && evaluation.staff) {
          await notificationService.notifyUser({
            userId: evaluation.staff._id,
            organization: evaluation.organization,
            message: `${req.user.fullName} added feedback to your performance evaluation`,
            type: 'performance',
            link: `/my-evaluations?id=${evaluation._id}`,
            sender: req.user._id
          });

          // Send email to staff
          try {
            const { sendPerformanceEvaluationCommentEmail } = require('../services/emailService');
            await sendPerformanceEvaluationCommentEmail({
              organization,
              recipient: evaluation.staff,
              commenter: { fullName: req.user.fullName, email: req.user.email },
              evaluation,
              comment,
              goalIndex
            });
          } catch (emailErr) {
            console.error('Failed to send performance evaluation comment email to staff:', emailErr);
          }
        }
      }
    } catch (notifErr) {
      console.error('Failed to send performance evaluation comment notifications:', notifErr);
    }

    res.json(evaluation);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add comment', error: err.message });
  }
};

// Recursively populate documents in all comments and replies
async function populateCommentDocuments(comments) {
  for (const comment of comments) {
    if (comment.documents && comment.documents.length > 0) {
      // If already populated, skip
      if (!comment.documents[0].fileUrl) {
        comment.documents = await Document.find({ _id: { $in: comment.documents } }, 'title fileUrl fileType uploadedBy createdAt');
      }
    }
    if (comment.replies && comment.replies.length > 0) {
      await populateCommentDocuments(comment.replies);
    }
  }
} 