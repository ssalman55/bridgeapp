/**
 * Validates an email address format
 * @param {string} email - The email address to validate
 * @returns {boolean} - True if email is valid, false otherwise
 */
exports.validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates a phone number format
 * @param {string} phone - The phone number to validate
 * @returns {boolean} - True if phone number is valid, false otherwise
 */
exports.validatePhone = (phone) => {
  // Basic phone validation - can be enhanced based on specific requirements
  const phoneRegex = /^\+?[\d\s-]{10,}$/;
  return phoneRegex.test(phone);
};

/**
 * Validates a password strength
 * @param {string} password - The password to validate
 * @returns {Object} - Object containing validation result and message
 */
exports.validatePassword = (password) => {
  if (password.length < 8) {
    return {
      isValid: false,
      message: 'Password must be at least 8 characters long'
    };
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
    return {
      isValid: false,
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    };
  }

  return {
    isValid: true,
    message: 'Password meets requirements'
  };
}; 