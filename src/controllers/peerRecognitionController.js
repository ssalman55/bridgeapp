const PeerRecognition = require('../models/PeerRecognition');
const User = require('../models/User');
const Notification = require('../models/Notification');
const notificationService = require('../services/notificationService');

// Staff: Submit a recognition
exports.submitRecognition = async (req, res) => {
  try {
    const { comment, recognized } = req.body;
    const recognition = new PeerRecognition({
      submitter: req.user._id,
      recognized: recognized || undefined,
      comment,
      status: 'pending',
      organization: req.user.organization._id || req.user.organization,
    });
    await recognition.save();

    // Notify all admins in the same organization
    const admins = await User.find({ organization: req.user.organization, role: 'admin', status: { $ne: 'archived' } });
    const staffName = req.user.fullName;
    const message = `${staffName} submitted a peer recognition`;
    const link = '/admin/peer-recognitions';
    await Promise.all(admins.map(admin => Notification.create({
      message,
      type: 'peer',
      link,
      recipient: admin._id,
      sender: req.user._id,
      organization: req.user.organization
    })));

    res.status(201).json({ message: 'Recognition submitted for review.', recognition });
  } catch (err) {
    console.error('Error in submitRecognition:', err);
    res.status(500).json({ message: 'Failed to submit recognition', error: err.message });
  }
};

// List recognitions
exports.listRecognitions = async (req, res) => {
  try {
    let filter = { organization: req.user.organization };
    const { status } = req.query;

    if (status) {
      filter.status = status;
    } else if (req.user.role !== 'admin') {
      // Staff default: only approved
      filter.status = 'approved';
    }

    let recognitions = await PeerRecognition.find(filter)
      .populate('submitter', 'fullName email')
      .populate('recognized', 'fullName email')
      .sort({ createdAt: -1 });

    res.json(recognitions);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch recognitions', error: err.message });
  }
};

// Admin: Approve recognition
exports.approveRecognition = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const { id } = req.params;
    const recognition = await PeerRecognition.findById(id);
    if (!recognition) return res.status(404).json({ message: 'Recognition not found' });
    recognition.status = 'approved';
    recognition.adminNote = '';
    await recognition.save();
    // Notify the user whose recognition was approved
    await notificationService.notifyUser({
      userId: recognition.recognized,
      organization: recognition.organization,
      message: 'Your peer recognition has been approved.',
      type: 'peer',
      link: '/admin/peer-recognitions',
      sender: req.user._id
    });
    res.json({ message: 'Recognition approved', recognition });
  } catch (err) {
    res.status(500).json({ message: 'Failed to approve recognition', error: err.message });
  }
};

// Admin: Reject recognition
exports.rejectRecognition = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const { id } = req.params;
    const { adminNote } = req.body;
    const recognition = await PeerRecognition.findById(id);
    if (!recognition) return res.status(404).json({ message: 'Recognition not found' });
    recognition.status = 'rejected';
    recognition.adminNote = adminNote || '';
    await recognition.save();
    // Notify the user whose recognition was rejected
    await notificationService.notifyUser({
      userId: recognition.recognized,
      organization: recognition.organization,
      message: 'Your peer recognition has been rejected.',
      type: 'peer',
      link: '/admin/peer-recognitions',
      sender: req.user._id
    });
    res.json({ message: 'Recognition rejected', recognition });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reject recognition', error: err.message });
  }
}; 