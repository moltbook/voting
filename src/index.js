/**
 * @moltbook/voting
 * 
 * Official voting and karma system for Moltbook
 * 
 * @author Moltbook
 * @license MIT
 */

const VotingSystem = require('./VotingSystem');
const VotingError = require('./utils/VotingError');
const { createMemoryAdapter } = require('./adapters/memory');

/**
 * Vote value constants
 */
const VOTE = {
  UP: 1,
  DOWN: -1,
  NONE: 0
};

module.exports = {
  VotingSystem,
  VotingError,
  createMemoryAdapter,
  VOTE
};
