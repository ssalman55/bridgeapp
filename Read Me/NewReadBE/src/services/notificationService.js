const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Notify all users in the organization (optionally filter by role)
 * @param {Object} params
 * @param {String} params.organization - Organization ID
 * @param {String} params.message - Notification message
 * @param {String} params.type - Notification type
 * @param {String} params.link - Link for notification
 * @param {String} [params.sender] - Sender user ID
 * @param {String[]} [params.excludeUserIds] - User IDs to exclude
 * @param {String[]} [params.roles] - Only notify users with these roles (optional)
 */
async function notifyAllUsers({ organization, message, type, link, sender, excludeUserIds = [], roles }) {
  try {
    const query = { organization };
    if (roles && roles.length) query.role = { $in: roles };
    if (excludeUserIds.length) query._id = { $nin: excludeUserIds };
    const users = await User.find(query).select('_id');
    if (!users.length) return;
    await Notification.insertMany(users.map(u => ({
      message,
      type,
      link,
      recipient: u._id,
      sender,
      organization
    })));
    // Optionally: send email here
  } catch (err) {
    console.error('notifyAllUsers error:', err);
  }
}

/**
 * Notify specific users
 * @param {Object} params
 * @param {String[]} params.userIds - Array of user IDs
 * @param {String} params.organization - Organization ID
 * @param {String} params.message - Notification message
 * @param {String} params.type - Notification type
 * @param {String} params.link - Link for notification
 * @param {String} [params.sender] - Sender user ID
 */
async function notifyUsers({ userIds, organization, message, type, link, sender }) {
  try {
    if (!userIds || !userIds.length) return;
    await Notification.insertMany(userIds.map(id => ({
      message,
      type,
      link,
      recipient: id,
      sender,
      organization
    })));
    // Optionally: send email here
  } catch (err) {
    console.error('notifyUsers error:', err);
  }
}

/**
 * Notify a single user
 * @param {Object} params
 * @param {String} params.userId - User ID
 * @param {String} params.organization - Organization ID
 * @param {String} params.message - Notification message
 * @param {String} params.type - Notification type
 * @param {String} params.link - Link for notification
 * @param {String} [params.sender] - Sender user ID
 */
async function notifyUser({ userId, organization, message, type, link, sender }) {
  try {
    await Notification.create({
      message,
      type,
      link,
      recipient: userId,
      sender,
      organization
    });
    // Optionally: send email here
  } catch (err) {
    console.error('notifyUser error:', err);
  }
}

/**
 * Notify all users with role-aware links
 * @param {Object} params
 * @param {String} params.organization - Organization ID
 * @param {String} params.message - Notification message
 * @param {String} params.type - Notification type
 * @param {String} params.adminLink - Link for admin users
 * @param {String} params.staffLink - Link for staff users
 * @param {String} [params.sender] - Sender user ID
 * @param {String[]} [params.excludeUserIds] - User IDs to exclude
 */
async function notifyAllUsersWithRoleAwareLinks({ organization, message, type, adminLink, staffLink, sender, excludeUserIds = [] }) {
  try {
    const users = await User.find({ 
      organization, 
      _id: { $nin: excludeUserIds || [] },
      status: { $ne: 'archived' }
    }).select('_id role');
    
    if (!users.length) return;
    
    const notifications = users.map(user => ({
      message,
      type,
      link: user.role === 'admin' ? adminLink : staffLink,
      recipient: user._id,
      sender,
      organization
    }));
    
    await Notification.insertMany(notifications);
  } catch (err) {
    console.error('notifyAllUsersWithRoleAwareLinks error:', err);
  }
}

module.exports = {
  notifyAllUsers,
  notifyUsers,
  notifyUser,
  notifyAllUsersWithRoleAwareLinks
}; 