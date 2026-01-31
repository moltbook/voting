/**
 * Custom error class for voting-related errors
 */
class VotingError extends Error {
  /**
   * Create a VotingError
   * 
   * @param {string} message - Error message
   * @param {string} code - Error code
   */
  constructor(message, code) {
    super(message);
    this.name = 'VotingError';
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = VotingError;
