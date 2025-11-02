// Simple validation functions without zod dependency

// Base validation functions
const validateObjectId = (value) => {
  if (!value || typeof value !== 'string') return false;
  return /^[0-9a-fA-F]{24}$/.test(value);
};

const validateDate = (value) => {
  if (!value) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
};

const validateString = (value, minLength = 0, maxLength = Infinity) => {
  if (typeof value !== 'string') return false;
  return value.length >= minLength && value.length <= maxLength;
};

const validateNumber = (value, min = -Infinity, max = Infinity) => {
  if (typeof value !== 'number') return false;
  return value >= min && value <= max;
};

const validateBoolean = (value) => {
  return typeof value === 'boolean';
};

const validateArray = (value) => {
  return Array.isArray(value);
};

// Main validation functions
const validateCreateEvent = (eventData) => {
  console.log('Validating event data:', JSON.stringify(eventData, null, 2));
  
  if (!eventData || typeof eventData !== 'object') {
    console.log('Validation failed: Invalid eventData object');
    return false;
  }
  
  const isValid = validateString(eventData.title, 1, 200) &&
                  (!eventData.description || validateString(eventData.description, 0, 2000)) &&
                  ['internal', 'external'].includes(eventData.type) &&
                  validateObjectId(eventData.leadUserId) &&
                  (!eventData.sponsorDeptId || validateObjectId(eventData.sponsorDeptId)) &&
                  (!eventData.locationId || validateObjectId(eventData.locationId)) &&
                  (!eventData.locationText || validateString(eventData.locationText, 0, 200)) &&
                  validateDate(eventData.startsAt) &&
                  validateDate(eventData.endsAt) &&
                  (!eventData.expectedAttendees || validateNumber(eventData.expectedAttendees, 0)) &&
                  ['in-person', 'virtual', 'hybrid'].includes(eventData.attendanceMode) &&
                  validateBoolean(eventData.notifyOnCreate) &&
                  (!eventData.templateId || validateObjectId(eventData.templateId));
  
  console.log('Basic validation result:', isValid);
  
  // Additional validation: end time must be after start time
  if (isValid && eventData.startsAt && eventData.endsAt) {
    const startTime = new Date(eventData.startsAt);
    const endTime = new Date(eventData.endsAt);
    if (endTime <= startTime) {
      console.log('Validation failed: End time must be after start time');
      return false;
    }
  }
  
  // Location is optional - no additional validation needed
  
  console.log('Final validation result:', isValid);
  return isValid;
};

const validateUpdateEvent = (eventData) => {
  // For updates, all fields are optional, but if provided, they must be valid
  if (!eventData || typeof eventData !== 'object') return false;
  
  const validations = [];
  
  if (eventData.title !== undefined) validations.push(validateString(eventData.title, 1, 200));
  if (eventData.description !== undefined) validations.push(!eventData.description || validateString(eventData.description, 0, 2000));
  if (eventData.type !== undefined) validations.push(['internal', 'external'].includes(eventData.type));
  if (eventData.leadUserId !== undefined) validations.push(validateObjectId(eventData.leadUserId));
  if (eventData.sponsorDeptId !== undefined) validations.push(!eventData.sponsorDeptId || validateObjectId(eventData.sponsorDeptId));
  if (eventData.locationId !== undefined) validations.push(!eventData.locationId || validateObjectId(eventData.locationId));
  if (eventData.locationText !== undefined) validations.push(!eventData.locationText || validateString(eventData.locationText, 0, 200));
  if (eventData.startsAt !== undefined) validations.push(validateDate(eventData.startsAt));
  if (eventData.endsAt !== undefined) validations.push(validateDate(eventData.endsAt));
  if (eventData.expectedAttendees !== undefined) validations.push(!eventData.expectedAttendees || validateNumber(eventData.expectedAttendees, 0));
  if (eventData.attendanceMode !== undefined) validations.push(['in-person', 'virtual', 'hybrid'].includes(eventData.attendanceMode));
  if (eventData.status !== undefined) validations.push(['draft', 'pending_approval', 'scheduled', 'in_delivery', 'completed', 'cancelled'].includes(eventData.status));
  
  return validations.every(Boolean);
};

const validateUpdateEventTask = (taskData) => {
  if (!taskData || typeof taskData !== 'object') return false;
  
  const validations = [];
  
  if (taskData.status !== undefined) validations.push(['pending', 'in-progress', 'completed', 'cancelled'].includes(taskData.status));
  if (taskData.assignedTo !== undefined) validations.push(!taskData.assignedTo || validateObjectId(taskData.assignedTo));
  if (taskData.assignedRole !== undefined) validations.push(!taskData.assignedRole || ['it-team', 'facilities-team', 'catering-team', 'security-team', 'av-team', 'general-staff'].includes(taskData.assignedRole));
  if (taskData.dueDate !== undefined) validations.push(validateDate(taskData.dueDate));
  if (taskData.notes !== undefined) validations.push(!taskData.notes || validateString(taskData.notes, 0, 1000));
  
  return validations.every(Boolean);
};

const validateApproveEvent = (approvalData) => {
  if (!approvalData || typeof approvalData !== 'object') return true; // Optional data
  
  return (!approvalData.notes || validateString(approvalData.notes, 0, 1000));
};

const validateRejectEvent = (rejectionData) => {
  if (!rejectionData || typeof rejectionData !== 'object') return false;
  
  return validateString(rejectionData.reason, 1, 500) &&
         (!rejectionData.notes || validateString(rejectionData.notes, 0, 1000));
};

// Export validation functions
module.exports = {
  validateCreateEvent,
  validateUpdateEvent,
  validateUpdateEventTask,
  validateApproveEvent,
  validateRejectEvent,
  validateObjectId,
  validateDate,
  validateString,
  validateNumber,
  validateBoolean,
  validateArray
};
